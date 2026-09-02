# Tasks — Refonte UX feuille de match de ligue

## 1. Backend — données de référence & identité d'équipe
- [x] 1.1 `loadSheetTeams` : sélectionne `teamValue`, `currentValue`, `treasury`, `owner.coachName` ; `MatchSheetTeam` enrichi (`raceName`, `coachName`, `teamValue`, `currentValue`, `treasury`).
- [x] 1.2 `buildMatchSheetReference(teams)` : tables météo (aplaties), catalogue de coups de pouce (hors `star_player`), Star Players par équipe, budgets (petty cash + trésorerie).
- [x] 1.3 `getMatchSheet` renvoie le bloc `reference`.

## 2. Backend — budget & comptabilité petty cash
- [x] 2.1 `updatePreMatch` : rejette une sélection de coups de pouce hors budget (`inducement_over_budget`), code ajouté à `MatchSheetError`.
- [x] 2.2 `buildOfflineInputFromSummary` : paramètre `pettyCash` (défaut 0/0) ; débit trésorerie coups de pouce = `max(0, coût − pettyCash)`.
- [x] 2.3 `validateByCommissioner` : charge les équipes, calcule le petty cash, le passe au builder.

## 3. Backend — mi-temps / tour
- [x] 3.1 `addEventSchema` : `half` (1..2), `turn` (1..16) optionnels.
- [x] 3.2 `addEvent` : fusionne `half`/`turn` dans `meta` sans écraser un `meta` fourni.

## 4. Frontend — résumé & identité
- [x] 4.1 `TeamIdentityBadges` (race + coach) + `TeamValueStrip` (TV + cagnotte) + helper `formatGold`.
- [x] 4.2 Intégration dans le résumé de `page.tsx`.

## 5. Frontend — avant-match
- [x] 5.1 Sélecteur de table météo (12 tables) + météo dépendante de la table.
- [x] 5.2 Affichage de la conséquence (informative) de la météo.
- [x] 5.3 Éditeur de coups de pouce piloté par le catalogue + Star Players (coût auto, quantité bornée).
- [x] 5.4 Jauge de budget (petty cash + cagnotte) + blocage du dépassement (save désactivé).

## 6. Frontend — évènements & timeline
- [x] 6.1 Sélecteurs mi-temps / tour dans le formulaire d'ajout.
- [x] 6.2 Helper pur `chronologicalTimeline(events)` (tri mi-temps → tour, départage stable) + test.
- [x] 6.3 Timeline ordonnée (`<ol>` + rail), séparateurs de mi-temps, badge `T{n}`.

## 6bis. Frontend — navigation par onglets
- [x] 6bis.1 Onglets Avant-match / En cours / Fin du match (état préservé, pas de refetch) ; compteur d'évènements sur « En cours ».
- [x] 6bis.2 Résumé, actions de workflow et invalidation hors onglets (toujours visibles).

## 7. Vérification
- [x] 7.1 `tsc` (server + web).
- [x] 7.2 Tests : `league-match-sheet.test.ts` (reference, budget, petty cash, half/turn) + `MatchSheetPanels.test.tsx` (badges, météo, budget) + `timeline.test.ts` (tri chronologique).
- [x] 7.3 Lint sans erreur sur les fichiers touchés.
- [ ] 7.4 Vérification visuelle staging (à faire au déploiement).
