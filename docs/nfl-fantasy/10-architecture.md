# 10 — Architecture monorepo

> Intégration du module NFL Fantasy dans le monorepo existant.
> Respecte les conventions documentées dans `CLAUDE.md` :
> packages purs, services Express + Prisma, Zod validation, tests
> Vitest, patterns idempotents.

## Vue d'ensemble

```
fantasy-football-game/
├── apps/
│   ├── server/                # Express + Prisma
│   │   └── src/
│   │       ├── services/
│   │       │   ├── nfl-ingest.ts            ★ NEW
│   │       │   ├── nfl-fantasy-league.ts    ★ NEW
│   │       │   ├── nfl-fantasy-lineup.ts    ★ NEW
│   │       │   ├── nfl-fantasy-scoring.ts   ★ NEW
│   │       │   └── nfl-fantasy-mercato.ts   ★ NEW
│   │       └── routes/
│   │           ├── nfl-fantasy-leagues.ts   ★ NEW
│   │           ├── nfl-fantasy-lineups.ts   ★ NEW
│   │           ├── nfl-fantasy-mercato.ts   ★ NEW
│   │           └── nfl-rosters.ts           ★ NEW
│   ├── web/                   # Next.js 14
│   │   └── app/
│   │       └── nfl-fantasy/                 ★ NEW
│   │           ├── page.tsx
│   │           ├── leagues/[id]/page.tsx
│   │           ├── lineup/page.tsx
│   │           └── mercato/page.tsx
│   └── mobile/                # Expo
│       └── (équivalent web)
├── packages/
│   ├── nfl-mapper/                          ★ NEW package
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── team-to-race.ts            # 32 NFL teams → race BB
│   │   │   ├── position-to-bb.ts          # NFL pos → BB pos par race
│   │   │   ├── stats-to-spp.ts            # Stats NFL → SPP BB
│   │   │   ├── rerolls.ts                 # Logique relances
│   │   │   ├── inducements.ts             # Logique inducements
│   │   │   ├── prayers.ts                 # Logique prières Nuffle
│   │   │   ├── pseudonymize.ts            # Génération pseudos
│   │   │   ├── archetype.ts               # Player → archetype (speed/power/...)
│   │   │   └── narrative.ts               # Stat line → Gazette text
│   │   ├── data/
│   │   │   ├── teams.json                 # 32 teams + race assignment
│   │   │   ├── rosters-2025.json          # Rosters 2025 mapped
│   │   │   ├── rosters-2026.json          # Saison suivante (post-FA)
│   │   │   └── pseudonyms.json            # Mapping privé player → pseudo
│   │   ├── __tests__/
│   │   │   ├── stats-to-spp.test.ts
│   │   │   ├── prayers.test.ts
│   │   │   ├── rerolls.test.ts
│   │   │   └── inducements.test.ts
│   │   └── package.json
│   ├── sim-engine/            # existant (réutilisé : attributeSpp)
│   ├── game-engine/           # existant
│   └── shared-types/          # existant (étendu avec types NFL)
├── prisma/
│   └── schema.prisma          # étendu (cf. § Schéma Prisma)
└── docs/
    └── nfl-fantasy/           # cette doc
```

## Package `nfl-mapper` (pure logic)

Suit le pattern existant des packages purs (`sim-engine`, `game-engine`) :
- **Pas d'I/O** (pas de Prisma, pas de fetch)
- **Pas de side effects**
- **Testable** en unit avec Vitest sans setup
- **Réutilisable** côté backend, frontend, et CLI

### `team-to-race.ts`

```ts
export type BbRace =
  | "Skaven" | "WoodElf" | "Orc" | "Human"
  | "Norse" | "Dwarf" | "Khorne" | "Necromantic";

export type NflTeamCode =
  | "KC" | "MIA" | "HOU" | "ARI"
  | "CIN" | "LAR" | "JAX" | "WAS"
  | "BAL" | "PHI" | "PIT" | "SF"
  | "DAL" | "GB"  | "ATL" | "SEA"
  | "BUF" | "MIN" | "DET" | "CHI"
  | "NYG" | "CLE" | "IND" | "NE"
  | "NYJ" | "LV"  | "LAC" | "TB"
  | "TEN" | "DEN" | "CAR" | "NO";

export interface TeamMeta {
  code: NflTeamCode;
  city: string;        // "Kansas City"
  race: BbRace;
  raceLabel: string;   // "Kansas City Skaven"
  cityDisambiguation?: string; // "(G-side)" pour NYG, "(R-side)" pour LAR
  palette: { primary: string; secondary: string; accent: string };
}

export function getTeamMeta(code: NflTeamCode): TeamMeta;
export function getAllTeams(): readonly TeamMeta[];
export function getTeamsByRace(race: BbRace): readonly TeamMeta[];
```

### `stats-to-spp.ts`

```ts
import type { NflPlayerStatLine, SppBreakdown, BbPosition } from "./types";

export function computeSpp(stat: NflPlayerStatLine): SppBreakdown;
```

(Voir [`06-scoring.md`](./06-scoring.md) pour la spec complète.)

### `prayers.ts`, `rerolls.ts`, `inducements.ts`

Voir [`07-mechanics.md`](./07-mechanics.md) pour la spec complète.

### `pseudonymize.ts`

```ts
export interface PseudonymOptions {
  cityTag: string;       // "Kansas City"
  bbPosition: BbPosition;
  jerseyNumber: number;
  archetype: PlayerArchetype;
}

export function generatePseudonym(opts: PseudonymOptions): string {
  // Ex: "Le Sidearm Wizard de Kansas City, #15"
}
```

## Services backend (`apps/server/src/services/`)

### `nfl-ingest.ts`

```ts
export async function ingestNflverseWeek(weekId: string): Promise<IngestResult>;
export async function ingestEspnLive(): Promise<IngestResult>;
export async function ingestRosters(seasonId: string): Promise<RosterUpdateResult>;
```

Pattern : idempotent, audit log persistent (`NflIngestRun`), retry queue.

### `nfl-fantasy-league.ts`

```ts
export async function createLeague(opts: {
  ownerId: string;
  name: string;
  size: number;
  type: "public" | "private";
  draftMode: "snake" | "auction" | "free";
}): Promise<NflFantasyLeague>;

export async function joinLeague(leagueId: string, userId: string): Promise<void>;
export async function startSeason(leagueId: string): Promise<void>;
```

### `nfl-fantasy-lineup.ts`

```ts
export async function setLineup(opts: {
  entryId: string;
  weekId: string;
  starters: ReadonlyArray<{ playerId: string; bbPosition: BbPosition }>;
  captainId: string;
}): Promise<NflFantasyLineup>;

export async function lockLineups(weekId: string): Promise<void>;
// Idempotent — appelé à kickoff Sunday
```

### `nfl-fantasy-scoring.ts`

```ts
export async function settleNflFantasyWeek(weekId: string): Promise<SettleResult>;
// Pour chaque matchup, applique :
// 1. computeSpp pour chaque starter (pure)
// 2. Apply rerolls (pure + pool update)
// 3. Apply inducements (pure + slot consume)
// 4. Apply prayers (pure + log)
// 5. Compute totals + winner
// 6. Persist scores + standings
// Idempotent (pattern Q.D.1)
```

### `nfl-fantasy-mercato.ts`

```ts
export async function listMarketplaceItems(filters: MercatoFilters): Promise<MercatoListing[]>;
export async function buyItem(itemId: string, userId: string): Promise<MercatoTransaction>;
// Réutilise Wallet existant (gold)
```

## Routes Express (`apps/server/src/routes/`)

Suit le pattern existant : Zod validation, middleware `authUser` / `adminOnly`,
erreurs typées via `class XxxError extends Error`.

```ts
// routes/nfl-fantasy-leagues.ts
import { Router } from "express";
import { z } from "zod";
import { authUser } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createLeague, joinLeague } from "../services/nfl-fantasy-league";

const router = Router();

const createLeagueSchema = z.object({
  name: z.string().min(3).max(50),
  size: z.number().int().min(2).max(16),
  type: z.enum(["public", "private"]),
  draftMode: z.enum(["snake", "auction", "free"]),
});

router.post("/", authUser, validate(createLeagueSchema), async (req, res) => {
  const league = await createLeague({
    ownerId: req.user!.id,
    ...req.body,
  });
  res.status(201).json(league);
});

// ... autres handlers

export default router;
```

## Schéma Prisma (ajouts)

```prisma
// prisma/schema.prisma — additions

// ─── Référentiel NFL ─────────────────────────────────────────

model NflSeason {
  id        String   @id // "2025-26"
  startDate DateTime
  endDate   DateTime
  status    String   // "upcoming" | "in_progress" | "completed"

  weeks     NflWeek[]
  games     NflGame[]
  rosters   NflRosterSnapshot[]
}

model NflWeek {
  id          String   @id // "2025-26:W1"
  seasonId    String
  weekNumber  Int      // 1-18 regular + 19-22 playoffs
  startDate   DateTime
  endDate     DateTime
  isPlayoffs  Boolean  @default(false)

  season      NflSeason @relation(fields: [seasonId], references: [id])
  games       NflGame[]
  matchups    NflFantasyMatchup[]

  @@index([seasonId, weekNumber])
}

model NflTeam {
  code      String   @id // "KC", "MIA", ...
  city      String   // "Kansas City"
  bbRace    String   // "Skaven", "Orc", ...
  raceLabel String   // "Kansas City Skaven"

  homeGames NflGame[] @relation("HomeTeam")
  awayGames NflGame[] @relation("AwayTeam")
  players   NflPlayer[]
}

model NflPlayer {
  id              String   @id // ID stable (e.g. nflverse player_id)
  realName        String   // PRIVÉ — pour mapping seulement
  pseudonym       String   // "Le Sidearm Wizard de Kansas City, #15"
  teamCode        String?
  jerseyNumber    Int?
  nflPosition     String   // "QB", "WR", "RB", ...
  bbPosition      String   // "Thrower", "Catcher", ...
  bbStats         Json     // { ma, st, ag, pa, av }
  bbSkills        Json     // string[]
  archetype       Json     // { speedScore, powerScore, ... }
  status          String   @default("active") // active | ir | retired | suspended
  retiredAt       DateTime?

  team            NflTeam? @relation(fields: [teamCode], references: [code])
  gameStats       NflGameStat[]

  @@index([teamCode, bbPosition])
  @@index([status])
}

model NflGame {
  id          String   @id // nflverse game_id
  seasonId    String
  weekId      String
  homeTeam    String
  awayTeam    String
  homeScore   Int?
  awayScore   Int?
  kickoffAt   DateTime
  status      String   // "scheduled" | "in_progress" | "final"

  week        NflWeek @relation(fields: [weekId], references: [id])
  home        NflTeam @relation("HomeTeam", fields: [homeTeam], references: [code])
  away        NflTeam @relation("AwayTeam", fields: [awayTeam], references: [code])
  stats       NflGameStat[]

  @@index([weekId])
}

model NflGameStat {
  id          String   @id @default(cuid())
  gameId      String
  playerId    String
  rawStats    Json     // toutes stats brutes (yards, TD, etc.)
  computedSpp Int?     // SPP calculé via computeSpp()
  sppBreakdown Json?   // detail des events SPP
  ingestSource String  // "nflverse" | "espn" | "manual"
  ingestedAt  DateTime @default(now())

  game        NflGame @relation(fields: [gameId], references: [id])
  player      NflPlayer @relation(fields: [playerId], references: [id])

  @@unique([gameId, playerId])
  @@index([playerId])
}

// ─── Snapshots roster (pour historique) ──────────────────────

model NflRosterSnapshot {
  id          String   @id @default(cuid())
  seasonId    String
  teamCode    String
  snapshotAt  DateTime @default(now())
  roster      Json     // players: [{ id, jersey, pos, bbPos, ... }]

  season      NflSeason @relation(fields: [seasonId], references: [id])

  @@index([seasonId, teamCode])
}

model NflIngestRun {
  id          String   @id @default(cuid())
  source      String   // "nflverse" | "espn"
  weekId      String?
  startedAt   DateTime @default(now())
  completedAt DateTime?
  status      String   // "success" | "partial" | "failed"
  result      Json     // { gamesUpdated, playersUpdated, errors }
}

// ─── Fantasy game (côté user) ────────────────────────────────

model NflFantasyLeague {
  id          String   @id @default(cuid())
  name        String
  ownerId     String
  size        Int
  type        String   // "public" | "private"
  draftMode   String   // "snake" | "auction" | "free"
  status      String   // "draft" | "in_progress" | "completed"
  seasonId    String
  createdAt   DateTime @default(now())

  entries     NflFantasyEntry[]
  matchups    NflFantasyMatchup[]

  @@index([ownerId])
  @@index([status])
}

model NflFantasyEntry {
  id          String   @id @default(cuid())
  leagueId    String
  userId      String
  teamName    String   // ex: "Krak'Skar Stompers"
  bbRace      String?  // Race assignée (cf. variante "Pure BB")
  totalTV     Int      @default(0) // somme des "team values" des joueurs

  league      NflFantasyLeague @relation(fields: [leagueId], references: [id])
  roster      NflFantasyRoster[]
  lineups     NflFantasyLineup[]
  rerolls     NflFantasyReroll[]
  inducements NflFantasyInducement[]
  prayers     NflFantasyPrayer[]

  @@unique([leagueId, userId])
}

model NflFantasyRoster {
  id          String   @id @default(cuid())
  entryId     String
  playerId    String   // NflPlayer.id
  acquiredAt  DateTime @default(now())
  acquiredVia String   // "draft" | "mercato" | "trade"
  tvCost      Int      // valeur en gold

  entry       NflFantasyEntry @relation(fields: [entryId], references: [id])

  @@unique([entryId, playerId])
}

model NflFantasyLineup {
  id          String   @id @default(cuid())
  entryId     String
  weekId      String
  captainId   String?  // playerId du captain
  lockedAt    DateTime?
  totalSpp    Int?     // calculé après settlement

  entry       NflFantasyEntry @relation(fields: [entryId], references: [id])
  starters    NflFantasyLineupStarter[]

  @@unique([entryId, weekId])
}

model NflFantasyLineupStarter {
  id          String   @id @default(cuid())
  lineupId    String
  playerId    String
  bbPosition  String
  isCaptain   Boolean  @default(false)
  rawSpp      Int?     // avant multipliers
  finalSpp    Int?     // après multipliers + rerolls + prayers + inducements
  sppBreakdown Json?

  lineup      NflFantasyLineup @relation(fields: [lineupId], references: [id])

  @@unique([lineupId, playerId])
}

model NflFantasyMatchup {
  id          String   @id @default(cuid())
  leagueId    String
  weekId      String
  homeEntryId String
  awayEntryId String
  homeScore   Int?
  awayScore   Int?
  winnerId    String?
  settledAt   DateTime?

  league      NflFantasyLeague @relation(fields: [leagueId], references: [id])

  @@index([leagueId, weekId])
}

model NflFantasyReroll {
  id          String   @id @default(cuid())
  entryId     String
  type        String   // "team" | "skill" | "assistant_coach"
  source      String   // "starter" | "purchased" | "achievement" | "skill_pro"
  used        Boolean  @default(false)
  usedAt      DateTime?
  weekId      String?
  matchupId   String?
  appliedTo   String?

  entry       NflFantasyEntry @relation(fields: [entryId], references: [id])

  @@index([entryId, used])
}

model NflFantasyInducement {
  id          String   @id @default(cuid())
  entryId     String
  type        String   // InducementId
  slot        String?  // "defensive" | "offensive" | "wildcard"
  used        Boolean  @default(false)
  usedAt      DateTime?
  weekId      String?
  matchupId   String?
  targetId    String?
  meta        Json?

  entry       NflFantasyEntry @relation(fields: [entryId], references: [id])

  @@index([entryId, used])
}

model NflFantasyPrayer {
  id          String   @id @default(cuid())
  entryId     String
  weekId      String
  matchupId   String
  prayerId    String
  rolledAt    DateTime @default(now())
  seed        String
  targetId    String?
  applied     Boolean  @default(false)
  appliedAt   DateTime?
  effectLog   String?

  entry       NflFantasyEntry @relation(fields: [entryId], references: [id])

  @@unique([entryId, weekId, prayerId])
}
```

## Cron jobs / scheduled tasks

Suivant le pattern existant (vraisemblablement Bull / Task queue) :

```ts
// apps/server/src/jobs/nfl-fantasy.ts

// Quotidien 03:00 UTC : pull nflverse
cron.schedule("0 3 * * *", async () => {
  await ingestNflverseLatest();
});

// Toutes les 5min sur gameday : pull ESPN live
cron.schedule("*/5 13-23 * * 0", async () => {
  // Dimanche 13h-23h ET
  await ingestEspnLive();
});

// Settlement Mardi 12:00 UTC
cron.schedule("0 12 * * 2", async () => {
  const lastWeek = getPreviousWeekId();
  await settleNflFantasyWeek(lastWeek);
});

// Lock lineups Sunday 17:00 UTC (12:00 ET)
cron.schedule("0 17 * * 0", async () => {
  const currentWeek = getCurrentWeekId();
  await lockLineups(currentWeek);
});
```

## Frontend Next.js (`apps/web/app/nfl-fantasy/`)

### Pages clés

```tsx
// app/nfl-fantasy/page.tsx — Dashboard
// app/nfl-fantasy/leagues/page.tsx — Liste des leagues
// app/nfl-fantasy/leagues/[id]/page.tsx — Détail league + standings
// app/nfl-fantasy/leagues/[id]/draft/page.tsx — Draft live
// app/nfl-fantasy/lineup/page.tsx — Set lineup hebdo
// app/nfl-fantasy/mercato/page.tsx — Marketplace inducements/rerolls
// app/nfl-fantasy/players/[id]/page.tsx — Fiche joueur (pseudo)
// app/nfl-fantasy/gazette/[matchupId]/page.tsx — Match report narratif
```

### Composants

```tsx
// app/nfl-fantasy/components/
//   LineupBuilder.tsx       — Drag-and-drop lineup
//   PlayerCard.tsx          — Avatar BB + stats + pseudo
//   InducementSlot.tsx      — Selector d'inducement
//   PrayerNotice.tsx        — Affiche prayers rolled
//   RerollButton.tsx        — Toggle auto-reroll
//   MatchupScoreboard.tsx   — Standing live
//   GazetteCard.tsx         — Récit narratif
```

### Réutilisations

- `apiRequest<T>` existant pour les fetchs
- `useLanguage()` pour i18n (FR/EN)
- `data-testid` parlants : `nfl-lineup-builder`, `prayer-card-friends-ref`, etc.
- Promise.all([detail, optional]) pour load parallel (pattern Q.B.3)

## Tests

Coverage cible 80% suivant les rules existantes.

### Unit (Vitest)

```
packages/nfl-mapper/__tests__/
├── stats-to-spp.test.ts          # Scoring deterministe
├── prayers.test.ts               # Roll + apply
├── rerolls.test.ts               # Apply + pool
├── inducements.test.ts           # Apply + slot
├── pseudonymize.test.ts          # Génération pseudos
└── team-to-race.test.ts          # Mapping complet 32 teams
```

### Integration (Vitest + SQLite mirror)

```
apps/server/src/services/__tests__/
├── nfl-ingest.test.ts            # Mock nflverse + ESPN
├── nfl-fantasy-scoring.test.ts   # Settlement end-to-end
├── nfl-fantasy-lineup.test.ts    # Lock + validation
└── nfl-fantasy-league.test.ts    # CRUD league
```

### E2E (Playwright)

```
apps/web/e2e/nfl-fantasy/
├── create-league.spec.ts
├── set-lineup.spec.ts
├── use-inducement.spec.ts
└── view-gazette.spec.ts
```

### Tests à écrire en priorité (TDD)

1. `computeSpp` pour chaque archétype (QB, WR, RB, DE, DT, LB, CB)
2. `rollPrayers` déterministe avec seed
3. `applyPrayer` pour chaque prayer ID
4. `shouldRollPrayers` selon différence TV
5. `pseudonymize` reproductible

## Migration / déploiement

Pattern existant : Prisma migrations + déploiement via Turbo.

```bash
# 1. Schema diff
npx prisma migrate dev --name add-nfl-fantasy

# 2. Seed data initial
pnpm seed:nfl-teams
pnpm seed:nfl-players-2025

# 3. Build + test
pnpm turbo build
pnpm turbo test

# 4. Deploy (workflow existant)
```

## Dépendances externes (à ajouter)

```json
// packages/nfl-mapper/package.json
{
  "dependencies": {
    "seedrandom": "^3.0.5",     // pour rollPrayers déterministe
    "zod": "^3.x"               // déjà présent monorepo
  },
  "devDependencies": {
    "vitest": "^1.x"            // déjà présent monorepo
  }
}

// apps/server/package.json (ajouts)
{
  "dependencies": {
    "parquetjs": "^0.11.x",     // pour ingest nflverse
    "node-cron": "^3.x"         // si pas déjà présent
  }
}
```

## Plan d'implémentation phasé

### Phase 1 — Foundation (semaine 1-2)
- [ ] Créer package `nfl-mapper` squelette
- [ ] Implémenter `team-to-race.ts` + `data/teams.json`
- [ ] Implémenter `position-to-bb.ts` + tests
- [ ] Implémenter `stats-to-spp.ts` + tests exhaustifs
- [ ] Implémenter `pseudonymize.ts`
- [ ] Schéma Prisma + migration

### Phase 2 — Data ingestion (semaine 3-4)
- [ ] Service `nfl-ingest.ts` (nflverse + ESPN)
- [ ] Cron jobs configurés
- [ ] Seed initial : 32 teams + rosters 2025
- [ ] Tests E2E ingest sur fixtures

### Phase 3 — Game logic (semaine 5-6)
- [ ] `rerolls.ts` + tests
- [ ] `inducements.ts` + tests
- [ ] `prayers.ts` + tests
- [ ] Service `nfl-fantasy-scoring.ts` (settlement)

### Phase 4 — User-facing (semaine 7-9)
- [ ] Services league + lineup + mercato
- [ ] Routes Express
- [ ] Pages Next.js (lineup builder, dashboard, mercato)
- [ ] E2E Playwright golden path

### Phase 5 — Polish (semaine 10-11)
- [ ] Gazette narrative integration
- [ ] Badge unlocks NFL Fantasy
- [ ] i18n FR/EN
- [ ] Avatars BB par race+poste

### Phase 6 — Beta (semaine 12)
- [ ] Beta privée 50 users
- [ ] Monitoring + feedback
- [ ] Itération scoring (calibration)

## Risques techniques

| Risque | Mitigation |
|---|---|
| nflverse format change | Tests automatisés daily, fallback ESPN |
| ESPN hidden API breaks | Migration MSF rapide, alertes monitoring |
| Calibration SPP off | Beta privée pour ajuster avant prod |
| Conflits avec Pro League existante | Tests d'intégration, séparation claire des modules |
| Performance ingestion volumineuse | Streaming Parquet, batch upsert |
| Latence settlement | Queue + parallélisme par matchup |

## Décisions à prendre avant Phase 1

Voir [`00-vision.md` § "Questions ouvertes"](./00-vision.md#questions-ouvertes) :

1. Mode mercato (draft snake / auction / free)
2. League size (8 / 10 / 12)
3. Captain multiplier (×1.5 / ×2)
4. Underdog trigger (TV / classement)
5. Race assignment (team-fixe / archetype / hybride)
6. Cross-pollution Pro League
7. Monétisation (freemium / subscription)
8. NFLPA licence (jamais / dès le départ)
