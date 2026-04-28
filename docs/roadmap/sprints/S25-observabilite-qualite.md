# Sprint 25 — Observabilite, perf & qualite

> Duree cible : ~6 jours
> Theme : voir ce qui se passe en prod, mesurer, et combler les trous
> de tests / perf avant la croissance organique.
> Pre-requis : S24.8 (wrapper console.error en place pour swap pino).

## Taches

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| S25.1 | Logger pino structure + correlation ID + healthcheck profond | AMELIO | M | [x] | Remplace les 270 `console.*` backend par pino avec `{ requestId, userId, duration, statusCode }`. Healthcheck `/health` actuellement renvoie `{ok:true}` sans verifier DB : ajouter liveness + readiness. Exportable Loki/Grafana LGTM (grafana.ryxeuf.fr). |
| S25.2 | Sentry front (Web Vitals deja monitores Q.20) | AMELIO | M | [ ] | Couverture exceptions JS + RUM. Q.20 monitor LCP/INP/CLS mais zero capture exceptions. Ajouter `@sentry/nextjs` avec sample rate 10% en prod. |
| S25.3 | `/metrics` Prometheus (latence p95, queue size, ws connexions) | EVO | L | [ ] | Pair avec Grafana LGTM existant. Custom metrics : `match_active_count`, `matchmaking_queue_size`, `ws_connections_open`, `pass_attempts_total`, `armor_break_total`. |
| S25.4 | Coverage thresholds 80% en CI + desactiver `passWithNoTests` | AMELIO | M | [ ] | `apps/server/vitest.config.ts:10` et autres. Deps coverage installees mais `--coverage` jamais lance en CI. Activer `coverage.thresholds.lines: 80` + lifter le seuil progressivement par package. |
| S25.5 | Adopter `ApiResponse<T>` sur les 75% routes restantes | AMELIO | L | [ ] | Std error handling. Aujourd'hui ~25/200+ routes l'utilisent (`utils/api-response.ts` cree pour O.6). Refactor `match.ts`, `team.ts`, `league.ts` en priorite. |
| S25.6 | Pagination `MatchQueue` + `LeagueParticipant` + `findMany` non bornes | AMELIO | M | [ ] | `services/matchmaking.ts:141`, `services/league.ts:349`. `findMany()` illimite = risque memoire si la beta scale. Ajouter limit/offset + index `(status, joinedAt)`. |
| S25.7 | Bundle web split routes + lazy-load game-engine | AMELIO | L | [ ] | Chunks actuels : main-app=150KB, payload=459KB, 3054=459KB. Pixi.js + game-engine >500KB chunk principal. Route-based splitting pour `/replay`, `/spectate`, `/play` ; les autres pages n'ont pas besoin du moteur. |
| S25.8 | Lazy-load 66 images star players + format webp | AMELIO | M | [ ] | 1.8MB sur les rosters pages. `next/image` + `loading="lazy"` + format webp prioritaire. |
| S25.9 | `gameLog` truncation cablee (fonction existe deja) | EVO | S | [ ] | `packages/game-engine/src/utils/logging.ts:90-102` contient `truncateGameLog()` mais jamais appele. Invoquer au start-of-turn ou pre-broadcast WS pour eviter croissance illimitee. |

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
