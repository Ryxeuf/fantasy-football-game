# Design — Qualification par poule et lancement des playoffs

## 1. Où se branche la décision

Le chemin actuel a une seule entrée et deux appelants :

```
recordLeagueMatchResult ─┐
                         ├─▶ (tous les rounds completed ?) ─▶ startPlayoffs(seasonId)
maybeCompleteRoundAndSeason ┘         │                              │
  (forfait + saisie offline)          │                              ├─ seeds  ← computeSeasonStandings (GLOBAL)
                                      │                              └─ génère 1 LeagueRound par slot
                                      └─ sinon ─▶ season.status = "completed" + awards
```

On ne touche **ni aux appelants ni au hook** : les deux manques se règlent
*à l'intérieur* de `startPlayoffs` (choix des seeds, nouvelles gardes) et
*au-dessus* (route + UI). C'est ce qui garantit la rétro-compatibilité : une
saison sans poule emprunte exactement le même code qu'aujourd'hui.

## 2. Sélection des seeds : une fonction pure de plus

`generatePlayoffSeedingFor(size, seeds, baseRoundNumber)` est déjà pure et
testée. On lui ajoute une sœur, également pure, qui produit la liste `seeds`
quand la saison est en poules :

```ts
export interface PoolQualificationInput {
  readonly poolId: string;
  readonly poolOrder: number;
  readonly qualifiesForPlayoffs: number;
  /** participantIds classés (index 0 = 1er de poule), withdrawn déjà exclus. */
  readonly ranked: readonly string[];
}

export type PoolSeedOutcome =
  | { readonly ok: true; readonly seeds: readonly string[] }
  | { readonly ok: false; readonly reason: "pool-qualification-mismatch" | "insufficient-participants" };

export function selectSeedsFromPools(
  pools: readonly PoolQualificationInput[],
  size: PlayoffSize,
): PoolSeedOutcome;
```

**Ordre serpentin.** On prend les qualifiés rang par rang, et à rang égal par
`poolOrder` : `[A1, B1, C1, D1, A2, B2, …]`. Ce n'est pas un détail cosmétique —
c'est ce qui fait que le seeding croisé existant évite les affrontements
intra-poule au premier tour, sans logique d'évitement dédiée :

| Config | Seeds serpentin | 1er tour (1v8/4v5/2v7/3v6) | Intra-poule ? |
|---|---|---|---|
| 2 poules × 2, size 4 | A1 B1 A2 B2 | A1–B2, B1–A2 | non |
| 4 poules × 2, size 8 | A1 B1 C1 D1 A2 B2 C2 D2 | A1–D2, D1–A2, B1–C2, C1–B2 | non |
| 2 poules × 4, size 8 | A1 B1 A2 B2 A3 B3 A4 B4 | A1–B4, B2–A3, B1–A4, A2–B3 | non |

La propriété tient tant que les poules ont **le même quota**. En quotas
asymétriques (poule A qualifie 3, poule B qualifie 1) un duel intra-poule au
premier tour redevient possible : c'est accepté et documenté, pas corrigé — le
commissaire garde l'éditeur de seeds (`PATCH …/playoff-bracket/participants`)
pour rectifier avant le premier match.

**Pourquoi une fonction pure séparée** plutôt qu'un `if` dans `startPlayoffs` :
toute la table ci-dessus se teste sans Prisma, comme
`generatePlayoffSeedingFor`. `startPlayoffs` ne fait plus que l'I/O.

## 3. Quand le mode « poule » s'active

```ts
const pools = await computeSeasonStandingsByPool(seasonId);   // [] si aucune poule
const totalQualified = pools.reduce((n, p) => n + p.qualifiesForPlayoffs, 0);
const usePoolSeeding = pools.length > 0 && totalQualified > 0;
```

Trois cas, et un seul est nouveau :

| Situation | Seeds |
|---|---|
| Aucune poule | classement global (**inchangé**) |
| Poules mais toutes à `qualifiesForPlayoffs = 0` | classement global (**inchangé**) |
| Poules avec quotas | **serpentin par poule** (nouveau) |

La pseudo-poule `__unassigned__` retournée par `computeSeasonStandingsByPool`
porte `qualifiesForPlayoffs: 0` : elle ne contribue jamais de seed, et un
participant non affecté ne peut donc pas se retrouver en playoffs par accident.
Les `withdrawn` sont filtrés **avant** le classement par poule, comme le fait
déjà le chemin global.

**Le mismatch est une erreur, pas un ajustement.** Si `Σ quotas ≠ playoffSize`,
on refuse. Deux alternatives ont été écartées :

- *tronquer / compléter au classement global* → produit un bracket qui contredit
  les badges « N qualifié(s) PO » affichés toute la saison ; le commissaire
  découvrirait l'écart au moment le plus sensible ;
- *dériver `playoffSize` de la somme des quotas* → la somme peut valoir 5 ou 6,
  qui ne sont pas des tailles de bracket supportées ; il faudrait inventer des
  byes.

Refuser, c'est rendre l'incohérence visible et réparable : le nouveau panneau
commissaire affiche le message et laisse corriger soit les quotas, soit
`playoffSize`, puis relancer.

## 4. Nouvelles gardes de `startPlayoffs`

`StartPlayoffsOutcome.skippedReason` s'étend de 4 à 6 valeurs :

```
playoffs-disabled           (existant) playoffSize = 0
playoffs-already-started    (existant) un round kind="playoff" existe déjà
season-missing              (existant)
insufficient-participants   (existant, étendu : vaut aussi par poule)
regular-season-incomplete   (NOUVEAU)  un round non-playoff n'est pas completed
pool-qualification-mismatch (NOUVEAU)  Σ quotas ≠ playoffSize
```

`regular-season-incomplete` est la garde qui rend le bouton sûr. Elle n'existait
pas parce que le seul appelant était le hook, qui ne se déclenche justement
qu'une fois tout terminé — dès qu'on expose l'action à un humain, l'invariant
doit être vérifié explicitement.

## 5. `force` : la clôture anticipée assumée

`startPlayoffs(seasonId, { force?: boolean, byUserId?: string })`. Avec
`force: true`, la garde `regular-season-incomplete` n'est pas contournée
silencieusement — elle est **satisfaite** en clôturant réellement la phase :

```ts
await prisma.leaguePairing.updateMany({
  where: { round: { seasonId, kind: { not: "playoff" } }, status: { in: ["scheduled", "in_progress"] } },
  data: { status: "cancelled" },
});
await prisma.leagueRound.updateMany({
  where: { seasonId, kind: { not: "playoff" }, status: { not: "completed" } },
  data: { status: "completed" },
});
```

C'est exactement la sémantique de `closeSeason`
([`league-scheduler.ts:493`](../../../apps/server/src/services/league-scheduler.ts#L493)),
restreinte aux rounds non-playoff et sans clôture de saison. Les autres gardes
(`playoffs-disabled`, `already-started`, mismatch, effectifs) **ne sont pas**
contournables par `force` : elles protègent la cohérence du bracket, pas le
calendrier. La clôture forcée est journalisée (best-effort, `AuditLog`,
action `league.playoff:force-start`) : elle annule des matchs planifiés, ça se
trace.

Ordre d'exécution : la clôture forcée n'a lieu qu'**après** validation de toutes
les autres gardes, pour ne jamais annuler des pairings si la génération devait
échouer juste après sur un mismatch.

## 6. Surface HTTP

| Route | Changement |
|---|---|
| `POST /leagues/seasons/:seasonId/playoff/start` | accepte `{ force?: boolean }` validé par Zod (`validate(startPlayoffsSchema)`, `.default({})` — un POST sans corps reste valide, cf. le piège rencontré sur `commissionerRemovalSchema`) ; réponse 400 avec un message explicite par `skippedReason` |
| `PATCH /leagues/seasons/:seasonId/config` | accepte `playoffSize: 0\|2\|4\|8` ; 409 `playoff_already_started` si un round playoff existe, 409 si saison `completed` |
| `GET /leagues/seasons/:seasonId/playoff-bracket` | ajoute `regularSeasonComplete: boolean` et `poolQualification: { totalQualified, playoffSize, consistent }` pour que l'UI puisse expliquer l'état sans deviner |

Le JSDoc de `handleStartPlayoffs` ([`routes/league.ts:861`](../../../apps/server/src/routes/league.ts#L861))
affirme aujourd'hui qu'on peut forcer un bracket « quand `playoffSize=0` » — c'est
faux (`startPlayoffs` renvoie `playoffs-disabled`). Il est corrigé dans la foulée
plutôt que laissé à contredire le code.

## 7. UI : rendre l'état visible avant de rendre l'action possible

`PlayoffBracketView` retourne `null` quand `rounds.length === 0`. On conserve ce
comportement **pour les non-commissaires**. Pour le commissaire, on rend à la
place un panneau d'état :

```
┌─ Playoffs ────────────────────────────────────────────┐
│ Taille du bracket : [ Aucun ▾ | 2 | 4 | 8 ]           │
│ Phase régulière : 12/14 matchs joués                  │
│ Poules : 2 × 2 qualifiés = 4  ✓ cohérent              │
│ ☐ Clôturer la phase de poule en cours (annule les     │
│   matchs restants)                                    │
│              [ Lancer les playoffs ]                  │
└───────────────────────────────────────────────────────┘
```

Le bouton reste cliquable même quand une garde va refuser : le message d'erreur
serveur est plus instructif qu'un bouton grisé sans explication. Seule exception,
la case `force` n'apparaît que si la phase régulière est incomplète — sinon elle
n'a pas de sens. La table `skippedReason → message français` vit côté web, à
côté du composant, pour rester traduisible.

## 8. Ce qu'on ne fait pas

- **Le match nul en playoff** continue de bloquer l'avancement du bracket
  (`winnerFromStatus` ne résout que les forfaits, et
  `advancePlayoffsWithWinner` n'est pas appelé sur un `draw`). C'est un bug de
  progression, indépendant du lancement ; le mêler ici brouillerait les tests
  des deux sujets.
- **Les tailles hors 0/2/4/8** (byes, brackets à 6) restent non supportées.
- **L'évitement systématique des duels intra-poule** en quotas asymétriques est
  laissé à l'éditeur de seeds manuel, déjà en place.
