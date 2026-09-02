# league-match-sheet (delta)

Compléments à la saisie de feuille de match : différenciation visuelle des
équipes, accès aux coups de pouce par roster, auto-calculs de fin de match
et édition des évolutions de joueurs.

## ADDED Requirements

### Requirement: Coups de pouce accessibles par équipe
Chaque équipe NE DOIT se voir proposer QUE les coups de pouce et star
players réellement accessibles à son roster selon les règles, avec le coût
effectif (rabais régional appliqué).

#### Scenario: Filtre d'accès apothicaire
- WHEN un roster a accès à l'apothicaire
- THEN l'« apothicaire itinérant » DOIT être proposé et « Igor » NE DOIT PAS l'être (et inversement pour un roster sans accès apothicaire)

#### Scenario: Coût régional
- WHEN un roster bénéficie d'un rabais régional sur un coup de pouce
- THEN le coût proposé DOIT être le coût réduit

### Requirement: Différenciation visuelle des équipes par couleur
La feuille DOIT colorer les éléments propres à chaque équipe à partir d'une
couleur dérivée de son roster, afin d'identifier l'équipe d'un coup d'œil.

#### Scenario: Timeline colorée
- WHEN un évènement est attribué à une équipe
- THEN sa ligne de timeline DOIT porter la couleur de cette équipe

#### Scenario: En-tête coloré
- WHEN le récap du match est affiché
- THEN chaque équipe DOIT être associée à sa couleur dans l'en-tête

### Requirement: Saisie d'évènements prioritaire à l'écran
Le bloc de saisie d'un évènement DOIT être positionné avant la timeline, de
sorte qu'ajouter un évènement ne nécessite pas de faire défiler la liste.

#### Scenario: Ajout sans défilement
- WHEN la liste contient de nombreux évènements
- THEN le formulaire d'ajout DOIT rester accessible en haut de la section

### Requirement: Auto-calcul des récompenses de fin de match
La feuille DOIT calculer automatiquement ce qui est déterministe par les
règles (SPP par joueur depuis les évènements, gains depuis la popularité) et
NE demander une saisie manuelle que pour les éléments non déterministes
(jets de dé, choix). Le SPP affiché DOIT correspondre au calcul appliqué.

#### Scenario: SPP par joueur
- WHEN des évènements (TD, sorties, passes, interceptions, MVP) sont saisis
- THEN le SPP de chaque joueur DOIT être calculé et affiché, et appliqué tel quel à la validation

#### Scenario: Gains automatiques
- WHEN le facteur de popularité est saisi
- THEN les gains DOIVENT être calculés automatiquement (override possible)

### Requirement: Évolutions de joueurs depuis la feuille, après validation
Le coach DOIT pouvoir réaliser les évolutions de ses joueurs (compétences /
améliorations de caractéristique) directement depuis la feuille de match,
une fois celle-ci validée par le commissaire. Les évolutions NE DOIVENT être
appliquées au roster qu'après cette validation.

#### Scenario: Édition inline après validation
- WHEN le match est validé et le coach ouvre l'onglet Évolutions
- THEN il DOIT pouvoir choisir et appliquer les avancements de ses joueurs éligibles sans quitter la feuille

#### Scenario: Aucune évolution avant validation
- WHEN le match n'est pas encore validé
- THEN aucune évolution NE DOIT être applicable et l'interface DOIT l'indiquer
