// Recharge · serveur (Cloudflare Worker)
// - Sert le site et l'appli (dossier public/) via la liaison ASSETS.
// - API des comptes légers : connexion par lien envoyé par email (sans mot de passe), sauvegarde des données, suppression du compte.
// - Coach IA (worker/coach.js) : analyse une question ou une capture et propose une réponse.
// Aucun secret dans ce fichier : RESEND_API_KEY et ANTHROPIC_API_KEY sont des secrets Cloudflare (Variables et secrets).

import { coach, CoachError, Quota } from "./coach.js";
import { TIERS, EXTRA_SEAT, FOUNDER_SLOTS, MAX_SEATS } from "./billing.js";
import { importDocs, ImportError } from "./importer.js";
import { playbookSignup, playbookDownload, playbookUnsubscribe, adminProspects, PlaybookError } from "./playbook.js";
import { Store, storeDb } from "./store.js";
import { sameKey } from "./util.js";
import { checkout, confirm, portal, refreshPlan, cancelSub, BillingError } from "./billing.js";
export { Quota, Store };

const LOGIN_TTL = 15 * 60 * 1000;              // un lien de connexion vaut 15 minutes
const SESSION_TTL = 180 * 24 * 3600 * 1000;     // une session vaut 180 jours (prolongée à l'usage)
const MAX_BACKUP = 4 * 1024 * 1024;             // 4 Mo de données (non compressées) au maximum
const MAX_LINKS_PER_HOUR = 5;                   // limite d'envois de liens par adresse email

// Adresse où renvoyer la vendeuse (lien de connexion, retour de paiement) : celle sur laquelle elle travaille déjà,
// car ses données sont gardées dans le navigateur, à cette adresse précise. Exception : api. et www. renvoient
// vers l'adresse publique (APP_ORIGIN). Les liens à partager (parrainage, équipe, Playbook) utilisent toujours APP_ORIGIN.
const sameOrigin = (env, url) => /^(api|www)\./.test(url.hostname) ? (env.APP_ORIGIN || url.origin) : url.origin;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isPlaybook = url.pathname.startsWith("/playbook/");
    if (!url.pathname.startsWith("/api/") && !isPlaybook) return env.ASSETS.fetch(request);
    // Pas de base D1 branchée : les comptes vivent dans le stockage Cloudflare créé automatiquement
    if (!env.DB && env.STORE) env = { ...env, DB: storeDb(env) };
    // Le Playbook PDF : uniquement avec un lien de téléchargement personnel
    if (isPlaybook) { try { return env.DB ? await playbookDownload(request, env, url) : Response.redirect(url.origin + "/", 302); } catch (e) { console.error("playbook", e && e.message); return new Response("Le Playbook est momentanément indisponible.", { status: 503 }); } }
    try {
      const res = await route(request, env, url, ctx);
      res.headers.set("Cache-Control", "no-store");
      res.headers.set("X-Content-Type-Options", "nosniff");
      return res;
    } catch (e) {
      if (e instanceof HttpError || e instanceof CoachError || e instanceof ImportError || e instanceof BillingError || e instanceof PlaybookError) return json({ error: e.message }, e.status);
      console.error("API", url.pathname, e && e.stack || e);   // visible dans Cloudflare › Observabilité
      return json({ error: "Une erreur est survenue. Réessayez dans un instant." }, 500);
    }
  }
};

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

async function route(request, env, url, ctx) {
  const m = request.method, p = url.pathname;
  if (p === "/api/health") return json({ ok: true, accounts: !!env.DB && (!!env.RESEND_API_KEY || env.DEV_SHOW_LINK === "true"), billing: !!env.DB && !!env.STRIPE_SECRET_KEY, coach: !!env.ANTHROPIC_API_KEY });
  if (p === "/api/coach" && m === "POST") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) throw new HttpError(403, "Origine refusée.");
    let plan = "free";
    if (env.DB && (request.headers.get("Authorization") || "").startsWith("Bearer ")) { try { plan = (await auth(request, env)).plan || "free"; } catch { /* non connecté : version gratuite */ } }
    return json(await coach(request, env, plan));
  }
  if (p === "/api/import" && m === "POST") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) throw new HttpError(403, "Origine refusée.");
    let plan = "free";
    if (env.DB && (request.headers.get("Authorization") || "").startsWith("Bearer ")) { try { plan = (await auth(request, env)).plan || "free"; } catch { /* non connecté : essai */ } }
    return json(await importDocs(request, env, plan));
  }
  if (!env.DB) throw new HttpError(503, "La base de données n'est pas encore branchée.");
  // Même origine uniquement pour les écritures (protection contre les requêtes d'autres sites)
  if (m !== "GET") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) throw new HttpError(403, "Origine refusée.");
  }
  if (p === "/api/event" && m === "POST") return trackEvent(request, env);
  if (p === "/api/playbook" && m === "POST") return playbookSignup(request, env, url, ctx);
  if (p === "/api/playbook/desinscription" && (m === "GET" || m === "POST")) return playbookUnsubscribe(request, env, url);
  if (p === "/api/admin/prospects" && (m === "GET" || m === "DELETE")) return adminProspects(request, env, url);
  if (p === "/api/lead" && m === "POST") return saveLead(request, env, url);
  if (p === "/api/stats" && m === "GET") return stats(request, env);
  if (p === "/api/referral" && m === "GET") return referral(request, env, url);
  if (p === "/api/auth/request" && m === "POST") return requestLink(request, env, url);
  if (p === "/api/auth/verify" && m === "POST") return verifyLink(request, env);
  if (p === "/api/auth/logout" && m === "POST") return logout(request, env);
  if (p === "/api/me" && m === "GET") return me(request, env);
  if (p === "/api/data" && m === "GET") return getData(request, env);
  if (p === "/api/data" && m === "PUT") return putData(request, env);
  if (p === "/api/account" && m === "DELETE") return deleteAccount(request, env);
  if (p === "/api/billing/checkout" && m === "POST") return billingCheckout(request, env, url);
  if (p === "/api/offers" && m === "GET") return offers(env);
  if (p === "/api/team" && m === "GET") return teamInfo(request, env, url);
  if (p === "/api/team/join" && m === "POST") return teamJoin(request, env);
  if (p === "/api/team/leave" && m === "POST") return teamLeave(request, env);
  if (p === "/api/team/remove" && m === "POST") return teamRemove(request, env);
  if (p === "/api/billing/confirm" && m === "POST") return billingConfirm(request, env);
  if (p === "/api/billing/portal" && m === "POST") return billingPortal(request, env, url);
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
    "SELECT s.token_hash, s.expires_at, u.id, u.email, u.plan, u.created_at, u.stripe_customer, u.stripe_sub, u.plan_checked_at, u.tier, u.founder, u.team_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?"
  ).bind(await sha256(token)).first();
  if (!row || row.expires_at < now()) throw new HttpError(401, "Votre connexion a expiré. Reconnectez-vous.");
  // Prolonge la session et note la dernière activité (au plus une fois par heure)
  if (row.expires_at - now() < SESSION_TTL - 3600 * 1000) {
    await env.DB.batch([
      env.DB.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").bind(now() + SESSION_TTL, row.token_hash),
      env.DB.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(now(), row.id)
    ]);
  }
  // Équipe : chaque membre a son propre abonnement (sa part). Être dans une équipe ne donne plus accès à lui seul.
  const plan = await refreshPlan(env, env.DB, row);
  return { id: row.id, email: row.email, plan, createdAt: row.created_at, tokenHash: row.token_hash, stripe_customer: row.stripe_customer, stripe_sub: row.stripe_sub, tier: row.tier, founder: !!row.founder, team_id: row.team_id };
}
const isPaid = u => ["recharge", "fondatrice", "equipe", "starter", "pro"].includes(u.plan);

/* ---------- Connexion par lien ---------- */
async function requestLink(request, env, url, given) {
  const body = given || await readJson(request);
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
  const origin = sameOrigin(env, url);
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
    await attachReferrer(env, user.id, body.ref);
  }
  return json(await openSession(env, user, isNew));
}
async function openSession(env, user, isNew) {
  const session = randomToken();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(session), user.id, now(), now() + SESSION_TTL).run();
  const b = await env.DB.prepare("SELECT rev, updated_at FROM backups WHERE user_id = ?").bind(user.id).first();
  return { session, isNew, user: publicUser(user, env), backup: b ? { rev: b.rev, updatedAt: b.updated_at } : null, analyse: await leadAnalyse(env, user.email) };
}
async function leadAnalyse(env, email) {
  try { const l = await env.DB.prepare("SELECT analyse FROM leads WHERE email = ?").bind(email).first(); return l && l.analyse ? JSON.parse(l.analyse) : null; } catch { return null; }
}
const publicUser = (u, env) => ({ email: u.email, plan: u.plan, paid: isPaid(u), billing: !!u.stripe_customer, founder: !!u.founder, team: !!u.team_id, createdAt: u.created_at ?? u.createdAt, canSync: env.REQUIRE_PAID !== "true" || isPaid(u) });

async function logout(request, env) {
  const u = await auth(request, env);
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(u.tokenHash).run();
  return json({ ok: true });
}

async function me(request, env) {
  const u = await auth(request, env);
  const b = await env.DB.prepare("SELECT rev, size, updated_at FROM backups WHERE user_id = ?").bind(u.id).first();
  const analyse = await leadAnalyse(env, u.email);
  return json({ user: publicUser(u, env), backup: b ? { rev: b.rev, size: b.size, updatedAt: b.updated_at } : null, analyse });
}

/* ---------- Parrainage ----------
   Chaque compte a un code personnel. Une personne qui crée son compte avec ce code est rattachée à sa marraine
   (uniquement à la création : on ne peut pas se rattacher après coup, ni à soi-même).
   La récompense (1 mois chacune) est donnée au premier vrai paiement de l'invitée : voir billing.js. */
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // sans 0/O ni 1/I/L, pour éviter les confusions
const cleanRef = v => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
async function attachReferrer(env, userId, ref) {
  const code = cleanRef(ref); if (code.length < 4) return;
  try {
    const r = await env.DB.prepare("SELECT id FROM users WHERE ref_code = ?").bind(code).first();
    if (r && r.id !== userId) await env.DB.prepare("UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL").bind(r.id, userId).run();
  } catch (e) { console.error("parrainage", e && e.message); }
}
async function referral(request, env, url) {
  const u = await auth(request, env);
  let row = await env.DB.prepare("SELECT ref_code, ref_pending FROM users WHERE id = ?").bind(u.id).first();
  let code = row && row.ref_code;
  if (!code) {
    const base = (u.email.split("@")[0] || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || "RECH";
    for (let k = 0; k < 6 && !code; k++) {
      const rnd = [...crypto.getRandomValues(new Uint8Array(Math.max(3, 7 - base.length)))].map(b => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
      const cand = base + rnd;
      const taken = await env.DB.prepare("SELECT 1 AS x FROM users WHERE ref_code = ?").bind(cand).first();
      if (!taken) { await env.DB.prepare("UPDATE users SET ref_code = ? WHERE id = ? AND ref_code IS NULL").bind(cand, u.id).run(); code = cand; }
    }
    row = await env.DB.prepare("SELECT ref_code, ref_pending FROM users WHERE id = ?").bind(u.id).first(); code = row && row.ref_code;
  }
  const inv = await env.DB.prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN ref_rewarded_at IS NOT NULL THEN 1 ELSE 0 END) AS paid FROM users WHERE referred_by = ?").bind(u.id).first();
  const origin = env.APP_ORIGIN || url.origin;
  return json({ code, link: `${origin}/?parrain=${code}`, invited: (inv && inv.n) || 0, paid: (inv && inv.paid) || 0, pending: (row && row.ref_pending) || 0, cap: 12 });
}

/* ---------- Mesure anonyme du parcours ----------
   Un compteur par jour et par étape. Aucun cookie, aucune adresse IP, aucun identifiant : on sait combien de
   personnes passent chaque étape, jamais qui. Les noms d'étapes sont limités à une liste connue. */
const EVENTS = new Set(["site_visite", "analyse_cta", "analyse_debut", "analyse_q1", "analyse_q2", "analyse_q3", "analyse_q4", "analyse_equipe", "analyse_resultat", "valeur_vue", "paywall_vu", "paywall_paiement", "paywall_plus_tard",
  "analyse_reseau", "analyse_coach", "analyse_email", "analyse_essai", "parrain_visite", "parrainage_ouvert", "parrainage_partage", "app_ouverte", "app_depuis_analyse", "onboarding_fin", "premiers_clients", "premiere_relance", "compte_cree", "saisie_phrase", "playbook_vue", "playbook_ouvert", "playbook_ferme", "playbook_inscrit", "playbook_telecharge"]);
async function trackEvent(request, env) {
  const body = await readJson(request, 1024);
  const name = String(body.e || "");
  if (!EVENTS.has(name)) return new Response(null, { status: 204 });
  const day = new Date().toISOString().slice(0, 10);
  try {
    await env.DB.prepare("INSERT INTO events_daily (day, name, n) VALUES (?, ?, 1) ON CONFLICT(day, name) DO UPDATE SET n = n + 1").bind(day, name).run();
  } catch (e) { console.error("event", e && e.message); }
  return new Response(null, { status: 204 });
}
/* Tableau de bord du parcours : réservé à la personne qui connaît STATS_KEY (secret Cloudflare). */
async function stats(request, env) {
  const key = request.headers.get("X-Stats-Key") || "";
  if (!env.STATS_KEY || key.length < 8 || !sameKey(key, env.STATS_KEY)) throw new HttpError(404, "Introuvable.");
  const since = new Date(now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const r = await env.DB.prepare("SELECT day, name, n FROM events_daily WHERE day >= ? ORDER BY day").bind(since).all();
  const leads = await env.DB.prepare("SELECT COUNT(*) AS n, SUM(news) AS news FROM leads").first();
  const users = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
  let prospects = { n: 0, marketing: 0 }; try { prospects = await env.DB.prepare("SELECT COUNT(*) AS n, SUM(marketing) AS marketing FROM prospects").first() || prospects; } catch { /* table absente */ }
  return json({ since, events: r.results || [], leads: leads || { n: 0, news: 0 }, users: users ? users.n : 0, prospects });
}

/* ---------- Analyse gratuite : sauvegarde avec l'email ----------
   La personne garde ses résultats et reçoit son lien d'accès. On ne stocke que ses réponses aux questions. */
async function saveLead(request, env, url) {
  const body = await readJson(request, 8 * 1024);
  const email = cleanEmail(body.email);
  if (!validEmail(email)) throw new HttpError(400, "Cette adresse email ne semble pas valide.");
  const a = body.analyse && typeof body.analyse === "object" ? body.analyse : {};
  const keep = {};
  for (const k of ["clients", "cat", "catLabel", "dorm", "pains", "renouv", "panier", "duree", "semaine", "valClient", "revenus", "reveilAn", "nouveaux", "resAn", "totalAn", "prio", "fois", "at"]) if (a[k] !== undefined) keep[k] = typeof a[k] === "number" ? a[k] : Array.isArray(a[k]) ? a[k].slice(0, 8).map(x => String(x).slice(0, 30)) : String(a[k]).slice(0, 40);
  await env.DB.prepare("INSERT INTO leads (email, analyse, news, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET analyse = excluded.analyse, news = MAX(news, excluded.news), updated_at = excluded.updated_at")
    .bind(email, JSON.stringify(keep), body.news ? 1 : 0, now(), now()).run();
  return requestLink(request, env, url, { email });
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
  await cancelSub(env, u);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM backups WHERE user_id = ?").bind(u.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id),
    env.DB.prepare("DELETE FROM login_tokens WHERE email = ?").bind(u.email),
    env.DB.prepare("DELETE FROM leads WHERE email = ?").bind(u.email),
    env.DB.prepare("DELETE FROM prospects WHERE email = ?").bind(u.email),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(u.id)
  ]);
  return json({ ok: true });
}

/* ---------- Abonnement (Stripe) ---------- */
async function optionalUser(request, env) {
  if (!(request.headers.get("Authorization") || "").startsWith("Bearer ")) return null;
  try { return await auth(request, env); } catch { return null; }
}
async function billingCheckout(request, env, url) {
  const body = await readJson(request);
  const u = await optionalUser(request, env);
  if (u && isPaid(u)) throw new HttpError(400, "Votre abonnement est déjà actif.");
  // Parrainage : 1 mois de plus d'essai pour une invitée, et les mois gagnés par une marraine qui s'abonne
  let refMonths = 0, invited = false;
  if (u && !u.stripe_sub) {
    try { const r = await env.DB.prepare("SELECT referred_by, ref_pending FROM users WHERE id = ?").bind(u.id).first(); invited = !!(r && r.referred_by); refMonths = Math.min(12, (r && r.ref_pending) || 0); } catch { /* colonnes absentes : pas de parrainage */ }
  }
  const tier = TIERS[body.tier] ? body.tier : "pro";
  let teamName = String(body.teamName || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
  const teamCode = String(body.teamCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (tier === "equipe" && teamCode) {
    // Un filleul paie sa part pour rejoindre une équipe existante
    const t = await env.DB.prepare("SELECT id, name, owner_id FROM teams WHERE code = ?").bind(teamCode).first();
    if (!t) throw new HttpError(404, "Ce code d'équipe n'existe pas. Vérifiez-le avec votre tête de réseau.");
    if (u && u.team_id && u.team_id !== t.id) throw new HttpError(409, "Vous faites déjà partie d'une autre équipe.");
    if (u && t.owner_id === u.id) throw new HttpError(400, "C'est votre propre équipe : partagez ce code avec vos filleuls.");
    teamName = t.name;
  } else if (tier === "equipe" && teamName.length < 2) throw new HttpError(400, "Donnez un nom à votre équipe.");
  if (u && u.team_id && tier !== "equipe") throw new HttpError(400, "Vous faites partie d'une équipe : choisissez l'offre Équipe pour payer votre part.");
  const founder = (await founderLeft(env)) > 0;
  // Version des CGV/CGU acceptée (case cochée dans l'appli juste avant le paiement), gardée comme preuve dans Stripe
  const cgv = String(body.cgv || "").replace(/[^0-9a-z.-]/gi, "").slice(0, 20);
  const offer = { tier, period: body.period === "year" ? "year" : "month", teamName, teamCode: tier === "equipe" ? teamCode : "", founder, cgv };
  return json({ url: await checkout(env, sameOrigin(env, url), offer, u, { invited, refMonths }) });
}
/* Prix fondateur : les 50 premiers comptes abonnés (un abonnement arrêté libère la place) */
async function founderLeft(env) {
  try { const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE founder = 1 AND plan != 'free'").first(); return Math.max(0, FOUNDER_SLOTS - ((r && r.n) || 0)); }
  catch { return 0; }
}
async function offers(env) {
  return json({ founderLeft: await founderLeft(env), founderTotal: FOUNDER_SLOTS, tiers: TIERS, extraSeat: EXTRA_SEAT, billing: !!env.STRIPE_SECRET_KEY });
}
/* ---------- Équipe ----------
   La tête de réseau crée l'équipe (son nom) en payant sa part, et reçoit un code à partager.
   Chaque filleul paie sa propre part en entrant ce code : Recharge le rattache à l'équipe.
   L'offre est prévue à partir de 5 personnes : en dessous, la tête de réseau voit combien il en manque (personne n'est bloqué). */
const TEAM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const teamCode = () => { const b = crypto.getRandomValues(new Uint8Array(8)); return Array.from(b, x => TEAM_ALPHABET[x % TEAM_ALPHABET.length]).join(""); };
async function createTeam(env, ownerId, name) {
  const ex = await env.DB.prepare("SELECT id FROM teams WHERE owner_id = ?").bind(ownerId).first();
  if (ex) { await env.DB.prepare("UPDATE teams SET seats = ?, name = COALESCE(NULLIF(?, ''), name) WHERE id = ?").bind(MAX_SEATS, name, ex.id).run(); return ex.id; }
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO teams (id, name, owner_id, seats, code, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, name || "Mon équipe", ownerId, MAX_SEATS, teamCode(), now()),
    env.DB.prepare("UPDATE users SET team_id = ? WHERE id = ?").bind(id, ownerId)
  ]);
  return id;
}
async function teamInfo(request, env, url) {
  const u = await auth(request, env);
  if (!u.team_id) return json({ team: null });
  const t = await env.DB.prepare("SELECT id, name, owner_id, code FROM teams WHERE id = ?").bind(u.team_id).first();
  if (!t) return json({ team: null });
  const owner = t.owner_id === u.id, min = TIERS.equipe.minSeats;
  const members = await env.DB.prepare("SELECT id, email, plan FROM users WHERE team_id = ? ORDER BY created_at").bind(t.id).all();
  const list = (members.results || []).map(x => ({ email: x.email, me: x.id === u.id, owner: x.id === t.owner_id, active: x.plan === "equipe" }));
  const paying = list.filter(x => x.active).length;
  return json({ team: { name: t.name, min, used: paying, missing: Math.max(0, min - paying), owner, active: u.plan === "equipe",
    code: t.code, link: `${env.APP_ORIGIN || url.origin}/app/?rejoindre=${t.code}`, members: owner ? list : undefined } });
}
/* Rejoindre avec un code : il faut payer sa part. Seul un compte qui a déjà une part Équipe active (sans équipe) est rattaché directement. */
async function teamJoin(request, env) {
  const u = await auth(request, env), body = await readJson(request);
  const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const t = code ? await env.DB.prepare("SELECT id, name FROM teams WHERE code = ?").bind(code).first() : null;
  if (!t) throw new HttpError(404, "Ce code d'équipe n'existe pas. Vérifiez-le avec votre tête de réseau.");
  if (u.team_id === t.id) return json({ ok: true, name: t.name });
  if (u.team_id) throw new HttpError(409, "Vous faites déjà partie d'une autre équipe.");
  if (u.stripe_sub && u.plan === "equipe") {
    await env.DB.prepare("UPDATE users SET team_id = ? WHERE id = ?").bind(t.id, u.id).run();
    return json({ ok: true, name: t.name });
  }
  if (u.stripe_sub && isPaid(u)) throw new HttpError(409, "Vous avez déjà un abonnement à votre nom : résiliez-le d'abord (Menu › Mon compte), puis rejoignez l'équipe.");
  return json({ ok: false, pay: true, name: t.name });
}
/* Quitter ou être retiré : la part de ce membre s'arrête aussi, pour qu'il ne paie plus rien */
async function teamLeave(request, env) {
  const u = await auth(request, env), body = await readJson(request);
  // Action sensible (arrête un abonnement) : validation explicite de la personne exigée
  if (body.confirm !== true) throw new HttpError(400, "Confirmez d'abord dans l'appli.");
  if (!u.team_id) return json({ ok: true });
  const t = await env.DB.prepare("SELECT owner_id FROM teams WHERE id = ?").bind(u.team_id).first();
  if (t && t.owner_id === u.id) throw new HttpError(400, "Vous gérez cette équipe : pour l'arrêter, résiliez votre abonnement.");
  if (u.plan === "equipe") await cancelSub(env, u);
  await env.DB.prepare("UPDATE users SET team_id = NULL, plan = 'free', stripe_sub = NULL WHERE id = ?").bind(u.id).run();
  return json({ ok: true });
}
async function teamRemove(request, env) {
  const u = await auth(request, env), body = await readJson(request);
  if (body.confirm !== true) throw new HttpError(400, "Confirmez d'abord dans l'appli.");   // arrête l'abonnement du membre
  const t = u.team_id ? await env.DB.prepare("SELECT id, owner_id FROM teams WHERE id = ?").bind(u.team_id).first() : null;
  if (!t || t.owner_id !== u.id) throw new HttpError(403, "Seule la tête de réseau peut retirer un membre.");
  const email = String(body.email || "").trim().toLowerCase();
  if (email === u.email) throw new HttpError(400, "Vous ne pouvez pas vous retirer vous-même.");
  const m = await env.DB.prepare("SELECT id, plan, stripe_sub FROM users WHERE team_id = ? AND email = ? AND id != ?").bind(t.id, email, u.id).first();
  if (!m) return json({ ok: true });
  if (m.plan === "equipe") await cancelSub(env, m);
  await env.DB.prepare("UPDATE users SET team_id = NULL, plan = 'free', stripe_sub = NULL WHERE id = ?").bind(m.id).run();
  return json({ ok: true });
}
async function billingConfirm(request, env) {
  const body = await readJson(request);
  const id = String(body.id || "");
  if (await env.DB.prepare("SELECT id FROM checkout_used WHERE id = ?").bind(id).first())
    throw new HttpError(400, "Ce paiement a déjà servi à vous connecter. Sur un autre téléphone, connectez-vous avec votre email.");
  const c = await confirm(env, id);
  // Le compte : celui de la vendeuse connectée au moment du paiement, sinon celui de cet email (créé au besoin)
  let user = c.userId ? await env.DB.prepare("SELECT id, email, plan, created_at FROM users WHERE id = ?").bind(c.userId).first() : null;
  if (!user) user = await env.DB.prepare("SELECT id, email, plan, created_at FROM users WHERE email = ?").bind(c.email).first();
  let isNew = false;
  if (!user) {
    user = { id: crypto.randomUUID(), email: c.email, created_at: now() };
    await env.DB.prepare("INSERT INTO users (id, email, plan, created_at, last_seen_at) VALUES (?, ?, 'recharge', ?, ?)").bind(user.id, user.email, user.created_at, now()).run();
    isNew = true;
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET plan = ?, tier = ?, founder = ?, stripe_customer = ?, stripe_sub = ?, plan_checked_at = ?, ref_pending = MAX(0, ref_pending - ?) WHERE id = ?").bind(c.tier, c.tier, c.founder ? 1 : 0, c.customer, c.sub, now(), c.refMonths || 0, user.id),
    env.DB.prepare("INSERT INTO checkout_used (id, used_at) VALUES (?, ?)").bind(id, now())
  ]);
  let teamId = null;
  if (c.tier === "equipe" && c.teamCode) {
    const t = await env.DB.prepare("SELECT id FROM teams WHERE code = ?").bind(c.teamCode).first();
    if (t) { teamId = t.id; await env.DB.prepare("UPDATE users SET team_id = ? WHERE id = ?").bind(t.id, user.id).run(); }
  } else if (c.tier === "equipe") teamId = await createTeam(env, user.id, c.teamName);
  user = { ...user, plan: c.tier, stripe_customer: c.customer, founder: c.founder, team_id: teamId };
  return json({ ...(await openSession(env, user, isNew)), trialEnd: c.trialEnd });
}
async function billingPortal(request, env, url) {
  const u = await auth(request, env);
  return json({ url: await portal(env, sameOrigin(env, url), u) });
}
