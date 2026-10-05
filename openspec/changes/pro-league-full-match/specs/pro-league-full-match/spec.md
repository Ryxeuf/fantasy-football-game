# pro-league-full-match

## ADDED Requirements

### Requirement: Remise en jeu après chaque touchdown

Dans le full driver, chaque touchdown DOIT être suivi d'une remise en place
des deux équipes et d'un coup d'envoi (table 2D6 complète) avant la reprise
du jeu, par la même séquence que la mi-temps. Aucun état en phase `playing`
NE DOIT avoir un terrain vide.

#### Scenario: Touchdown en première mi-temps
- WHEN une équipe marque au tour 3 de la première mi-temps
- THEN l'état suivant DOIT contenir les deux équipes replacées et un évènement `KICKOFF`
- AND le jeu DOIT reprendre au tour 4 avec l'équipe réceptrice

### Requirement: Un joueur à terre se relève

Le moteur DOIT distinguer un joueur sonné (Stunned) d'un joueur à terre
(Prone). Un joueur sonné DOIT devenir Prone à la fin du tour de son équipe.
Un joueur Prone DOIT pouvoir se relever au début de son activation pour 3 PM
(toute son allocation si MA < 3), gratuitement avec *Jump Up*. Un état stocké
sans le champ Prone DOIT rester lisible.

#### Scenario: Plaqué puis relevé
- WHEN un joueur est plaqué sans être KO ni blessé
- THEN il est sonné jusqu'à la fin du tour suivant de son équipe
- AND au tour d'après son équipe DOIT pouvoir le relever et le déplacer avec MA − 3

#### Scenario: Ancien état
- WHEN un état sérialisé avant ce change porte `stunned: true` sans champ Prone
- THEN le moteur DOIT le traiter comme sonné puis Prone au tour suivant, sans erreur

### Requirement: Les choix en attente sont obligatoires

Quand un choix est en attente (dé de blocage, poussée, suivi, relance,
apothicaire, remise), `getLegalMoves` DOIT renvoyer uniquement les coups qui
le résolvent, et l'IA DOIT en choisir un. Aucun choix NE DOIT survivre à un
`END_TURN` autrement que par le nettoyage de secours, journalisé.

#### Scenario: Blocage à deux dés par l'IA
- WHEN l'IA déclare un blocage à deux dés
- THEN le coup suivant DOIT être un `BLOCK_CHOOSE` parmi les résultats proposés
- AND le résultat choisi DOIT être appliqué (joueur poussé, à terre ou blessé)

#### Scenario: Cent matchs sans choix orphelin
- WHEN 100 matchs du full driver sont simulés avec des rosters de 13 joueurs
- THEN 100 % des blocages et blitz DOIVENT être résolus
- AND aucun `END_TURN` NE DOIT trouver un choix en attente

### Requirement: Structure complète du match

Chaque équipe DOIT jouer 8 tours par mi-temps ; `kickingTeam` DOIT être posé
dès la construction de l'état et recalculé en seconde mi-temps ; les
évènements de coup d'envoi interactifs DOIVENT être appliqués avec un
placement IA ; un joueur DOIT jouer son activation en une séquence contiguë
et au plus une fois par tour.

#### Scenario: Comptage des tours
- WHEN un match complet est simulé
- THEN chaque équipe DOIT avoir reçu exactement 16 évènements `TURN_START`

#### Scenario: Activation contiguë
- WHEN l'IA active un joueur
- THEN tous les coups suivants DOIVENT concerner ce joueur jusqu'à `END_PLAYER_TURN`, une action finale ou l'épuisement de ses PM

### Requirement: Mesures sur de vrais matchs

Le smoke de perf, `sim:perf` et `sim:compare` DOIVENT simuler avec des
rosters de 13 joueurs. Le budget p95 d'un match du full driver DOIT rester
sous 5 s.

#### Scenario: Smoke de perf
- WHEN le smoke de perf du sim-engine tourne
- THEN il DOIT utiliser 22 joueurs sur le terrain et vérifier p95 < 5 s
