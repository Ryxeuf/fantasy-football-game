# Tasks — Règlements de tournoi en base + admin

## 1. Schéma & seed
- [x] 1.1 Modèle `TournamentRuleset` (slug unique immuable, Json strings, `archivedAt`) + migration additive `20260824120000_add_tournament_ruleset_model` + miroir SQLite + client de test régénéré.
- [x] 1.2 `scripts/seed-tournament-rulesets.ts` (create-only, idempotent, `--dry-run`, pattern staff-config) câblé dans `seed.ts`.

## 2. Repository serveur
- [x] 2.1 `services/tournament-ruleset-repository.ts` : parsing tolérant (null ↔ ∞), `getTournamentRulesetRecord` (archivés résolus), `resolveTournamentRulesetSelection` (inconnu/archivé refusés), labels batchés, listing fusionné DB + statique, sérialisation partagée seed/admin.
- [x] 2.2 Consommateurs rebranchés : build, create-from-roster (pack de coupe archivés inclus), createLeague/updateLeague (conserver un règlement archivé permis), addParticipant, POST /cup, registerTeamToCup ; labels embarqués sur GET /team/:id, /team/mine, /team/list ; `utils/tournament-ruleset-helpers.ts` supprimé.
- [x] 2.3 Tests repository/seed (20) — les mocks Prisma existants restent valides via le fallback statique.

## 3. API publique
- [x] 3.1 `routes/public-tournament-rulesets.ts` : liste (non archivés) + détail (archivés avec flag), cache 5 min + `invalidateTournamentRulesetCaches`, monté sous /api. Tests (4).

## 4. Admin serveur
- [x] 4.1 `schemas/admin-tournament-rulesets.schemas.ts` (create + update partiel sans slug).
- [x] 4.2 `routes/admin-tournament-rulesets.ts` : list/GET/POST/PUT + archive/unarchive idempotents + POST /seed ; validation sémantique sur la définition résultante ; audit `tournamentRuleset.*` + invalidation cache. Monté `/admin/tournament-rulesets`. Tests (16).

## 5. Admin web
- [x] 5.1 `/admin/data/tournament-rulesets` : liste (badges Actif/Archivé/Code non seedé, archivage inline, « Matérialiser les packs du code ») + entrée de menu « Données du jeu ».
- [x] 5.2 Formulaire partagé création/édition (table des règles par roster via /api/rosters de l'édition, barème, taxe, bannis/Élite en CSV, inducements) + pages new / [id]/edit (recharge serveur après save). Tests (3).

## 6. Web public via l'API
- [x] 6.1 `app/lib/tournament-rulesets.ts` (fetchers + cache module + fallback statique, null → ∞) + hook `useTournamentRulesets`.
- [x] 6.2 Builder : liste + définition fetchées (slug inconnu → règles standard), option de secours pour un pack imposé absent de la liste.
- [x] 6.3 LeagueForm + formulaire coupe (filtres édition/format sur les résumés API, option de secours en édition) ; badges ligue/coupe via le hook, fiche roster via le label serveur.

## 7. OpenSpec
- [x] 7.1 Archivage du change `add-tournament-ruleset-selection` (mergé, PR #970) + promotion du delta en `openspec/specs/tournament-ruleset/spec.md`.
- [x] 7.2 Ce change (proposal + design + delta + tasks).
