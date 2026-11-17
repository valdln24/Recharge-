// Recharge · l'abonnement (Stripe).
// - Paiement sur la page sécurisée de Stripe (Checkout) : Recharge ne voit jamais la carte bancaire.
// - Après le paiement, la vendeuse est connectée directement (son compte = l'email donné à Stripe).
// - « Gérer mon abonnement » ouvre l'espace client Stripe (changer de carte, factures, résilier).
// - Le statut est revérifié chez Stripe au plus toutes les 12 h : pas de webhook à configurer.
// Aucun secret ici : STRIPE_SECRET_KEY est un secret Cloudflare (Variables et secrets).

export const PLANS = {
  month: { amount: 990, interval: "month", label: "Recharge · abonnement mensuel" },
  year: { amount: 9900, interval: "year", label: "Recharge · abonnement annuel" }
};
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
export async function checkout(env, origin, period, user) {
  const p = PLANS[period]; if (!p) throw new BillingError(400, "Formule inconnue.");
  const s = await stripe(env, "POST", "checkout/sessions", {
    mode: "subscription",
    locale: "fr",
    line_items: { 0: { quantity: 1, price_data: { currency: "eur", unit_amount: p.amount, recurring: { interval: p.interval }, product_data: { name: p.label } } } },
    subscription_data: { trial_period_days: user && user.stripe_sub ? undefined : TRIAL_DAYS },
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
  return { email, customer: typeof s.customer === "string" ? s.customer : s.customer && s.customer.id, sub: sub.id, userId: s.client_reference_id || null };
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
  if (u.plan_checked_at && Date.now() - u.plan_checked_at < RECHECK) return u.plan;
  try {
    const sub = await stripe(env, "GET", `subscriptions/${u.stripe_sub}`);
    const plan = ACTIVE.includes(sub.status) ? "recharge" : "free";
    await db.prepare("UPDATE users SET plan = ?, plan_checked_at = ? WHERE id = ?").bind(plan, Date.now(), u.id).run();
    return plan;
  } catch (e) { return u.plan; }   // Stripe injoignable : on garde le dernier statut connu
}

/* 5. Suppression du compte : l'abonnement s'arrête aussi, pour ne plus rien payer */
export async function cancelSub(env, u) {
  if (!u.stripe_sub || !env.STRIPE_SECRET_KEY) return;
  try { await stripe(env, "DELETE", `subscriptions/${u.stripe_sub}`); } catch (e) { console.error("Stripe: résiliation impossible", u.stripe_sub); }
}
