-- S27.1f — Match-of-the-week.
-- Ajoute `featuredAt` (timestamp du pick admin) et `featuredNote`
-- (commentaire court FR/EN) sur LocalMatch. Les deux sont nullable
-- pour rester retro-compatibles avec les matchs existants. Index
-- `featuredAt` pour la requete `ORDER BY featuredAt DESC LIMIT 1`.

-- AlterTable
ALTER TABLE "public"."LocalMatch" ADD COLUMN "featuredAt" TIMESTAMP(3);
ALTER TABLE "public"."LocalMatch" ADD COLUMN "featuredNote" TEXT;

-- CreateIndex
CREATE INDEX "LocalMatch_featuredAt_idx" ON "public"."LocalMatch"("featuredAt");
