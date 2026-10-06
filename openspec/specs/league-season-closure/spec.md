# league-season-closure

## Purpose

La clôture d'une saison est un acte du commissaire (`closeSeason`,
`POST /leagues/seasons/:id/close`), jamais un effet du dernier résultat : un
résultat complète la journée, le panneau invite à clôturer, une journée
ré-ouverte par une invalidation repasse `in_progress`.

Change d'origine : `swiss-cups-and-matchday-calendar` (#1013, archivé le 2026-10-06).

## Requirements

### Requirement: La clôture d'une saison est un acte du commissaire

Aucun résultat (feuille validée, forfait, dernier match des playoffs) NE
DOIT faire passer `LeagueSeason.status` à `completed`. Le dernier résultat
complète la journée (et démarre les playoffs si la saison en prévoit) et
laisse la saison `in_progress`. Seul `POST /leagues/seasons/:id/close`
(créateur de la ligue) clôture la saison ; il DOIT alors persister le
palmarès et déclencher la clôture thématique.

#### Scenario: Dernier match invalidable
- WHEN le dernier match d'une saison à deux équipes est validé
- THEN la journée DOIT être `completed`, la saison `in_progress`
- AND `POST /leagues/pairings/<id>/sheet/invalidate` DOIT renvoyer `200`

#### Scenario: Après clôture
- WHEN le commissaire a appelé `/close`
- THEN l'invalidation du même match DOIT renvoyer `409` avec `season-completed`

### Requirement: Invitation à clôturer

Quand toutes les journées d'une saison `in_progress` sont `completed`, le
panneau d'administration DOIT indiquer que tout est joué et mettre en
avant le bouton « Clôturer ».

### Requirement: Journée ré-ouverte

Une journée `completed` dont un résultat est invalidé DOIT repasser
`in_progress` (statut connu du calendrier), jamais un statut hors
`pending | in_progress | completed`.
