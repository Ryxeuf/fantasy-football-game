-- S27.1a — Mensualisation des Nuffle Cup.
-- Ajoute `monthlyYear` (annee canonique a 4 chiffres) et `monthlyMonth`
-- (1-12) sur la table Cup. Les deux sont nullable pour rester retro-
-- compatible avec les cups privees / non programmees.
-- La validation du couple (year > 0, month dans [1,12]) est enforcee
-- cote service `nuffle-cup-monthly.ts`.

-- AlterTable
ALTER TABLE "public"."Cup" ADD COLUMN "monthlyYear" INTEGER;
ALTER TABLE "public"."Cup" ADD COLUMN "monthlyMonth" INTEGER;

-- CreateIndex
CREATE INDEX "Cup_monthlyYear_monthlyMonth_idx" ON "public"."Cup"("monthlyYear", "monthlyMonth");
