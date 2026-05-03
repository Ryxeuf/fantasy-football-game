-- S26.6 — Ligues thematiques saisonnieres + reset ELO.
-- Ajoute les champs `theme` (slug : skaven_cup | nordic_challenge |
-- underworld_open) et `themeYear` (annee canonique a 4 chiffres) sur
-- LeagueSeason. Les deux sont nullable pour rester retro-compatible
-- avec l'historique des saisons non thematiques. La validation du
-- couple "theme + themeYee" est enforcee cote service (createSeason).

-- AlterTable
ALTER TABLE "public"."LeagueSeason" ADD COLUMN "theme" TEXT;
ALTER TABLE "public"."LeagueSeason" ADD COLUMN "themeYear" INTEGER;

-- CreateIndex
CREATE INDEX "LeagueSeason_theme_themeYear_idx" ON "public"."LeagueSeason"("theme", "themeYear");
