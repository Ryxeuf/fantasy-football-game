-- FR17 — coups de pouce (inducements) autorisés au niveau ligue.
-- JSON array de slugs ; NULL = tous autorisés. Additif et nullable :
-- rétro-compatible, aucune réécriture de données existantes.
ALTER TABLE "League" ADD COLUMN "allowedInducements" TEXT;
