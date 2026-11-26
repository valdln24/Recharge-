-- Rappel la veille de la fin de l'essai (worker/reminders.js)
ALTER TABLE users ADD COLUMN trial_end INTEGER;          -- fin de l'essai Stripe (ms), notée au retour du paiement
ALTER TABLE users ADD COLUMN trial_reminded_at INTEGER;  -- date d'envoi du rappel J-1 (un seul envoi)
CREATE INDEX IF NOT EXISTS idx_users_trial ON users(trial_end);
