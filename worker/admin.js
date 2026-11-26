// Recharge · back-office (GET/POST /api/admin/...)
// Réservé aux adresses listées dans ADMIN_EMAILS (variable Cloudflare, séparées par des virgules).
// On se connecte comme dans l'appli (email + code) ; toute autre personne reçoit « Introuvable ».
// Chaque action qui change quelque chose exige une confirmation explicite et est notée dans admin_log.
// Aucun secret ici.

const DAY = 864e5;

export function isAdmin(env, email) {
  const list = String(env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(String(email).toLowerCase());
}

export async function adminRoute(p, m, request, env, url, h) {
  const { auth, json, HttpError, readJson } = h;
  const u = await auth(request, env);
  if (!isAdmin(env, u.email)) throw new HttpError(404, "Introuvable.");
  const now = Date.now();
  const log = (action, target, detail) => env.DB.prepare("INSERT INTO admin_log (at, admin, action, target, detail) VALUES (?, ?, ?, ?, ?)")
    .bind(Date.now(), u.email, action, target || null, detail ? String(detail).slice(0, 300) : null).run();
  const body = m === "POST" ? await readJson(request) : {};
  const email = String(body.email || "").trim().toLowerCase();
  const target = async () => {
    if (!email || email.length > 254) throw new HttpError(400, "Email manquant.");
    return await env.DB.prepare("SELECT id, email, plan, stripe_customer, stripe_sub, gift_until FROM users WHERE email = ?").bind(email).first();
  };
  const needConfirm = () => { if (body.confirm !== true) throw new HttpError(400, "Confirmation manquante."); };

  if (p === "/api/admin/me" && m === "GET") return json({ ok: true, email: u.email });

  if (p === "/api/admin/overview" && m === "GET") {
    const one = async (sql, ...b) => ((await env.DB.prepare(sql).bind(...b).first()) || {}).n || 0;
    const plans = (await env.DB.prepare("SELECT plan, COUNT(*) AS n FROM users GROUP BY plan").all()).results || [];
    const since = new Date(now - 30 * DAY).toISOString().slice(0, 10);
    const ev = (await env.DB.prepare("SELECT name, SUM(n) AS n FROM events_daily WHERE day >= ? GROUP BY name").bind(since).all()).results || [];
    let prospects = 0; try { prospects = await one("SELECT COUNT(*) AS n FROM prospects"); } catch { /* table absente */ }
    return json({
      users: await one("SELECT COUNT(*) AS n FROM users"),
      plans: Object.fromEntries(plans.map(r => [r.plan, r.n])),
      trials: await one("SELECT COUNT(*) AS n FROM users WHERE stripe_sub IS NOT NULL AND trial_end > ?", now),
      paying: await one("SELECT COUNT(*) AS n FROM users WHERE stripe_sub IS NOT NULL AND plan != 'free' AND (trial_end IS NULL OR trial_end <= ?)", now),
      offered: await one("SELECT COUNT(*) AS n FROM users WHERE plan = 'offert'"),
      new7: await one("SELECT COUNT(*) AS n FROM users WHERE created_at > ?", now - 7 * DAY),
      active7: await one("SELECT COUNT(*) AS n FROM users WHERE last_seen_at > ?", now - 7 * DAY),
      leads: await one("SELECT COUNT(*) AS n FROM leads"),
      prospects,
      events30: Object.fromEntries(ev.map(r => [r.name, r.n]))
    });
  }

  if (p === "/api/admin/users" && m === "GET") {
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 100), f = url.searchParams.get("f") || "";
    const where = [], b = [];
    if (q) { where.push("u.email LIKE ?"); b.push("%" + q.replace(/[%_]/g, "") + "%"); }
    if (f === "offert") where.push("u.plan = 'offert'");
    if (f === "free") where.push("u.plan = 'free'");
    if (f === "trial") { where.push("u.stripe_sub IS NOT NULL AND u.trial_end > ?"); b.push(now); }
    if (f === "paid") { where.push("u.stripe_sub IS NOT NULL AND u.plan != 'free' AND (u.trial_end IS NULL OR u.trial_end <= ?)"); b.push(now); }
    const rows = (await env.DB.prepare(
      "SELECT u.email, u.plan, u.tier, u.founder, u.created_at, u.last_seen_at, u.trial_end, u.stripe_customer, u.team_id, u.gift_until, u.gift_note, bk.size AS data_size, bk.updated_at AS data_at " +
      "FROM users u LEFT JOIN backups bk ON bk.user_id = u.id " + (where.length ? "WHERE " + where.join(" AND ") + " " : "") + "ORDER BY u.created_at DESC LIMIT 200"
    ).bind(...b).all()).results || [];
    return json({ users: rows });
  }

  if (p === "/api/admin/log" && m === "GET") {
    const rows = (await env.DB.prepare("SELECT at, admin, action, target, detail FROM admin_log ORDER BY at DESC LIMIT 100").all()).results || [];
    return json({ log: rows });
  }

  // Offrir un accès gratuit (à vie, ou jusqu'à une date). Crée le compte s'il n'existe pas.
  if (p === "/api/admin/gift" && m === "POST") {
    needConfirm();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, "Cette adresse email ne semble pas valide.");
    const until = body.until ? Date.parse(String(body.until) + "T23:59:59") : null;
    if (body.until && (!until || until < now)) throw new HttpError(400, "La date de fin doit être dans le futur.");
    const note = String(body.note || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 80);
    let t = await target();
    if (t && t.stripe_sub && t.plan !== "free") throw new HttpError(409, "Ce compte a déjà un abonnement payant : annulez-le d'abord dans Stripe si vous voulez l'offrir.");
    if (!t) {
      await env.DB.prepare("INSERT INTO users (id, email, plan, created_at, last_seen_at) VALUES (?, ?, 'free', ?, NULL)").bind(crypto.randomUUID(), email, now).run();
    }
    await env.DB.prepare("UPDATE users SET plan = 'offert', gift_until = ?, gift_note = ? WHERE email = ?").bind(until, note || null, email).run();
    await log("offrir", email, (until ? "jusqu'au " + new Date(until).toISOString().slice(0, 10) : "sans limite") + (note ? " · " + note : ""));
    let emailed = false;
    if (body.notify !== false) emailed = await giftEmail(env, url, email, until);
    return json({ ok: true, created: !t, emailed });
  }

  /* Équipes : la liste avec leur code (en cas de problème) et la création d'une équipe pour une tête de réseau */
  if (p === "/api/admin/teams" && m === "GET") {
    const rows = (await env.DB.prepare(
      "SELECT t.id, t.name, t.code, t.created_at, o.email AS owner, o.plan AS owner_plan, " +
      "(SELECT COUNT(*) FROM users x WHERE x.team_id = t.id) AS members, (SELECT COUNT(*) FROM users x WHERE x.team_id = t.id AND x.plan IN ('equipe','offert')) AS active " +
      "FROM teams t LEFT JOIN users o ON o.id = t.owner_id ORDER BY t.created_at DESC LIMIT 300").all()).results || [];
    const origin = env.APP_ORIGIN || url.origin;
    return json({ teams: rows.map(r => ({ ...r, link: `${origin}/app/?rejoindre=${r.code}` })) });
  }
  if (p === "/api/admin/team" && m === "POST") {
    needConfirm();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, "Cette adresse email ne semble pas valide.");
    const name = String(body.name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
    if (name.length < 2) throw new HttpError(400, "Donnez un nom à l'équipe.");
    let t = await target();
    if (!t) { await env.DB.prepare("INSERT INTO users (id, email, plan, created_at, last_seen_at) VALUES (?, ?, 'free', ?, NULL)").bind(crypto.randomUUID(), email, now).run(); t = await target(); }
    const teamId = await h.createTeam(env, t.id, name);
    if (body.giftOwner === true && !(t.stripe_sub && t.plan !== "free")) await env.DB.prepare("UPDATE users SET plan = 'offert', gift_note = COALESCE(gift_note, ?) WHERE id = ?").bind("tête de réseau", t.id).run();
    const team = await env.DB.prepare("SELECT name, code FROM teams WHERE id = ?").bind(teamId).first();
    await log("équipe", email, `${team.name} · code ${team.code}${body.giftOwner === true ? " · accès offert" : ""}`);
    return json({ ok: true, name: team.name, code: team.code, link: `${env.APP_ORIGIN || url.origin}/app/?rejoindre=${team.code}` });
  }

  if (p === "/api/admin/ungift" && m === "POST") {
    needConfirm();
    const t = await target();
    if (!t || t.plan !== "offert") throw new HttpError(400, "Ce compte n'a pas d'accès offert.");
    await env.DB.prepare("UPDATE users SET plan = 'free', gift_until = NULL WHERE id = ?").bind(t.id).run();
    await log("retirer l'accès offert", email);
    return json({ ok: true });
  }

  // Renvoyer un code de connexion à quelqu'un qui est bloqué
  if (p === "/api/admin/link" && m === "POST") {
    needConfirm();
    await h.requestLink(request, env, url, { email });
    await log("renvoyer un code", email);
    return json({ ok: true });
  }

  // Supprimer un compte et toutes ses données (droit à l'effacement)
  if (p === "/api/admin/delete" && m === "POST") {
    if (String(body.confirm || "").trim().toUpperCase() !== "SUPPRIMER") throw new HttpError(400, "Tapez SUPPRIMER pour confirmer.");
    const t = await target();
    if (!t) throw new HttpError(404, "Compte introuvable.");
    if (t.email === u.email) throw new HttpError(400, "Vous ne pouvez pas supprimer votre propre compte d'ici.");
    await h.deleteUserData(env, t);
    await log("supprimer le compte", email);
    return json({ ok: true });
  }

  throw new HttpError(404, "Introuvable.");
}

async function giftEmail(env, url, email, until) {
  if (!env.RESEND_API_KEY) return false;
  const origin = env.APP_ORIGIN || url.origin, link = `${origin}/app/#connexion`;
  const dur = until ? `jusqu'au ${new Date(until).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })}` : "sans limite de durée";
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f5f2;font-family:Arial,Helvetica,sans-serif;color:#101312">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <p style="font-size:22px;font-weight:bold;line-height:1.3;margin:0 0 12px">Un accès à Recharge vous est offert</p>
    <p style="font-size:16px;line-height:1.5;margin:0 0 20px">Vous avez accès à toute l'appli Recharge, gratuitement, ${dur}. Aucune carte bancaire n'est demandée.</p>
    <p style="font-size:16px;line-height:1.5;margin:0 0 8px"><b>Pour vous connecter :</b></p>
    <ol style="font-size:16px;line-height:1.6;margin:0 0 22px;padding-left:20px"><li>Appuyez sur le bouton ci-dessous.</li><li>Tapez cette adresse email : <b>${email.replace(/[<>&"]/g, "")}</b></li><li>Recopiez le code à 6 chiffres reçu par email.</li></ol>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#ff5e1f;color:#fff;text-decoration:none;font-weight:bold;font-size:17px;padding:14px 26px;border-radius:999px">Ouvrir Recharge</a></p>
    <p style="font-size:13px;color:#6b706e;line-height:1.5;margin:0">Vous n'attendiez pas cet email ? Ignorez-le simplement : rien ne se passe sans vous.</p>
  </div></body></html>`;
  const text = `Un accès à Recharge vous est offert, ${dur}, sans carte bancaire.\n\nPour vous connecter : ouvrez ${link}, tapez votre email (${email}), puis le code à 6 chiffres reçu par email.`;
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], reply_to: env.EMAIL_REPLY_TO || undefined, subject: "Un accès à Recharge vous est offert", html, text }) });
    if (!r.ok) { console.error("admin: email offert", r.status); return false; }
    return true;
  } catch (e) { return false; }
}
