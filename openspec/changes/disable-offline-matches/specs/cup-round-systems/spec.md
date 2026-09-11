# cup-round-systems

## ADDED Requirements

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
