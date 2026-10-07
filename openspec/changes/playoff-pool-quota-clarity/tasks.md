# Tasks — quotas de poule

## 1. Lot 1 — un panneau de play-offs qui dit vrai

- [ ] 1.1 Ajouter `summarizePoolQualification` (pur) à `apps/server/src/services/bracket-seeding.ts` et la brancher dans le bracket de ligue (`routes/league.ts`) et de coupe (`services/cup-playoffs.ts`) ; vérifier par `bracket-seeding.test.ts` (total, bornage à 0, ordre, cohérence, sans poule) et par les tests de route/service existants étendus au détail.
- [ ] 1.2 Créer `apps/web/app/lib/pool-qualification.ts` (pur, `formatPoolBreakdown`) et l'utiliser dans `PlayoffBracketView` (ligue) et `CupPlayoffBracketView` (coupe, locales fr/en) : libellé « au total » + détail, menu de taille en nombre d'équipes, indice de refus `pool-qualification-mismatch` ; vérifier par tests unitaires et de rendu (détail présent, repli sans détail).

## 2. Lot 2 — un quota de ligue qui se corrige

- [ ] 2.1 Ouvrir le quota dans `updatePool` (`services/league-pool.ts`) jusqu'au premier round de play-off, saison non clôturée ; code `playoffs_started` / `season_completed` mappés en 409 ; vérifier par `league-pool.test.ts` (quota accepté `in_progress`, nom refusé, refus bracket, refus clôture).
- [ ] 2.2 `PoolsManagerPanel` : prop `quotaEditable` calculée par la page (saison démarrée non clôturée, aucun round `kind = "playoff"`), dernier quota conservé à la création ; vérifier par tests de rendu.
- [ ] 2.3 Consigner la règle dans `CLAUDE.md` (section « Poules »).
