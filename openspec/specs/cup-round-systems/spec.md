# cup-round-systems

## Purpose

Comment une coupe enchaîne ses rondes : tirage au sort (l'appariement de la
première ronde, où le classement est encore vide), ronde suisse sur le
classement courant, ou rencontres posées à la main par le commissaire. Les
trois partagent les mêmes garde-fous et produisent la même chose ; seul
l'appariement diffère — et l'écran doit dire lequel s'applique, au moment du
choix comme après coup.

## Requirements

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

### Requirement: Le bandeau des rondes annonce le système qui va s'appliquer

Quand le sélecteur d'appariement est affiché au commissaire, le titre ET la
description du bandeau des rondes DOIVENT décrire le système SÉLECTIONNÉ, et
changer dès qu'il en choisit un autre. Deux systèmes ne DOIVENT jamais
partager la même description.

Quand le sélecteur n'est pas affiché — coach inscrit, ou commissaire qui ne
peut pas encore générer — le bandeau DOIT rester neutre : une coupe panache
les systèmes d'une ronde à l'autre, en annoncer un seul serait faux. Le
système d'une ronde donnée reste porté par son badge.

#### Scenario: Bascule d'un système à l'autre
- WHEN le commissaire sélectionne « Ronde suisse » puis « Saisie manuelle »
- THEN le bandeau DOIT décrire l'appariement par classement, puis la
  composition à la main

#### Scenario: Défaut hors première ronde
- WHEN le sélecteur s'ouvre sur son défaut « Tirage au sort »
- THEN le bandeau NE DOIT PAS décrire l'appariement par classement

#### Scenario: Coach inscrit
- WHEN un coach sans droit de commissaire consulte les rondes
- THEN le bandeau NE DOIT annoncer aucun système d'appariement
