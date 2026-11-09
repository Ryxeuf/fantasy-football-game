# Spec — Ligue libre

## ADDED Requirements

### Requirement: Une ligue choisit son format

Une ligue SHALL porter un format `standard` (défaut, y compris pour toute
ligue existante dont la colonne est vide) ou `open`. Le format se choisit à
la création et reste modifiable tant qu'aucune rencontre n'a été jouée.

#### Scenario: Ligue existante
- **WHEN** une ligue antérieure à la colonne est lue
- **THEN** elle est traitée comme `standard`, sans changement de comportement

### Requirement: En ligue libre, un coach déclare ses rencontres

En format `open`, un coach propriétaire d'une équipe active de la saison
SHALL pouvoir déclarer une rencontre entre cette équipe et une autre équipe
active de la saison, sans intervention du commissaire. La rencontre est
rangée dans la journée du mois correspondant, créée au besoin.

#### Scenario: Première rencontre du mois
- **WHEN** un coach déclare une rencontre datée d'un mois sans journée
- **THEN** une journée « <Mois> <Année> » est créée avec le numéro suivant
  et la rencontre y est rangée

#### Scenario: Équipe tierce
- **WHEN** un coach déclare une rencontre entre deux équipes qui ne lui
  appartiennent pas
- **THEN** la déclaration est refusée (403), sauf pour le commissaire

### Requirement: Le classement libre est un pourcentage avec seuil

En format `open`, le classement SHALL ordonner les équipes ayant joué au
moins le seuil de matchs (5 par défaut) selon un score combinant pourcentage
de victoires et bonus de participation, puis selon l'ordre de départage de
la ligue. Les équipes sous le seuil SHALL être listées à part comme « non
classées » avec leur nombre de matchs.

#### Scenario: Équipe sous le seuil
- **WHEN** une équipe a joué 4 matchs et que le seuil est 5
- **THEN** elle figure dans les non classées (4/5) et pas dans le classement

## Notes

Formule exacte du score, plafond de rencontres contre le même adversaire,
play-offs et fin de saison : voir les questions ouvertes du design. Les
scénarios seront complétés après l'exploration.
