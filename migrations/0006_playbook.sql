-- Recharge · Lead magnet « Le Playbook de la vente directe ».
-- Une ligne par adresse email (pas de doublon) : prénom, provenance, consentement marketing distinct et daté.
-- Télécharger le Playbook n'inscrit à aucune lettre d'information : marketing = 1 seulement si la case a été cochée.

CREATE TABLE IF NOT EXISTS prospects (
  email            TEXT PRIMARY KEY,
  prenom           TEXT NOT NULL,
  source           TEXT,                       -- page ou campagne d'origine (ex. « accueil », « utm:instagram »)
  marketing        INTEGER NOT NULL DEFAULT 0, -- 1 = accepte les actualités et communications commerciales
  marketing_at     INTEGER,                    -- date du consentement (ou du retrait)
  token            TEXT NOT NULL,              -- lien de téléchargement personnel
  downloads        INTEGER NOT NULL DEFAULT 0,
  last_download_at INTEGER,
  emailed_at       INTEGER,                    -- date d'envoi du Playbook par email
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_token ON prospects(token);
CREATE INDEX IF NOT EXISTS idx_prospects_created ON prospects(created_at);
