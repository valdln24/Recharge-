// Recharge · Lead magnet « Le Playbook de la vente directe »
// - POST /api/playbook : prénom + email (+ case marketing facultative, jamais précochée) → enregistre le prospect,
//   renvoie un lien de téléchargement personnel, et envoie le Playbook par email si l'envoi est configuré (Resend).
// - GET /playbook/telecharger?t=… : sert le PDF uniquement avec un lien valide (le fichier n'est pas en accès libre).
// - GET /api/playbook/desinscription?t=… : retire le consentement marketing en un clic.
// - GET/DELETE /api/admin/prospects : consultation, export CSV et suppression, réservés à la clé STATS_KEY.
// Aucun secret ici : RESEND_API_KEY et STATS_KEY sont des secrets Cloudflare (Variables et secrets).
import { sameKey } from "./util.js";

const PDF_PATH = "/playbook/le-playbook-de-la-vente-directe.pdf";
const PDF_NAME = "Le-Playbook-de-la-vente-directe-Recharge.pdf";
const PER_IP_HOUR = 8;            // inscriptions par adresse IP et par heure (anti-robots)
const MIN_FILL_MS = 1500;         // un humain met plus d'une seconde et demie à remplir le formulaire
const RESEND_AFTER = 10 * 60e3;   // pas de nouvel email au même prospect avant 10 minutes

class PlaybookError extends Error { constructor(status, message) { super(message); this.status = status; } }
export { PlaybookError };

const now = () => Date.now();
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
const cleanEmail = v => String(v || "").trim().toLowerCase();
const validEmail = e => e.length <= 254 && /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]{2,}$/.test(e) && !/\.\./.test(e);
const cleanName = v => String(v || "").replace(/[\u0000-\u001f<>"{}\[\]\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
const cleanSource = v => String(v || "site").toLowerCase().replace(/[^a-z0-9:_./-]/g, "").slice(0, 60) || "site";
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function token() { const b = crypto.getRandomValues(new Uint8Array(24)); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
const origin = (env, url) => env.APP_ORIGIN || url.origin;
const downloadUrl = (env, url, t) => `${origin(env, url)}/playbook/telecharger?t=${encodeURIComponent(t)}`;

/* Garde-fou anti-robots : un compteur par adresse IP et par heure (stockage Cloudflare du coach, déjà en place) */
async function ipLimit(env, ip) {
  if (!env.QUOTA) return;
  const stub = env.QUOTA.get(env.QUOTA.idFromName("pb:ip:" + ip)), hour = new Date().toISOString().slice(0, 13);
  if (await stub.peek(hour) >= PER_IP_HOUR) throw new PlaybookError(429, "Trop de demandes depuis cette connexion. Réessayez dans une heure.");
  await stub.add(hour);
}

export async function playbookSignup(request, env, url, ctx) {
  let body; try { body = JSON.parse(await request.text() || "{}"); } catch { throw new PlaybookError(400, "Demande illisible."); }
  // Robots : champ invisible rempli, ou formulaire envoyé trop vite → on répond comme si tout allait bien, sans rien enregistrer
  if (String(body.website || "").trim() || (Number(body.elapsed) || 0) < MIN_FILL_MS) return json({ ok: true, download: `${origin(env, url)}/#playbook`, emailed: false });
  const prenom = cleanName(body.prenom), email = cleanEmail(body.email);
  if (prenom.length < 1) throw new PlaybookError(400, "Indiquez votre prénom.");
  if (!validEmail(email)) throw new PlaybookError(400, "Cette adresse email ne semble pas valide.");
  const marketing = body.marketing === true, source = cleanSource(body.source);
  await ipLimit(env, request.headers.get("CF-Connecting-IP") || "?");

  const t = now();
  const prev = await env.DB.prepare("SELECT token, marketing, emailed_at FROM prospects WHERE email = ?").bind(email).first();
  let tok;
  if (prev) {
    // Même email : on met à jour la fiche existante (pas de doublon). Ne pas cocher la case n'efface pas un accord donné avant :
    // le retrait se fait par le lien de désinscription présent dans chaque email.
    tok = prev.token;
    await env.DB.prepare("UPDATE prospects SET prenom = ?, marketing = MAX(marketing, ?), marketing_at = CASE WHEN ? = 1 AND marketing = 0 THEN ? ELSE marketing_at END, updated_at = ? WHERE email = ?")
      .bind(prenom, marketing ? 1 : 0, marketing ? 1 : 0, t, t, email).run();
  } else {
    tok = token();
    await env.DB.prepare("INSERT INTO prospects (email, prenom, source, marketing, marketing_at, token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(email, prenom, source, marketing ? 1 : 0, marketing ? t : null, tok, t, t).run();
  }
  const link = downloadUrl(env, url, tok);
  // Envoi par email si Resend est configuré (sans faire attendre la personne)
  // On n'annonce « envoyé » que si l'envoi a vraiment réussi (attente de 6 secondes au plus)
  let emailed = false;
  if (env.RESEND_API_KEY && (!prev || !prev.emailed_at || t - prev.emailed_at > RESEND_AFTER)) {
    const send = sendPlaybookEmail(env, url, email, prenom, link, tok, marketing || (prev && prev.marketing))
      .then(async () => { await env.DB.prepare("UPDATE prospects SET emailed_at = ? WHERE email = ?").bind(now(), email).run(); return true; })
      .catch(e => { console.error("playbook email", e && e.message); return false; });
    if (ctx && ctx.waitUntil) ctx.waitUntil(send);
    emailed = await Promise.race([send, new Promise(r => setTimeout(() => r(false), 6000))]);
  } else if (prev && prev.emailed_at) emailed = true;   // déjà envoyé il y a moins de 10 minutes
  return json({ ok: true, download: link, emailed });
}

async function sendPlaybookEmail(env, url, email, prenom, link, tok, marketing) {
  const unsub = `${origin(env, url)}/api/playbook/desinscription?t=${encodeURIComponent(tok)}`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#F4EFE8;font-family:Arial,Helvetica,sans-serif;color:#1C1A22">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border-radius:20px;padding:32px 28px">
      <p style="font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#C9541A;margin:0 0 10px">Votre guide gratuit</p>
      <p style="font-size:24px;font-weight:bold;line-height:1.25;margin:0 0 14px">Bonjour ${esc(prenom)}, voici votre Playbook de la vente directe</p>
      <p style="font-size:16px;line-height:1.55;margin:0 0 24px;color:#4A4652">13 pages de méthodes concrètes pour structurer votre portefeuille client, relancer au bon moment et développer vos commandes récurrentes. Le plan d'action sur 30 jours est à la page 12.</p>
      <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#FF782E;color:#1C1A22;text-decoration:none;font-weight:bold;font-size:17px;padding:15px 28px;border-radius:999px">Télécharger mon Playbook (PDF)</a></p>
      <p style="font-size:14px;line-height:1.5;color:#4A4652;margin:0">Bonne lecture,<br>L'équipe Recharge</p>
    </div>
    <p style="font-size:12px;line-height:1.55;color:#8A8592;margin:18px 6px 0">Vous recevez cet email parce que vous avez demandé le Playbook sur le site Recharge. Ce lien de téléchargement est personnel.
    ${marketing ? `Vous avez accepté de recevoir nos actualités : <a href="${unsub}" style="color:#8A8592">ne plus les recevoir</a>.` : "Vous n'êtes inscrit(e) à aucune lettre d'information."}
    Pour accéder à vos données ou les faire supprimer, répondez simplement à cet email.</p>
  </div></body></html>`;
  const text = `Bonjour ${prenom},\n\nVoici votre Playbook de la vente directe (PDF) :\n${link}\n\nBonne lecture,\nL'équipe Recharge\n\n` +
    `Vous recevez cet email parce que vous avez demandé le Playbook sur le site Recharge.${marketing ? `\nNe plus recevoir nos actualités : ${unsub}` : ""}\nPour accéder à vos données ou les faire supprimer, répondez à cet email.`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject: "Votre Playbook de la vente directe", html, text, reply_to: env.EMAIL_REPLY_TO || undefined,
      headers: marketing ? { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined })
  });
  if (!r.ok) throw new Error(`Resend ${r.status} ${await r.text()}`);
}

/* Le PDF : seulement avec un lien personnel valide. Sans lien, on renvoie vers le formulaire. */
export async function playbookDownload(request, env, url) {
  const t = String(url.searchParams.get("t") || "").slice(0, 64);
  const row = t && url.pathname === "/playbook/telecharger" ? await env.DB.prepare("SELECT email FROM prospects WHERE token = ?").bind(t).first() : null;
  if (!row) return Response.redirect(`${origin(env, url)}/#playbook`, 302);
  await env.DB.prepare("UPDATE prospects SET downloads = downloads + 1, last_download_at = ? WHERE token = ?").bind(now(), t).run();
  const file = await env.ASSETS.fetch(new Request(new URL(PDF_PATH, url.origin)));
  if (!file.ok) return new Response("Le Playbook est momentanément indisponible.", { status: 503 });
  const h = new Headers(file.headers);
  h.set("Content-Type", "application/pdf");
  h.set("Content-Disposition", `${url.searchParams.get("voir") ? "inline" : "attachment"}; filename="${PDF_NAME}"`);
  h.set("Cache-Control", "private, no-store");
  h.set("X-Robots-Tag", "noindex");
  return new Response(file.body, { status: 200, headers: h });
}

/* Désinscription en un clic (lien présent dans les emails) */
export async function playbookUnsubscribe(request, env, url) {
  const t = String(url.searchParams.get("t") || "").slice(0, 64);
  if (t) await env.DB.prepare("UPDATE prospects SET marketing = 0, marketing_at = ?, updated_at = ? WHERE token = ?").bind(now(), now(), t).run();
  if (request.method === "POST") return new Response(null, { status: 204 });
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Désinscription · Recharge</title></head>
<body style="margin:0;background:#F4EFE8;font-family:Arial,Helvetica,sans-serif;color:#1C1A22"><div style="max-width:460px;margin:12vh auto;padding:28px;background:#fff;border-radius:20px">
<h1 style="font-size:22px;margin:0 0 10px">C'est fait.</h1><p style="font-size:16px;line-height:1.5;color:#4A4652;margin:0 0 20px">Vous ne recevrez plus les actualités et communications commerciales de Recharge. Votre lien vers le Playbook reste valable.</p>
<a href="/" style="color:#C9541A;font-weight:bold">Retour au site</a></div></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/* ---------- Administration (clé STATS_KEY, même accès que le tableau de bord du parcours) ---------- */
function adminKey(request, env) {
  const key = request.headers.get("X-Stats-Key") || "";
  if (!env.STATS_KEY || key.length < 8 || !sameKey(key, env.STATS_KEY)) throw new PlaybookError(404, "Introuvable.");
}
export async function adminProspects(request, env, url, isAdminSession) {
  if (!isAdminSession) adminKey(request, env);   // clé STATS_KEY, ou session du back-office
  if (request.method === "DELETE") {
    let body = {}; try { body = JSON.parse(await request.text() || "{}"); } catch {}
    const email = cleanEmail(body.email);
    if (!validEmail(email)) throw new PlaybookError(400, "Email invalide.");
    const r = await env.DB.prepare("DELETE FROM prospects WHERE email = ?").bind(email).run();
    return json({ ok: true, deleted: (r.meta && r.meta.changes) || 0 });
  }
  const r = await env.DB.prepare("SELECT email, prenom, source, marketing, marketing_at, downloads, last_download_at, emailed_at, created_at FROM prospects ORDER BY created_at DESC LIMIT 5000").all();
  const rows = r.results || [];
  if (url.searchParams.get("format") === "csv") {
    const d = v => v ? new Date(v).toISOString().replace("T", " ").slice(0, 16) : "";
    const cell = v => { const s = String(v ?? ""); return /[";\n]|^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };
    const lines = [["Prénom", "Email", "Inscription", "Provenance", "Accord marketing", "Date accord", "Téléchargements", "Email envoyé"].join(";")]
      .concat(rows.map(x => [x.prenom, x.email, d(x.created_at), x.source, x.marketing ? "oui" : "non", d(x.marketing_at), x.downloads, d(x.emailed_at)].map(cell).join(";")));
    return new Response("﻿" + lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="prospects-playbook-${new Date().toISOString().slice(0, 10)}.csv"` } });
  }
  const total = rows.length, opt = rows.filter(x => x.marketing).length, dl = rows.filter(x => x.downloads > 0).length;
  return json({ total, marketing: opt, downloaded: dl, prospects: rows });
}
