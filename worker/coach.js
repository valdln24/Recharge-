// Recharge · le coach IA (POST /api/coach)
// La vendeuse pose une question ou envoie la capture d'une conversation avec un prospect ;
// le coach analyse et propose une réponse prête à envoyer, qu'elle peut modifier avant de l'utiliser.
// Aucun secret ici : ANTHROPIC_API_KEY est un secret Cloudflare (Variables et secrets).
// Rien n'est conservé : ni la capture, ni la conversation (pas d'écriture en base).
import Anthropic from "@anthropic-ai/sdk";
import { DurableObject } from "cloudflare:workers";

const FREE_PER_MONTH = 3;              // échanges gratuits par mois et par téléphone
const FREE_PER_IP = 12;                // garde-fou : par connexion internet et par mois, pour la version gratuite

/* Compteur d'échanges du mois, tenu par le serveur (un petit stockage Cloudflare, sans base à créer) */
export class Quota extends DurableObject {
  async peek(month) { return (await this.ctx.storage.get(month)) || 0; }
  async add(month) { const n = ((await this.ctx.storage.get(month)) || 0) + 1; await this.ctx.storage.put(month, n); return n; }
}
const counter = (env, key) => env.QUOTA.get(env.QUOTA.idFromName(key));

const MODEL = "claude-opus-5-5";
const MAX_IMAGE = 1.6 * 1024 * 1024;   // capture déjà réduite par l'appli (base64)
const MAX_TEXT = 4000;
const MAX_TURNS = 12;
const PER_HOUR = 30;                   // demandes par heure et par adresse IP (limite simple, par serveur)
const hits = new Map();

const SYSTEM = `Tu es « le coach Recharge », un coach commercial bienveillant pour les vendeuses et vendeurs à domicile (VDI, vente directe) en France.
Tu aides à prospecter, vendre, suivre, fidéliser et obtenir des recommandations, avec une approche humaine, jamais agressive.

Règles :
- Réponds en français, simplement, chaleureusement, sans jargon.
- N'invente jamais d'information sur une personne (prénom, achat, besoin, date). Si une information manque pour bien répondre, dis-le dans « manque ».
- Si une capture d'écran de conversation est fournie : lis l'échange, repère où en est la personne (curiosité, hésitation, objection prix, besoin de réfléchir, désintérêt…) et propose LA prochaine réponse à envoyer.
- Le message proposé doit être court (2 à 4 phrases), naturel, comme écrit par la vendeuse elle-même sur WhatsApp, sans pression ni fausse urgence, sans promesse de santé ou de résultat.
- Respecte un « non » : si la personne n'est pas intéressée, propose un message qui garde le lien sans insister.
- Respecte le tutoiement ou le vouvoiement indiqué.
- Pour une question générale (sans capture), donne un conseil concret et applicable tout de suite ; « message » peut alors contenir un exemple de message, ou rester vide.
- Ne recopie pas de numéros de téléphone ou d'adresses présents sur la capture.`;

const FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["analyse", "message", "conseil", "manque"],
    properties: {
      analyse: { type: "string", description: "Où en est la conversation ou la situation, en 1 à 3 phrases." },
      message: { type: "string", description: "Le message proposé, prêt à envoyer. Vide si aucun message n'est utile." },
      conseil: { type: "string", description: "Un conseil concret pour la suite, en 1 à 2 phrases." },
      manque: { type: "string", description: "Les informations qui manquent pour mieux répondre. Vide si rien ne manque." }
    }
  }
};

class CoachError extends Error { constructor(status, message) { super(message); this.status = status; } }

function limit(ip) {
  const t = Date.now(), list = (hits.get(ip) || []).filter(x => t - x < 3600e3);
  if (list.length >= PER_HOUR) throw new CoachError(429, "Vous avez beaucoup utilisé le coach cette heure-ci. Réessayez un peu plus tard.");
  list.push(t); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
}

function clean(s, max = MAX_TEXT) { return String(s || "").slice(0, max); }

export async function coach(request, env, plan = "free") {
  if (!env.ANTHROPIC_API_KEY) throw new CoachError(503, "Le coach IA n'est pas encore activé.");
  const ip = request.headers.get("CF-Connecting-IP") || "?";
  limit(ip);
  // Version gratuite : 3 échanges par mois. Abonnement : illimité.
  const paid = plan && !["free", "starter"].includes(plan), month = new Date().toISOString().slice(0, 7);
  const device = (request.headers.get("X-Recharge-Device") || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
  let used = 0;
  if (!paid) {
    if (!device || !env.QUOTA) throw new CoachError(400, "Mettez l'appli à jour pour utiliser le coach.");
    used = await counter(env, "d:" + device).peek(month);
    const ipUsed = await counter(env, "ip:" + ip).peek(month);
    if (used >= FREE_PER_MONTH || ipUsed >= FREE_PER_IP) throw new CoachError(402, `Vous avez utilisé vos ${FREE_PER_MONTH} échanges gratuits avec le coach ce mois-ci. Avec l'offre Pro, le coach est illimité.`);
  }
  const len = +request.headers.get("Content-Length") || 0;
  if (len > MAX_IMAGE + 64 * 1024) throw new CoachError(413, "La capture est trop lourde.");
  let body; try { body = await request.json(); } catch { throw new CoachError(400, "Demande illisible."); }

  const tone = body.tone === "vous" ? "vouvoiement" : "tutoiement";
  const ctx = `Contexte de la vendeuse : ${clean(body.myName, 60) ? "prénom " + clean(body.myName, 60) + ", " : ""}marque ${clean(body.brand, 80) || "non précisée"}, univers ${clean(body.univers, 120) || "non précisé"}, ${tone} avec ses clients.`;

  // historique court du chat (texte seulement) + la nouvelle demande (texte + capture éventuelle)
  const turns = Array.isArray(body.history) ? body.history.slice(-MAX_TURNS) : [];
  const messages = [];
  for (const h of turns) {
    const role = h.role === "assistant" ? "assistant" : "user";
    const text = clean(h.text); if (!text) continue;
    if (messages.length && messages[messages.length - 1].role === role) messages[messages.length - 1].content += "\n" + text;
    else messages.push({ role, content: text });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();
  const content = [];
  if (body.image) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image);
    if (!m || m[2].length > MAX_IMAGE) throw new CoachError(400, "Capture non reconnue (JPEG, PNG ou WebP).");
    content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  content.push({ type: "text", text: `${ctx}\n\n${clean(body.question) || "Voici la capture de ma conversation avec un prospect. Que dois-je lui répondre ?"}` });
  messages.push({ role: "user", content });

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined });
  let res;
  try {
    res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: FORMAT },
      system: SYSTEM,
      messages
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new CoachError(429, "Le coach est très sollicité. Réessayez dans une minute.");
    if (e instanceof Anthropic.AuthenticationError) { console.error("coach: clé refusée"); throw new CoachError(503, "Le coach IA n'est pas encore activé."); }
    if (e instanceof Anthropic.BadRequestError) { console.error("coach: requête refusée", e.message); throw new CoachError(400, "Le coach n'a pas pu lire cette demande. Essayez avec une autre capture."); }
    if (e instanceof Anthropic.APIError) { console.error("coach: API", e.status, e.message); throw new CoachError(502, "Le coach ne répond pas pour le moment. Réessayez dans un instant."); }
    throw e;
  }
  if (res.stop_reason === "refusal") return { analyse: "", message: "", conseil: "Je ne peux pas aider sur cette demande. Reformulez-la, ou envoyez une autre capture.", manque: "", left: paid ? null : FREE_PER_MONTH - used };
  // l'échange n'est compté qu'une fois la réponse obtenue
  let left = null;
  if (!paid) { const n = await counter(env, "d:" + device).add(month); await counter(env, "ip:" + ip).add(month); left = Math.max(0, FREE_PER_MONTH - n); }
  const text = res.content.filter(b => b.type === "text").map(b => b.text).join("");
  let out; try { out = JSON.parse(text); } catch { out = { analyse: "", message: "", conseil: text.slice(0, 1500), manque: "" }; }
  return { ...out, left };
}

export { CoachError };
