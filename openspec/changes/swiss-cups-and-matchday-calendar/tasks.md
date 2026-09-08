# Tasks — Ronde suisse des coupes, clôture manuelle et journées repensées

## 1. Clôture manuelle de saison
- [x] 1.1 `league-match-result` / `league-forfeit` : plus de clôture automatique, `seasonReadyToClose`.
- [x] 1.2 `closeSeason` : palmarès + clôture thématique ; journée ré-ouverte → `in_progress`.
- [x] 1.3 `SeasonAdminPanel` : invitation à clôturer quand tout est joué. Tests.
- [x] 1.4 Spec e2e-api `leagues-season-manual-close` ; `leagues-mvp-flow` adapté.

## 2. Date prévisionnelle d'une rencontre
- [x] 2.1 Schéma + service `league-pairing-schedule` + route `PATCH /leagues/pairings/:id/schedule`. Tests.
- [x] 2.2 Notification interne `league.pairing_scheduled`.
- [x] 2.3 Web : helpers `pairing-status`, `PairingScheduleEditor`, badge « Prévu le … ». Tests.
- [x] 2.4 Spec e2e-api `leagues-pairing-schedule`.

## 3. Poule du coach en premier
- [x] 3.1 `putPoolFirst` ; classements par poule et groupement du calendrier. Tests.

## 4. Journées repensées
- [x] 4.1 `components/competition/MatchCard` (présentationnel). Tests.
- [x] 4.2 `SeasonCalendar` : cartes de journée, avancement, filtre, statut dérivé. Tests.
- [x] 4.3 Captures bureau / mobile (hors dépôt).

## 5. Ronde suisse des coupes
- [x] 5.1 Modèles `CupRound` / `CupPairing`, `LocalMatch.cupPairingId` (PG + miroir SQLite + client généré) ; wipe dans `/__test/reset`.
- [x] 5.2 Moteur pur `swiss-pairing`. Tests.
- [x] 5.3 Service `cup-rounds` ; exempts au classement (`cupScoring`). Tests.
- [x] 5.4 Routes `cup-rounds` ; `POST /local-match` avec `cupPairingId` ; hooks complete / cancel / delete ; `GET /cup/:id` sert `rounds`. Tests.
- [x] 5.5 Web : `CupRoundsView`, `ScheduleEditor` commun, colonne « Ex. ». Tests.
- [x] 5.6 Spec e2e-api `cup-swiss-rounds`.

## 6. Vérification
- [x] 6.1 `tsc` server + web, suites unitaires server + web, e2e-api complète.

## Suites possibles (hors périmètre)
- Départages propres à la ronde suisse (Buchholz, adversaires battus) et affichage du score de départage.
- Appariement manuel d'une ronde de coupe par le commissaire (`system: "manual"`).
- Rondes suisses en ligue (le moteur pur est déjà indépendant de la coupe).
- Rappel de rencontre (push) à l'approche de la date prévisionnelle.
