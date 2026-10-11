# tournament-ruleset

## ADDED Requirements

### Requirement: Coups de pouce du règlement achetés à la création

Sous un règlement de tournoi, les coups de pouce de sa liste fermée DOIVENT
pouvoir être achetés à la création de l'équipe, sur le budget d'or, à ses
prix et quantités. Tout coup de pouce absent de la liste DOIT être refusé,
y compris quand l'équipe n'est construite pour aucune coupe.

#### Scenario: Achat sous règlement
- **WHEN** un coach construit une équipe orc NAF WC 2027 avec une Mascotte
- **THEN** la Mascotte DOIT être facturée 25 000 po sur le budget de 1 080 kpo

#### Scenario: Hors liste
- **WHEN** le même build porte un Mage Météo
- **THEN** la création DOIT être refusée (400) en nommant le règlement

### Requirement: Remises du règlement par équipe

Une règle de coup de pouce du règlement DOIT pouvoir porter un prix réduit,
appliqué aux équipes que le catalogue officiel désigne pour la remise de ce
coup de pouce (règle spéciale ou roster). Sans prix réduit, le prix du
règlement DOIT s'appliquer à toutes les équipes.

#### Scenario: Chantage et Corruption
- **WHEN** une équipe goblin NAF WC 2027 achète des Pots-de-vin
- **THEN** chaque Pot-de-vin DOIT être facturé 50 000 po

#### Scenario: Halflings
- **WHEN** une équipe halfling NAF WC 2027 achète le Chef Cuistot Halfling
- **THEN** il DOIT être facturé 100 000 po, et 300 000 po à toute autre équipe

### Requirement: Plafond de Pots-de-vin abaissé par une Arme Secrète

Une règle de coup de pouce du règlement DOIT pouvoir abaisser sa quantité
maximale quand l'équipe recrute un Star Player portant Arme Secrète. Sous
NAF WC 2027, ce plafond DOIT être de 2 Pots-de-vin.

#### Scenario: Star Player à Arme Secrète
- **WHEN** une équipe NAF WC 2027 recrute un Star Player à Arme Secrète et 3 Pots-de-vin
- **THEN** la création DOIT être refusée (400)

#### Scenario: Sans Arme Secrète
- **WHEN** la même équipe recrute 3 Pots-de-vin sans Star Player à Arme Secrète
- **THEN** la création DOIT être acceptée

### Requirement: Or non dépensé perdu sous règlement

Une équipe créée sous un règlement de tournoi DOIT naître avec une
trésorerie nulle : le reliquat du budget d'or est perdu. Sans règlement, le
reliquat DOIT continuer d'être versé en trésorerie.

#### Scenario: Reliquat sous règlement
- **WHEN** une équipe NAF WC 2027 dépense 1 060 kpo sur 1 080 kpo
- **THEN** sa trésorerie DOIT valoir 0

#### Scenario: Reliquat sans règlement
- **WHEN** une équipe sans règlement dépense 960 kpo sur 1 000 kpo
- **THEN** sa trésorerie DOIT valoir 40 000 po

### Requirement: Remises et plafonds éditables

L'administration des règlements DOIT permettre de saisir le prix réduit et
le plafond conditionnel de chaque coup de pouce autorisé. Un prix réduit
négatif ou supérieur au prix de base, ou un plafond conditionnel négatif,
DOIT être refusé à l'écriture et ignoré à la lecture.

#### Scenario: Prix réduit incohérent
- **WHEN** un administrateur saisit un prix réduit de 150 000 po pour un prix de 100 000 po
- **THEN** l'enregistrement DOIT être refusé
