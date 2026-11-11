// Recharge · serveur (Cloudflare Worker)
// - Sert le site et l'appli (dossier public/) via la liaison ASSETS.
// - API des comptes légers : connexion par lien envoyé par email (sans mot de passe), sauvegarde des données, suppression du compte.
// Aucun secret dans ce fichier : RESEND_API_KEY est un secret Cloudflare (Variables et secrets).

const LOGIN_TTL = 15 * 60 * 1000;              // un lien de connexion vaut 15 minutes
const SESSION_TTL = 180 * 24 * 3600 * 1000;     // une session vaut 180 jours (prolongée à l'usage)
const MAX_BACKUP = 4 * 1024 * 1024;             // 4 Mo de données (non compressées) au maximum
const MAX_LINKS_PER_HOUR = 5;                   // limite d'envois de liens par adresse email

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      const res = await route(request, env, url, ctx);
      res.headers.set("Cache-Control", "no-store");
      res.headers.set("X-Content-Type-Options", "nosniff");
      return res;
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error("API", url.pathname, e && e.stack || e);   // visible dans Cloudflare › Observabilité
      return json({ error: "Une erreur est survenue. Réessayez dans un instant." }, 500);
    }
  }
};

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

async function route(request, env, url, ctx) {
  const m = request.method, p = url.pathname;
  if (!env.DB) throw new HttpError(503, "La base de données n'est pas encore branchée.");
  // Même origine uniquement pour les écritures (protection contre les requêtes d'autres sites)
  if (m !== "GET") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) throw new HttpError(403, "Origine refusée.");
  }
  if (p === "/api/auth/request" && m === "POST") return requestLink(request, env, url);
  if (p === "/api/auth/verify" && m === "POST") return verifyLink(request, env);
  if (p === "/api/auth/logout" && m === "POST") return logout(request, env);
  if (p === "/api/me" && m === "GET") return me(request, env);
  if (p === "/api/data" && m === "GET") return getData(request, env);
  if (p === "/api/data" && m === "PUT") return putData(request, env);
  if (p === "/api/account" && m === "DELETE") return deleteAccount(request, env);
  throw new HttpError(404, "Introuvable.");
}

/* ---------- Outils ---------- */
const now = () => Date.now();
function randomToken(bytes = 32) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function readJson(request, max = 64 * 1024) {
  const len = +request.headers.get("Content-Length") || 0;
  if (len > max) throw new HttpError(413, "Données trop volumineuses.");
  const text = await request.text();
  if (text.length > max) throw new HttpError(413, "Données trop volumineuses.");
  try { return JSON.parse(text || "{}"); } catch { throw new HttpError(400, "Requête invalide."); }
}
const cleanEmail = v => String(v || "").trim().toLowerCase();
const validEmail = e => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

async function gzip(text) {
  const cs = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(cs).arrayBuffer());
}
async function gunzip(bytes) {
  const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(ds).text();
}

/* Session : jeton dans l'en-tête Authorization: Bearer … */
async function auth(request, env) {
  const h = request.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token || token.length > 200) throw new HttpError(401, "Connexion nécessaire.");
  const row = await env.DB.prepare(
    "SELECT s.token_hash, s.expires_at, u.id, u.email, u.plan, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?"
  ).bind(await sha256(token)).first();
  if (!row || row.expires_at < now()) throw new HttpError(401, "Votre connexion a expiré. Reconnectez-vous.");
  // Prolonge la session et note la dernière activité (au plus une fois par heure)
  if (row.expires_at - now() < SESSION_TTL - 3600 * 1000) {
    await env.DB.batch([
      env.DB.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").bind(now() + SESSION_TTL, row.token_hash),
      env.DB.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(now(), row.id)
    ]);
  }
  return { id: row.id, email: row.email, plan: row.plan, createdAt: row.created_at, tokenHash: row.token_hash };
}
const isPaid = u => ["recharge", "fondatrice", "equipe"].includes(u.plan);

/* ---------- Connexion par lien ---------- */
async function requestLink(request, env, url) {
  const body = await readJson(request);
  const email = cleanEmail(body.email);
  if (!validEmail(email)) throw new HttpError(400, "Cette adresse email ne semble pas valide.");
  const since = now() - 3600 * 1000;
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_tokens WHERE email = ? AND created_at > ?").bind(email, since).first();
  if (recent && recent.n >= MAX_LINKS_PER_HOUR) throw new HttpError(429, "Trop de demandes. Réessayez dans une heure.");
  const token = randomToken();
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  await env.DB.prepare("INSERT INTO login_tokens (token_hash, email, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256(token), email, await sha256(email + ":" + code), now(), now() + LOGIN_TTL).run();
  // Ménage : liens expirés depuis plus d'un jour
  await env.DB.prepare("DELETE FROM login_tokens WHERE expires_at < ?").bind(now() - 24 * 3600 * 1000).run();
  const origin = env.APP_ORIGIN || url.origin;
  const link = `${origin}/app/?login=${encodeURIComponent(token)}`;
  if (env.DEV_SHOW_LINK === "true") return json({ ok: true, devLink: link, devCode: code });
  await sendLoginEmail(env, email, link, code);
  return json({ ok: true });
}

async function sendLoginEmail(env, email, link, code) {
  if (!env.RESEND_API_KEY) throw new HttpError(503, "L'envoi d'emails n'est pas encore configuré.");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f5f2;font-family:Arial,Helvetica,sans-serif;color:#101312">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <p style="font-size:22px;font-weight:bold;margin:0 0 8px">Votre lien de connexion 🔑</p>
    <p style="font-size:16px;line-height:1.5;margin:0 0 24px">Appuyez sur le bouton pour ouvrir Recharge et retrouver vos clients. Ce lien est valable 15 minutes et ne sert qu'une fois.</p>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#ff5e1f;color:#fff;text-decoration:none;font-weight:bold;font-size:17px;padding:14px 26px;border-radius:999px">Ouvrir Recharge</a></p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 6px">Ou tapez ce code dans l'appli :</p>
    <p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:0 0 24px">${code}</p>
    <p style="font-size:13px;color:#6b706e;line-height:1.5;margin:0">Vous n'avez rien demandé ? Ignorez simplement cet email : personne ne peut se connecter sans ce lien.</p>
  </div></body></html>`;
  const text = `Votre lien de connexion à Recharge (valable 15 minutes, une seule fois) :\n${link}\n\nOu tapez ce code dans l'appli : ${code}\n\nVous n'avez rien demandé ? Ignorez cet email.`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject: `${code} : votre code de connexion à Recharge`, html, text })
  });
  if (!r.ok) {
    console.error("Resend", r.status, await r.text());
    throw new HttpError(502, "L'email n'a pas pu partir. Réessayez dans un instant.");
  }
}

async function verifyLink(request, env) {
  const body = await readJson(request);
  let h, row;
  if (body.code) {
    // Connexion par code à 6 chiffres (5 essais au maximum par code)
    const email = cleanEmail(body.email), code = String(body.code).replace(/\D/g, "");
    if (!validEmail(email) || code.length !== 6) throw new HttpError(400, "Code invalide.");
    const cand = await env.DB.prepare("SELECT token_hash, code_hash, email, expires_at, used_at, attempts FROM login_tokens WHERE email = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1").bind(email, now()).first();
    if (!cand) throw new HttpError(400, "Ce code a expiré. Demandez un nouveau lien.");
    if (cand.code_hash !== await sha256(email + ":" + code)) {
      const used = cand.attempts + 1 >= 5 ? now() : null;
      await env.DB.prepare("UPDATE login_tokens SET attempts = attempts + 1, used_at = ? WHERE token_hash = ?").bind(used, cand.token_hash).run();
      throw new HttpError(400, used ? "Trop d'essais. Demandez un nouveau lien." : "Ce code n'est pas le bon. Vérifiez votre email.");
    }
    h = cand.token_hash; row = cand;
  } else {
    const token = String(body.token || "");
    if (!token || token.length > 200) throw new HttpError(400, "Lien invalide.");
    h = await sha256(token);
    row = await env.DB.prepare("SELECT email, expires_at, used_at FROM login_tokens WHERE token_hash = ?").bind(h).first();
  }
  if (!row || row.used_at) throw new HttpError(400, "Ce lien a déjà servi ou n'est pas valide. Demandez-en un nouveau.");
  if (row.expires_at < now()) throw new HttpError(400, "Ce lien a expiré (15 minutes). Demandez-en un nouveau.");
  // Lien à usage unique : on le marque d'abord (seule la première requête passe)
  const upd = await env.DB.prepare("UPDATE login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL").bind(now(), h).run();
  if (!upd.meta || !upd.meta.changes) throw new HttpError(400, "Ce lien a déjà servi. Demandez-en un nouveau.");
  let user = await env.DB.prepare("SELECT id, email, plan, created_at FROM users WHERE email = ?").bind(row.email).first();
  let isNew = false;
  if (!user) {
    user = { id: crypto.randomUUID(), email: row.email, plan: "free", created_at: now() };
    await env.DB.prepare("INSERT INTO users (id, email, plan, created_at, last_seen_at) VALUES (?, ?, 'free', ?, ?)").bind(user.id, user.email, user.created_at, now()).run();
    isNew = true;
  }
  const session = randomToken();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(session), user.id, now(), now() + SESSION_TTL).run();
  const b = await env.DB.prepare("SELECT rev, updated_at FROM backups WHERE user_id = ?").bind(user.id).first();
  return json({ session, isNew, user: publicUser(user, env), backup: b ? { rev: b.rev, updatedAt: b.updated_at } : null });
}
const publicUser = (u, env) => ({ email: u.email, plan: u.plan, createdAt: u.created_at ?? u.createdAt, canSync: env.REQUIRE_PAID !== "true" || isPaid(u) });

async function logout(request, env) {
  const u = await auth(request, env);
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(u.tokenHash).run();
  return json({ ok: true });
}

async function me(request, env) {
  const u = await auth(request, env);
  const b = await env.DB.prepare("SELECT rev, size, updated_at FROM backups WHERE user_id = ?").bind(u.id).first();
  return json({ user: publicUser(u, env), backup: b ? { rev: b.rev, size: b.size, updatedAt: b.updated_at } : null });
}

/* ---------- Sauvegarde ---------- */
async function getData(request, env) {
  const u = await auth(request, env);
  const b = await env.DB.prepare("SELECT data, rev, updated_at FROM backups WHERE user_id = ?").bind(u.id).first();
  if (!b) return json({ data: null, rev: 0 });
  const bytes = b.data instanceof ArrayBuffer ? new Uint8Array(b.data) : new Uint8Array(b.data);
  return json({ data: JSON.parse(await gunzip(bytes)), rev: b.rev, updatedAt: b.updated_at });
}

async function putData(request, env) {
  const u = await auth(request, env);
  if (env.REQUIRE_PAID === "true" && !isPaid(u)) throw new HttpError(402, "La sauvegarde est incluse dans la version complète.");
  const body = await readJson(request, MAX_BACKUP + 2048);
  const data = body.data;
  if (!data || typeof data !== "object" || !Array.isArray(data.clients) || !Array.isArray(data.sales)) throw new HttpError(400, "Sauvegarde invalide.");
  const baseRev = Number.isInteger(body.baseRev) ? body.baseRev : -1;
  const cur = await env.DB.prepare("SELECT rev FROM backups WHERE user_id = ?").bind(u.id).first();
  // Un autre téléphone a sauvegardé entre-temps : on ne l'écrase pas sans le demander
  if (cur && baseRev !== cur.rev && !body.force) return json({ conflict: true, rev: cur.rev }, 409);
  const text = JSON.stringify(data);
  if (text.length > MAX_BACKUP) throw new HttpError(413, "Vos données dépassent 4 Mo. Contactez-nous.");
  const gz = await gzip(text), rev = (cur ? cur.rev : 0) + 1, device = String(body.device || "").slice(0, 60);
  await env.DB.prepare(
    "INSERT INTO backups (user_id, data, size, rev, device, updated_at) VALUES (?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, size = excluded.size, rev = excluded.rev, device = excluded.device, updated_at = excluded.updated_at"
  ).bind(u.id, gz, text.length, rev, device, now()).run();
  return json({ ok: true, rev, updatedAt: now() });
}

/* ---------- Supprimer le compte et toutes les données ---------- */
async function deleteAccount(request, env) {
  const u = await auth(request, env);
  const body = await readJson(request);
  if (String(body.confirm || "").trim().toUpperCase() !== "SUPPRIMER") throw new HttpError(400, "Tapez SUPPRIMER pour confirmer.");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM backups WHERE user_id = ?").bind(u.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id),
    env.DB.prepare("DELETE FROM login_tokens WHERE email = ?").bind(u.email),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(u.id)
  ]);
  return json({ ok: true });
}
