# Tasks — une coupe offre ce qu'offre une ligue

## 1. Feuille imprimable

- [x] 1.1 La page de chaque équipe rappelle ses coups de pouce (inscription puis avant-match) — vérifier : `documents/match-sheet-roster.test.ts` (ligue, coupe build complète et simplifiée, pas de ligne vide).

## 2. Fiche de roster de coupe

- [x] 2.1 Extraire `services/team-roster-view` (race, libellés de poste, valeur d'un joueur, règles spéciales, Ligue retenue) et l'employer dans la fiche de ligue — vérifier : `league-roster-view.test.ts` et `league-access.test.ts` inchangés et verts.
- [x] 2.2 `services/cup-team-roster` (pur + chargement) et `GET /cup/:id/teams/:teamId/roster-view` — vérifier : `cup-team-roster.test.ts` (gestes par côté, Star Player regroupé par slug, repli par nom, repli `live`) + spec e2e `cup-team-roster.spec.ts` (404 hors coupe, 401 sans compte).
- [x] 2.3 `components/TeamRosterPanel` partagé ; page `/cups/[id]/teams/[teamId]` — vérifier : tests de la page de ligue inchangés, `cups/[id]/teams/[teamId]/page.test.tsx`.
- [x] 2.4 `teamRosterHref` + `TeamRosterLink` par compétition ; liens depuis inscrits, classement, rondes, play-offs, bracket, matchs, podiums, tops joueurs et feuille de match — vérifier : tests de chaque composant + `page.roster-links.test.tsx`.

## 3. Feuilles à valider en coupe

- [x] 3.1 `GET /cup/:id` et `listCupRounds` servent le logo uploadé et le statut de la feuille de chaque rencontre — vérifier : tests de service.
- [x] 3.2 Carte de ronde : « En attente validation (1/2) » / « En attente validation » — vérifier : `CupRoundsView.test.tsx`.
- [x] 3.3 Notification du commissaire : noms et lien selon la compétition — vérifier : test de `sendLeagueMatchValidationPush` / du service.
- [x] 3.4 `PendingValidationsView` partagé ; page `/cups/[id]/pending-validations` ; lien du commissaire sur la coupe — vérifier : tests de rendu (filtre par compétition, « Ronde N », liens).

## 4. Calendrier de coupe

- [x] 4.1 « Mes prochains matchs » sur la page de coupe — vérifier : test du sélecteur pur et du panneau.
- [x] 4.2 Notification de la date convenue à l'autre coach — vérifier : test de `scheduleCupPairing`.
- [x] 4.3 Relance d'une ronde (`POST /cup/rounds/:roundId/remind`) + bouton du commissaire — vérifier : tests de service/route et de rendu.

## 5. Statistiques de coupe

- [x] 5.1 `GET /cup/:id/leaderboards?topN=` — vérifier : test de route (bornes, top N).
- [x] 5.2 Page `/cups/[id]/stats` + lien depuis la coupe — vérifier : test de rendu.

## 6. Pronostics de coupe

- [x] 6.1 Schéma : `CompetitionPrediction.cupPairingId` (+ `pairingId` nullable, unicité), `Cup.predictionsScope`, `CupPairing.predictionsClosedAt`, `CupRound.predictionsNotifiedAt` (Postgres + miroir SQLite, client régénéré) ; lectures de ligue filtrées `pairingId not null` — vérifier : typecheck + tests de prédictions de ligue verts.
- [x] 6.2 Service `cup-predictions` (lecture, classement, saisie, suppression, portée, clôtures) sur les règles pures — vérifier : tests unitaires.
- [x] 6.3 Crochets : clôture (1er évènement, 1re soumission), règlement à la validation (forfait ⇒ void), dérèglement à l'invalidation, bilan de ronde — vérifier : tests + spec e2e `cup-predictions-flow.spec.ts`.
- [x] 6.4 Routes `/cup/:id/predictions`, `/cup/:id/predictions/leaderboard`, `/cup/pairings/:id/prediction`, clôtures, portée ; `POST /cup` écrit `members` — vérifier : `routes/cup-predictions.test.ts` (chaîne Express réelle).
- [x] 6.5 Web : page `/cups/[id]/predictions`, résumé sur la coupe, bouton 🔮 par ronde, portée à la création et à l'édition — vérifier : tests de rendu (page, résumé, `CupRoundsView`, création, édition).

## 6 bis. Palmarès

- [x] 6.6 Bandeau champion + Oracle d'une coupe jouée (module pur `cup-champion`) — vérifier : `cup-champion.test.ts`, `CupChampionBanner.test.tsx`.

## 7. Clôture

- [ ] 7.1 Captures avant/après versionnées (`docs/screenshots/`) — vérifier : images relues.
- [ ] 7.2 CLAUDE.md : patron « fiche de roster de coupe = roster d'inscription » et pronostics polymorphes — vérifier : section relue.
