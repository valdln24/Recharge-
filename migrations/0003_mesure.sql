-- Recharge · mesure anonyme du parcours (aucun cookie, aucune adresse IP, aucun identifiant de visiteur)
-- et sauvegarde de l'analyse gratuite quand la personne choisit de laisser son email.

-- Un simple compteur par jour et par étape du parcours (ex. : « analyse_debut », « analyse_resultat »).
CREATE TABLE IF NOT EXISTS events_daily (
  day   TEXT NOT NULL,
  name  TEXT NOT NULL,
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);

-- L'analyse gratuite sauvegardée avec l'email (réponses aux questions, jamais de données de clients).
CREATE TABLE IF NOT EXISTS leads (
  email       TEXT PRIMARY KEY,
  analyse     TEXT,
  news        INTEGER NOT NULL DEFAULT 0,   -- 1 si la personne accepte de recevoir des conseils par email
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
