# league-status-lifecycle

## MODIFIED Requirements

### Requirement: Etats terminaux pilotes par l'admin ou le commissaire
Les statuts `completed` et `archived` sont hors de l'echelle d'avancement
automatique. L'avancement automatique NE DOIT PAS ecraser ni retrograder une
ligue dont le statut est `completed` ou `archived`. `completed` reste fixe par
les chemins admin (`PATCH /admin/leagues/:id/status`). `archived` DOIT pouvoir
etre fixe par les chemins admin (`PATCH /admin/leagues/:id/status`,
`POST /admin/leagues/:id/archive`) **et** par le commissaire de la ligue via
`POST /leagues/:id/archive` (cf. `competition-lifecycle`).

#### Scenario: Ligue completed preservee
- WHEN une saison est demarree sur une ligue en `completed`
- THEN `League.status` DOIT rester `completed`

#### Scenario: Archivage par le commissaire
- WHEN le createur d'une ligue `open` appelle `POST /leagues/:id/archive`
- THEN `League.status` DOIT devenir `archived`
- AND l'ouverture ulterieure d'une saison NE DOIT PAS retrograder ce statut
