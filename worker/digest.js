// Recharge · l'email du matin : « aujourd'hui, 3 clients à relancer »
// Recharge est un site (pas d'appli installée) : l'email est le rappel quotidien qui marche partout.
// Lancé chaque heure par Cloudflare ; ne part qu'entre 8 h et 9 h (heure de Paris), au plus une fois par jour,
// seulement aux comptes abonnés (ou accès offert) qui ont vraiment quelque chose à faire ce jour-là.
// Rythme doux : tous les jours si la personne est venue ces 14 derniers jours, sinon le lundi seulement,
// et plus rien après 60 jours sans visite. Lien « ne plus recevoir » dans chaque email (et réglage dans l'appli).
// Aucun secret ici : RESEND_API_KEY est un secret Cloudflare.
const DAY = 864e5;
const esc = s => String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const PAID = ["recharge", "fondatrice", "equipe", "starter", "pro", "offert"];

function parisNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hourCycle: "h23" })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, monday: p.weekday === "Mon" };
}
const dd = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);   // a - b en jours (dates AAAA-MM-JJ)
async function gunzip(bytes) { return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text(); }

/* Ce que l'appli mettrait en haut du plan du jour : réponses à noter, puis produits qui arrivent à leur fin */
export function morningList(data, t) {
  if (!data || typeof data !== "object") return null;
  const clients = new Map((data.clients || []).filter(c => c && !c.example).map(c => [c.id, c]));
  const first = id => { const c = clients.get(id); return c && !c.noContact ? String(c.name || "").trim().split(/\s+/)[0].slice(0, 30) : ""; };
  const rd = (data.settings && +data.settings.relanceDays) || 5;
  const answers = [], due = [];
  for (const s of data.sales || []) {
    if (!s || s.example) continue;
    const n = first(s.clientId); if (!n) continue;
    if (s.status === "relance" && s.relancedAt && dd(t, s.relancedAt) >= 2 && dd(t, s.relancedAt) <= 45 && (!s.ansNext || s.ansNext <= t)) answers.push(n);
    else if (s.status === "open" && s.end && dd(s.end, t) <= rd && (!s.snooze || s.snooze <= t)) due.push({ n, p: String(s.product || "").slice(0, 40), late: dd(s.end, t) < 0 });
  }
  const seen = new Set(), relances = due.filter(x => !seen.has(x.n) && seen.add(x.n));
  const name = String((data.profile && data.profile.name) || (data.settings && data.settings.myName) || "").trim().split(/\s+/)[0].slice(0, 30);
  return { name, relances, answers: [...new Set(answers)] };
}

export function morningEmail({ name, relances, answers }, appUrl, offUrl) {
  const nR = relances.length, nA = answers.length;
  const subject = nR ? `Aujourd'hui : ${nR} client${nR > 1 ? "s" : ""} à relancer` : `${nA} réponse${nA > 1 ? "s" : ""} à noter dans Recharge`;
  const items = relances.slice(0, 5).map(x => `<li><b>${esc(x.n)}</b>${x.p ? ` · ${esc(x.p)}` : ""}${x.late ? " (déjà fini)" : ""}</li>`).join("") + (nR > 5 ? `<li>et ${nR - 5} autre${nR - 5 > 1 ? "s" : ""}</li>` : "");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f5f2;font-family:Arial,Helvetica,sans-serif;color:#101312">
  <div style="max-width:480px;margin:0 auto;padding:28px 20px">
    <p style="font-size:16px;margin:0 0 10px">${name ? `Bonjour ${esc(name)},` : "Bonjour,"}</p>
    ${nR ? `<p style="font-size:21px;font-weight:bold;line-height:1.3;margin:0 0 12px">${nR > 1 ? `${nR} clients arrivent` : "Un client arrive"} à la fin de leur produit.</p>
    <ul style="margin:0 0 14px;padding-left:18px;font-size:16px;line-height:1.7">${items}</ul>
    <p style="font-size:15px;line-height:1.5;margin:0 0 18px">Les messages sont déjà écrits : 2 minutes chacun.</p>` : ""}
    ${nA ? `<p style="font-size:15px;line-height:1.5;margin:0 0 18px">${nR ? "Et " : ""}${nA > 1 ? `${nA} personnes relancées attendent` : `${esc(answers[0])} attend`} votre réponse : ${nA > 1 ? "ont-elles" : "a-t-elle"} recommandé ? Un appui suffit, Recharge compte ce que vos relances rapportent.</p>` : ""}
    <p style="margin:0 0 26px"><a href="${appUrl}" style="display:inline-block;background:#ff5e1f;color:#fff;text-decoration:none;font-weight:bold;font-size:17px;padding:14px 26px;border-radius:999px">Ouvrir mon plan du jour</a></p>
    <p style="font-size:12px;color:#6b706e;line-height:1.5;margin:0">Vous recevez cet email les jours où Recharge a quelque chose pour vous. <a href="${offUrl}" style="color:#6b706e">Ne plus recevoir cet email</a></p>
  </div></body></html>`;
  const text = `${name ? `Bonjour ${name},` : "Bonjour,"}\n\n${nR ? `À relancer aujourd'hui : ${relances.slice(0, 5).map(x => x.n + (x.p ? ` (${x.p})` : "")).join(", ")}${nR > 5 ? "…" : ""}.\n` : ""}${nA ? `Réponses à noter : ${answers.slice(0, 5).join(", ")}.\n` : ""}\nOuvrir mon plan du jour : ${appUrl}\n\nNe plus recevoir cet email : ${offUrl}`;
  return { subject, html, text };
}

function randomKey() { const b = crypto.getRandomValues(new Uint8Array(18)); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

export async function morningDigest(env, force) {
  if (!env.DB || !env.RESEND_API_KEY) return { sent: 0, skipped: "base ou Resend non branché" };
  const P = parisNow(); if (!force && env.DIGEST_ANY_HOUR !== "true" && P.hour !== 8) return { sent: 0, skipped: "pas l'heure" };
  const t0 = Date.now(), origin = env.APP_ORIGIN || "https://getrecharge.fr";
  const rows = (await env.DB.prepare(
    `SELECT u.id, u.email, u.last_seen_at, u.digest_key, b.data FROM users u JOIN backups b ON b.user_id = u.id
     WHERE u.plan IN (${PAID.map(() => "?").join(",")}) AND u.digest_off IS NULL AND (u.digest_at IS NULL OR u.digest_at < ?)
       AND u.last_seen_at > ? LIMIT 300`).bind(...PAID, t0 - 20 * 3600e3, t0 - 60 * DAY).all()).results || [];
  let sent = 0;
  for (const u of rows) {
    try {
      const idle = t0 - (u.last_seen_at || 0);
      if (idle < 2 * 3600e3) continue;                 // déjà dans l'appli ce matin
      if (idle > 14 * DAY && !P.monday) continue;      // moins venue : le lundi seulement
      const list = morningList(JSON.parse(await gunzip(new Uint8Array(u.data))), P.date);
      if (!list || (!list.relances.length && !list.answers.length)) continue;   // rien à faire : pas d'email
      let key = u.digest_key; if (!key) { key = randomKey(); await env.DB.prepare("UPDATE users SET digest_key = ? WHERE id = ?").bind(key, u.id).run(); }
      const mail = morningEmail(list, `${origin}/app/`, `${origin}/api/digest/off?u=${encodeURIComponent(u.id)}&k=${encodeURIComponent(key)}`);
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [u.email], reply_to: env.EMAIL_REPLY_TO || undefined, subject: mail.subject, html: mail.html, text: mail.text,
          headers: { "List-Unsubscribe": `<${origin}/api/digest/off?u=${encodeURIComponent(u.id)}&k=${encodeURIComponent(key)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }) });
      if (!r.ok) { console.error("email du matin : Resend", r.status); continue; }
      await env.DB.prepare("UPDATE users SET digest_at = ? WHERE id = ?").bind(Date.now(), u.id).run(); sent++;
    } catch (e) { console.error("email du matin", e && e.message); }
  }
  return { sent, checked: rows.length };
}

/* Lien « ne plus recevoir » (sans connexion) : jeton aléatoire propre au compte, comparé en temps constant.
   GET affiche un bouton (les antivirus des messageries ouvrent parfois les liens tout seuls), POST coupe l'email. */
export async function digestOff(request, env, url, sameKey) {
  const id = String(url.searchParams.get("u") || "").slice(0, 64), k = String(url.searchParams.get("k") || "").slice(0, 64);
  const row = id && k ? await env.DB.prepare("SELECT digest_key FROM users WHERE id = ?").bind(id).first() : null;
  const ok = !!(row && row.digest_key && sameKey(k, row.digest_key));
  let body;
  if (!ok) body = `<p>Ce lien n'est plus valable. Vous pouvez couper l'email du matin dans Recharge : Menu › Rappels et appli.</p>`;
  else if (request.method === "POST") { await env.DB.prepare("UPDATE users SET digest_off = 1 WHERE id = ?").bind(id).run(); body = `<p>C'est noté : vous ne recevrez plus l'email du matin.</p><p>Vous pouvez le réactiver dans Recharge : Menu › Rappels et appli.</p>`; }
  else body = `<p>Ne plus recevoir l'email du matin de Recharge ?</p><form method="post"><button style="font:inherit;font-weight:bold;background:#1c1a22;color:#fff;border:0;border-radius:999px;padding:12px 22px">Oui, ne plus le recevoir</button></form>`;
  return new Response(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recharge</title><body style="font-family:Arial,sans-serif;background:#f7f5f2;color:#101312;padding:40px 20px;max-width:480px;margin:0 auto;font-size:18px;line-height:1.5">${body}<p><a href="/app/" style="color:#ff5e1f;font-weight:bold">Ouvrir Recharge</a></p></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
