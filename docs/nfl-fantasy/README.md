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
| 19 | [draft-gameplay.md](./19-draft-gameplay.md) | Draft + gameplay V1 Phase A (autoFillRosters + finalizeLeague + lineup builder UI) |
| 20 | [matchups-standings.md](./20-matchups-standings.md) | Matchups + standings UI Phase A.3 (page /matchups + 2 routes user-facing) |
| 21 | [admin-explorer.md](./21-admin-explorer.md) | Admin data explorer Phase 3.C (seasons/teams/players + resync per-player) |
| 22 | [backfill-past-seasons.md](./22-backfill-past-seasons.md) | Backfill nflverse 2023+2024 (Phase 3.E) + fallback schedules.csv pour saison sans game_id |
| 23 | [admin-audit-weeks-leagues.md](./23-admin-audit-weeks-leagues.md) | Admin audit ingest-runs + calendrier weeks + leagues globales (Phase 3.D) |
| 24 | [bulk-actions-replay.md](./24-bulk-actions-replay.md) | Bulk recompute SPP/BB saison + replay end-to-end d'une saison passée (Phase 3.F + 3.G) |
| 25 | [matchup-detail-cleanup-optimal.md](./25-matchup-detail-cleanup-optimal.md) | Detail matchup admin + cleanup leagues replay + optimal lineup pour replay (Phase 3.I + 3.J + 3.K) |
| 26 | [gazette-matchup.md](./26-gazette-matchup.md) | Nuffle Gazette par matchup — narrative LLM Haiku post-settle (Phase 3.H) |
| 27 | [e2e-smoke.md](./27-e2e-smoke.md) | Smoke E2E Playwright sur `/nfl-fantasy/*` user-facing (Phase 4) |

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
| Admin data explorer | Implementé v1 ✅ | Haute | `nfl-fantasy-admin-explorer.ts` Phase 3.C (seasons + teams + players + 2 resync actions). 18 tests + E2E 9 étapes. Doc [`21-admin-explorer.md`](./21-admin-explorer.md). |
| Backfill saisons passées | Implementé v1 ✅ | Haute | `backfillNflSeason` Phase 3.E + fix schedules.csv fallback pour 2024 (nflverse a drop `game_id`). 6 tests + 2023+2024 ingerees sur Postgres (285+285=570 games · 37580 stats). Doc [`22-backfill-past-seasons.md`](./22-backfill-past-seasons.md). |
| Admin audit + weeks + leagues | Implementé v1 ✅ | Haute | Phase 3.D : audit log NflIngestRun + calendrier 22 weeks + leagues globales admin. 12 tests + 5 pages. Doc [`23-admin-audit-weeks-leagues.md`](./23-admin-audit-weeks-leagues.md). |
| Bulk actions + replay saison | Implementé v1 ✅ | Haute | Phase 3.F (recomputeSeasonSpp + reDeriveAllPlayersBb) + 3.G (replaySeason). 16 tests + E2E 8 teams × 18 weeks de 2024 settled en 4s. Doc [`24-bulk-actions-replay.md`](./24-bulk-actions-replay.md). |

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
| 2026-05-20 | v3.2 | Phase A — module rendu jouable bout-en-bout. **Backend** : service `nfl-fantasy-draft.ts` (autoFillRosters deterministe via mulberry32 PRNG + seededShuffle helper pur + finalizeLeague qui transitionne draft→in_progress + seed 8 rerolls/entry). 20 tests + erreur typée 5 codes. Routes admin (`auto-fill-rosters` / `finalize-league` / `draft-stats/:id`). Endpoint user `GET /entries/:id/roster` modifié pour joindre NflPlayer (sans realName, Q8). **Frontend** : page `/nfl-fantasy/leagues/[id]/lineup` (table checkboxes + radios captain×1.5/vice×1.2, lock indicator, autosubmit PUT), CTA "Régler mon lineup" sur page détail quand status=in_progress, 2 cartes admin "Auto-fill rosters" + "Finalize league". E2E 8 étapes OK sur Postgres (auto-fill 2x15 → idempotent → finalize seed 16 rerolls → setLineup 2 entries → generateMatchups + settle W10 home=24 vs away=15). Doc dédiée [`19-draft-gameplay.md`](./19-draft-gameplay.md). |
| 2026-05-20 | v3.3 | Phase A.3 — Matchups + standings UI. **Backend** : helper pur `computeStandings` (W-L-T-PF-PA + tri wins/diff/pf, ignore non-settles), `getLeagueStandings(leagueId)` (Promise.all entries + matchups settles + compute), 2 routes user-facing (`GET /leagues/:id/matchups?weekId=` + `GET /leagues/:id/standings`). 6 tests scoring ajoutés (33 total). **Frontend** : page `/nfl-fantasy/leagues/[id]/matchups` avec section Standings (tableau coloré, highlight "Toi", diff vert/rouge) + section Matchups (selecteur weekId, cards home/away avec scores+winner+badges contextuels "Ton match"/"Victoire"/"Défaite"). CTA "📊 Matchups & standings" sur page détail. E2E 4 étapes OK sur Postgres (full flow autoFill→finalize→setLineup×2→settle→listMatchups+getLeagueStandings). Doc dédiée [`20-matchups-standings.md`](./20-matchups-standings.md). |
| 2026-05-20 | v3.4 | Phase 3.C — Admin data explorer. **Backend** : service `nfl-fantasy-admin-explorer.ts` (5 read helpers + 2 mutations per-player idempotentes : recomputePlayerSpp via buildStatLineFromRow exporté + reDerivePlayerBb via getBbPosition). Router `admin-nfl-fantasy-explorer.ts` monté sous `/admin/nfl-fantasy/explore/*` avec authUser+adminOnly. Erreur typée `NflFantasyAdminError` (4 codes) mappée 404/422. 18 tests verts + E2E 9 étapes sur Postgres réel (32 teams, KC=Skaven, joueur réel testé recompute + re-derive idempotents). **Frontend** : layout `/admin/nfl-fantasy/layout.tsx` avec SeasonContext (persisté en URL ?season=YYYY) + SubNav (Actions/Équipes/Joueurs) + SeasonPicker. 4 pages : `/teams` (32 teams filtre race/search) + `/teams/[code]` (roster groupé par status + calendrier) + `/players` (table paginée 50/p + filtres + SPP si saison) + `/players/[id]` (mapping NFL→BB + 2 boutons resync + stats par game avec drill-down JSON). Doc dédiée [`21-admin-explorer.md`](./21-admin-explorer.md). |
| 2026-05-20 | v3.5 | Phase 3.E — Backfill saisons passées + fix schedules.csv. **Backend** : helper `backfillNflSeason(seasonId, opts)` (seed + boucle weeks 1-22, CSV cache memoire, idempotent skipExisting=true accepte aussi `partial`). Script CLI `backfill-past-seasons.ts` (default 2023+2024, options --season/--from/--to/--no-skip). **Fix critique** : nflverse a drop la colonne `game_id` du CSV `stats_player_week_2024.csv` → backfill ingerait 18959 players mais 0 games/stats. Fallback `games.csv` (nflverse-data/schedules) fetche 1 seule fois par saison, parse + index Map<season:week:teamA:teamB,row>, utilise pour reconstruire game_id + determiner home/away. Nouveaux helpers purs exposes : `parseSchedulesCsv`, `reconstructGameId`, `buildScheduleLookup`, `lookupSchedule`. 6 tests ajoutes (42 total). Run sur Postgres : 2023+2024 = 570 games · 37580 stats en ~7min total. Doc dédiée [`22-backfill-past-seasons.md`](./22-backfill-past-seasons.md). |
| 2026-05-20 | v3.6 | Phase 3.D — Admin audit + weeks + leagues. **Backend** : extension `nfl-fantasy-admin-explorer.ts` avec 6 read helpers (listNflIngestRunsForAdmin + getNflIngestRunForAdmin + listWeeksForSeason + getWeekDetail + listAllLeaguesForAdmin + getLeagueDetailForAdmin). 6 nouvelles routes `/explore/ingest-runs[/:id]` + `/explore/weeks[/:weekId]` + `/explore/leagues[/:id]` avec Zod validateQuery. 12 tests ajoutes (30 total explorer). **Frontend** : SubNav etendue avec 3 nouveaux tabs Calendrier/Leagues/Ingest. 5 pages : `/ingest-runs` (filtres source+status, durations, drill-down JSON Fragment), `/weeks` (22 lignes par saison + statut ingest), `/weeks/[weekId]` (games + scores + statsCount), `/leagues` (toutes les leagues admin, paginee + filtres status/type/saison/search), `/leagues/[id]` (4 cards + entries avec owner badge + matchups avec teamName resolu via Map). Doc dédiée [`23-admin-audit-weeks-leagues.md`](./23-admin-audit-weeks-leagues.md). |
| 2026-05-20 | v4.0 | Phase 4 — E2E smoke user-facing. Premier spec Playwright `nfl-fantasy-smoke.spec.ts` (5 tests) sur les ecrans `/nfl-fantasy/*`. Tests non-authentifies (catch 500 + presence elements critiques + navigation retour + league inexistante sans error boundary). Volontairement minimaliste : les flows authentifies complets restent couverts en backend par `nfl-fantasy-admin-explorer-e2e.ts`. Pas de fixtures DB, donc spec rapide et isole. Doc dédiée [`27-e2e-smoke.md`](./27-e2e-smoke.md). |
| 2026-05-20 | v3.9 | Phase 3.H — Nuffle Gazette par matchup. **Schema** : +3 colonnes sur `NflFantasyMatchup` (gazetteTitle, gazetteBody, gazetteGeneratedAt). `prisma db push` via container. **Backend** : nouveau service `nfl-fantasy-gazette.ts` (146 LOC) qui reutilise `callClaude` (Claude Haiku 4.5) + parse JSON strict `{title, body}` + persiste sur le matchup. Idempotent (skip si deja genere sauf `force=true`). Helpers purs `buildMatchupUserPrompt` + `parseGazetteLLMResponse` (tolere fences markdown). Erreur typee `NflFantasyGazetteError` 4 codes mappee 404/422. Route `POST /explore/matchups/:id/generate-gazette` body Zod. `getMatchupDetailForAdmin` etendu : retourne `gazette: null \| {title, body, generatedAt}`. **Frontend** : section "📜 Nuffle Gazette" sur `/admin/nfl-fantasy/matchups/[id]` avec bouton "Générer" + "Régénérer (force)" si deja present. Affichage article `whitespace-pre-wrap`. 14 tests gazette + 85 tests serveur total au vert. Cout estime ~0.0008 USD/call (Haiku). Doc dédiée [`26-gazette-matchup.md`](./26-gazette-matchup.md). |
| 2026-05-20 | v3.8 | Phase 3.I+J+K — Detail matchup, cleanup replays, optimal lineup. **Backend 3.I** : `cleanupReplayLeagues()` (`deleteMany ownerId startsWith 'replay-'`, cascade ON DELETE → entries/rosters/lineups/starters/matchups). **Backend 3.J** : `getMatchupDetailForAdmin(matchupId)` (5 queries : matchup + league + entries + lineups + starters + players, agregé en `AdminMatchupDetail` avec home/away starters tries DESC par finalSpp, winnerSide derive). **Backend 3.K** : option `lineupMode: 'first11' \| 'optimal'` sur `replaySeason`. Helper `pickOptimalStarters(roster, weekId)` lit `NflGameStat.computedSpp` filtre `game.weekId`, agrege par player, trie stable DESC. 3 routes POST/GET ajoutees. 9 tests ajoutes (55 total : 42 explorer + 13 replay). **Frontend 3.I** : 3e card "Cleanup leagues replay" dans `SeasonActions.tsx`. **Frontend 3.J** : nouvelle page `/admin/nfl-fantasy/matchups/[id]` (2 cards home/away cote-a-cote, bordure emerald sur winner, starters tries par finalSpp avec drill-down sppBreakdown JSON, lien vers player detail). Colonne "Detail" ajoutee dans la table matchups de league detail. **Frontend 3.K** : `<select>` lineupMode dans card replay (first11 default, optimal = hindsight). Doc dédiée [`25-matchup-detail-cleanup-optimal.md`](./25-matchup-detail-cleanup-optimal.md). |
| 2026-05-20 | v3.7 | Phase 3.F+G — Bulk actions saison + replay. **Backend 3.F** : `recomputeSeasonSpp(seasonId)` (loop NflGameStat de la saison, reconstruct statLine, computeSpp, persiste — bloquant ~30-60s pour 19k stats) + `reDeriveAllPlayersBb()` (re-derive bbPosition pour tous players avec teamCode, idempotent). **Backend 3.G** : nouveau service `nfl-fantasy-replay.ts` avec `replaySeason({seasonId, teamCount, fromWeek, toWeek})` qui orchestre createLeague + N-1 entries + autoFillRosters + finalizeLeague + boucle weeks (setLineup 11 premiers du roster + generateMatchups + lockLineups + settleNflFantasyWeek). 3 routes POST. 16 tests ajoutes (52 total : 36 explorer + 10 replay + 6 ingest). **Frontend** : composant `SeasonActions` monte sur `/weeks` avec 2 cards (recompute SPP avec confirm + replay avec form inputs teamCount/from/to + link vers league créée). Bouton bulk re-derive BB sur `/players`. **E2E validation** : 8 teams × 18 weeks de 2024 settled en 4s avec standings realistes (top 15-2-1 PF=226 vs bottom 7-10-1 PF=62). Doc dédiée [`24-bulk-actions-replay.md`](./24-bulk-actions-replay.md). |

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
