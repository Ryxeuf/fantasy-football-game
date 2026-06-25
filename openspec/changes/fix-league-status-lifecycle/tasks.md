# Tasks — Auto-avancement de `League.status`

> TDD : tests de non-regression d'abord. Forward-only + idempotent, calque sur
> le contrat decrit dans `specs/league-status-lifecycle/spec.md`.

## 1. Auto-avancement (serveur)
- [x] 1.1 `league-scheduler.ts` : helper `advanceLeagueStatus(leagueId, target)`
      + echelle `LEAGUE_STATUS_FORWARD_RANK` (`draft<open<in_progress`).
      No-op si la ligue est deja >= cible ou hors echelle (completed/archived).
- [x] 1.2 `openSeasonForRegistration` : selectionner `leagueId` ; apres le passage
      de la saison a `scheduled`, `advanceLeagueStatus(leagueId, "open")`.
- [x] 1.3 `startSeason` : selectionner `leagueId` ; apres le passage de la saison
      a `in_progress`, `advanceLeagueStatus(leagueId, "in_progress")`.

## 2. Tests de non-regression
- [x] 2.1 `league-scheduler.test.ts` : ajouter le modele `league` au mock prisma.
- [x] 2.2 `openSeasonForRegistration` fait passer la ligue `draft` → `open`.
- [x] 2.3 `startSeason` fait passer la ligue `open` → `in_progress`.
- [x] 2.4 Pas de retrogradation : `startSeason` ne touche pas une ligue `completed`.
- [x] 2.5 Idempotence : pas d'ecriture si la ligue est deja au niveau cible/au-dela.

## 3. Backfill de l'existant
- [x] 3.1 `scripts/backfill-league-status.ts` : recale les ligues `draft`/`open`
      d'apres l'etat de leurs saisons (in_progress/scheduled), forward-only,
      `--dry-run` supporte.

## 4. Verification
- [x] 4.1 `vitest run src/services/league-scheduler.test.ts` vert (23/23).
- [x] 4.2 `tsc -p tsconfig.json --noEmit` vert.
- [ ] 4.3 Sur staging/prod : `tsx src/scripts/backfill-league-status.ts --dry-run`
      puis sans `--dry-run` une fois le diff valide.
