# Tasks — Qualification par poule et lancement des playoffs

> TDD : la fonction pure de seeding et les gardes d'abord (toutes les branches
> de refus), puis les happy paths, puis l'UI.
> Calque sur le contrat de `specs/league-playoff-launch/spec.md`.

## 1. Seeding par poule (pur)
- [ ] 1.1 `league-playoffs.ts` : types `PoolQualificationInput` / `PoolSeedOutcome`.
- [ ] 1.2 `selectSeedsFromPools(pools, size)` — pure : filtre les poules à quota 0,
      prend les `qualifiesForPlayoffs` premiers de chaque `ranked`, ordonne en
      serpentin (rang croissant, puis `poolOrder` croissant).
- [ ] 1.3 Refus `pool-qualification-mismatch` si `Σ quotas ≠ size` ;
      `insufficient-participants` si `ranked.length < qualifiesForPlayoffs` pour
      une poule.
- [ ] 1.4 Tests purs : 2×2/size 4, 4×2/size 8, 2×4/size 8 (vérifier l'absence de
      duel intra-poule au 1er tour via `generatePlayoffSeedingFor`), quotas
      asymétriques, mismatch, poule trop petite, poule `__unassigned__` ignorée.

## 2. Gardes et branchement de `startPlayoffs`
- [ ] 2.1 Signature `startPlayoffs(seasonId, opts?: { force?: boolean; byUserId?: string })`.
- [ ] 2.2 Garde `regular-season-incomplete` : compte des rounds `kind != "playoff"`
      dont le statut n'est pas `completed`. Placée après `playoffs-disabled` /
      `playoffs-already-started` / `season-missing`.
- [ ] 2.3 Branchement poule : `computeSeasonStandingsByPool` ; si `pools.length > 0`
      et `Σ quotas > 0` → `selectSeedsFromPools`, sinon classement global
      (chemin actuel, `withdrawn` filtrés).
- [ ] 2.4 `force` : après validation de TOUTES les autres gardes, annuler les
      pairings réguliers `scheduled`/`in_progress` (`cancelled`) et compléter les
      rounds réguliers, puis poursuivre la génération.
- [ ] 2.5 Journalisation best-effort de la clôture forcée (`AuditLog`, action
      `league.playoff:force-start`, `entity="LeagueSeason"`), dans un try/catch
      qui ne fait pas échouer la génération.
- [ ] 2.6 Étendre `StartPlayoffsOutcome.skippedReason` (+2 valeurs) et les tests
      existants de `league-playoffs.test.ts`.

## 3. Surface HTTP
- [ ] 3.1 `schemas/league.schemas.ts` : `startPlayoffsSchema` = `{ force?: boolean }`
      avec `.default({})` (un POST sans corps doit rester valide) + type inféré.
- [ ] 3.2 `schemas/league.schemas.ts` : `playoffSize` (`0|2|4|8`) ajouté à
      `updateSeasonConfigSchema` (le `refine` « au moins un champ » reste valable).
- [ ] 3.3 `routes/league.ts` : `handleStartPlayoffs` — `validate(startPlayoffsSchema)`,
      corps typé via le schéma (pas de `req.body as`), passage de `force` et de
      `userId`, mapping `skippedReason → message` en 400 ; corriger le JSDoc
      trompeur sur `playoffSize=0`.
- [ ] 3.4 `routes/league.ts` : `handleUpdateSeasonConfig` — prise en compte de
      `playoffSize`, refus 409 si un round `kind="playoff"` existe
      (`playoff_already_started`) ou si la saison est `completed`.
- [ ] 3.5 `handleGetPlayoffBracket` : ajouter `regularSeasonComplete` et
      `poolQualification { totalQualified, playoffSize, consistent }` à la réponse.

## 4. UI commissaire (web)
- [ ] 4.1 `PlayoffBracketView.tsx` : rendre un panneau commissaire quand
      `rounds.length === 0` (au lieu de `null`) — `null` conservé pour les
      non-commissaires.
- [ ] 4.2 Sélecteur `playoffSize` (0/2/4/8) → `PATCH …/seasons/:id/config`,
      désactivé si un bracket existe.
- [ ] 4.3 Bouton « Lancer les playoffs » → `POST …/playoff/start`, avec case
      « clôturer la phase de poule en cours » affichée seulement si
      `regularSeasonComplete === false` ; recharge le bracket au succès.
- [ ] 4.4 Table `skippedReason → message français` locale au composant + affichage
      des erreurs API.
- [ ] 4.5 `data-testid` : `playoff-launch-panel`, `playoff-size-select`,
      `playoff-start-button`, `playoff-force-close`.
- [ ] 4.6 `leagues/[id]/page.tsx` : rien à propager si la réponse bracket suffit ;
      sinon passer `playoffSize` courant.

## 5. Tests
- [ ] 5.1 `league-playoffs.test.ts` : seeding par poule (cf. 1.4) + nouvelles
      gardes (`regular-season-incomplete`, mismatch, force accepté, force refusé
      sur config incohérente sans annuler de pairing).
- [ ] 5.2 `routes/league*.test.ts` : 400 par `skippedReason`, 403 non-commissaire,
      409 `playoff_already_started` sur le config.
- [ ] 5.3 `routes/no-raw-body-cast.test.ts` doit rester vert (corps typés via Zod).
- [ ] 5.4 `PlayoffBracketView.test.tsx` : panneau visible commissaire / invisible
      non-commissaire, flux de démarrage, case force conditionnelle, restitution
      d'un refus.
- [ ] 5.5 Non-régression : saison sans poule et saison à quotas nuls produisent
      exactement les seeds globaux d'avant.

## 6. Vérification
- [ ] 6.1 `pnpm --filter server vitest run league-playoffs league` vert.
- [ ] 6.2 `pnpm --filter web vitest run app/leagues` vert.
- [ ] 6.3 `pnpm --filter web typecheck` vert.
- [ ] 6.4 `pnpm --filter server typecheck` (client Prisma requis — à valider en CI
      si non générable hors-ligne).
