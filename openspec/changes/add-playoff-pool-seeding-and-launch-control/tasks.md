# Tasks — Qualification par poule et lancement des playoffs

> TDD : la fonction pure de seeding et les gardes d'abord (toutes les branches
> de refus), puis les happy paths, puis l'UI.
> Calque sur le contrat de `specs/league-playoff-launch/spec.md`.

## 1. Seeding par poule (pur)
- [x] 1.1 `league-playoffs.ts` : types `PoolQualificationInput` / `PoolSeedOutcome`.
- [x] 1.2 `selectSeedsFromPools(pools, size)` — pure : filtre les poules à quota 0,
      prend les `qualifiesForPlayoffs` premiers de chaque `ranked`, ordonne en
      serpentin (rang croissant, puis `poolOrder` croissant).
- [x] 1.3 Refus `pool-qualification-mismatch` si `Σ quotas ≠ size` ;
      `insufficient-participants` si `ranked.length < qualifiesForPlayoffs` pour
      une poule.
- [x] 1.4 Tests purs : 2×2/size 4, 4×2/size 8, 2×4/size 8 (vérifier l'absence de
      duel intra-poule au 1er tour via `generatePlayoffSeedingFor`), quotas
      asymétriques, mismatch, poule trop petite, poule `__unassigned__` ignorée.

## 2. Gardes et branchement de `startPlayoffs`
- [x] 2.1 Signature `startPlayoffs(seasonId, opts?: { force?: boolean; byUserId?: string })`.
- [x] 2.2 Garde `regular-season-incomplete` : compte des rounds `kind != "playoff"`
      dont le statut n'est pas `completed`. Placée après `playoffs-disabled` /
      `playoffs-already-started` / `season-missing`.
- [x] 2.3 Branchement poule : `computeSeasonStandingsByPool` ; si `pools.length > 0`
      et `Σ quotas > 0` → `selectSeedsFromPools`, sinon classement global
      (chemin actuel, `withdrawn` filtrés).
- [x] 2.4 `force` : après validation de TOUTES les autres gardes, annuler les
      pairings réguliers `scheduled`/`in_progress` (`cancelled`) et compléter les
      rounds réguliers, puis poursuivre la génération.
- [x] 2.5 Journalisation best-effort de la clôture forcée (`AuditLog`, action
      `league.playoff:force-start`, `entity="LeagueSeason"`), dans un try/catch
      qui ne fait pas échouer la génération.
- [x] 2.6 Étendre `StartPlayoffsOutcome.skippedReason` (+2 valeurs) et les tests
      existants de `league-playoffs.test.ts`.

## 3. Surface HTTP
- [x] 3.1 `schemas/league.schemas.ts` : `startPlayoffsSchema` = `{ force?: boolean }`
      avec `.default({})` (un POST sans corps doit rester valide) + type inféré.
- [x] 3.2 `schemas/league.schemas.ts` : `playoffSize` (`0|2|4|8`) ajouté à
      `updateSeasonConfigSchema` (le `refine` « au moins un champ » reste valable).
- [x] 3.3 `routes/league.ts` : `handleStartPlayoffs` — `validate(startPlayoffsSchema)`,
      corps typé via le schéma (pas de `req.body as`), passage de `force` et de
      `userId`, mapping `skippedReason → message` en 400 ; corriger le JSDoc
      trompeur sur `playoffSize=0`.
- [x] 3.4 `routes/league.ts` : `handleUpdateSeasonConfig` — prise en compte de
      `playoffSize`, refus 409 si un round `kind="playoff"` existe
      (`playoff_already_started`) ou si la saison est `completed`.
- [x] 3.5 `handleGetPlayoffBracket` : ajouter `regularSeasonComplete` et
      `poolQualification { totalQualified, playoffSize, consistent }` à la réponse.

## 4. UI commissaire (web)
- [x] 4.1 `PlayoffBracketView.tsx` : rendre un panneau commissaire quand
      `rounds.length === 0` (au lieu de `null`) — `null` conservé pour les
      non-commissaires.
- [x] 4.2 Sélecteur `playoffSize` (0/2/4/8) → `PATCH …/seasons/:id/config`,
      désactivé si un bracket existe.
- [x] 4.3 Bouton « Lancer les playoffs » → `POST …/playoff/start`, avec case
      « clôturer la phase de poule en cours » affichée seulement si
      `regularSeasonComplete === false` ; recharge le bracket au succès.
- [x] 4.4 Table `skippedReason → message français` locale au composant + affichage
      des erreurs API.
- [x] 4.5 `data-testid` : `playoff-launch-panel`, `playoff-size-select`,
      `playoff-start-button`, `playoff-force-close`.
- [x] 4.6 `leagues/[id]/page.tsx` : rien à propager — la réponse enrichie de
      `playoff-bracket` (3.5) porte `playoffSize`, `regularSeasonComplete` et
      `poolQualification`. Aucun changement nécessaire.

## 5. Tests
- [x] 5.1 `league-playoffs.test.ts` : seeding par poule (cf. 1.4) + nouvelles
      gardes (`regular-season-incomplete`, mismatch, force accepté, force refusé
      sur config incohérente sans annuler de pairing).
- [x] 5.2 `routes/league*.test.ts` : 400 par `skippedReason`, 403 non-commissaire,
      409 `playoff_already_started` sur le config.
- [x] 5.3 `routes/no-raw-body-cast.test.ts` doit rester vert (corps typés via Zod).
- [x] 5.4 `PlayoffBracketView.test.tsx` : panneau visible commissaire / invisible
      non-commissaire, flux de démarrage, case force conditionnelle, restitution
      d'un refus.
- [x] 5.5 Non-régression : saison sans poule et saison à quotas nuls produisent
      exactement les seeds globaux d'avant.

## 6. Vérification
- [x] 6.1 `pnpm --filter server vitest run league-playoffs league` vert.
- [x] 6.2 `pnpm --filter web vitest run app/leagues` vert.
- [x] 6.3 `pnpm --filter web typecheck` vert.
- [x] 6.4 `pnpm --filter server typecheck` vert (client Prisma généré par
      `pnpm install` dans ce sandbox).

## Notes d'implémentation
- Le message de succès du panneau a été retiré : un lancement réussi recharge le
  bracket, ce qui démonte le panneau — la notice n'aurait jamais été visible.
  C'est le bracket lui-même qui fait office de confirmation.
- Pas de reformatage Prettier : `routes/league.ts`, `schemas/league.schemas.ts`,
  `services/league-playoffs.ts` et `PlayoffBracketView.tsx` sont déjà non
  conformes au `HEAD` et aucun check de format ne tourne en CI — reformater
  aurait noyé le diff.
- Aucun ESLint dans le repo (`eslint.config.*` absent) : étape de lint sans objet.
