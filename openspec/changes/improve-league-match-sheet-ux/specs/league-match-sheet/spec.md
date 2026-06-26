# league-match-sheet (delta)

Capability : saisie de feuille de match de ligue physique (avant-match,
évènements, fin de match) alignée sur les règles officielles Blood Bowl,
avec données de référence (météo, coups de pouce, budgets) fournies par
le serveur.

## ADDED Requirements

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
