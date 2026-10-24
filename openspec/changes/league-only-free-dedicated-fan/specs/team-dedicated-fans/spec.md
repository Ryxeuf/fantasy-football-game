# team-dedicated-fans

## ADDED Requirements

### Requirement: Aucun Fan Dévoué offert à la construction

Une équipe construite (`POST /team/build`, `POST /team/create-from-roster`,
équipe d'entraînement de l'IA), pour une coupe ou hors compétition, DOIT
partir de 0 Fan Dévoué par défaut et DOIT payer CHACUN de ses Fans Dévoués au
prix unitaire de la config staff résolue (roster × format). Le nombre demandé
DOIT être compris entre 0 et le plafond de la config. La création DOIT écrire
`Team.leagueFreeFan = false`.

#### Scenario: Construction sans fan demandé
- WHEN un coach construit une équipe sans préciser de Fans Dévoués
- THEN l'équipe DOIT être créée avec 0 Fan Dévoué et `leagueFreeFan = false`
- AND aucun coût de Fan Dévoué NE DOIT être compté au budget

#### Scenario: Chaque fan se paie
- WHEN un coach construit une équipe BB11 avec 2 Fans Dévoués au prix de 5 000 po
- THEN le coût des Fans Dévoués compté au budget DOIT être de 10 000 po

#### Scenario: Construction pour une coupe
- WHEN un coach construit une équipe pour une coupe (`cupId`) avec 1 Fan Dévoué
- THEN ce fan DOIT être facturé au prix unitaire
- AND l'équipe inscrite DOIT porter 1 Fan Dévoué, sans fan offert

#### Scenario: Zéro fan accepté
- WHEN un coach construit une équipe avec 0 Fan Dévoué
- THEN la construction DOIT être acceptée

#### Scenario: Plafond inchangé
- WHEN un coach demande plus de Fans Dévoués que le plafond de la config
- THEN la construction DOIT être refusée (400) avec le plafond applicable

### Requirement: Fan Dévoué offert au démarrage de la première saison de ligue

Au démarrage d'une saison de ligue (`startSeason`, ou `regenerateSchedule`
quand il passe la saison `in_progress`), chaque participant ACTIF dont
`leagueFreeFan` vaut `false` DOIT recevoir un Fan Dévoué offert, et
`leagueFreeFan` DOIT passer à `true` dans la même écriture. Une équipe dont
`leagueFreeFan` vaut `true` ou `null` NE DOIT rien recevoir. L'octroi DOIT
être idempotent (écriture conditionnée à `leagueFreeFan = false`) et DOIT être
journalisé dans le journal d'équipe (`TeamAuditEvent`, action
`team.league_free_fan`). Un échec d'octroi NE DOIT PAS faire échouer le
démarrage de la saison.

#### Scenario: Première saison de ligue
- WHEN une saison démarre avec une équipe neuve (`leagueFreeFan = false`) qui a 2 Fans Dévoués
- THEN l'équipe DOIT avoir 3 Fans Dévoués et `leagueFreeFan = true`
- AND le journal d'équipe DOIT tracer l'octroi avec la saison

#### Scenario: Seconde saison
- WHEN une saison démarre avec une équipe dont `leagueFreeFan = true`
- THEN ses Fans Dévoués NE DOIVENT PAS changer

#### Scenario: Équipe antérieure à la règle
- WHEN une saison démarre avec une équipe dont `leagueFreeFan = null`
- THEN ses Fans Dévoués NE DOIVENT PAS changer (son fan offert est déjà compté)

#### Scenario: Participant retiré avant le démarrage
- WHEN une équipe inscrite a été retirée de la saison (`withdrawn`) avant son démarrage
- THEN elle NE DOIT PAS recevoir de fan offert

#### Scenario: Démarrage rejoué
- WHEN `regenerateSchedule` est appelé après `startSeason` sur la même saison
- THEN aucun second fan offert NE DOIT être accordé

### Requirement: Équipe au plafond — le prix d'un fan en trésorerie

Si une équipe qui doit recevoir son fan offert a déjà atteint le plafond de
Fans Dévoués de sa config, ses fans NE DOIVENT PAS dépasser le plafond : sa
trésorerie DOIT être créditée du prix unitaire d'un Fan Dévoué (config staff
résolue, en incrément atomique) et `leagueFreeFan` DOIT passer à `true`.

#### Scenario: Six fans achetés hors ligue
- WHEN une saison démarre avec une équipe neuve BB11 qui a 6 Fans Dévoués (plafond 6, prix 5 000 po)
- THEN l'équipe DOIT garder 6 Fans Dévoués
- AND sa trésorerie DOIT être créditée de 5 000 po
- AND le journal d'équipe DOIT tracer un remboursement

### Requirement: Coût des fans achetés et minimum par équipe

Tout calcul du coût des Fans Dévoués d'une équipe (résumé budgétaire de la
fiche, contrôle de budget à la sauvegarde du roster, éditeur de staff, page de
partage) DOIT déduire le fan offert SEULEMENT s'il est compté dans l'équipe
(`leagueFreeFan` à `true` ou `null`). Le minimum de Fans Dévoués d'une équipe
DOIT être 1 si son fan offert est compté, 0 sinon. La règle DOIT être une
fonction pure partagée par le serveur et le web ; un marqueur absent de la
réponse d'API DOIT être lu comme `null`.

#### Scenario: Équipe historique
- WHEN le résumé budgétaire est calculé pour une équipe `leagueFreeFan = null` qui a 3 Fans Dévoués à 5 000 po
- THEN le coût des fans DOIT être de 10 000 po

#### Scenario: Équipe neuve hors ligue
- WHEN le résumé budgétaire est calculé pour une équipe `leagueFreeFan = false` qui a 3 Fans Dévoués à 5 000 po
- THEN le coût des fans DOIT être de 15 000 po

#### Scenario: Retirer son dernier fan hors ligue
- WHEN le coach d'une équipe `leagueFreeFan = false` ramène ses Fans Dévoués à 0
- THEN la modification DOIT être acceptée

#### Scenario: Équipe de ligue sous son minimum
- WHEN le coach d'une équipe `leagueFreeFan = true` demande 0 Fan Dévoué
- THEN la modification DOIT être refusée (400) en citant le minimum de 1

### Requirement: Zéro Fan Dévoué au Facteur de Popularité

Le Facteur de Popularité d'avant-match DOIT utiliser le compte de Fans Dévoués
de l'équipe tel quel, 0 compris : aucun repli NE DOIT transformer 0 en 1.

#### Scenario: Match local d'une équipe sans fan
- WHEN un match local démarre avec une équipe qui a 0 Fan Dévoué
- THEN son Facteur de Popularité DOIT valoir D3 + 0

### Requirement: La règle est annoncée là où elle s'applique

Le builder DOIT afficher, à côté de la ligne des Fans Dévoués, que chaque fan
se paie et qu'une équipe de ligue reçoit son premier fan au démarrage de sa
première saison. La fiche d'une équipe dont `leagueFreeFan` vaut `false`
DOIT annoncer que le fan offert sera ajouté au démarrage d'une saison de
ligue.

#### Scenario: Builder
- WHEN un coach ouvre le builder
- THEN la ligne « Fans dévoués » DOIT partir de 0, afficher le coût de chaque fan
- AND la mention de la règle de ligue DOIT être visible

#### Scenario: Fiche d'une équipe neuve
- WHEN un coach consulte une équipe `leagueFreeFan = false`
- THEN la fiche DOIT annoncer le fan offert au démarrage d'une saison de ligue
