# 13 — Roster + Lineup (Phase 2.D)

> Deux services qui pose la couche "ma team de la semaine" :
> `nfl-fantasy-roster.ts` (qui possede quoi) et
> `nfl-fantasy-lineup.ts` (qui joue ce dimanche).

## Modeles Prisma ajoutes

```prisma
model NflFantasyRoster {
  id          String   @id @default(cuid())
  entryId     String
  playerId    String                       // NflPlayer.id (FK logique)
  acquiredVia String   @default("draft")   // draft | mercato | trade | free_agent
  acquiredAt  DateTime @default(now())
  tvCost      Int      @default(0)         // TV frozen au moment de l'acquisition
  entry       NflFantasyEntry @relation(... onDelete: Cascade)
  @@unique([entryId, playerId])
  @@index([playerId])
}

model NflFantasyLineup {
  id            String    @id @default(cuid())
  entryId       String
  weekId        String                     // "{year}:W{n}"
  captainId     String?                    // doit etre dans starters
  viceCaptainId String?                    // doit etre dans starters, != captain
  lockedAt      DateTime?                  // set par lockLineups(weekId)
  totalSpp      Int?                       // settle Phase 2.E
  ...
  starters      NflFantasyLineupStarter[]
  @@unique([entryId, weekId])
  @@index([weekId])
}

model NflFantasyLineupStarter {
  id            String  @id @default(cuid())
  lineupId      String
  playerId      String
  bbPosition    String                     // snapshot, evite drift au re-mapping
  isCaptain     Boolean @default(false)
  isViceCaptain Boolean @default(false)
  rawSpp        Int?                       // settle Phase 2.E
  finalSpp      Int?                       // apres multipliers + bonus
  sppBreakdown  Json?
  ...
  @@unique([lineupId, playerId])
}
```

## API roster service

| Fonction | Garde |
|---|---|
| `addPlayerToRoster({ entryId, playerId, acquiredVia?, tvCost? })` | entry + player existent, pas deja sur le roster ; update `entry.totalTV += tvCost` en transaction |
| `removePlayerFromRoster({ entryId, playerId })` | sur le roster ; update `entry.totalTV -= tvCost` |
| `getRoster(entryId)` | tri `acquiredAt asc` |
| `isPlayerOnRoster(entryId, playerId)` | helper read-only |

Erreur typee `NflFantasyRosterError` : `ENTRY_NOT_FOUND` /
`PLAYER_NOT_FOUND` / `PLAYER_ALREADY_ON_ROSTER` / `PLAYER_NOT_ON_ROSTER`.

Pas de "cap salarial" en V1 (Q7 freemium).

## API lineup service

| Fonction | Comportement |
|---|---|
| `getLineup({ entryId, weekId })` | retourne `NflFantasyLineup + starters[]` ou `null` |
| `setLineup({ entryId, weekId, starters, captainId, viceCaptainId? })` | upsert atomique (replace starters), validations strictes |
| `lockLineups(weekId)` | bulk `lockedAt = now()` pour les non-lockees (idempotent) |
| `isLineupLocked({ entryId, weekId })` | helper read-only |

### Validation `setLineup`

Pur helper `validateLineupStructure(opts)` :
- 11 starters obligatoires (override via `startersCount`)
- Pas de doublon playerId
- `captainId` ∈ starters
- `viceCaptainId` ∈ starters et != captainId

Cote DB :
- Entry existe
- Tous les `starters[].playerId` sont dans le NflFantasyRoster de l'entry
- Lineup pas deja `lockedAt`

### Multipliers Q3

- `CAPTAIN_MULTIPLIER = 1.5`
- `VICE_CAPTAIN_MULTIPLIER = 1.2`

Constantes exportees, utilisees par Phase 2.E `settleNflFantasyWeek`.

### Codes d'erreur `NflFantasyLineupError`

`ENTRY_NOT_FOUND` / `LINEUP_LOCKED` / `INVALID_STARTERS` /
`PLAYER_NOT_ON_ROSTER` / `DUPLICATE_PLAYER` /
`CAPTAIN_NOT_IN_STARTERS` / `VICE_NOT_IN_STARTERS` /
`CAPTAIN_EQUALS_VICE` / `INVALID_LINEUP_SIZE`.

## Tests + E2E

- `nfl-fantasy-roster.test.ts` : **11 tests verts**
- `nfl-fantasy-lineup.test.ts` : **24 tests verts**
- E2E `nfl-fantasy-lineup-e2e.ts` sur DB Postgres reelle : **8 etapes OK**
  (add x11, totalTV=110, setLineup, idempotent, rejet
  `PLAYER_NOT_ON_ROSTER`, lockLineups, rejet `LINEUP_LOCKED`,
  removePlayer decrement totalTV)

## Hors scope (phases suivantes)

- **Draft snake/auction/free** : service dedie en Phase 2.D' (non
  livre dans ce lot). Pour V1 le roster est rempli par `addPlayerToRoster`
  appele manuellement / par seed.
- **Settle SPP** (rawSpp / finalSpp / totalSpp) : Phase 2.E.
- **Rerolls / inducements / prayers appliques au lineup** : Phase 2.F.
