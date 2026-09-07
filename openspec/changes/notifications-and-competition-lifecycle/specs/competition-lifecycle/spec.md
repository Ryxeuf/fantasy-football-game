# competition-lifecycle

## ADDED Requirements

### Requirement: Archivage par le commissaire

Le **commissaire** (créateur) d'une ligue ou d'une coupe — ou un
administrateur — DOIT pouvoir l'archiver via `POST /leagues/:id/archive`
ou `POST /cup/:id/archive`, quel que soit son statut courant. L'archivage
DOIT être idempotent (une compétition déjà archivée renvoie `changed: false`)
et DOIT poser `League.status = "archived"` / `Cup.status = "archivee"`,
valeurs déjà lues par les listes et pages d'archives. Un coach tiers DOIT
être refusé (`403`).

#### Scenario: Le commissaire archive une ligue en cours

- WHEN le créateur d'une ligue `in_progress` appelle `POST /leagues/<id>/archive`
- THEN la réponse DOIT être `200` avec `status: "archived"` et `changed: true`
- AND la ligue DOIT apparaître sur `/leagues/archived`

#### Scenario: Un coach participant tente d'archiver

- WHEN un coach inscrit mais non créateur appelle la même route
- THEN la réponse DOIT être `403`

### Requirement: Suppression par le commissaire

Le commissaire — ou un administrateur — DOIT pouvoir supprimer une ligue
(`DELETE /leagues/:id`) ou une coupe (`DELETE /cup/:id`). La suppression
DOIT emporter saisons, poules, appariements, feuilles de match, invitations
et documents de la compétition ; les équipes et les matchs joués en ligne
DOIVENT survivre. L'interface DOIT exiger la saisie du nom de la compétition
avant d'appeler la route.

#### Scenario: Suppression d'une ligue

- WHEN le créateur appelle `DELETE /leagues/<id>`
- THEN la réponse DOIT être `200`
- AND `GET /leagues/<id>` DOIT renvoyer `404`

### Requirement: Participants notifiés

À l'archivage comme à la suppression, chaque coach possédant une équipe
inscrite à la compétition (hors auteur de l'action) DOIT recevoir une
notification interne (`league.archived`, `league.deleted`, `cup.archived`,
`cup.deleted`). Pour une suppression, la notification DOIT être créée
**avant** l'effacement et ne porte pas de lien vers la compétition.

#### Scenario: Archivage notifie les coachs inscrits

- WHEN A (commissaire) archive une ligue où B a une équipe inscrite
- THEN B DOIT recevoir une notification `league.archived`
- AND A NE DOIT PAS en recevoir
