-- Recharge · comptes légers (connexion par lien envoyé par email, sans mot de passe) et sauvegarde des données.
-- Aucune donnée des clients des VDI n'est lisible ici en clair : la sauvegarde est un bloc compressé, rattaché au compte.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  plan          TEXT NOT NULL DEFAULT 'free',      -- free | recharge | fondatrice | equipe (mis à jour par Stripe en phase 3)
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER
);

-- Liens de connexion : on ne garde que l'empreinte (SHA-256) du jeton et du code, valables 15 minutes, utilisables une seule fois.
CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  code_hash   TEXT,                 -- empreinte du code à 6 chiffres (même email, à taper dans l'appli)
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_login_tokens_email ON login_tokens(email, created_at);

-- Sessions : empreinte du jeton de session, valable 180 jours (prolongée à l'usage).
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Sauvegarde : la dernière version des données de l'appli (JSON compressé gzip), une par compte.
CREATE TABLE IF NOT EXISTS backups (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        BLOB NOT NULL,
  size        INTEGER NOT NULL,
  rev         INTEGER NOT NULL,
  device      TEXT,
  updated_at  INTEGER NOT NULL
);
