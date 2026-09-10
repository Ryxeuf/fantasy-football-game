# cup-standings-criteria

## Purpose

Les critères de départage du classement d'une coupe, définis et ordonnés par
son commissaire, et l'édition d'une coupe (nom, description, visibilité,
barème, départages) sans avoir à la recréer.

## Requirements

### Requirement: Critères de classement configurables

Une coupe DOIT pouvoir définir ses critères de départage, dans l'ordre de
priorité, parmi : points, points de résultat, points d'action, victoires,
différence de TD, TD marqués, TD encaissés, différence de sorties, sorties
infligées, sorties subies, passes, matchs joués, nom. Le nom est TOUJOURS le
dernier critère effectif, pour garantir un ordre total.

Une coupe sans configuration — y compris toute coupe antérieure à la colonne —
DOIT conserver l'ordre historique : points, différence de TD, TD marqués,
victoires, nom. Une valeur illisible ou ne contenant aucun critère connu DOIT
retomber sur ce même ordre.

#### Scenario: Départage à la BASH
- WHEN une coupe configure `["points", "cas_for"]`
- THEN à égalité de points, l'équipe ayant infligé le plus de sorties DOIT être devant

#### Scenario: Sans configuration
- WHEN la coupe ne configure aucun critère
- THEN le classement DOIT être identique à celui d'avant la fonctionnalité

### Requirement: Édition d'une coupe par son commissaire

`PATCH /cup/:id` (commissaire ou administrateur) DOIT permettre de modifier le
nom, la description, la visibilité, le barème de points et les critères de
départage, y compris en cours de coupe — le classement étant dérivé, il se
recalcule seul. L'édition, le format et le règlement de tournoi NE DOIVENT PAS
y être modifiables. Une coupe archivée DOIT être refusée (`409`), un tiers
(`403`), une coupe inconnue (`404`).

#### Scenario: Barème corrigé en cours de coupe
- WHEN le commissaire change `winPoints` alors que des matchs sont joués
- THEN le classement servi ensuite DOIT appliquer le nouveau barème

### Requirement: Critères servis à la lecture

`GET /cup/:id` DOIT servir les critères EFFECTIFS (défaut compris) pour que
l'écran puisse les afficher dans leur ordre d'application.
