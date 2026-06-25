# Ligue physique — E2E du parcours complet (2026-06-25)

> Chantier 3 du « reste à faire » de
> [`league-physical-rework-2026-06-25.md`](./league-physical-rework-2026-06-25.md).
> Verrouille, au niveau API (le plus rapide à fiabiliser), le parcours
> « 2 coachs saisissent + valident → commissaire valide → classement /
> équipes à jour », ainsi que la réversion à l'invalidation.

## Spec

`tests/e2e-api/specs/leagues-match-sheet-flow.spec.ts` (vrai serveur Express
+ SQLite in-memory, comme `leagues-mvp-flow.spec.ts`).

### Scénario 1 — happy path (ligue 4 équipes)

1. 4 coachs + équipes, ligue + saison + inscriptions + démarrage.
2. Ouverture de la feuille d'un pairing de round 1 (la saison reste
   `in_progress`, condition nécessaire pour autoriser l'invalidation ensuite).
3. `addEvent` : 2 TD domicile + 1 TD extérieur → score dérivé 2-1.
4. `PATCH pre-match` (table météo + popularité).
5. `PATCH post-match` : gains (override), MVP, **achats** (relance +
   **joueur créé** via `<roster>_lineman`), **licenciement** d'un joueur.
6. `submit` par chaque coach → `both_submitted`, puis `validate` commissaire.
7. **Vérifications** : standings (victoire 2-1, 3 pts, 2 TD) ; trésorerie
   (`150k − 100k d'achats = 50k`) ; relance `+1` ; joueur « Recrue » créé
   (12 joueurs en base) ; joueur licencié (`firedAt`, exclu des pickers) ;
   SPP appliqués (MVP + buteur > 0).
8. **Invalidation autorisée** → réversion **exacte** : trésorerie `0`,
   relance `0`, joueur créé supprimé (11 joueurs), licencié ré-activé,
   standings remis à zéro.

### Scénario 2 — invalidation bloquée

Ligue 4 équipes : on valide une feuille de round 1, puis les 2 équipes
rejouent un pairing **ultérieur** (forfait commissaire). `can-invalidate`
renvoie alors `{ ok: false, reason: "both_teams_played_later" }` et
l'invalidation est rejetée (4xx).

## Correctif d'infra (miroir sqlite)

Le flux écrit des valeurs **natives** (arrays/objets) dans les champs Json de
`LeagueMatchSheet` (`purchasesHome/Away`, `motmPlayerIds`, `firedPlayerIds`,
`sppBonus`, `costlyErrors*`, `inducements*`, `prayers*`). Le miroir sqlite les
déclarait en `String?`, ce qui **échouait à l'écriture** sur sqlite
(`Expected String, provided Object`) — le flux n'avait jamais été exercé sur
sqlite (les tests unitaires mockent prisma).

Correctif : aligner ces champs sur **`Json?`** dans le miroir (comme en PG, et
comme `Match.offlineResultInput` qui était déjà `Json?`). Prisma 6 sérialise
nativement le Json sur sqlite. Les parsers de lecture restent tolérants (array
natif OU string sérialisée), donc aucun impact sur les tests existants
(991 tests ligue toujours verts). Client sqlite régénéré.

## Notes d'exécution

- En CI, `e2e.yml` régénère le client sqlite (`prisma generate --schema
  prisma/sqlite/schema.prisma`) et lance la suite e2e-api ; `ci.yml` lance les
  tests unitaires (prisma mocké).
- `data-testid` UI disponibles (`match-sheet`, `derived-score`,
  `purchases-home/away`, `fired-home/away`, `validate-sheet`,
  `invalidate-sheet`…) si l'on veut doubler d'un E2E Playwright UI plus tard.
