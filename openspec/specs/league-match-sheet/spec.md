# league-match-sheet

## Purpose

La saisie de feuille de match de ligue physique (avant-match, évènements, fin
de match), alignée sur les règles officielles Blood Bowl, avec les données de
référence (météo, coups de pouce, budgets) fournies par le serveur — plus les
compléments d'ergonomie qui la rendent tenable en bord de table :
différenciation visuelle des équipes, accès aux coups de pouce par roster,
auto-calculs de fin de match et édition des évolutions de joueurs.

## Requirements

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

### Requirement: Identité et valeur d'équipe sur la feuille
La feuille DOIT exposer, pour chaque équipe, sa **race** (libellé du
roster), son **coach** (owner), sa **TV** (valeur d'équipe actuelle) et
sa **cagnotte** (trésorerie). Ces informations DOIVENT être affichées sur
le résumé du match.

#### Scenario: Badges race + coach
- WHEN un coach ou le commissaire ouvre la feuille
- THEN chaque équipe DOIT afficher un badge race et un badge coach sous son nom

#### Scenario: TV et cagnotte affichées
- WHEN la feuille est chargée
- THEN la TV (VEA) et la cagnotte de chaque équipe DOIVENT être affichées

### Requirement: Tables météo officielles et météo dépendante
La feuille DOIT proposer l'ensemble des tables météo du moteur. La météo
sélectionnable DOIT dépendre de la table choisie (résultats 2..12 de
cette table). La **conséquence informative** de la météo sélectionnée
DOIT être affichée.

#### Scenario: La météo dépend de la table
- WHEN aucune table météo n'est choisie
- THEN le sélecteur de météo DOIT être désactivé
- WHEN une table est choisie
- THEN le sélecteur de météo DOIT lister les conditions (roll → condition) de cette table

#### Scenario: Conséquence de la météo
- WHEN une météo est sélectionnée
- THEN sa conséquence (description de la règle) DOIT être affichée à titre informatif

#### Scenario: Changement de table
- WHEN la table météo est modifiée
- THEN la météo précédemment choisie DOIT être réinitialisée

### Requirement: Coups de pouce issus du catalogue officiel
Les coups de pouce NE DOIVENT PLUS être une saisie libre : ils DOIVENT
être choisis dans le catalogue officiel et parmi les Star Players
disponibles pour le roster de l'équipe. Le coût DOIT être pré-rempli et
la quantité bornée par la limite du catalogue (1 pour un Star Player).

#### Scenario: Ajout depuis le catalogue
- WHEN un coach ajoute un coup de pouce
- THEN il DOIT le choisir dans le catalogue (ou parmi les Star Players de son équipe)
- AND le coût DOIT être renseigné automatiquement

#### Scenario: Quantité bornée
- WHEN un coup de pouce a une quantité maximale
- THEN la quantité saisie NE DOIT PAS dépasser cette limite

### Requirement: Budget des coups de pouce (petty cash + trésorerie)
Le budget de coups de pouce d'une équipe DOIT être calculé selon les
règles officielles : petty cash (différence de CTV pour l'équipe la moins
chère) + trésorerie. Une sélection dépassant ce budget DOIT être empêchée
côté interface ET rejetée côté serveur.

#### Scenario: Budget affiché
- WHEN la feuille est chargée
- THEN le petty cash, la trésorerie et le budget total de chaque équipe DOIVENT être affichés

#### Scenario: Dépassement bloqué côté UI
- WHEN la sélection de coups de pouce dépasse le budget
- THEN l'enregistrement de l'avant-match DOIT être désactivé

#### Scenario: Dépassement rejeté côté serveur
- WHEN une sélection hors budget est soumise à `updatePreMatch`
- THEN la requête DOIT être rejetée (`inducement_over_budget`) sans modification

#### Scenario: Comptabilité petty cash à la validation
- WHEN le match est validé par le commissaire
- THEN la trésorerie NE DOIT être débitée que de l'excédent des coups de pouce au-delà du petty cash reçu

### Requirement: Mi-temps et tour des évènements
Chaque évènement de match DOIT pouvoir porter une **mi-temps** (1 ou 2) et
un **tour**. Ces valeurs DOIVENT être persistées et affichées à côté de
l'évènement.

#### Scenario: Saisie mi-temps + tour
- WHEN un coach ajoute un évènement avec une mi-temps et un tour
- THEN la mi-temps et le tour DOIVENT être enregistrés (dans `meta`)

#### Scenario: Affichage
- WHEN la liste des évènements est rendue
- THEN la mi-temps et le tour de chaque évènement (s'ils existent) DOIVENT être affichés

### Requirement: Timeline chronologique des évènements
La liste des évènements DOIT être affichée dans l'ordre chronologique :
par mi-temps croissante puis par tour croissant, l'ordre de saisie servant
de départage stable. Les évènements sans mi-temps/tour DOIVENT rester
affichables (traités comme début de 1re mi-temps).

#### Scenario: Tri par mi-temps puis tour
- WHEN plusieurs évènements ont des mi-temps/tours différents
- THEN ils DOIVENT être ordonnés par mi-temps puis par tour, indépendamment de leur ordre de saisie

#### Scenario: Départage stable
- WHEN deux évènements ont la même mi-temps et le même tour
- THEN leur ordre relatif de saisie DOIT être conservé

### Requirement: Navigation par phase (onglets)
La saisie DOIT être organisée en trois phases navigables — avant-match,
en cours, fin du match — sur une seule page, sans rechargement ni perte
de l'état de saisie en changeant de phase. Le résumé du match, les
actions de validation (coach / commissaire) et l'invalidation DOIVENT
rester accessibles quelle que soit la phase active.

#### Scenario: Changement de phase
- WHEN l'utilisateur sélectionne une autre phase
- THEN le contenu correspondant DOIT s'afficher sans rechargement de page
- AND l'état de saisie des autres phases NE DOIT PAS être perdu

#### Scenario: Actions toujours accessibles
- WHEN une phase quelconque est active
- THEN le résumé et les actions de workflow DOIVENT rester visibles
