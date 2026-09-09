# league-archives-visibility

## ADDED Requirements

### Requirement: Les ligues archivées sortent de la liste par défaut

`GET /leagues` sans paramètre `status` NE DOIT PAS servir les ligues dont le
statut est `archived` — elles n'ont plus d'action possible et noyaient les
ligues vivantes. Le comptage de pagination DOIT voir le même périmètre.
`GET /leagues?status=archived` DOIT continuer de les servir : c'est de lui
que vit la page « Ligues archivées ». Tout autre statut explicite DOIT être
respecté tel quel.

L'exclusion DOIT s'appliquer aussi aux ligues privées d'un viewer (créateur,
participant ou invité).

#### Scenario: Ligue fraîchement archivée
- WHEN le commissaire archive sa ligue
- THEN `GET /leagues` NE DOIT PLUS la contenir
- AND `GET /leagues?status=archived` DOIT la contenir

#### Scenario: Filtre de la page des ligues
- WHEN un visiteur ouvre `/leagues`
- THEN le filtre de statut NE DOIT PAS proposer « Archivée »
- AND un lien vers `/leagues/archived` DOIT rester accessible
