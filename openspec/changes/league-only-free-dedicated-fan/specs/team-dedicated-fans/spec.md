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

### Requirement: Fan Dévoué offert à l'inscription en ligue

L'inscription d'une équipe à une saison de ligue (`addParticipant` :
inscription, acceptation d'invitation, participant de test) DOIT accorder un
Fan Dévoué offert à une équipe dont `leagueFreeFan` vaut `false`, passer
`leagueFreeFan` à `true` et enregistrer sur l'inscription ce qui a été accordé
(`freeFanGrant = "fan"`), dans la MÊME transaction que la création de
l'inscription. Une équipe dont `leagueFreeFan` vaut `true` ou `null` NE DOIT
rien recevoir. L'octroi DOIT être conditionné à `leagueFreeFan = false` (deux
inscriptions concurrentes n'accordent qu'une fois) et DOIT être journalisé
(`TeamAuditEvent`, action `team.league_free_fan.granted`).

#### Scenario: Première inscription en ligue
- WHEN une équipe neuve (`leagueFreeFan = false`) qui a 2 Fans Dévoués s'inscrit à une saison
- THEN l'équipe DOIT avoir 3 Fans Dévoués et `leagueFreeFan = true`
- AND l'inscription DOIT porter `freeFanGrant = "fan"`
- AND le journal d'équipe DOIT tracer l'octroi avec la saison

#### Scenario: Équipe qui a déjà son fan offert
- WHEN une équipe `leagueFreeFan = true` s'inscrit à une nouvelle saison
- THEN ses Fans Dévoués NE DOIVENT PAS changer
- AND l'inscription NE DOIT porter aucun `freeFanGrant`

#### Scenario: Équipe antérieure à la règle
- WHEN une équipe `leagueFreeFan = null` s'inscrit à une saison
- THEN ses Fans Dévoués NE DOIVENT PAS changer (son fan offert est déjà compté)

#### Scenario: Inscription refusée
- WHEN l'inscription est refusée (saison fermée, roster non autorisé, équipe déjà engagée, saison complète)
- THEN aucun Fan Dévoué NE DOIT être accordé

### Requirement: Équipe au plafond — le prix d'un fan en trésorerie

Si une équipe qui doit recevoir son fan offert a déjà atteint le plafond de
Fans Dévoués de sa config, ses fans NE DOIVENT PAS dépasser le plafond : sa
trésorerie DOIT être créditée du prix unitaire d'un Fan Dévoué (config staff
résolue, en incrément atomique), `leagueFreeFan` DOIT passer à `true` et
l'inscription DOIT porter `freeFanGrant = "refund"` et le montant crédité
(`freeFanRefund`).

#### Scenario: Six fans achetés hors ligue
- WHEN une équipe neuve BB11 qui a 6 Fans Dévoués (plafond 6, prix 5 000 po) s'inscrit à une saison
- THEN l'équipe DOIT garder 6 Fans Dévoués
- AND sa trésorerie DOIT être créditée de 5 000 po
- AND l'inscription DOIT porter `freeFanGrant = "refund"` et `freeFanRefund = 5000`

### Requirement: Fan offert repris quand l'équipe quitte la ligue

Quand une inscription qui porte un `freeFanGrant` est retirée
(`withdrawParticipant`), supprimée par le commissaire (`removeTeamFromLeague`,
`removeCoachFromSeason`) ou emportée par la suppression de sa ligue, ce
qu'elle a accordé DOIT être repris dans la MÊME transaction que le départ,
`leagueFreeFan` DOIT repasser à `false` et la reprise DOIT être journalisée
(`team.league_free_fan.revoked`). Une inscription sans `freeFanGrant` NE DOIT
rien reprendre. La reprise NE DOIT jamais rendre la trésorerie ni les fans
négatifs : un fan accordé reprend 1 fan s'il en reste ; un remboursement
reprend son montant si la trésorerie le couvre, sinon 1 fan s'il en reste,
sinon rien.

#### Scenario: Retrait avant le démarrage
- WHEN une équipe dont l'inscription porte `freeFanGrant = "fan"` est retirée de la saison
- THEN elle DOIT perdre 1 Fan Dévoué et repasser `leagueFreeFan = false`
- AND l'inscription retirée NE DOIT plus porter de `freeFanGrant`

#### Scenario: Suppression par le commissaire
- WHEN le commissaire supprime une équipe dont l'inscription porte `freeFanGrant = "fan"`
- THEN elle DOIT perdre 1 Fan Dévoué et repasser `leagueFreeFan = false`

#### Scenario: Suppression de la ligue
- WHEN une ligue est supprimée alors qu'une de ses inscriptions porte `freeFanGrant = "fan"`
- THEN l'équipe DOIT perdre 1 Fan Dévoué et repasser `leagueFreeFan = false`

#### Scenario: Départ d'une seconde saison
- WHEN une équipe dont le fan offert a été accordé par sa saison 1 quitte la saison 2 (inscription sans `freeFanGrant`)
- THEN ses Fans Dévoués NE DOIVENT PAS changer

#### Scenario: Remboursement repris
- WHEN une équipe dont l'inscription porte `freeFanGrant = "refund"` et `freeFanRefund = 5000` est retirée avec 8 000 po en trésorerie
- THEN sa trésorerie DOIT être débitée de 5 000 po

#### Scenario: Remboursement déjà dépensé
- WHEN la même équipe est retirée avec 2 000 po en trésorerie et 6 Fans Dévoués
- THEN elle DOIT perdre 1 Fan Dévoué et garder sa trésorerie

#### Scenario: Plus aucun fan à reprendre
- WHEN une équipe dont l'inscription porte `freeFanGrant = "fan"` est retirée avec 0 Fan Dévoué
- THEN ses fans DOIVENT rester à 0
- AND `leagueFreeFan` DOIT repasser à `false`

#### Scenario: L'équipe reste en ligue ailleurs
- WHEN l'inscription qui porte l'octroi part alors que l'équipe a une autre inscription active hors de la ligue supprimée
- THEN l'octroi DOIT être reporté sur cette inscription
- AND les Fans Dévoués et la trésorerie de l'équipe NE DOIVENT PAS changer

#### Scenario: Nouvelle inscription après un retrait
- WHEN une équipe dont le fan offert a été repris s'inscrit à une autre saison
- THEN elle DOIT recevoir à nouveau son fan offert

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
se paie et qu'une équipe de ligue reçoit son premier fan à son
inscription en ligue. La fiche d'une équipe dont `leagueFreeFan` vaut
`false` DOIT annoncer que le fan offert sera ajouté à son inscription en
ligue.

#### Scenario: Builder
- WHEN un coach ouvre le builder
- THEN la ligne « Fans dévoués » DOIT partir de 0, afficher le coût de chaque fan
- AND la mention de la règle de ligue DOIT être visible

#### Scenario: Fiche d'une équipe neuve
- WHEN un coach consulte une équipe `leagueFreeFan = false`
- THEN la fiche DOIT annoncer le fan offert à l'inscription en ligue
