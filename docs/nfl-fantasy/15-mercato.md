# 15 — Mercato : rerolls + inducements (Phase 2.F)

> Service `nfl-fantasy-mercato.ts` qui gere les ressources d'une
> entry au sein d'une saison : pool de rerolls + slots d'inducement
> par matchup.

## Modeles Prisma ajoutes

```prisma
model NflFantasyReroll {
  id        String   @id @default(cuid())
  entryId   String
  type      String   @default("team_reroll")    // team_reroll | skill_reroll | assistant_coach
  source    String   @default("starter")        // starter | purchased | achievement | mercato | reward
  used      Boolean  @default(false)
  usedAt    DateTime?
  weekId    String?                              // set quand consomme
  matchupId String?
  appliedTo String?                              // NflPlayer.id booste
  createdAt DateTime @default(now())
  entry NflFantasyEntry @relation(... onDelete: Cascade)
  @@index([entryId, used])
}

model NflFantasyInducement {
  id        String   @id @default(cuid())
  entryId   String
  type      String                              // InducementId catalogue 07-mechanics.md
  slot      String   @default("wildcard")       // defensive | offensive | wildcard
  source    String   @default("purchased")
  weekId    String                              // requis (matchup-bound)
  matchupId String
  targetId  String?                             // NflPlayer.id (parfois)
  meta      Json?
  usedAt    DateTime @default(now())
  createdAt DateTime @default(now())
  entry NflFantasyEntry @relation(... onDelete: Cascade)
  @@index([entryId, weekId, matchupId])
}
```

Back-relations ajoutees sur `NflFantasyEntry` (`rerolls`,
`inducements`).

## API service

### Rerolls (pool depletable, 8 par saison V1)

| Fonction | Comportement |
|---|---|
| `seedStartingRerolls({ entryId, count? })` | Cree N rerolls source="starter". Idempotent : skip si starters existent deja. Default `STARTING_REROLLS = 8`. |
| `grantReroll({ entryId, source, type? })` | Cree un reroll bonus (achievement, mercato, reward, purchased). Valide type + source. |
| `consumeReroll({ rerollId, entryId, weekId, matchupId, appliedTo? })` | Marque `used=true` + contexte. Garde owner + already-used. |
| `listRerolls({ entryId, used? })` | filtre optionnel `used` |
| `countAvailableRerolls(entryId)` | count `used=false` |

### Inducements (3 slots PAR matchup V1, pas de pool)

| Fonction | Comportement |
|---|---|
| `consumeInducement({ entryId, weekId, matchupId, type, slot?, source?, targetId?, meta? })` | Cree une row si `< INDUCEMENT_SLOTS_PER_MATCHUP` (=3) deja consommes pour ce matchup. Valide type et slot. |
| `listInducements({ entryId, weekId?, matchupId? })` | filtres optionnels |
| `countRemainingInducementSlots({ entryId, weekId, matchupId })` | `max(0, 3 - count)` |

### Constantes exportees

- `STARTING_REROLLS = 8` (vision V1)
- `INDUCEMENT_SLOTS_PER_MATCHUP = 3` (vision V1)

### Erreurs typees

`NflFantasyMercatoError` avec codes :
- `ENTRY_NOT_FOUND` / `REROLL_NOT_FOUND` / `REROLL_NOT_OWNED` /
  `REROLL_ALREADY_USED`
- `INDUCEMENT_LIMIT_REACHED`
- `INVALID_TYPE` / `INVALID_SLOT`

## Validation E2E

Script `apps/server/src/scripts/nfl-fantasy-mercato-e2e.ts`,
**8 etapes OK** sur DB Postgres reelle (2026-05-20) :

```
docker exec nufflearena_server sh -c "cd /app/apps/server && \
  pnpm exec tsx src/scripts/nfl-fantasy-mercato-e2e.ts"
```

1. seedStartingRerolls -> 8 rerolls cree, countAvailable=8
2. seedStartingRerolls re-run -> 0 (idempotent)
3. grantReroll achievement -> countAvailable=9
4. consumeReroll -> countAvailable=8
5. consumeReroll rejet REROLL_ALREADY_USED
6. 3 inducements consumes -> countRemaining=0
7. 4eme consumeInducement rejet INDUCEMENT_LIMIT_REACHED
8. autre matchup -> remaining=3 (isolation par matchup)

## Tests unitaires

`nfl-fantasy-mercato.test.ts` : **24 tests verts** couvrant tous les
flows + chaque code d'erreur + constantes Q7.

## Hors scope V1 (futur)

- **Wallet (gold) integration** : `purchaseReroll`/`purchaseInducement`
  consommant le wallet existant. V1 utilise juste `source="purchased"`
  comme placeholder.
- **Effet SPP** : applique les bonus rerolls/inducements en post-settle
  de Phase 2.E (recompute `finalSpp += bonus`). Phase 2.F'.
- **Prieres a Nuffle** (random seedrandom) : phase dediee. Modele
  `NflFantasyPrayer` documente dans `10-architecture.md`.
- **Catalogue inducements** : V1 accepte n'importe quel `type`
  string. V2 introduira un enum / table referentielle (cf.
  `07-mechanics.md`).
