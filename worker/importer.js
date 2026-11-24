// Recharge · l'import intelligent (POST /api/import)
// La vendeuse prend en photo son carnet, une capture Excel ou une capture du back-office de sa marque :
// l'IA lit les pages et renvoie la liste des clients et des ventes. Rien n'est enregistré côté serveur :
// les photos ne sont pas conservées, la liste revient au téléphone, où la vendeuse vérifie avant d'importer.
// Aucun secret ici : ANTHROPIC_API_KEY est un secret Cloudflare (Variables et secrets).
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const MAX_IMAGES = 6;                  // pages de carnet ou captures par import
const MAX_IMAGE = 2.4 * 1024 * 1024;   // par image (base64), déjà réduite par l'appli
const FREE_PER_MONTH = 5;              // imports par mois pendant l'essai (par téléphone)
const FREE_PER_IP = 15;                // garde-fou par connexion internet et par mois
const PER_HOUR = 20;                   // garde-fou par adresse IP et par heure
const hits = new Map();

class ImportError extends Error { constructor(status, message) { super(message); this.status = status; } }
const counter = (env, key) => env.QUOTA.get(env.QUOTA.idFromName(key));

const SYSTEM = `Tu lis des documents de vendeuses et vendeurs à domicile (VDI, vente directe) en France : pages de carnet écrites à la main, tableaux Excel, captures du back-office de leur marque, notes sur téléphone.
Ta mission : en sortir la liste de leurs clients et de leurs ventes, pour les importer dans leur appli de suivi.

Règles :
- Une ligne par achat : un client, un produit, une quantité, une date. Si un client a acheté 3 produits différents, fais 3 lignes.
- Si une page liste seulement des personnes (sans achat), fais une ligne par personne avec produit vide.
- Recopie les noms tels qu'ils sont écrits (prénom et nom si présents). Corrige seulement les fautes de lecture évidentes de l'écriture manuscrite.
- Rapproche les noms de produits de la liste des produits connus de la vendeuse quand c'est clairement le même produit ; sinon garde le nom lu.
- Dates au format AAAA-MM-JJ. Si l'année manque, prends la date passée la plus récente par rapport à aujourd'hui. Si une date est écrite une seule fois en haut d'un groupe de lignes, elle vaut pour tout le groupe. Si aucune date n'est lisible, laisse vide.
- Quantité : 1 par défaut.
- Téléphone : recopie-le s'il est écrit, sinon vide. Prix unitaire en euros s'il est écrit, sinon 0.
- N'invente jamais rien : ni nom, ni produit, ni date, ni numéro. Dans le doute sur un mot, recopie ce que tu lis et mets « doute » à vrai.
- Ignore les totaux, en-têtes, numéros de commande, statuts, adresses et tout ce qui n'est pas un client ou un achat.
- Dans « remarque », une phrase courte pour la vendeuse si quelque chose est illisible ou coupé (sinon vide).`;

const FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["lignes", "remarque"],
    properties: {
      lignes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["client", "telephone", "produit", "quantite", "date", "prix", "doute"],
          properties: {
            client: { type: "string", description: "Nom du client tel qu'écrit" },
            telephone: { type: "string", description: "Numéro s'il est écrit, sinon vide" },
            produit: { type: "string", description: "Produit acheté, vide si la ligne ne contient qu'une personne" },
            quantite: { type: "integer", description: "Quantité, 1 par défaut" },
            date: { type: "string", description: "AAAA-MM-JJ, vide si illisible ou absente" },
            prix: { type: "number", description: "Prix unitaire en euros, 0 si absent" },
            doute: { type: "boolean", description: "Vrai si un élément de la ligne est difficile à lire" }
          }
        }
      },
      remarque: { type: "string" }
    }
  }
};

function limit(ip) {
  const t = Date.now(), list = (hits.get(ip) || []).filter(x => t - x < 3600e3);
  if (list.length >= PER_HOUR) throw new ImportError(429, "Beaucoup d'imports cette heure-ci. Réessayez un peu plus tard.");
  list.push(t); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
}
const clean = (s, max = 200) => String(s || "").replace(/[\u0000-\u001f]/g, " ").slice(0, max);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));

export async function importDocs(request, env, plan = "free") {
  if (!env.ANTHROPIC_API_KEY) throw new ImportError(503, "La lecture intelligente n'est pas encore activée.");
  const ip = request.headers.get("CF-Connecting-IP") || "?";
  limit(ip);
  // Essai : 5 imports par mois · Starter : 3 par mois · Pro et Équipe : illimité
  const paid = plan && !["free", "starter"].includes(plan), cap = plan === "starter" ? 3 : FREE_PER_MONTH, month = new Date().toISOString().slice(0, 7);
  const device = (request.headers.get("X-Recharge-Device") || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
  let used = 0;
  if (!paid) {
    if (!device || !env.QUOTA) throw new ImportError(400, "Mettez l'appli à jour pour utiliser l'import.");
    used = await counter(env, "imp:d:" + device).peek(month);
    const ipUsed = await counter(env, "imp:ip:" + ip).peek(month);
    if (used >= cap || ipUsed >= FREE_PER_IP) throw new ImportError(402, `Vous avez utilisé vos ${cap} imports du mois. Avec l'offre Pro, l'import est illimité.`);
  }
  const len = +request.headers.get("Content-Length") || 0;
  if (len > MAX_IMAGES * MAX_IMAGE + 128 * 1024) throw new ImportError(413, "Les photos sont trop lourdes.");
  let body; try { body = await request.json(); } catch { throw new ImportError(400, "Demande illisible."); }
  const imgs = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  if (!imgs.length) throw new ImportError(400, "Ajoutez au moins une photo.");

  const content = [];
  imgs.forEach((src, i) => {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(src));
    if (!m || m[2].length > MAX_IMAGE) throw new ImportError(400, "Photo non reconnue (JPEG, PNG ou WebP).");
    if (imgs.length > 1) content.push({ type: "text", text: `Page ${i + 1} :` });
    content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  });
  const today = isDate(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const prods = (Array.isArray(body.products) ? body.products : []).slice(0, 80).map(p => clean(p, 80)).filter(Boolean);
  content.push({ type: "text", text: `Aujourd'hui : ${today}.\nMarque : ${clean(body.brand, 80) || "non précisée"}.\nProduits déjà connus de la vendeuse : ${prods.length ? prods.join(" ; ") : "aucun"}.\n\nLis ces documents et donne-moi la liste des clients et des achats.` });

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined });
  let res;
  try {
    // en flux : une longue liste (carnet de plusieurs pages) peut prendre du temps à écrire
    res = await client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: FORMAT },
      system: SYSTEM,
      messages: [{ role: "user", content }]
    }).finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new ImportError(429, "La lecture est très sollicitée. Réessayez dans une minute.");
    if (e instanceof Anthropic.AuthenticationError) { console.error("import: clé refusée"); throw new ImportError(503, "La lecture intelligente n'est pas encore activée."); }
    if (e instanceof Anthropic.BadRequestError) { console.error("import: requête refusée", e.message); throw new ImportError(400, "Ces photos n'ont pas pu être lues. Essayez avec une photo plus nette."); }
    if (e instanceof Anthropic.APIError) { console.error("import: API", e.status, e.message); throw new ImportError(502, "La lecture ne répond pas pour le moment. Réessayez dans un instant."); }
    throw e;
  }
  if (res.stop_reason === "refusal") throw new ImportError(422, "Ces photos n'ont pas pu être lues. Essayez avec d'autres photos.");
  let out; try { out = JSON.parse(res.content.filter(b => b.type === "text").map(b => b.text).join("")); } catch { throw new ImportError(502, "La lecture a échoué. Réessayez."); }
  const rows = (Array.isArray(out.lignes) ? out.lignes : []).slice(0, 500).map(r => ({
    name: clean(r.client, 80).trim(), phone: clean(r.telephone, 30).replace(/[^\d+ .]/g, "").trim(),
    product: clean(r.produit, 80).trim(), qty: Math.max(1, Math.min(99, parseInt(r.quantite, 10) || 1)),
    date: isDate(r.date) && r.date <= today ? r.date : "", price: Math.max(0, Math.min(5000, +r.prix || 0)), doubt: !!r.doute
  })).filter(r => r.name);
  // l'import n'est compté que s'il a donné quelque chose
  let left = null;
  if (!paid && rows.length) { const n = await counter(env, "imp:d:" + device).add(month); await counter(env, "imp:ip:" + ip).add(month); left = Math.max(0, cap - n); }
  return { rows, note: clean(out.remarque, 300), left };
}

export { ImportError };
