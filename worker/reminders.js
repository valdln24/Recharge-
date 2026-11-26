// Recharge · email de rappel la veille de la fin de l'essai (J-1)
// Lancé chaque heure par Cloudflare (voir "triggers" dans wrangler.jsonc).
// Pour chaque compte dont l'essai finit dans les 26 prochaines heures et qui n'a pas encore été prévenu :
// - on revérifie chez Stripe (essai toujours en cours, pas déjà annulé, date de fin exacte) ;
// - on envoie un email : date et montant du premier prélèvement, ce que Recharge a fait pendant l'essai,
//   et un lien pour annuler en 1 clic ;
// - on note l'envoi pour ne jamais l'envoyer deux fois.
// Aucun secret ici : STRIPE_SECRET_KEY et RESEND_API_KEY sont des secrets Cloudflare.
import { stripe } from "./billing.js";

const WINDOW = 26 * 3600 * 1000;   // « la veille » : entre 26 h et 0 h avant la fin de l'essai

const eur = cents => (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
const day = ms => new Date(ms).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
const esc = s => String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

async function gunzip(bytes) {
  const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(ds).text();
}

/* Ce que Recharge a fait pendant l'essai, lu dans la sauvegarde du compte (si elle existe) */
export function recap(data, sinceMs) {
  if (!data || typeof data !== "object") return null;
  const since = new Date(sinceMs).toISOString().slice(0, 10);
  const real = x => x && !x.example;
  const clients = (data.clients || []).filter(real).length;
  const relances = (data.events || []).filter(e => real(e) && e.type === "relance" && String(e.date || "") >= since).length;
  const sales = (data.sales || []).filter(s => real(s) && String(s.date || "") >= since);
  const ca = sales.reduce((t, s) => t + (+s.price || 0) * (+s.qty || 1), 0);
  return { clients, relances, ventes: sales.length, ca: Math.round(ca) };
}

/* Confirmation d'abonnement, envoyée une seule fois au retour du paiement (support durable : offre, prix, date, annulation) */
export function welcomeEmail({ endMs, amount, interval, tierName, origin }) {
  const per = interval === "year" ? "pour l'année" : "par mois", price = amount ? eur(amount) : "";
  const when = endMs && endMs > Date.now() ? day(endMs) : "";
  const subject = "Bienvenue sur Recharge : votre abonnement est confirmé";
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1a22;background:#f7f5f2">
    <p style="font-size:20px;font-weight:bold;margin:0 0 14px">Bienvenue sur Recharge 🎉</p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 14px">Votre abonnement <b>${esc(tierName)}</b> est confirmé${price ? ` : <b>${esc(price)} ${per}</b>` : ""}.</p>
    ${when ? `<p style="font-size:15px;line-height:1.5;margin:0 0 14px">Votre essai gratuit court jusqu'au <b>${esc(when)}</b>. Aucun prélèvement avant cette date, et nous vous prévenons par email la veille.</p>` : ""}
    <p style="font-size:15px;line-height:1.5;margin:0 0 20px">Chaque matin, ouvrez votre plan du jour : Recharge vous dit qui relancer, avec le message prêt.</p>
    <p style="margin:0 0 22px"><a href="${origin}/app/" style="display:inline-block;background:#1c1a22;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px">Ouvrir mon plan du jour</a></p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 22px;background:#fff;border:1px solid #e6ddd2;border-radius:14px;padding:14px 16px"><b>Installez Recharge sur votre téléphone</b> : elle s'ouvre en un geste depuis votre écran d'accueil, comme une appli. <a href="${origin}/app/#installer" style="color:#ff5e1f;font-weight:bold">Voir comment (30 secondes)</a></p>
    <p style="font-size:13px;color:#6b706e;line-height:1.5;margin:0">Sans engagement : annulez à tout moment en 1 clic depuis l'appli (Menu › Mon abonnement) ou ici : ${origin}/app/#gerer. Si vous avez souscrit en tant que particulier, vous disposez d'un droit de rétractation de 14 jours. Conditions de vente : ${origin}/cgv/</p></div>`;
  const text = `Bienvenue sur Recharge !\n\nVotre abonnement ${tierName} est confirmé${price ? ` : ${price} ${per}` : ""}.\n${when ? `Votre essai gratuit court jusqu'au ${when}. Aucun prélèvement avant cette date, et nous vous prévenons par email la veille.\n` : ""}\nOuvrir mon plan du jour : ${origin}/app/\n\nInstallez Recharge sur votre téléphone, pour l'ouvrir en un geste comme une appli : ${origin}/app/#installer\n\nSans engagement : annulez à tout moment en 1 clic depuis l'appli (Menu › Mon abonnement) ou ici : ${origin}/app/#gerer. Si vous avez souscrit en tant que particulier, vous disposez d'un droit de rétractation de 14 jours. Conditions de vente : ${origin}/cgv/`;
  return { subject, html, text };
}

export function reminderEmail({ name, endMs, amount, interval, origin, r }) {
  const when = day(endMs), price = eur(amount), per = interval === "year" ? "pour l'année" : "par mois";
  const manage = `${origin}/app/#gerer`;
  const lines = [];
  if (r && r.clients) lines.push(`${r.clients} client${r.clients > 1 ? "s" : ""} suivi${r.clients > 1 ? "s" : ""}`);
  if (r && r.relances) lines.push(`${r.relances} relance${r.relances > 1 ? "s" : ""} au bon moment`);
  if (r && r.ventes) lines.push(`${r.ventes} vente${r.ventes > 1 ? "s" : ""} enregistrée${r.ventes > 1 ? "s" : ""}${r.ca ? ` (${r.ca.toLocaleString("fr-FR")} €)` : ""}`);
  const hi = name ? `Bonjour ${esc(name)},` : "Bonjour,";
  const subject = `Votre essai Recharge se termine demain`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f5f2;font-family:Arial,Helvetica,sans-serif;color:#101312">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <p style="font-size:16px;line-height:1.5;margin:0 0 12px">${hi}</p>
    <p style="font-size:22px;font-weight:bold;line-height:1.3;margin:0 0 12px">Votre essai gratuit se termine demain.</p>
    <p style="font-size:16px;line-height:1.5;margin:0 0 20px">Sans action de votre part, votre abonnement commence <b>${esc(when)}</b> : <b>${esc(price)} ${per}</b>, prélevé sur la carte enregistrée.</p>
    ${lines.length ? `<div style="background:#fff;border:1px solid #e6ddd2;border-radius:16px;padding:16px 18px;margin:0 0 20px"><p style="font-size:14px;font-weight:bold;margin:0 0 8px">Pendant votre essai</p><ul style="margin:0;padding-left:18px;font-size:15px;line-height:1.6">${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul></div>` : ""}
    <p style="font-size:16px;line-height:1.5;margin:0 0 20px">Vous voulez continuer ? Vous n'avez rien à faire.</p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 10px">Vous préférez arrêter ? Annulez en 1 clic avant ${esc(when)} : vous ne payerez rien.</p>
    <p style="margin:0 0 24px"><a href="${manage}" style="display:inline-block;background:#1c1a22;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:999px">Gérer ou annuler mon abonnement</a></p>
    <p style="font-size:13px;color:#6b706e;line-height:1.5;margin:0">Vous pouvez aussi annuler depuis l'appli : Menu › Gérer mon abonnement. Si vous avez souscrit en tant que particulier, vous gardez votre droit de rétractation de 14 jours à compter de la souscription.</p>
  </div></body></html>`;
  const text = `${name ? `Bonjour ${name},` : "Bonjour,"}\n\nVotre essai gratuit Recharge se termine demain. Sans action de votre part, votre abonnement commence ${when} : ${price} ${per}, prélevé sur la carte enregistrée.\n${lines.length ? `\nPendant votre essai : ${lines.join(", ")}.\n` : ""}\nVous voulez continuer ? Vous n'avez rien à faire.\nVous préférez arrêter ? Annulez en 1 clic avant ${when}, vous ne payerez rien : ${manage}\n(ou dans l'appli : Menu › Gérer mon abonnement)`;
  return { subject, html, text };
}

export async function trialReminders(env) {
  if (!env.DB || !env.STRIPE_SECRET_KEY) return { sent: 0, skipped: "base ou Stripe non branché" };
  if (!env.RESEND_API_KEY) { console.log("rappel J-1 : RESEND_API_KEY absente, aucun email envoyé"); return { sent: 0, skipped: "Resend non branché" }; }
  const t = Date.now(), origin = env.APP_ORIGIN || "https://getrecharge.fr";
  const rows = (await env.DB.prepare("SELECT id, email, stripe_sub FROM users WHERE stripe_sub IS NOT NULL AND trial_end IS NOT NULL AND trial_reminded_at IS NULL AND trial_end > ? AND trial_end <= ? LIMIT 200")
    .bind(t, t + WINDOW).all()).results || [];
  let sent = 0;
  for (const u of rows) {
    try {
      const sub = await stripe(env, "GET", `subscriptions/${u.stripe_sub}`);
      const end = sub.trial_end ? sub.trial_end * 1000 : 0;
      // Plus en essai, ou déjà annulé : rien à rappeler
      if (sub.status !== "trialing" || sub.cancel_at_period_end || sub.cancel_at || !end) { await mark(env, u.id, end || null); continue; }
      // Date de fin changée chez Stripe (essai prolongé) : on la met à jour et on attend
      if (end - t > WINDOW) { await env.DB.prepare("UPDATE users SET trial_end = ? WHERE id = ?").bind(end, u.id).run(); continue; }
      const price = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price;
      if (!price || !price.unit_amount) continue;
      let r = null, name = "";
      try {
        const b = await env.DB.prepare("SELECT data FROM backups WHERE user_id = ?").bind(u.id).first();
        if (b && b.data) {
          const data = JSON.parse(await gunzip(new Uint8Array(b.data)));
          r = recap(data, sub.trial_start ? sub.trial_start * 1000 : end - 7 * 864e5);
          name = String((data.profile && data.profile.name) || (data.settings && data.settings.myName) || "").trim().split(/\s+/)[0].slice(0, 30);
        }
      } catch (e) { /* pas de récapitulatif : l'email part quand même */ }
      const mail = reminderEmail({ name, endMs: end, amount: price.unit_amount, interval: price.recurring && price.recurring.interval, origin, r });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [u.email], reply_to: env.EMAIL_REPLY_TO || undefined, subject: mail.subject, html: mail.html, text: mail.text })
      });
      if (!res.ok) { console.error("rappel J-1 : Resend", res.status, (await res.text()).slice(0, 200)); continue; }   // nouvel essai l'heure suivante
      await mark(env, u.id, end); sent++;
    } catch (e) { console.error("rappel J-1", e && e.message); }
  }
  return { sent, checked: rows.length };
}
const mark = (env, id, end) => env.DB.prepare("UPDATE users SET trial_reminded_at = ?, trial_end = COALESCE(?, trial_end) WHERE id = ?").bind(Date.now(), end, id).run();
