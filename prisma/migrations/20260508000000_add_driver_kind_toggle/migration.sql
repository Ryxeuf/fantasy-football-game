-- Lot 3.B.1 — toggle driverKind hybrid/full.
--
-- Le sim-engine expose désormais deux drivers :
--   - 'hybrid' (lot 0.A.2) : synthèse archétype-vs-archétype rapide,
--     stable, conforme FUMBBL ±5%. Default pour toute saison existante.
--   - 'full'   (lot 3.A.2) : auto-play game-engine roster-aware, plus
--     riche narrativement mais en cours de validation drift.
--
-- Pour permettre un A/B test progressif (un match `full` au sein d'une
-- saison `hybrid`, ou rejouer un match en `hybrid` après bug `full`),
-- le toggle est porté à deux niveaux :
--
--   - ProLeagueSeason.driverKind     : default pour la saison entière.
--   - ProLeagueMatch.driverKindOverride : nullable, prend précédence.
--
-- La migration est rétrocompatible : tous les enregistrements existants
-- héritent du default 'hybrid' (= behavior pré-3.B.1).

ALTER TABLE "public"."ProLeagueSeason"
    ADD COLUMN "driverKind" TEXT NOT NULL DEFAULT 'hybrid';

ALTER TABLE "public"."ProLeagueMatch"
    ADD COLUMN "driverKindOverride" TEXT;

-- Pas d'index sur ces colonnes : aucune route ne filtre sur driverKind
-- en MVP (toutes les saisons sont 'hybrid' à l'install). Les requêtes
-- d'agrégation A/B test (lot 3.B.2) utiliseront des full-scans temporaires
-- sur quelques saisons à la fois, pas de scan production.
