# cup-visibility

## Purpose

Une coupe privée (`Cup.isPublic = false`) est INVISIBLE (404, jamais 403) pour
qui n'en fait pas partie, sur toutes ses lectures par id — même règle que les
ligues privées (`league-visibility`), résolue au même endroit.

## ADDED Requirements

### Requirement: Une coupe privée n'existe que pour ses membres

Une coupe dont `isPublic` vaut `false` est PRIVÉE. Toute lecture de la coupe
par son id — ou par l'id d'une de ses rencontres — DOIT être réservée à son
commissaire, aux administrateurs, aux propriétaires d'une équipe inscrite et
aux coachs nommés par une invitation en attente (directement ou par une de
leurs équipes). Sont concernés : la fiche de la coupe, ses rondes, ses poules,
son bracket de play-offs, ses classements individuels, ses pronostics et leur
classement, la fiche de roster d'un inscrit, la feuille de match d'une
rencontre, ses documents officiels et son blog. La résolution DOIT être unique
côté serveur (`services/competition-access`) et partagée avec les ligues.

#### Scenario: Coach tiers sur une coupe privée
- **WHEN** un coach connecté, ni commissaire, ni inscrit, ni invité, demande la fiche d'une coupe privée
- **THEN** la réponse DOIT être un 404 « Coupe introuvable », identique à celle d'un id inexistant

#### Scenario: Coach inscrit
- **WHEN** le propriétaire d'une équipe inscrite demande les rondes d'une coupe privée
- **THEN** il DOIT les recevoir

#### Scenario: Coach invité
- **WHEN** un coach invité (invitation en attente) ouvre la fiche d'une coupe privée
- **THEN** il DOIT la voir

#### Scenario: Feuille d'une rencontre de coupe privée
- **WHEN** un coach tiers demande la feuille de match d'une rencontre d'une coupe privée
- **THEN** la réponse DOIT être un 404

#### Scenario: Documents officiels
- **WHEN** un coach tiers demande les documents officiels d'une coupe privée
- **THEN** la réponse DOIT être un 404, et non plus un 403

#### Scenario: Coupe publique
- **WHEN** n'importe quel coach connecté demande la fiche d'une coupe publique
- **THEN** il DOIT la recevoir, comme auparavant
