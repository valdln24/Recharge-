-- Recharge · parrainage : un code personnel par compte, et qui a invité qui.
-- Règle : quand une personne invitée paie son premier mois (après l'essai), l'invitée et la marraine gagnent chacune 1 mois.
-- Plafond : 12 mois gagnés par an et par marraine.

ALTER TABLE users ADD COLUMN ref_code TEXT;              -- code personnel (ex. « LAURA7K »), créé à la première ouverture du parrainage
ALTER TABLE users ADD COLUMN referred_by TEXT;           -- id du compte qui a invité (uniquement à la création du compte)
ALTER TABLE users ADD COLUMN ref_rewarded_at INTEGER;    -- date à laquelle cette invitée a déclenché la récompense (une seule fois)
ALTER TABLE users ADD COLUMN ref_pending INTEGER NOT NULL DEFAULT 0;   -- mois gagnés pas encore appliqués à un abonnement
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ref_code ON users(ref_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
