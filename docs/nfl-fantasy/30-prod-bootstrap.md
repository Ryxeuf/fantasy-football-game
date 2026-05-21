# 30 — Bootstrap NFL Fantasy en prod (Phase 5.E)

> Comment populate la DB Postgres prod avec teams + seasons + rosters
> + stats + scores apres un deploiement initial.

## TL;DR

```bash
# 1. Sur la prod, applique les migrations Prisma
make db-migrate-deploy

# 2. Lance le bootstrap NFL Fantasy (idempotent ~5-7min par saison)
make nfl-bootstrap          # 2023 + 2024 + 2025
# OU pour aller vite la premiere fois :
make nfl-bootstrap-2025     # juste 2025
```

Le cron prend ensuite le relais automatiquement (~03:00 UTC) pour
maintenir stats + rosters + scores a jour.

## Ce que fait le bootstrap

`apps/server/src/scripts/bootstrap-nfl-prod.ts` execute en 5 etapes
sequentielles, **toutes idempotentes** :

| Etape | Service | Effet |
|---|---|---|
| 1 | `seedNflTeams()` | 32 NflTeam (upsert) |
| 2 | `seedNflSeason(year)` × N | 22 NflWeek par saison (upsert) |
| 3 | `ingestNflverseRosters({seasonId})` × N | Bio + jersey + headshot CDN sur ~3000 joueurs |
| 4 | `backfillNflSeason({seasonId, skipExisting:true})` × N | Stats W1-W22 (~19000 stats par saison) |
| 5 | `backfillScoresFromSchedules({seasonId})` × N | Scores nflverse + correction kickoffAt |

Chaque etape skip ce qui est deja fait → re-run safe. Si une etape
crashe, les precedentes restent valides.

## Workflow deploiement complet

### Pre-requis
- DB Postgres provisionnee, `DATABASE_URL` dans l'env
- Code deploye, container/process serveur up
- Reseau sortant OK vers `github.com/nflverse/nflverse-data` (CDN
  GitHub Releases)

### Etapes

```bash
# 1. Migrations schema Prisma
make db-migrate-deploy

# 2. Bootstrap data
make nfl-bootstrap

# 3. Verifier : healthcheck + counts
curl https://api.tonsite.com/health
# OU directement en DB :
psql $DATABASE_URL -c "SELECT \"seasonId\", COUNT(*) FROM \"NflGame\" GROUP BY \"seasonId\";"
```

### Apres bootstrap : le cron prend le relais

Le `nflFantasyOrchestratorTick` (voir `nfl-fantasy-cron.ts`) tourne
deja en boucle (planifie cote app au demarrage). Fenetres :
- **03:00-03:59 UTC** : nflverse stats + rosters (quotidien)
- **Sunday / Monday / Thursday 03:00 UTC** : ESPN gameday (jour de
  game)
- **Sunday 17:00 UTC** : lock lineups
- **Sunday 21:00 UTC** : settle week

Donc apres bootstrap, **rien a faire** : la DB se met a jour seule.

## Options bootstrap

```bash
# Sous-ensemble de saisons
pnpm exec tsx src/scripts/bootstrap-nfl-prod.ts --season 2024 --season 2025

# Re-run rapide sans recharger les CSV
pnpm exec tsx src/scripts/bootstrap-nfl-prod.ts --skip-stats --skip-rosters
# (utile par exemple apres avoir push une nouvelle formule SPP : il
# faut alors trigger recompute via /admin/nfl-fantasy/explore/seasons/X/recompute-spp)

# Skip ce qui est lent
pnpm exec tsx src/scripts/bootstrap-nfl-prod.ts --skip-stats
```

## Bootstrap depuis le container local (dev / debug)

```bash
docker exec nufflearena_server sh -c "cd /app/apps/server && \
  pnpm exec tsx src/scripts/bootstrap-nfl-prod.ts --season 2025"
```

## Bootstrap depuis une connexion psql distante

Si le serveur ne tourne pas encore mais que la DB est accessible :

```bash
DATABASE_URL="postgres://user:pass@host:5432/db" \
  pnpm --filter @bb/server exec tsx \
  src/scripts/bootstrap-nfl-prod.ts
```

## Validation post-bootstrap

Le script termine sur un summary :

```
═══════════════════════════════════════
  Summary
═══════════════════════════════════════
  2023 : 32 teams · 22 weeks · 285 games (285 with score) · 18621 stats
         4565 total NflPlayer in DB (cumulative)
  2024 : 32 teams · 22 weeks · 285 games (285 with score) · 18959 stats
         4565 total NflPlayer in DB (cumulative)
  2025 : 32 teams · 22 weeks · 285 games (285 with score) · 19399 stats
         4565 total NflPlayer in DB (cumulative)

═══════════════════════════════════════
  ✓ Bootstrap done in 7.3 min
═══════════════════════════════════════
```

Coverage attendue apres bootstrap (cible) :
- **855 games** sur 3 saisons (285 × 3)
- **855 games avec score** (100%)
- **~57000 NflGameStat**
- **~4500 NflPlayer** (cumul cross-season car gsis_id stable)
- **~89% des joueurs actifs avec jersey + headshot + bio**

## Re-run apres mise a jour code

Apres chaque deploy qui touche au mapping ou aux donnees nflverse :

```bash
# Cas 1 : nouveau champ bbStats/bbSkills → re-derive
curl -X POST -H "Cookie: $ADMIN_COOKIE" \
  https://api.tonsite.com/admin/nfl-fantasy/explore/players/re-derive-bb-bulk

# Cas 2 : nouvelle formule SPP → recompute saison
curl -X POST -H "Cookie: $ADMIN_COOKIE" \
  https://api.tonsite.com/admin/nfl-fantasy/explore/seasons/2025/recompute-spp

# Cas 3 : ajout d'un champ bio dans NflPlayer → re-ingest rosters
make nfl-bootstrap --skip-stats --skip-scores
```

## Couts data externes

- **nflverse CSV** : 100% gratuit (GitHub Releases CDN). Pas de
  rate-limit notable.
- **ESPN scoreboard** : free API non-officielle, on l'utilise
  uniquement en cron quotidien pour le live (pas en bootstrap qui
  utilise nflverse schedules pour les scores).
- **Headshots** : hot-linked depuis le CDN nflverse (URLs stockees,
  pas de copie locale → 0 stockage S3 image).

## Hors scope (futurs)

- **Mode "production-restore"** : restorer depuis un snapshot SQL
  plutot que rebuild from scratch — utile pour migrations majeures.
- **GitHub Action one-shot** : workflow qui execute le bootstrap
  apres chaque deploy main → no manual step.
- **Notification Slack/email** : ping en fin de bootstrap avec le
  summary (utile pour deploy nocturne).
- **Bootstrap incremental** : actuellement seasons fixes par CLI
  args. V2 : auto-detect "saison en cours" via date du jour.
