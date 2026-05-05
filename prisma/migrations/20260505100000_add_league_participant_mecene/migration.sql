-- L2.B.5 — Coup de mecene : 1x par saison ligue par equipe.
-- Ajoute deux colonnes sur LeagueParticipant pour tracker si l'equipe
-- a deja active son coup de mecene pendant cette saison.
ALTER TABLE "LeagueParticipant"
  ADD COLUMN "mecenePlayed"   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN "mecenePlayedAt" TIMESTAMP(3);
