# cup-pools

## Purpose

Comment une coupe répartit ses inscrits en groupes qui ne se rencontrent
qu'entre eux. Les rondes restent COMMUNES à la coupe — c'est l'appariement qui
se fait poule par poule — et le classement d'une poule est une projection du
classement général, jamais un second tri. La composition se fige à la première
ronde ; seul le quota de qualifiés, qui ne gouverne que le seeding des
play-offs, reste corrigeable après coup.

## Requirements

### Requirement: Composition des poules d'une coupe

Le commissaire d'une coupe (ou un administrateur) DOIT pouvoir créer,
renommer, supprimer ses poules et fixer, pour chacune, son nombre de
qualifiés pour les play-offs. Les noms sont uniques dans la coupe. Une poule
qui compte encore des inscrits n'est pas supprimable.

Toute autre personne DOIT être refusée en `403`.

#### Scenario: Création refusée à un tiers
- WHEN un inscrit qui n'est pas le commissaire demande la création d'une poule
- THEN la réponse DOIT être `403`

#### Scenario: Nom déjà pris
- WHEN le commissaire crée une seconde poule du même nom
- THEN la réponse DOIT être `409`

#### Scenario: Poule habitée
- WHEN le commissaire supprime une poule qui compte des inscrits
- THEN la réponse DOIT être `409` et la poule DOIT subsister

### Requirement: Fenêtre d'édition fermée par la première ronde

La COMPOSITION (création, suppression, affectation) DOIT être refusée en
`409` dès qu'une ronde existe dans la coupe, ou que la coupe est terminée ou
archivée : réaffecter une équipe après coup réécrirait rétroactivement un
classement déjà joué.

Le QUOTA de qualifiés DOIT rester modifiable dans ces mêmes conditions : il
ne gouverne que le seeding des play-offs, qui n'a pas encore eu lieu.

#### Scenario: Composition figée
- WHEN une ronde a été générée et que le commissaire crée une poule
- THEN la réponse DOIT être `409`

#### Scenario: Quota encore modifiable
- WHEN une ronde a été générée et que le commissaire change le quota d'une poule
- THEN la réponse DOIT être `200`

### Requirement: Affectation des inscrits

Le commissaire DOIT pouvoir affecter chaque inscription à une poule (ou l'en
retirer, `poolId: null`), et DOIT pouvoir demander une répartition
automatique équilibrée en serpentin. L'affectation porte l'identifiant de
l'INSCRIPTION, pas celui de l'équipe. Une inscription étrangère à la coupe
DOIT être refusée.

`GET /cup/:id` DOIT exposer, pour chaque inscrit, son `participantId` et son
`poolId`.

#### Scenario: Répartition automatique équilibrée
- WHEN 4 inscrits sont répartis automatiquement dans 2 poules
- THEN chaque poule DOIT compter 2 équipes

#### Scenario: Désaffectation
- WHEN le commissaire affecte une inscription à `poolId: null`
- THEN l'inscription DOIT redevenir non affectée

### Requirement: Appariement par groupe

Quand la coupe déclare des poules, la génération d'une ronde DOIT apparier à
l'intérieur de chaque poule et jamais d'une poule à l'autre. La ronde reste
COMMUNE à la coupe (un seul `roundNumber`), et peut donc porter PLUSIEURS
exempts — un par groupe d'effectif impair.

Une équipe non affectée DOIT rester appariable : elle forme un groupe à part
plutôt que d'être exclue en silence.

#### Scenario: Deux poules de deux
- WHEN le commissaire génère une ronde sur une coupe à 2 poules de 2 équipes
- THEN la ronde DOIT compter 2 rencontres, chacune interne à sa poule

### Requirement: Classement par poule

`GET /cup/:id` DOIT servir un `poolStandings` : le classement général
PROJETÉ dans chaque poule, dans le même ordre, avec le quota de qualifiés de
la poule. Il DOIT être vide quand la coupe n'a pas de poule — l'écran retombe
alors sur le seul classement général.

Les équipes non affectées DOIVENT apparaître dans un groupe sentinelle en
queue : les taire les ferait disparaître du classement.

#### Scenario: Un classement par poule
- WHEN une coupe déclare deux poules
- THEN `poolStandings` DOIT compter un groupe par poule, nommé
