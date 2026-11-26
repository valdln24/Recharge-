-- Back-office (worker/admin.js) : accès offerts et historique des actions
ALTER TABLE users ADD COLUMN gift_until INTEGER;   -- fin de l'accès offert (ms), vide = sans limite
ALTER TABLE users ADD COLUMN gift_note TEXT;       -- note libre (ex. « famille »)
CREATE TABLE IF NOT EXISTS admin_log (
  at      INTEGER NOT NULL,
  admin   TEXT NOT NULL,
  action  TEXT NOT NULL,
  target  TEXT,
  detail  TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_log_at ON admin_log(at);
