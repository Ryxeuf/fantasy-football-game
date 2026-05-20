# NFL Fantasy × Blood Bowl — Documentation

> Documentation vivante du module **NFL Fantasy** : un axe additionnel
> (et non un remplacement) du jeu Blood Bowl existant, dans lequel les
> joueurs construisent une équipe fantasy MPG-like basée sur les vraies
> stats NFL, mais skinnée dans l'univers Blood Bowl.
>
> Cette documentation est issue d'une session d'exploration de 2026-05-19.
> Elle doit évoluer au fil des décisions, validations légales, et changements
> de roster NFL.

## Vision en 3 lignes

1. **Axe additionnel** : on garde la Pro League BB simulée actuelle, on ajoute un mode "NFL Fantasy" qui réutilise l'infra (auth, wallet, gazette, badges, mercato).
2. **Skin BB sur stats NFL réelles** : chaque équipe NFL → 1 race BB, chaque joueur NFL → 1 poste BB, chaque event NFL → SPP via mapping pur.
3. **Pseudonymisé légalement** : pas de noms d'équipes NFL (juste villes + race BB), pas de noms de joueurs (titres BB + numéros + descripteur). Stats réelles autorisées (CBC v. MLB AM, 2007).

## Index des documents

| # | Doc | Sujet |
|---|---|---|
| 00 | [vision.md](./00-vision.md) | Vision, scope, calendrier complémentaire BB/NFL |
| 01 | [legal.md](./01-legal.md) | Cadre légal CBC v. MLB AM, RGPD, conventions pseudonymisation |
| 02 | [references-sorare.md](./02-references-sorare.md) | Étude de cas Sorare (multi-sport) + concurrents fantasy |
| 03 | [api-strategy.md](./03-api-strategy.md) | Stratégie API NFL : nflverse, ESPN, MySportsFeeds, SportRadar |
| 04 | [race-mapping.md](./04-race-mapping.md) | 32 équipes NFL → 8 races BB avec justifications |
| 05 | [position-mapping.md](./05-position-mapping.md) | Postes NFL → postes BB par race |
| 06 | [scoring.md](./06-scoring.md) | Conversion stats NFL → SPP Blood Bowl |
| 07 | [mechanics.md](./07-mechanics.md) | Intégration relances, inducements, prières à Nuffle |
| 08 | [rosters-2025.md](./08-rosters-2025.md) | Rosters 2025 des 32 équipes mappés en postes BB |
| 09 | [transitions-2026.md](./09-transitions-2026.md) | Free agents 2025 + draftees 2025 à reclasser pour 2026-27 |
| 10 | [architecture.md](./10-architecture.md) | Intégration dans le monorepo (packages, services, Prisma) |
| 11 | [ingestion-pipeline.md](./11-ingestion-pipeline.md) | Pipeline d'ingestion Phase 2.A (nflverse) + 2.B (ESPN gameday + rosters) |
| 12 | [league-crud.md](./12-league-crud.md) | League CRUD Phase 2.C (créer / rejoindre / quitter / config) |
| 13 | [roster-lineup.md](./13-roster-lineup.md) | Roster + Lineup hebdo Phase 2.D (starters + captain/vice + lock) |
| 14 | [scoring.md](./14-scoring.md) | Matchups + scoring/settle Phase 2.E (round-robin + captain/vice multipliers) |
| 15 | [mercato.md](./15-mercato.md) | Mercato Phase 2.F (rerolls 8/saison + inducements 3/matchup) |
| 16 | [routes.md](./16-routes.md) | Routes Express Phase 2.G (admin + user-facing, mapping NflXxxError → HTTP) |
| 17 | [crons.md](./17-crons.md) | Crons Phase 2.H (orchestrateur 5min : nflverse 03h, ESPN gameday, lock Sun 17h, settle Tue 12h) |
| 18 | [frontend.md](./18-frontend.md) | Frontend V1 Phase 3.A (dashboard + create + join + détail league) |

## Statut des sections

| Section | Statut | Confiance | Action |
|---|---|---|---|
| Vision & scope | Draft v1 | Haute | Validation produit |
| Légal | Draft v1 | Moyenne | À faire valider par juriste (FR/EU) |
| API stratégie | Draft v1.4 | Haute | POC nflverse + ESPN ✅ — Tank01 V1.5 à intégrer |
| Race mapping (teams) | Implementé v1 ✅ | Haute | `@bb/nfl-mapper` team-to-race (32 teams, 24 tests) |
| Position mapping | Implementé v1 ✅ | Haute | `@bb/nfl-mapper` position-to-bb (8 races × 26 NflPos, 55 tests) |
| Scoring (stats → SPP) | Implementé v1 ✅ | Moyenne | `@bb/nfl-mapper` stats-to-spp + captain multiplier (43 tests). À calibrer sur saison entière |
| Mechanics (BB) | Draft v1 | Haute | Validation prototype |
| Rosters 2025 | Draft v1 | Moyenne | Coupure jan 2026 — à updater |
| Transitions 2026 | Draft v1 | Faible | FA/Draft post mars-avril 2026 |
| Architecture | Implementé v1 ✅ | Haute | Schéma Prisma 14 modèles NflXxx (Phase 1 + 2.C-2.F), migrations appliquées Voie B sur DB réelle. |
| Pseudonymisation | Implementé v1 ✅ | Haute | `@bb/nfl-mapper` pseudonymize (Q8, 31 tests) |
| Ingestion (nflverse + ESPN) | Implementé v1 ✅ | Haute | `nfl-ingest.ts` + `nfl-ingest-espn.ts` Phase 2.A/2.B. 74 tests + E2E W10 2025 validé (14 games, 962 stats). Doc [`11-ingestion-pipeline.md`](./11-ingestion-pipeline.md). |
| League CRUD | Implementé v1 ✅ | Haute | `nfl-fantasy-league.ts` Phase 2.C. 37 tests + E2E 10 étapes. Doc [`12-league-crud.md`](./12-league-crud.md). |
| Roster + Lineup | Implementé v1 ✅ | Haute | `nfl-fantasy-roster.ts` + `nfl-fantasy-lineup.ts` Phase 2.D. 35 tests + E2E 8 étapes. Doc [`13-roster-lineup.md`](./13-roster-lineup.md). |
| Matchups + Scoring | Implementé v1 ✅ | Haute | `nfl-fantasy-scoring.ts` Phase 2.E. 27 tests + E2E avec stats W10 réelles (home=131 vs away=99). Doc [`14-scoring.md`](./14-scoring.md). |
| Mercato (rerolls + inducements) | Implementé v1 ✅ | Moyenne | `nfl-fantasy-mercato.ts` Phase 2.F. 24 tests + E2E. Wallet/Gold + effets SPP : V1.5. Doc [`15-mercato.md`](./15-mercato.md). |
| Routes Express | Implementé v1 ✅ | Haute | 4 routers (admin + user) + error-mapper. 15 tests pur + E2E 12 étapes API live. Doc [`16-routes.md`](./16-routes.md). |
| Crons | Implementé v1 ✅ | Haute | Orchestrateur 5min unique (`nfl-fantasy-cron.ts`) avec 4 fenêtres temporelles. 28 tests + E2E 7 étapes. Doc [`17-crons.md`](./17-crons.md). |

## Convention de mise à jour

Cette doc évolue en suivant les patterns du projet :
- Branche `claude/nfl-fantasy-*` pour les évolutions
- Commit `docs(nfl-fantasy): <description>`
- Update `Statut des sections` ci-dessus à chaque modif
- Ajouter une entrée dans `Changelog` ci-dessous

## Changelog

| Date | Version | Notes |
|---|---|---|
| 2026-05-19 | v1 | Création initiale (session exploratoire) |
| 2026-05-19 | v1.1 | Tranchage Q1/Q3/Q4/Q5 : snake draft, captain ×1.5 + vice ×1.2, prayers par TV, race fixe par équipe |
| 2026-05-19 | v1.2 | Tranchage Q2/Q6/Q7/Q8 : 10 users/league, silos séparés Pro League, freemium V1, pseudo full + flag DB `realNameDisplay` |
| 2026-05-19 | v1.3 | Schéma Prisma 10-architecture.md : ajout `realNameDisplay` Bool (Q8), retrait `archetype` Json + fichier `archetype.ts` (V2, Q5 race fixe par équipe) |
| 2026-05-19 | v1.4 | 03-api-strategy.md : correctif tag nflverse (`stats_player` ≥ 2025), correction MSF (free non-commercial uniquement), ajout Tier 1.5 Tank01 + V1.5 cost ($120/an), ajout Sleeper + Odds API + SDX, avertissements ToS (Sofascore, DK/FD WS, SerpAPI), refs repos ESPN (pseudo-r/Public-ESPN-API, mkreiser/ESPN-Fantasy-Football-API), POC findings W10 2025 |
| 2026-05-19 | v1.5 | 03-api-strategy.md gotchas: POC validé sur W1/W10/W18 2025 (testé sur 3 weeks). ESPN `?dates` filtre par ET local (TNF→Thu), summary 18/19 keys variable, season sous `leagues[0]`. nflverse: 1 CSV/saison cache-friendly, filter aussi `season_type`, position_group peut être vide. |
| 2026-05-19 | v1.6 | 03-api-strategy.md edge cases playoffs + intl : POC éprouvé sur Friday Sao Paulo (KC@LAC), Wildcard W19 (LAR@CAR, BUF@JAX, SF@PHI), Super Bowl LX (SEA 29 @ NE 13). Bug ESPN découvert : `leagues[0].season.type` figé à `reg` même en playoffs ; source de vérité = `event.season.slug=post-season`. Numérotation post-season ESPN : Wildcard=1, Div=2, Conf=3, SB=5 (skip 4=Pro Bowl). Mapping nflverse W19-22 ↔ ESPN post-season W1-5 documenté. |
| 2026-05-19 | v1.7 | Phase 1.A : package `@bb/nfl-mapper` créé avec `team-to-race` (24 tests, mergé via PR #880). |
| 2026-05-19 | v1.8 | Phase 1.B-1.E livrée en commits atomiques sur main local : position-to-bb (55 tests, 8 races × 26 NflPos), stats-to-spp + captain multiplier (43 tests, examples doc validés Mahomes/Henry/Jefferson/Donald/Watt/Sauce), pseudonymize Q8 (31 tests, 29 BbPosition + 8 archetype overrides), schéma Prisma 8 modèles NflXxx (NflSeason/Week/Team/Player/Game/GameStat/RosterSnapshot/IngestRun) avec `realNameDisplay` flag + sans `archetype` (Q5/Q8). Total package : 153 tests passent, coverage >96%. Migration Prisma à générer dans container `nufflearena_server`. |
| 2026-05-19 | v1.9 | Phase 2.A — `nfl-ingest.ts` (nflverse) livré : seedNflTeams + seedNflSeason + ingestNflverseWeek (idempotent, audit NflIngestRun). Validation E2E W10 2025 : 962 players + 962 stats + 14 games ingérés sur la DB Postgres réelle. 32 tests verts. CLI `nfl-ingest-cli.ts` pour invocation manuelle dans container. |
| 2026-05-20 | v2.0 | Phase 2.B — `nfl-ingest-espn.ts` livré : ingestEspnGameday (scoreboard ET local) + ingestEspnRosters (32 teams) + mapping ESPN W1-5 ↔ nflverse W19-22 (skip Pro Bowl) + alias `WSH`↔`WAS`. Validation E2E W10 2025 : 14/14 games scored après merge nflverse+ESPN (Thu+Sun+Mon), 2 roster snapshots KC/MIA (91 athlètes chacun). 38 tests verts. Fix bonus : normalisation `LA`→`LAR` dans `parseRow` (legacy nflverse) qui causait un doublon `2025_10_LA_SF` / `2025_10_LAR_SF`. Doc dédiée [`11-ingestion-pipeline.md`](./11-ingestion-pipeline.md). Total Phase 2.A+2.B : 74 tests verts. |
| 2026-05-20 | v2.1 | Phase 2.C — `nfl-fantasy-league.ts` livré : créer / rejoindre (id ou inviteCode) / quitter / configurer / supprimer une league. Defaults Q1/Q2 : size=10, snake, private. 2 modèles Prisma (`NflFantasyLeague` + `NflFantasyEntry`) avec FK cascade et indexes (`ownerId`, `status+type`, `seasonId`). Migration appliquée Voie B sur DB réelle. 37 tests verts + script E2E 10 étapes OK sur Postgres (create→join→list→update→pivot type→leave→delete). Erreur typée `NflFantasyLeagueError` avec 12 codes. Doc dédiée [`12-league-crud.md`](./12-league-crud.md). |
| 2026-05-20 | v2.2 | Phase 2.D — `nfl-fantasy-roster.ts` + `nfl-fantasy-lineup.ts` livrés : roster CRUD (add/remove/get/isOn + maj totalTV en transaction), lineup hebdo avec captain ×1.5 et vice ×1.2 (Q3), validation pure `validateLineupStructure` (11 starters, captain/vice ∈ starters et !=, pas de doublon), `lockLineups(weekId)` bulk idempotent. 3 modèles Prisma (`NflFantasyRoster` + `NflFantasyLineup` + `NflFantasyLineupStarter`). 35 tests verts (11 roster + 24 lineup) + E2E 8 étapes OK sur Postgres. Doc dédiée [`13-roster-lineup.md`](./13-roster-lineup.md). |
| 2026-05-20 | v2.3 | Phase 2.E — `nfl-fantasy-scoring.ts` livré : `generateMatchups` (round-robin "circle method" deterministe, N/2 paires/week, idempotent) + `settleNflFantasyWeek` (lit `NflGameStat.computedSpp` ingéré 2.A, applique captain ×1.5 / vice ×1.2 trunc, persiste rawSpp+finalSpp+sppBreakdown sur starters / totalSpp sur lineups / scores+winnerId+settledAt sur matchups, idempotent skip-si-settled). Modèle `NflFantasyMatchup`. 27 tests verts + E2E 6 étapes OK sur Postgres avec W10 réelle (home=131 vs away=99, captain mult verifié). Helpers purs exportés (`pairEntriesForWeek`, `applyCaptainMultiplier`, `determineWinner`). Doc dédiée [`14-scoring.md`](./14-scoring.md). |
| 2026-05-20 | v2.4 | Phase 2.F — `nfl-fantasy-mercato.ts` livré : pool reroll dépleté (8/saison V1 vision) + slots inducements 3/matchup. `seedStartingRerolls` idempotent, `grantReroll`/`consumeReroll` avec gardes owner/already-used, `consumeInducement` avec limite 3-par-matchup, `countAvailableRerolls` / `countRemainingInducementSlots`. 2 modèles Prisma (`NflFantasyReroll` + `NflFantasyInducement`). 24 tests verts + E2E 8 étapes OK sur Postgres (seed → grant → consume → reject already-used → 3 inducements limit → isolation par matchup). Wallet/Gold integration documentée TODO V1.5. Doc dédiée [`15-mercato.md`](./15-mercato.md). |
| 2026-05-20 | v2.5 | Phase 2.G — couche HTTP exposant tous les services 2.A-2.F : `utils/nfl-error-mapper.ts` (pur, mapping code → status 404/403/409/422/502/500, 15 tests) + 4 routers Express : `admin-nfl-ingest` (5 endpoints sous `/admin/nfl/ingest`), `admin-nfl-fantasy` (4 endpoints sous `/admin/nfl-fantasy`), `nfl-fantasy-leagues` (8 endpoints user-facing sous `/api/nfl-fantasy/leagues`), `nfl-fantasy-entries` (10 endpoints sous `/api/nfl-fantasy/entries/:entryId` avec ownership check `loadOwnedEntry`). Wired dans `index.ts`. Zod validation body/query partout. E2E 12 étapes OK sur API live (401/403/404/400/200/201/204). Doc dédiée [`16-routes.md`](./16-routes.md). |
| 2026-05-20 | v2.6 | Phase 2.H — `nfl-fantasy-cron.ts` livré : orchestrateur 5min unique (`nflFantasyOrchestratorTick`) sequence 4 ticks idempotents avec leurs propres fenêtres temporelles UTC (nflverse 03h, ESPN gameday Thu/Fri/Sat/Sun/Mon, lockLineups Sun 17h, settle Tue 12h). Helpers purs `dateYmd` / `currentSeasonId` / `isNflGameday` / `isLockLineupsWindow` / `isSettleWindow` / `isNflverseDailyWindow` exportés. `findCurrentNflWeek` avec tri `[startDate desc, weekNumber desc]` pour gérer le seed approximatif Phase 2.A. Câblé dans `index.ts` avec `runOnceAtATime("nfl-fantasy-cron")` + `setInterval` configurable via `NFL_FANTASY_CRON_TICK_MS` (default 5min). 28 tests verts + E2E 7 étapes OK sur Postgres (force=true sur chaque tick + skip out-of-window vérifié). Doc dédiée [`17-crons.md`](./17-crons.md). **Boucle la Phase 2 NFL Fantasy complète.** |
| 2026-05-20 | v3.0 | Phase 3.A — Frontend V1 livré : 4 pages Next.js 14 app router sous `/nfl-fantasy/*` (layout + dashboard + new + join + leagues/[id]) qui consomment les routes Phase 2.G via `apiRequest<T>`. `types.ts` partagé (miroir API). Hardcoded FR (vision §scope), TailwindCSS slate+orange, `data-testid` parlants pour Playwright futur. Mapping UX des erreurs ApiClientError (401 → CTA login, 404 → "introuvable"). Toutes les actions owner/member exposées sur la page detail (rename, toggle public/private, leave, delete) avec confirmation. Smoke test : 4 paths HTTP 200, aucun warning compile Next.js. Doc dédiée [`18-frontend.md`](./18-frontend.md). |
| 2026-05-20 | v3.1 | Phase 3.B — Console admin `/admin/nfl-fantasy` livrée : page unique avec composant local `ActionCard` qui wrap chaque endpoint admin Phase 2.G (5 cartes ingestion + 4 cartes league ops). Inputs Zod-alignés (pattern HTML5 minimum), affichage JSON brut des réponses (`<pre>` scrollable), indicateur OK/HTTP{status}. Réutilise `apps/web/app/admin/layout.tsx` + ajout nav item "🐀 NFL Fantasy" après "Pro League". Check `fetchMe()` + redirect "/" si pas admin (pattern existant). Footer avec liens docs 16-routes.md + 17-crons.md. Smoke test : 307 → /admin/sync (sync auth cookie, comportement identique à /admin/blog). Doc 18-frontend.md étendue. |

## Source de cette session

Cette doc consolide une discussion exploratoire couvrant :
1. Faisabilité du pivot NFL fantasy en axe supplémentaire
2. Étude de cas Sorare (architecture multi-sport)
3. Stratégie API et tiers de coût
4. Cadre légal (CBC precedent, RGPD)
5. Mapping racial des 32 équipes NFL
6. Mapping postes joueurs NFL → BB
7. Mécaniques BB (relances, inducements, prières) en seasonal bonus
8. Rosters et transitions 2025→2026

Les questions structurantes encore ouvertes sont listées dans
[vision.md § "Questions ouvertes"](./00-vision.md).
