-- Email du matin (worker/digest.js) et pause d'abonnement
ALTER TABLE users ADD COLUMN digest_off INTEGER;   -- 1 = ne veut plus l'email du matin
ALTER TABLE users ADD COLUMN digest_at INTEGER;    -- dernier envoi (ms)
ALTER TABLE users ADD COLUMN digest_key TEXT;      -- jeton aléatoire du lien « ne plus recevoir »
ALTER TABLE users ADD COLUMN paused_until INTEGER; -- abonnement en pause jusqu'à (ms)
