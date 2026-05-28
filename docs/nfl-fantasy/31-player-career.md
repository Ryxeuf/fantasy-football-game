# Carrière du joueur en NFL Fantasy

## Pourquoi

V1 (pre-2026-05-30) : les SPP fantasy s'accumulaient sur
`NflFantasyLineupStarter` (snapshot par semaine) sans jamais se
dépenser. Pas de notion de "carrière" du joueur dans une entry. Les
[bbStats / bbSkills](./05-position-mapping.md) dérivés à l'ingest ne
pouvaient donc pas évoluer en cours de saison.

V2 ferme la boucle : NFL → SPP semaine → **career SPP cumulés** →
achat de skill BB via le [pool d'accès Position](../skill-access-feature.md)
→ bonus de scoring (cf. [06-scoring.md § Bonus skills BB](./06-scoring.md)).

## Modèle

`prisma/schema.prisma` :

```prisma
model NflFantasyPlayerCareer {
  id             String   @id @default(cuid())
  entryId        String
  playerId       String   // NflPlayer.id (FK logique)
  sppCareer      Int      @default(0)  // jamais décrément
  sppSpent       Int      @default(0)
  skillsUnlocked Json     @default("[]")  // string[] de slugs
  statsBonus     Json     @default("{}")  // réservé V2
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  entry NflFantasyEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@unique([entryId, playerId])
  @@index([playerId])
}
```

Migration : `prisma/migrations/20260530000000_add_nfl_fantasy_player_career/`.

La clé `(entryId, playerId)` est volontaire : **un joueur a une
progression différente dans chaque ligue** où il est drafté. Mahomes
drafté dans 3 ligues fantasy a 3 careers distinctes, alignées avec
l'esprit "chaque manager construit son Mahomes".

## Agrégation

`settleNflFantasyWeek` (`apps/server/src/services/nfl-fantasy-scoring.ts`)
inclut désormais un `upsert` par starter scoré, dans la transaction
du matchup :

- `create` si la career n'existe pas (`sppCareer = rawSpp`).
- `update` sinon (`sppCareer: { increment: rawSpp }`).

Le delta utilisé est `rawSpp` (computed + bonus skills), **pas
`finalSpp`** : le multiplier captain reste un boost de score fantasy
hebdo, pas un gain de carrière. Un joueur "bye" (rawSpp = 0) ne
génère pas d'upsert.

Idempotency : un matchup ne se settle qu'une fois (pattern Q.D.1,
filtre `settledAt: null`). Pas de double-comptage en cas de re-run.

## API

User-facing (`apps/server/src/routes/nfl-fantasy-entries.ts`) :

- `GET /api/nfl-fantasy/entries/:entryId/careers` → liste des
  carrières de l'entry (ownership check).
- `GET /api/nfl-fantasy/entries/:entryId/careers/:playerId` →
  career d'un joueur (404 si non créée).

Shape de réponse :

```json
{
  "career": {
    "id": "...",
    "entryId": "...",
    "playerId": "00-0033873",
    "sppCareer": 42,
    "sppSpent": 12,
    "sppAvailable": 30,
    "skillsUnlocked": ["block", "dodge"]
  }
}
```

`sppAvailable = sppCareer - sppSpent` calculé côté service (pas
stocké).

## Prochaine étape

La dépense de SPP pour débloquer un skill est dans le commit suivant
(étape iii) : UI achat via le pool d'accès Position primaire/secondaire,
endpoint serveur `POST /careers/:playerId/unlock-skill` qui :

1. Charge le pool d'accès via `NflPlayer.bbPosition` + race
   (`NflTeam.bbRace`) et la `Position` du roster BB matchée.
2. Vérifie que le skill demandé est dans le pool primaire/secondaire.
3. Décrémente `sppAvailable` selon le coût (3 SPP primaire / 6 SPP
   secondaire, alignés sur les coûts BB classiques) et push dans
   `skillsUnlocked`.

Ce skill alimente immédiatement les bonus de scoring V1
(`nfl-fantasy-skill-bonus.ts`) : Mahomes débloque `accurate` →
bonus +1 par TD passing dès la semaine suivante.
