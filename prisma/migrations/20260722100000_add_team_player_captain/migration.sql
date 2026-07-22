-- Règle spéciale d'équipe "Capitaine" (Saison 3) : le coach désigne un
-- joueur (hors Gros Bras) capitaine de son équipe. Flag porté par le
-- joueur ; l'unicité par équipe est garantie côté service.
ALTER TABLE "TeamPlayer" ADD COLUMN "isCaptain" BOOLEAN NOT NULL DEFAULT false;
