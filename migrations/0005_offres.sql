-- Recharge · les offres Starter, Pro et Équipe, le prix fondateur et les équipes.
-- tier : l'offre choisie au paiement (starter, pro, equipe). Le statut actif reste dans plan.
-- founder : 1 si le compte a obtenu le prix fondateur (réservé aux 50 premiers abonnés ; gardé tant que l'abonnement continue).

ALTER TABLE users ADD COLUMN tier TEXT;
ALTER TABLE users ADD COLUMN founder INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN team_id TEXT;

-- Une équipe : son nom, la personne qui paie, le nombre de places payées, et le code pour la rejoindre.
CREATE TABLE IF NOT EXISTS teams (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  owner_id    TEXT NOT NULL,
  seats       INTEGER NOT NULL DEFAULT 6,
  code        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_code ON teams(code);
CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_users_founder ON users(founder);
