// Recharge · l'abonnement (Stripe).
// - Paiement sur la page sécurisée de Stripe (Checkout) : Recharge ne voit jamais la carte bancaire.
// - Après le paiement, la vendeuse est connectée directement (son compte = l'email donné à Stripe).
// - « Gérer mon abonnement » ouvre l'espace client Stripe (changer de carte, factures, résilier).
// - Le statut est revérifié chez Stripe au plus toutes les 12 h : pas de webhook à configurer.
// Aucun secret ici : STRIPE_SECRET_KEY est un secret Cloudflare (Variables et secrets).

/* Les offres (prix en centimes). Annuel = −25 % par rapport au mensuel.
   Prix fondateur : réservé aux 50 premiers abonnés, gardé tant que l'abonnement continue. */
export const TIERS = {
  starter: { name: "Starter", month: 990, year: 8900, founderMonth: 590, founderYear: 5900 },
  pro: { name: "Pro", month: 1990, year: 17900, founderMonth: 1190, founderYear: 11900 },
  // Équipe : prix PAR PERSONNE. Une tête de réseau crée l'équipe et paie sa part ; chaque filleul rejoint avec le code
  // de l'équipe et paie la sienne. Prévue à partir de 5 personnes (règle affichée, personne n'est bloqué en dessous).
  equipe: { name: "Équipe", month: 990, year: 8900, founderMonth: 790, founderYear: 7100, perPerson: true, minSeats: 5 }
};
/* Ancienne offre Équipe (cachée, jamais vendue : le paiement n'était pas encore branché) :
   39,90 €/mois pour 6 personnes payées par une seule, puis 7,90 € par personne. */
export const EXTRA_SEAT = { month: 790, year: 7100 };
export const FOUNDER_SLOTS = 50;
export const MAX_SEATS = 60;
export const TIER_KEYS = Object.keys(TIERS);
const TRIAL_DAYS = 14;
const RECHECK = 12 * 3600 * 1000;
const ACTIVE = ["active", "trialing", "past_due"];

class BillingError extends Error { constructor(status, message) { super(message); this.status = status; } }
export { BillingError };

/* Paramètres au format attendu par Stripe : line_items[0][price_data][currency]=eur … */
function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out); else out.append(key, String(v));
  }
  return out;
}
async function stripe(env, method, path, params) {
  if (!env.STRIPE_SECRET_KEY) throw new BillingError(503, "Le paiement n'est pas encore activé.");
  const base = env.STRIPE_API_BASE || "https://api.stripe.com";
  const q = method === "GET" && params ? "?" + form(params) : "";
  const r = await fetch(`${base}/v1/${path}${q}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2024-06-20" },
    body: method === "GET" ? undefined : form(params || {})
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("Stripe", path, r.status, data.error && data.error.message); throw new BillingError(502, "Le paiement ne répond pas pour le moment. Réessayez dans un instant."); }
  return data;
}

/* 1. Ouvrir la page de paiement */
export async function checkout(env, origin, offer, user, ref = {}) {
  const t = TIERS[offer.tier], period = offer.period === "year" ? "year" : "month";
  if (!t) throw new BillingError(400, "Offre inconnue.");
  const amount = offer.founder ? t[period === "year" ? "founderYear" : "founderMonth"] : t[period];
  const team = offer.tier === "equipe" ? (offer.teamName ? ` · ma part (équipe « ${offer.teamName} »)` : " · ma part") : "";
  const label = `Recharge ${t.name}${team}${offer.founder ? " · prix fondateur" : ""}`;
  const items = { 0: { quantity: 1, price_data: { currency: "eur", unit_amount: amount, recurring: { interval: period }, product_data: { name: label } } } };
  // team_code : l'équipe à rejoindre (filleul) ; team_name seul : l'équipe à créer (tête de réseau)
  const meta = { tier: offer.tier, founder: offer.founder ? 1 : 0, team_name: offer.teamName || "", team_code: offer.teamCode || "" };
  // Parrainage : +30 jours d'essai pour une invitée, +30 jours par mois gagné en tant que marraine
  const bonus = (ref.invited ? 30 : 0) + 30 * (ref.refMonths || 0);
  const s = await stripe(env, "POST", "checkout/sessions", {
    mode: "subscription",
    locale: "fr",
    line_items: items,
    subscription_data: { trial_period_days: user && user.stripe_sub ? undefined : TRIAL_DAYS + bonus, metadata: { ref_months: ref.refMonths || 0, ...meta } },
    metadata: meta,
    allow_promotion_codes: "true",
    customer: user && user.stripe_customer ? user.stripe_customer : undefined,
    customer_email: user && !user.stripe_customer ? user.email : undefined,
    client_reference_id: user ? user.id : undefined,
    success_url: `${origin}/app/?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/app/#abonnement`
  });
  return s.url;
}

/* 2. Au retour du paiement : vérifier chez Stripe, puis créer ou mettre à jour le compte */
export async function confirm(env, id) {
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(String(id || ""))) throw new BillingError(400, "Lien de paiement invalide.");
  const s = await stripe(env, "GET", `checkout/sessions/${id}`, { expand: { 0: "subscription" } });
  const sub = s.subscription;
  if (s.mode !== "subscription" || s.status !== "complete" || !sub || !ACTIVE.includes(sub.status)) throw new BillingError(402, "Le paiement n'est pas terminé.");
  const email = String((s.customer_details && s.customer_details.email) || s.customer_email || "").trim().toLowerCase();
  if (!email) throw new BillingError(400, "Email introuvable sur ce paiement.");
  const md = sub.metadata || {}, tier = TIERS[md.tier] ? md.tier : "pro";
  return { email, customer: typeof s.customer === "string" ? s.customer : s.customer && s.customer.id, sub: sub.id, userId: s.client_reference_id || null, refMonths: Math.max(0, +(md.ref_months || 0)),
    tier, founder: md.founder === "1" || md.founder === 1, teamName: String(md.team_name || "").slice(0, 60), teamCode: String(md.team_code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) };
}

/* 3. L'espace client Stripe : carte, factures, résiliation */
export async function portal(env, origin, user) {
  if (!user.stripe_customer) throw new BillingError(400, "Aucun abonnement sur ce compte.");
  const s = await stripe(env, "POST", "billing_portal/sessions", { customer: user.stripe_customer, return_url: `${origin}/app/` });
  return s.url;
}

/* 4. Le statut de l'abonnement, revérifié au plus toutes les 12 h */
export async function refreshPlan(env, db, u) {
  if (!u.stripe_sub || !env.STRIPE_SECRET_KEY) return u.plan;
  if (u.plan_checked_at && Date.now() - u.plan_checked_at < (env.PLAN_RECHECK_MS ? +env.PLAN_RECHECK_MS : RECHECK)) return u.plan;
  try {
    const sub = await stripe(env, "GET", `subscriptions/${u.stripe_sub}`);
    const plan = ACTIVE.includes(sub.status) ? (TIERS[u.tier] ? u.tier : "recharge") : "free";
    await db.prepare("UPDATE users SET plan = ?, plan_checked_at = ? WHERE id = ?").bind(plan, Date.now(), u.id).run();
    if (sub.status === "active") await rewardReferral(env, db, u.id);   // premier vrai paiement, après l'essai
    return plan;
  } catch (e) { return u.plan; }   // Stripe injoignable : on garde le dernier statut connu
}

/* Parrainage : au premier vrai paiement d'une invitée, sa marraine gagne 1 mois (plafond : 12 par an).
   Si la marraine est abonnée, le mois est déduit de sa prochaine facture (crédit Stripe) ;
   sinon il est mis de côté et ajouté à son essai quand elle s'abonnera. */
async function rewardReferral(env, db, userId) {
  try {
    const me = await db.prepare("SELECT referred_by, ref_rewarded_at FROM users WHERE id = ?").bind(userId).first();
    if (!me || !me.referred_by || me.ref_rewarded_at) return;
    const done = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND ref_rewarded_at > ?").bind(me.referred_by, Date.now() - 365 * 864e5).first();
    const upd = await db.prepare("UPDATE users SET ref_rewarded_at = ? WHERE id = ? AND ref_rewarded_at IS NULL").bind(Date.now(), userId).run();
    if (!upd.meta || !upd.meta.changes) return;                 // déjà récompensée (deux vérifications en même temps)
    if (done && done.n >= 12) return;                           // plafond annuel atteint pour la marraine
    const sp = await db.prepare("SELECT stripe_customer, stripe_sub FROM users WHERE id = ?").bind(me.referred_by).first();
    if (sp && sp.stripe_customer && sp.stripe_sub) {
      try {
        const sub = await stripe(env, "GET", `subscriptions/${sp.stripe_sub}`);
        const price = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price;
        if (ACTIVE.includes(sub.status) && price) {
          const amount = price.recurring && price.recurring.interval === "year" ? Math.round(price.unit_amount / 12) : price.unit_amount;
          await stripe(env, "POST", `customers/${sp.stripe_customer}/balance_transactions`, { amount: -amount, currency: "eur", description: "Parrainage Recharge : 1 mois offert" });
          return;
        }
      } catch (e) { console.error("parrainage: crédit Stripe impossible, mis de côté", e && e.message); }
    }
    await db.prepare("UPDATE users SET ref_pending = MIN(ref_pending + 1, 12) WHERE id = ?").bind(me.referred_by).run();
  } catch (e) { console.error("parrainage", e && e.message); }
}

/* 5. Suppression du compte : l'abonnement s'arrête aussi, pour ne plus rien payer */
export async function cancelSub(env, u) {
  if (!u.stripe_sub || !env.STRIPE_SECRET_KEY) return;
  try { await stripe(env, "DELETE", `subscriptions/${u.stripe_sub}`); } catch (e) { console.error("Stripe: résiliation impossible", u.stripe_sub); }
}
