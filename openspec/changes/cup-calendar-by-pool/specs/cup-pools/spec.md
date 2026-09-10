# cup-pools

## ADDED Requirements

### Requirement: Calendrier d'une coupe groupé par poule

Quand une coupe déclare des poules, les rencontres d'une ronde DOIVENT être
présentées groupées par poule, chaque groupe portant le nom de sa poule. Les
groupes sont triés par nom, et celui de la poule du coach connecté DOIT
passer en tête, marqué comme tel.

Le découpage DOIT être omis — la liste reste à plat — quand aucune poule
n'est déclarée, ou qu'une seule est effectivement représentée dans la ronde :
un groupe unique n'apprendrait rien.

Une équipe non affectée DOIT rester visible, dans un groupe sans nom placé en
queue.

#### Scenario: Ronde d'une coupe à deux poules
- WHEN une ronde d'une coupe à deux poules est affichée
- THEN chaque rencontre DOIT apparaître sous le nom de la poule de son équipe
  à domicile

#### Scenario: Poule du coach en premier
- WHEN le coach connecté a une équipe affectée à une poule
- THEN cette poule DOIT être le premier groupe de chaque ronde, et être
  signalée comme la sienne

#### Scenario: Coupe sans poule
- WHEN la coupe ne déclare aucune poule
- THEN les rencontres DOIVENT s'afficher à plat, sans aucun bandeau

#### Scenario: Une seule poule représentée
- WHEN toutes les rencontres d'une ronde tombent dans la même poule
- THEN aucun groupe ne DOIT être affiché

#### Scenario: Équipe non affectée
- WHEN une rencontre oppose une équipe sans poule
- THEN elle DOIT apparaître dans un groupe sans nom, placé après les poules

### Requirement: Une ronde de bracket ne se groupe pas

Une ronde de play-off (`kind = "playoff"`) NE DOIT JAMAIS être groupée par
poule : elle oppose par construction les qualifiés de poules différentes, et
la rattacher à celle de son équipe à domicile serait faux.

#### Scenario: Finale entre deux poules
- WHEN une ronde de bracket est affichée sur une coupe à poules
- THEN aucun groupe de poule ne DOIT l'accompagner

### Requirement: La lecture d'une coupe porte de quoi grouper

`GET /cup/:id` DOIT servir la liste des poules de la coupe (identifiant, nom,
ordre, quota de qualifiés), en plus des affectations déjà exposées par
inscrit. Le calendrier a besoin de NOMMER ses groupes, ce que le classement
par poule ne garantit pas.

Le champ DOIT être vide pour une coupe sans poule, et son absence (API
antérieure) DOIT laisser l'écran retomber sur un affichage à plat.

#### Scenario: Poules servies avec la coupe
- WHEN une coupe déclarant deux poules est lue
- THEN la réponse DOIT porter ces deux poules, dans leur ordre
