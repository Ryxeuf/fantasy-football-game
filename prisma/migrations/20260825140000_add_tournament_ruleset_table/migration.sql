-- Règlements de tournoi éditables en base.
--
-- Le contenu complet du règlement vit dans `definition` (JSON validé par Zod
-- à l'écriture comme à la lecture). Le slug reste la valeur référencée par
-- Team/League/Cup.tournamentRuleset — aucune contrainte de clé étrangère :
-- une compétition garde son règlement même si la ligne est désactivée ou
-- supprimée, et le registre @bb/game-engine sert alors de repli.
--
-- Migration additive : aucune donnée existante modifiée. La table est
-- alimentée par le seed depuis le registre du moteur.
CREATE TABLE "TournamentRuleset" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRuleset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentRuleset_slug_key" ON "TournamentRuleset"("slug");
CREATE INDEX "TournamentRuleset_enabled_idx" ON "TournamentRuleset"("enabled");
