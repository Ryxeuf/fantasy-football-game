# 03 — Stratégie API : Data NFL

> 3 tiers de fournisseurs selon le budget, la latence requise et la
> richesse des données. Approche progressive : démarrer gratuit, scaler
> selon usage.

## TL;DR

| Tier | Coût | Latence | Recommandation |
|---|---|---|---|
| Gratuit | 0€ | 5min–24h | **MVP V1** (nflverse + ESPN hidden API) |
| Abordable | $50-500/mois | ~5-30s | V2 si DAU >5k (MySportsFeeds) |
| Enterprise | $2000+/mois | <1s | V3 si DFS-grade requis (SportRadar) |

## Tier 1 — Gratuit (recommandé MVP)

### nflverse / nflfastR

**URL** : <https://github.com/nflverse>

**Format** : GitHub releases (Parquet, CSV), JSON via API REST légère

**Couverture** :
- Play-by-play complet depuis 1999
- Rosters joueurs avec jersey numbers, positions, age, etc.
- Stats agrégées par game, par drive, par play
- Stats fantasy pré-calculées (DK/FD points)
- Schedules saison + playoffs
- Snap counts, route data, NextGen Stats partielles

**Fréquence MAJ** :
- Pendant la saison : commits quasi-immédiats post-match (~15min après end)
- Off-season : mises à jour combine, FA, draft

**Limites** :
- Pas de live in-game (delay 15min minimum)
- Pas de WebSocket / push
- Format Parquet → besoin de pipeline conversion

**Use case pour nous** :
- Ingestion **post-match** chaque dimanche soir / lundi matin
- Scoring users tranquillement le lundi
- Source de vérité pour rosters + stats annuelles

### ESPN Hidden API

**URL base** : `https://site.api.espn.com/apis/site/v2/sports/football/nfl/`

**Endpoints clés** :
```
GET /scoreboard                          → matches du jour, scores live
GET /scoreboard?dates=20260920           → matches d'un jour précis
GET /summary?event=401547417             → boxscore d'un match
GET /teams                               → liste 32 teams
GET /teams/{team}/roster                 → roster d'une team
GET /athletes/{playerId}                 → fiche joueur
GET /athletes/{playerId}/stats           → stats joueur
GET /news                                → news NFL
```

**Format** : JSON
**Authentification** : aucune
**Rate limit** : non documenté, en pratique ~100 req/min OK
**Latence live** : ~30s pendant les matches

**Limites** :
- **Non documenté** = peut changer sans préavis (a tenu ~10 ans)
- Pas de SLA, pas de support
- ToS ESPN gris zone (scraping vs API publique informelle)

**Use case pour nous** :
- **Live scoreboard** pendant les gameday (dimanche)
- Boxscores rapides pour engagement temps réel
- Compléments rosters (photos non utilisées, mais bio data utile)

### Pro-Football-Reference (scraping)

**Pourquoi ne pas l'utiliser** :
- ToS interdisent explicitement le scraping commercial
- Risque légal réel (lettres mise en demeure observées)
- nflverse + ESPN couvrent les mêmes besoins

### TheSportsDB

**URL** : <https://www.thesportsdb.com/api.php>

**Couverture** : Basique (équipes, matches, lineups)
**Coût** : Gratuit (Patreon $3/mois pour clé patron)
**Use case** : Backup / cross-check, pas suffisant standalone

## Tier 2 — Abordable ($30-500/mois)

### MySportsFeeds

**URL** : <https://www.mysportsfeeds.com>

**Pricing** :
- Personal use : gratuit (delayed data)
- Indie ($49/mois) : real-time NFL post-game
- Pro ($249/mois) : live play-by-play, ~5s latence
- Enterprise : custom

**Couverture** :
- Play-by-play live (~5s latence en Pro)
- Boxscores temps réel
- Stats joueurs + équipes
- Schedules, standings, odds
- REST API + Push API

**Use case pour nous** :
- Migration depuis Tier 1 quand DAU >5k justifie investissement
- Live in-game engagement (notifs temps réel)

### API-Sports / api-football

**URL** : <https://apisports.io>

**Pricing** :
- Free : 100 req/jour (POC seulement)
- Pro ($29/mois) : 7500 req/jour
- Ultra ($99/mois) : illimité

**Couverture NFL** :
- Schedules, scores, lineups
- Stats joueurs par match
- **Pas de play-by-play live** (limitation)

**Use case** :
- Backup pas cher si nflverse down

### SportsDataIO Fantasy NFL plan

**URL** : <https://sportsdata.io/nfl-api>

**Pricing** :
- Trial : 14 jours gratuit
- Fantasy plan : ~$300-500/mois
- Premium plan : ~$1000+/mois

**Couverture** :
- Fantasy points **pré-calculés** (DK, FD, Yahoo, ESPN)
- Player projections (saison + match)
- Live boxscores, ~10s latence
- Injuries, depth charts, news

**USP** : fantasy-specific, gain de dev sur scoring

**Use case** :
- Si on veut comparer notre scoring BB-SPP avec scoring fantasy classique
- Source secondaire de validation

### Goalserve

**URL** : <https://www.goalserve.com>

**Pricing** : ~$30-100/mois selon volume
**Couverture** : NFL live scores + box scores
**Réputation** : OK mais moins riche que MSF

## Tier 3 — Enterprise ($2000+/mois)

### SportRadar

**URL** : <https://sportradar.com/nfl>

**Pricing** : custom, généralement >$2000/mois pour real-time NFL

**Couverture** :
- Data officielle NFL (partenariat)
- Latence <1s, snap-by-snap
- Tracking joueur (position sur le terrain)
- Player props, injuries en temps réel
- Hundreds of stats par player

**Use case** :
- Si on devient DFS-grade
- Si on veut tracking joueur (heat maps, etc.)
- Hors scope V1/V2

### Stats Perform

**URL** : <https://www.statsperform.com>

**Pricing** : similar à SportRadar
**Réputation** : très utilisé par les bookmakers
**Coverage** : équivalent SportRadar
**Use case** : alternative SportRadar

### Genius Sports

**URL** : <https://www.geniussports.com>

**Pricing** : enterprise
**USP** : data officielle NFL (deal exclusif 2022 pour data DFS)
**Use case** : si on veut data officielle DFS-grade pour les odds

## Architecture d'ingestion proposée

```
┌─────────────────────────────────────────────────────────────┐
│                     INGESTION TIER 1 (MVP)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Cron daily 03:00 UTC                                       │
│  ┌─────────────┐                                            │
│  │  nflverse   │──► fetch latest Parquet ──► normalize     │
│  │  releases   │    + diff vs DB           ─► upsert       │
│  └─────────────┘                                            │
│                                                              │
│  Cron each 5min on gameday (Sun 13h-23h ET)                 │
│  ┌─────────────┐                                            │
│  │ ESPN hidden │──► scoreboard + boxscores ─► normalize    │
│  │     API     │                            ─► upsert      │
│  └─────────────┘                                            │
│                                                              │
│  Settlement cron Tuesday 12:00 UTC                          │
│  ┌─────────────┐                                            │
│  │ Apply rules │──► stats → SPP per player                  │
│  │  + rerolls  │ ──► update standings + level-ups          │
│  │  + prayers  │                                            │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

### Pattern code (suivant les conventions du repo)

```ts
// apps/server/src/services/nfl-ingest.ts

interface IngestResult {
  source: "nflverse" | "espn";
  weekId: string;
  playersUpdated: number;
  gamesUpdated: number;
  errors: ReadonlyArray<{ context: string; error: string }>;
}

// Service pur sauf I/O réseau et Prisma
export async function ingestNflverseWeek(weekId: string): Promise<IngestResult> {
  // 1. Fetch nflverse Parquet
  // 2. Parse + normalize via nfl-mapper (package pur)
  // 3. Upsert Prisma (NflGame, NflGameStat)
  // 4. Return audit log
}

export async function ingestEspnLive(): Promise<IngestResult> {
  // 1. GET scoreboard
  // 2. Pour chaque match in-progress, GET summary
  // 3. Normalize + upsert (NflPlayerLiveStat)
  // 4. Return audit log
}
```

## Estimation coût annuel V1 (Tier 1 seulement)

| Poste | Coût |
|---|---|
| nflverse | 0€ |
| ESPN hidden API | 0€ |
| Hébergement cron (déjà payé) | 0€ |
| Stockage Postgres (déjà payé) | 0€ |
| **Total V1** | **0€/an** |

## Estimation coût V2 (~5-50k DAU)

| Poste | Coût |
|---|---|
| MySportsFeeds Pro | $249/mois = ~$3000/an |
| Backup nflverse | 0€ |
| Storage incrémental | ~$50/mois |
| **Total V2** | **~$3600/an** |

## Estimation coût V3 (>50k DAU, DFS-grade)

| Poste | Coût |
|---|---|
| SportRadar real-time | ~$30-60k/an |
| Backup MSF | $3000/an |
| Storage + bandwidth | ~$2000/an |
| **Total V3** | **~$40-65k/an** |

## Plan de migration tier par tier

```
V1 (POC + MVP commercial)
└── nflverse (post-match) + ESPN (gameday live)
    └── Tient jusqu'à ~10k DAU

V2 (Scale)
└── Si DAU >5k OU si engagement live <3min/match
    └── + MySportsFeeds Pro ($249/mois)
    └── Tient jusqu'à ~50k DAU

V3 (DFS-grade)
└── Si pivot DFS ou audience pro
    └── SportRadar ou Stats Perform
```

## Décisions techniques

### Cache stratégique

- **Stats games passés** : immutables → cache infini Redis + DB
- **Live scoreboard** : TTL 30s
- **Rosters joueurs** : TTL 24h (refresh quotidien)
- **Schedules** : TTL 7j (refresh hebdo, mais MAJ instantanée sur trade)

### Idempotence ingestion

Suivre le pattern Q.D.1 du CLAUDE.md (settle services idempotents) :
- Chaque `ingestNflverseWeek(weekId)` skip les stats déjà ingérées
- `upsert` avec contrainte `@@unique([gameId, playerId, statType])`
- Audit log en table dédiée (`NflIngestRun`)

### Replay déterministe

Les events ingérés doivent être replay-friendly. Stockage en JSON
versionné avec hash de l'event source ⇒ on peut re-jouer le scoring
si on change les règles `stats-to-spp.ts`.

```ts
// Pattern Q.A.2 : snapshot lazy compute avec staleness
interface NflWeekScore {
  weekId: string;
  computedAt: Date;
  sourceHash: string;  // hash du payload nflverse
  scoringVersion: string; // version de stats-to-spp.ts
  spp: Record<NflPlayerId, number>;
}

// Si scoringVersion change ⇒ recompute
// Si sourceHash change (data updated) ⇒ recompute
```

## Risques API

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| ESPN hidden API change format | Moyenne | Élevé | Tests automatisés daily, fallback nflverse |
| ESPN hidden API totalement supprimée | Faible | Élevé | Migrer MSF d'urgence |
| nflverse maintenance discontinue | Très faible | Critique | Open source community, low risk |
| MSF rate limits dépassés | Moyenne | Modéré | Cache agressif, queue retry |
| SportRadar price hike | Moyenne | Élevé | Contrats annuels, fallback MSF |

## TODOs avant V1

- [ ] POC ingestion `nflverse` : pull 1 semaine de stats, normalize, store
- [ ] POC ESPN scoreboard : poll pendant 1 gameday, valider stabilité
- [ ] Schéma Prisma `NflGame`, `NflGameStat`, `NflPlayer`, `NflIngestRun`
- [ ] Service `nfl-ingest.ts` idempotent avec audit log
- [ ] Cron orchestration (Tasks/Bull/etc. selon stack existante)
- [ ] Monitoring : alertes si nflverse ou ESPN failent
- [ ] Tests E2E ingestion sur fixtures saison 2025
