-- CreateTable: TeamSpecialRule
-- Catalogue des règles spéciales d'équipe (Bagarreurs Brutaux,
-- Chantage et Corruption, Favori de..., Trois-quarts à vil prix,
-- Maîtres de la Non-vie, Déferlement, Capitaine).
-- Source : retranscription OCR officielle Saison 3.
CREATE TABLE "TeamSpecialRule" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ruleset" "Ruleset" NOT NULL DEFAULT 'season_3',
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamSpecialRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamSpecialRule_slug_ruleset_key" ON "TeamSpecialRule"("slug", "ruleset");

-- CreateTable: RegionalLeague
-- Catalogue des ligues régionales (Bagarre des Terres Arides, Clash du Chaos,
-- Ligue des Royaumes Elfiques, Coupe Dé à Coudre Halfling, Super-ligue de
-- Lustrie, Classique du Vieux Monde, Spot de Sylvanie, Ligue Sylvestre,
-- Défi des Bas-fonds, Super-ligue du Bord du Monde).
-- Source : retranscription OCR officielle Saison 3.
CREATE TABLE "RegionalLeague" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ruleset" "Ruleset" NOT NULL DEFAULT 'season_3',
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegionalLeague_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegionalLeague_slug_ruleset_key" ON "RegionalLeague"("slug", "ruleset");
