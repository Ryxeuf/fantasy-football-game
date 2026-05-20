# 12 — League CRUD (Phase 2.C)

> Service `nfl-fantasy-league.ts` qui pose les fondations cote
> utilisateur : creer / rejoindre / quitter / configurer une league.
> Pas encore de draft, lineup ou scoring (Phases 2.D-2.E).

## Modeles Prisma ajoutes

```prisma
model NflFantasyLeague {
  id         String   @id @default(cuid())
  name       String           // 3-50 chars
  ownerId    String           // User.id, sans FK explicite (Q6 silos)
  size       Int      @default(10)  // Q2 default 10, range 2-16
  type       String   @default("private")  // "public" | "private"
  draftMode  String   @default("snake")    // "snake" | "auction" | "free"
  status     String   @default("draft")    // draft | in_progress | completed
  seasonId   String                        // FK logique NflSeason.id
  inviteCode String?  @unique              // 8 char alphanum (private only)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  entries NflFantasyEntry[]

  @@index([ownerId])
  @@index([status, type])
  @@index([seasonId])
}

model NflFantasyEntry {
  id       String   @id @default(cuid())
  leagueId String
  userId   String
  teamName String   // 3-50 chars, unique par league
  bbRace   String?  // null en V1 (Q5 race fixe via teamCode)
  totalTV  Int      @default(0)
  joinedAt DateTime @default(now())

  league NflFantasyLeague @relation(fields: [leagueId], references: [id], onDelete: Cascade)

  @@unique([leagueId, userId])
  @@unique([leagueId, teamName])
  @@index([userId])
}
```

**Choix d'architecture** :
- `ownerId` / `userId` sont des `String` sans relation Prisma vers
  `User` pour eviter de toucher au modele User existant (deja gros).
  Contrainte d'integrite assuree au niveau service / routes.
- `inviteCode` est unique en DB ; alphabet sans `I/L/O/0/1` pour eviter
  les confusions visuelles (32^8 ~= 1.1e12 codes possibles).
- `onDelete: Cascade` sur `NflFantasyEntry.leagueId` : supprimer la
  league supprime ses entries.

Migration appliquee via la "Voie B" (cf. memo `nuffle-arena DB reset
via container`) : `prisma migrate diff --from-url $DATABASE_URL
--to-schema-datamodel` + `prisma db execute`.

## API service

| Fonction | Signature courte | Garde |
|---|---|---|
| `createLeague` | `(ownerId, name, teamName, seasonId, size?, type?, draftMode?)` | season existe |
| `getLeague` | `(leagueId)` | NOT_FOUND |
| `listLeaguesForUser` | `(userId, { status? })` | filtre status optionnel |
| `joinLeague` | `({ userId, teamName, leagueId? | inviteCode? })` | status draft + pas full + pas deja membre |
| `leaveLeague` | `({ leagueId, userId })` | status draft + pas owner |
| `updateLeague` | `({ leagueId, userId, name?, type?, size? })` | owner + draft + size >= entries |
| `deleteLeague` | `({ leagueId, userId })` | owner + draft |

### Defaults

- `size` : **10** (Q2, MPG-like)
- `type` : **private** (invite-only par defaut)
- `draftMode` : **snake** (Q1)

### Pivots `type`

- `private -> public` : `inviteCode` passe a `null` (la league devient
  decouvrable par id).
- `public -> private` : un nouvel `inviteCode` est genere.

### Erreurs typees

`NflFantasyLeagueError` avec codes :

| Code | Cas |
|---|---|
| `NOT_FOUND` | league / user non trouve |
| `NOT_OWNER` | operation requiert le proprietaire |
| `ALREADY_JOINED` | user deja membre |
| `FULL` | entries >= size |
| `INVALID_STATUS` | operation hors phase draft |
| `OWNER_CANNOT_LEAVE` | owner doit deleteLeague (V2 = transfer) |
| `SEASON_NOT_FOUND` | seasonId inexistant |
| `INVALID_INVITE` | code absent ou invalide |
| `INVALID_NAME` / `INVALID_TEAM_NAME` / `INVALID_SIZE` | validations |
| `TEAM_NAME_TAKEN` | (P2002) deux entries avec meme teamName |

Mapping HTTP cote Phase 2.G : 404 (NOT_FOUND, INVALID_INVITE,
SEASON_NOT_FOUND), 403 (NOT_OWNER), 409 (ALREADY_JOINED, FULL,
INVALID_STATUS, OWNER_CANNOT_LEAVE, TEAM_NAME_TAKEN), 422 (INVALID_*).

## Validation E2E

Script dedie `apps/server/src/scripts/nfl-fantasy-league-e2e.ts` qui
joue 10 etapes sur la **vraie DB Postgres** du dev stack :

```
docker exec nufflearena_server sh -c "cd /app/apps/server && \
  pnpm exec tsx src/scripts/nfl-fantasy-league-e2e.ts"
```

Etapes (toutes OK, 2026-05-20) :

1. createLeague (private) -> inviteCode genere + entry owner
2. getLeague + 1 entry
3. joinLeague via inviteCode -> entry member
4. getLeague -> 2 entries
5. listLeaguesForUser(member) contient la league
6. joinLeague double -> ALREADY_JOINED ✓
7. updateLeague rename
8. updateLeague pivot public -> inviteCode = null
9. leaveLeague(member) -> 1 entry restante
10. deleteLeague(owner) -> NOT_FOUND apres

Cleanup automatique en fin de run (les IDs utilises sont prefixes
`e2e-*-{timestamp}`).

## Tests unitaires

`apps/server/src/services/nfl-fantasy-league.test.ts` : **37 tests
verts** couvrant :
- `generateInviteCode` (forme + entropie sur 100 tirages)
- `createLeague` defaults + invite code + season missing + validations
- `getLeague` + `listLeaguesForUser`
- `joinLeague` (id, code, full, already, status, P2002)
- `leaveLeague` (member, owner, status, not-member)
- `updateLeague` (name, size, pivot type, refus size < entries, NOT_OWNER, status)
- `deleteLeague`
- `NflFantasyLeagueError` (preserve code + name)
- Constantes `DEFAULT_LEAGUE_SIZE=10` / `MIN=2` / `MAX=16`

## Hors scope Phase 2.C

Reporte aux phases suivantes :
- **Draft** (snake / auction / free) -> service dedie 2.D
- **Roster** (player picks par entry) -> 2.D
- **Lineup** hebdo (starters + captain/vice) -> 2.D
- **Matchups** + scheduling -> 2.E (genere quand status passe draft -> in_progress)
- **Settlement** hebdo (SPP -> scores) -> 2.E
- **Mercato** (gold inducements/rerolls) -> 2.F
- **Routes admin** Express -> 2.G
- **Transfer ownership** -> V2
