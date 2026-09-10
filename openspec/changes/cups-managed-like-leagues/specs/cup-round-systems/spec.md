# cup-round-systems

## ADDED Requirements

### Requirement: Trois systèmes d'appariement

Le commissaire DOIT pouvoir générer la ronde suivante d'une coupe via
`POST /cup/:id/rounds` avec `system` valant `random` (tirage au sort),
`swiss` (ronde suisse, défaut) ou `manual` (saisie). Les trois systèmes
partagent les garde-fous existants : coupe en cours, au moins deux inscrits,
ronde précédente sans rencontre ouverte. `POST /cup/:id/rounds/swiss`
continue de fonctionner.

#### Scenario: Tirage au sort
- WHEN le commissaire d'une coupe validée à 5 inscrits demande `system = "random"`
- THEN la réponse DOIT être `201` avec 2 rencontres et 1 exempt

#### Scenario: Tirage rejouable
- WHEN une ronde tirée au sort est supprimée puis régénérée
- THEN l'appariement obtenu DOIT être identique

### Requirement: Saisie manuelle d'une ronde

En mode `manual`, le commissaire fournit les rencontres
(`{ homeTeamId, awayTeamId }`, `awayTeamId` absent ou `null` = équipe
exemptée). Une saisie DOIT être refusée en `400` si une équipe y apparaît
deux fois, s'affronte elle-même, n'est pas inscrite à la coupe, si deux
équipes sont déclarées exemptes, ou si aucune rencontre n'est fournie.

Une équipe inscrite mais ABSENTE de la saisie est acceptée : elle ne joue pas
cette ronde.

#### Scenario: Rencontre et exempt posés à la main
- WHEN le commissaire pose une rencontre et déclare une équipe exempte
- THEN la ronde DOIT compter exactement ces deux entrées

#### Scenario: Doublon
- WHEN une équipe apparaît dans deux rencontres de la saisie
- THEN la réponse DOIT être `400`

### Requirement: Système visible sur la ronde

Chaque ronde DOIT conserver et afficher le système qui l'a produite.
