-- Ligue régionale choisie à la création de l'équipe (slug du catalogue
-- @bb/game-engine `REGIONAL_LEAGUES`, ex : "chaos_clash"). C'est elle qui
-- débloque les Star Players recrutables et les Coups de Pouce accessibles.
-- NULL = aucun choix enregistré (équipes antérieures à la règle) : le moteur
-- retombe alors sur l'union historique des règles régionales du roster, donc
-- migration additive sans perte d'accès.
ALTER TABLE "Team" ADD COLUMN "regionalLeague" TEXT;
