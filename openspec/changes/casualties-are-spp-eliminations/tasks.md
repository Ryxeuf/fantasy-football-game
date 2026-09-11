# Tasks — Une sortie est une élimination qui rapporte des PSP

## 1. Règle unique
- [x] 1.1 `eliminationEarnsSpp` (pur) dans `league-match-summary` ; compteurs
      d'équipe et stat-lines dérivés du prédicat ; option `foulingFrenzy`
      par côté. Invariant « sorties d'équipe = somme des sorties créditées »
      testé ; scénario « 4 blocages + 1 agression = 4 sorties ».
- [x] 1.2 Prière 13 « Frénésie d'Agression » reconnue par
      `league-sheet-prayer-spp` (jet ou id) et servie au summarizer
      (`foulingFrenzySides`). Tests.

## 2. Un seul constructeur d'options
- [x] 2.1 `league-sheet-summary-options` (pur) : compétences du coup d'envoi
      par côté (`frozenSkillHolders`) + prières. Tests.
- [x] 2.2 `league-match-sheet` : lecture et validation passent par
      `sheetSummaryOptions` ; `loadSheetTeams` exporté. Tests de validation
      (agression sans / avec Frénésie, prière du mauvais côté) et de lecture
      (PSP affichés).
- [x] 2.3 `league-player-stats` : cogneurs et tueurs de saison évalués par
      feuille avec `eliminationEarnsSpp` ; feuilles chargées avec gel,
      prières et équipes. Tests.

## 3. Reprise des feuilles validées
- [x] 3.1 `league-sheet-casualty-resync` : `planCasualtyResync` (pur) +
      `resyncValidatedSheetCasualties` (transaction, journal d'équipe,
      snapshot réécrit, bonus ré-évalué, saison clôturée ignorée). Tests.
- [x] 3.2 Script `db:resync-sheet-casualties` (simulation par défaut,
      `--apply`, `--pairing <id>`). Tests du parcours.

## 4. Web et documentation
- [x] 4.1 Rappel de règle sous le type d'évènement (agression, public).
      Tests.
- [x] 4.2 `CLAUDE.md` (définition d'une sortie, Frénésie d'Agression, script
      de reprise), `docs/roadmap/backlog/openspec-suites.md` (Prière 12,
      opération de déploiement), récit de session.

## 5. Au déploiement
- [ ] 5.1 `pnpm --filter @bb/server db:resync-sheet-casualties` (simulation),
      relire le rapport, puis `-- --apply`.

## Hors périmètre (suites)
- Prière 12 « Interaction avec les Fans » : demande l'auteur d'une sortie
  par le public sur la feuille.
- Reprise d'une saison CLÔTURÉE (palmarès persisté) : à trancher au cas par
  cas, le script les ignore.
