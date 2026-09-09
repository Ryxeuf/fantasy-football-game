# league-round-followup

## ADDED Requirements

### Requirement: Relance d'une journée par le commissaire

`POST /leagues/rounds/:roundId/remind` DOIT permettre au commissaire d'une
ligue de relancer, en un appel, les coachs des rencontres en retard de la
journée. La route DOIT refuser toute autre personne (`403`), y compris un
coach inscrit à la ligue, et renvoyer `404` sur une journée inconnue.

Deux cas, et deux seulement, DOIVENT être relancés :

- **`not_scheduled`** : rencontre encore ouverte, sans date convenue ;
- **`sheet_overdue`** : rencontre encore ouverte, date convenue DÉPASSÉE, et
  aucune feuille parvenue au commissaire.

Une rencontre jouée, forfaitée ou annulée NE DOIT JAMAIS être relancée. Une
rencontre planifiée dans le futur NON PLUS. Une feuille `submitted_*` ou
`validated` DOIT éteindre la relance ; un `draft` ou un `invalidated` NE
DOIT PAS le faire — elle n'est pas parvenue au commissaire.

Les DEUX coachs de chaque rencontre retenue DOIVENT être relancés, et un
coach possédant les deux équipes ne DOIT l'être qu'une fois.

#### Scenario: Rencontre non planifiée
- WHEN le commissaire relance une journée dont une rencontre n'a pas de date
- THEN la réponse DOIT porter cette rencontre avec le motif `not_scheduled`
- AND les deux coachs DOIVENT recevoir une notification interne
  `league.round_followup` pointant vers la journée

#### Scenario: Journée en ordre
- WHEN aucune rencontre n'est en retard
- THEN la réponse DOIT être `200` avec une liste de relances VIDE et le
  nombre de rencontres passées en revue

#### Scenario: Relance rejouée
- WHEN le commissaire relance deux fois la même journée
- THEN les deux relances DOIVENT partir : rien n'est dédoublonné ni écrasé

### Requirement: Message de relance figé

Le corps de chaque relance DOIT être la formulation exacte retenue par le
commissaire, identique d'une journée et d'un destinataire à l'autre :

- `not_scheduled` : « Ton match de la journée en cours n'est pas encore
  planifié. Contacte rapidement ton adversaire pour fixer une date ou le
  commissaire pour signaler tout PB. Merci »
- `sheet_overdue` : « La feuille de match de la journée en cours n'est pas
  parvenue au commissaire alors que le match a dû se dérouler. Merci de
  faire le nécessaire rapidement et de prévenir le commissaire »

L'e-mail DOIT situer le match relancé (ligue, journée, rencontre) et porter
un lien vers la journée quand l'origine web est connue.

### Requirement: Trois canaux, aucun bloquant

La relance DOIT partir sur la notification interne (canal garanti,
indépendant des préférences push et d'une adresse e-mail), le push et
l'e-mail. L'échec d'un canal ou d'un destinataire NE DOIT PAS interrompre
les autres. Le compte rendu DOIT indiquer les e-mails RÉELLEMENT acceptés
par le transport.

#### Scenario: Coach sans adresse e-mail
- WHEN un des deux coachs n'a pas d'adresse
- THEN l'autre DOIT recevoir son e-mail
- AND les deux DOIVENT recevoir leur notification interne

### Requirement: Bouton de relance réservé au commissaire

Le calendrier DOIT proposer un bouton « Relancer » sur chaque journée au
seul commissaire, et afficher le compte rendu de l'appel — y compris quand
il n'y avait rien à relancer, information utile et non silence.

#### Scenario: Coach inscrit
- WHEN un coach consulte le calendrier
- THEN le bouton NE DOIT PAS apparaître
