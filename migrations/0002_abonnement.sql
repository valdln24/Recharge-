-- Recharge · phase 3 : abonnement Stripe rattaché au compte.
-- On ne garde que les identifiants Stripe (jamais de numéro de carte : le paiement se fait entièrement chez Stripe).

ALTER TABLE users ADD COLUMN stripe_customer TEXT;
ALTER TABLE users ADD COLUMN stripe_sub TEXT;
ALTER TABLE users ADD COLUMN plan_checked_at INTEGER;

-- Un paiement terminé ne sert qu'une fois à se connecter.
CREATE TABLE IF NOT EXISTS checkout_used (
  id       TEXT PRIMARY KEY,
  used_at  INTEGER NOT NULL
);
