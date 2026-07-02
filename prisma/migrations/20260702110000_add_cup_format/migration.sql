-- Format imposé par la coupe (BB11 / Sevens). Défaut bb11 : rétro-compatible
-- avec les coupes existantes (toutes considérées BB11).
ALTER TABLE "Cup" ADD COLUMN "format" "Format" NOT NULL DEFAULT 'bb11';
