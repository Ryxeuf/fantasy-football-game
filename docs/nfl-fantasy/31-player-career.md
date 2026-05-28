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

## Dépense de SPP — achat de skill

Service `apps/server/src/services/nfl-fantasy-skill-unlock.ts` :

1. Matche la `Position` Saison 3 du joueur via
   `getPositionSlugFor(race, bbPosition)` (cf. [nfl-bb-derivation](../05-position-mapping.md)).
2. Lit `Position.primarySkills` / `secondarySkills` (encodage CSV
   G/A/S/P/M alimenté par la feature [skill-access](../skill-access-feature.md)).
3. Vérifie que la catégorie du skill demandé (`Skill.category`) est
   dans le pool indiqué (`primary` vs `secondary`).
4. Coûts V1 (chosen BB) : **6 SPP primaire**, **12 SPP secondaire**.
5. Cap V1 : **6 skills unlocked** maximum (les bbSkills de départ ne
   comptent pas dans ce cap).
6. Persiste `sppSpent: { increment: cost }` + push slug dans
   `skillsUnlocked`.

Erreurs typées `SkillUnlockError` → HTTP via map dans
`routes/nfl-fantasy-entries.ts`. Codes : `CAREER_NOT_FOUND`,
`PLAYER_NOT_FOUND`, `POSITION_NOT_MAPPED`, `POSITION_NOT_FOUND`,
`POSITION_HAS_NO_ACCESS`, `SKILL_NOT_FOUND`, `SKILL_ALREADY_OWNED`,
`SKILL_NOT_IN_POOL`, `NOT_ENOUGH_SPP`, `SKILL_CAP_REACHED`.

## API publique (user-facing)

- `POST /api/nfl-fantasy/entries/:entryId/careers/:playerId/unlock-skill`
  Body : `{ skillSlug, accessType: "primary"|"secondary" }`.
- `GET /api/nfl-fantasy/entries/:entryId/careers/:playerId/available-skills`
  → `{ primary: AvailableSkill[], secondary: AvailableSkill[], cap,
        remaining, costs, sppAvailable }`. Skills déjà starters /
  unlocked déjà filtrés côté serveur.

## UI

Deux pages Next.js :

- `/nfl-fantasy/leagues/[id]/career` — liste mes carrières (table :
  pseudonyme, position, SPP cumulés, SPP disponibles, skills
  unlocked).
- `/nfl-fantasy/leagues/[id]/career/[playerId]` — détail du joueur,
  stats career, badges starter/unlocked, sections "Pool primaire (6
  SPP)" / "Pool secondaire (12 SPP)" avec un bouton "Débloquer" par
  skill achetable. Désactivé si SPP insuffisants ou cap atteint.

CTA "🎯 Carrière des joueurs" ajouté au bandeau "Ma semaine" de la
page league.

## Boucle complète

Après ce commit, la boucle Phase 2 → V2 est fermée :

1. **NFL réel** (ESPN/nflverse ingest) → `NflGameStat.computedSpp`.
2. **Settle hebdo** → `NflFantasyLineupStarter.rawSpp` enrichi par
   les bonus skills BB (étape i) + `sppCareer` incrémenté (étape ii).
3. **Joueur dépense SPP** → unlock skill BB via pool d'accès Position
   (étape iii).
4. Le skill débloqué participe immédiatement aux bonus du settle
   suivant — Mahomes débloque `accurate` → +1 SPP par TD passing dès
   la semaine d'après. La boucle fantasy → BB → fantasy se renforce
   chaque semaine.
