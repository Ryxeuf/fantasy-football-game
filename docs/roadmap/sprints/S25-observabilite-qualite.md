# Sprint 25 — Observabilite, perf & qualite

> Duree cible : ~6 jours
> Theme : voir ce qui se passe en prod, mesurer, et combler les trous
> de tests / perf avant la croissance organique.
> Pre-requis : S24.8 (wrapper console.error en place pour swap pino).

## Taches

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| S25.1 | Logger pino structure + correlation ID + healthcheck profond | AMELIO | M | [x] | Remplace les 270 `console.*` backend par pino avec `{ requestId, userId, duration, statusCode }`. Healthcheck `/health` actuellement renvoie `{ok:true}` sans verifier DB : ajouter liveness + readiness. Exportable Loki/Grafana LGTM (grafana.ryxeuf.fr). |
| S25.2 | Sentry front (Web Vitals deja monitores Q.20) | AMELIO | M | [x] | Couverture exceptions JS + RUM. Q.20 monitor LCP/INP/CLS mais zero capture exceptions. Ajouter `@sentry/nextjs` avec sample rate 10% en prod. |
| S25.3 | `/metrics` Prometheus (latence p95, queue size, ws connexions) | EVO | L | [x] | Pair avec Grafana LGTM existant. Custom metrics : `match_active_count`, `matchmaking_queue_size`, `ws_connections_open`, `pass_attempts_total`, `armor_break_total`. |
| S25.4 | Coverage thresholds 80% en CI + desactiver `passWithNoTests` | AMELIO | M | [x] | `apps/server/vitest.config.ts:10` et autres. Deps coverage installees mais `--coverage` jamais lance en CI. Activer `coverage.thresholds.lines: 80` + lifter le seuil progressivement par package. |
| S25.5 | Adopter `ApiResponse<T>` sur les 75% routes restantes | AMELIO | L | [~] | Std error handling. Aujourd'hui ~25/200+ routes l'utilisent (`utils/api-response.ts` cree pour O.6). Refactor `match.ts`, `team.ts`, `league.ts` en priorite. **Avancement** : league.ts ENTIEREMENT migre (errors S25.5a, success paths S25.5e) + helper partage `apiRequest<T>` cote front (S25.5b) + frontend leagues consumers migres (S25.5c list page, S25.5d detail page). **S25.5f** : routes lifecycle match (`/match/create`, `/match/join`, `/match/accept`) extraites en handlers exportes `handleCreateMatch/handleJoinMatch/handleAcceptMatch` migres vers `sendSuccess/sendError` + 8 tests unitaires + callsites front `lobby/page.tsx`, `play/page.tsx`, `waiting/[id]/page.tsx`, `play/[id]/hooks/useGameState.ts` migres vers `apiRequest<T>`. **S25.5g** : routes `/match/practice` et `/match/:id/cancel` extraites en handlers exportes `handlePracticeMatch/handleCancelMatch` + 8 tests unitaires + callsites front `play/page.tsx` (practice) et `waiting/[id]/page.tsx` (cancel) migres. **S25.5h** : routes list `/match/my-matches` et `/match/live` extraites en handlers exportes `handleListMyMatches/handleListLiveMatches` + 5 tests unitaires + callsites front `me/matches/page.tsx`, `play/page.tsx` (loadMatches), `spectate/page.tsx` migres vers `apiRequest<T>`. **S25.5i** : routes GET `/match/:id/turns`, `/match/:id/results`, `/match/:id/spectate`, `/match/:id/replay` extraites en handlers exportes `handleListMatchTurns/handleGetMatchResults/handleSpectateMatch/handleReplayMatch` migres vers `sendSuccess/sendError` + 17 tests unitaires + callsites front `components/MatchEndScreen.tsx`, `replay/[id]/page.tsx`, `spectate/[id]/page.tsx` (initial + polling) migres vers `apiRequest<T>`. **S25.5j** : routes GET `/match/details` (x-match-token), `/match/:id/details` (auth), `/match/:id/teams` extraites en handlers exportes `handleGetMatchDetailsByToken/handleGetMatchDetails/handleGetMatchTeams` migres vers `sendSuccess/sendError` + 11 tests unitaires (incl. mock jwt.verify) + 3 callsites front dans `play/[id]/hooks/useGameState.ts` (load team names + fallback teams) migres vers `apiRequest<T>`. **S25.5k** : route GET `/match/:id/summary` extraite en handler exporte `handleGetMatchSummary` migre vers `sendSuccess/sendError` + 4 tests unitaires (succes avec teams/score/half/turn/acceptances, fallback ordre selections quand creatorId absent, 404 partie introuvable, 500 prisma). 4 callsites front migres vers `apiRequest<T>` : `waiting/[id]/page.tsx` (polling + post-accept refresh), `play/page.tsx` (loadQueueStatus initial + polling matchmaking), `play/[id]/hooks/useGameState.ts` (match status check + load summary metadata). **Reste** : `/match/:id/move` (collision champ `success` avec `MoveAckPayload`, slice dedie a prevoir), route GET `/match/:id/state` (~190 lignes, slice dedie), team.ts (2151 lignes, a split). |
| S25.6 | Pagination `MatchQueue` + `LeagueParticipant` + `findMany` non bornes | AMELIO | M | [x] | `services/matchmaking.ts:141`, `services/league.ts:349`. `findMany()` illimite = risque memoire si la beta scale. Ajouter limit/offset + index `(status, joinedAt)`. **Audit** : `matchQueue.findMany` deja borne (`take: 1`, FIFO oldest match). `leagueParticipant.findMany` dans `computeSeasonStandings` est intentionnellement non-paginé (aggregation complete pour le ranking). Seul `listLeagues` etait reellement non-borne — fix : limit/offset par defaut 50/0, cap 100 + meta total/limit/page dans la response. |
| S25.7 | Bundle web split routes + lazy-load game-engine | AMELIO | L | [x] | Chunks actuels : main-app=150KB, payload=459KB, 3054=459KB. Pixi.js + game-engine >500KB chunk principal. Route-based splitting pour `/replay`, `/spectate`, `/play` ; les autres pages n'ont pas besoin du moteur. **Slice** : `GameBoardWithDugouts` (Pixi.js + @pixi/react, >500KB) lazy-loade via `next/dynamic({ssr:false})` sur /replay, /spectate, /dugout-demo (le pattern existait deja sur /play). Game-engine reste cote routes qui en ont besoin. |
| S25.8 | Lazy-load 66 images star players + format webp | AMELIO | M | [x] | 1.8MB sur les rosters pages. `next/image` + `loading="lazy"` + format webp prioritaire. **Audit** : les assets sont deja en `.webp` (33 fichiers) + `.svg` (32 fichiers) dans `public/images/star-players/`. La liste `/star-players` (StarPlayerCard) ne charge pas d'images — pas de regression sur 1.8MB sur les rosters. Seul site image : `/star-players/[slug]/page.tsx` (un seul `<img>`). **Fix** : remplace `<img>` par `<Image>` (`next/image`) → lazy-load auto, responsive `sizes`, bascule AVIF/WebP via `next.config.mjs` (`formats: ['image/avif','image/webp']`). |
| S25.9 | `gameLog` truncation cablee (fonction existe deja) | EVO | S | [x] | `packages/game-engine/src/utils/logging.ts:90-102` contient `truncateGameLog()` mais jamais appele. Invoquer au start-of-turn ou pre-broadcast WS pour eviter croissance illimitee. **Audit** : pre-broadcast deja cable depuis S22+ (`game-broadcast.ts` tronque a 100 entrees pour le WS). Manquait le start-of-turn cote engine pour borner aussi le state stocke server-side (DB + memoire). **Fix** : `applyMove` tronque a 200 entrees apres chaque `END_TURN` — buffer au-dessus du seuil broadcast pour les lookups historiques server. |

## Definition of done

- [ ] Logs structures visibles dans Grafana Loki (1 requete = 1 log enrichi)
- [ ] `/metrics` expose au moins 5 metriques custom + scrape par Prometheus
- [ ] Sentry dashboard front montre 0 erreur sur la golden path
- [ ] Coverage CI report >= 70% sur web/server, 85% sur game-engine
- [ ] Lighthouse Score >= 90 perf sur `/`, `/play`, `/leagues`
- [ ] Une partie de 16 tours : taille gameLog <= 100 entries (truncation)

## Risques

- **Pino + structured logs (S25.1)** : risque de logs trop verbeux qui
  saturent Loki. Configurer log level par env (debug en dev, info en prod).
- **Coverage 80% (S25.4)** : risque de tests "fake" pour gonfler le %.
  Utiliser branch coverage + line coverage combines.
- **Bundle split (S25.7)** : chunks trop fragmentes = trop de roundtrips
  reseau. Cible ~5-7 chunks principaux, pas 50.

## Sources

Findings agents : DX#1-6, perf#3-4, perf#5 (gameLog), backend#3, backend#6, tests#1-2.
