# @bb/nfl-mapper

> Package pur (TypeScript, sans I/O) qui traduit les entites NFL
> reelles en entites Blood Bowl pour le module **NFL Fantasy**.
> Suit le pattern des autres packages purs (`@bb/sim-engine`,
> `@bb/game-engine`) : pas de Prisma, pas de fetch, pas de side effects.

## Modules

| Module | Statut | Description |
|---|---|---|
| [types.ts](./src/types.ts) | ✅ | Types fondamentaux (`BbRace`, `NflTeamCode`, `TeamMeta`) |
| [team-to-race.ts](./src/team-to-race.ts) | ✅ | 32 NFL teams → 8 BB races (mapping fixe par equipe, cf. Q5) |
| `position-to-bb.ts` | 🚧 V1.B | NFL pos → BB pos par race |
| `stats-to-spp.ts` | 🚧 V1.C | Stats NFL → SPP BB |
| `pseudonymize.ts` | 🚧 V1.D | Generation de pseudonymes pour la pseudonymisation legale |

## Reference

- Mapping race : `docs/nfl-fantasy/04-race-mapping.md`
- Architecture : `docs/nfl-fantasy/10-architecture.md`
- Decisions Q5 (race fixe par equipe) : `docs/nfl-fantasy/00-vision.md`

## Usage

```ts
import { getTeamMeta, getAllTeams, getTeamsByRace } from '@bb/nfl-mapper';

const kc = getTeamMeta('KC');
// → { code: 'KC', city: 'Kansas City', race: 'Skaven', raceLabel: 'Kansas City Skaven', ... }

const skavenTeams = getTeamsByRace('Skaven');
// → 4 teams (KC, MIA, HOU, ARI)
```
