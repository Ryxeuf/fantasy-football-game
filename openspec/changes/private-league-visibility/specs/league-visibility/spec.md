# league-visibility

## ADDED Requirements

### Requirement: Une ligue privée n'existe que pour ses membres

Une ligue dont `isPublic` vaut `false` est PRIVÉE. Toute lecture de la ligue
par son id — ou par l'id d'une de ses saisons ou d'une de ses rencontres —
DOIT être réservée à son commissaire, aux administrateurs, aux coachs inscrits
(une équipe dans au moins une saison de la ligue, quel que soit son statut) et
aux coachs invités par une invitation en attente qui les nomme. Sont
concernés : le détail de la ligue, le détail d'une saison (calendrier,
appariements, participants), le classement, les poules, les classements
individuels et par équipe, le récap de fin de saison, le bracket de play-offs,
la feuille de match d'une rencontre, les rosters en lecture seule et les
documents officiels.

La résolution DOIT être unique côté serveur (`services/league-access`) ; aucun
endpoint ne DOIT réécrire la règle.

#### Scenario: Coach tiers sur une ligue privée
- WHEN un coach connecté qui n'est ni commissaire, ni inscrit, ni invité lit
  une ligue privée par son id
- THEN le serveur DOIT répondre `404`

#### Scenario: Coach inscrit
- WHEN un coach dont une équipe est inscrite à une saison de la ligue lit la
  ligue, une de ses saisons, son classement ou sa feuille de match
- THEN le serveur DOIT répondre `200`

#### Scenario: Coach invité en attente
- WHEN un coach nommé par une invitation `pending` lit la ligue ou une de ses
  saisons avant d'avoir accepté
- THEN le serveur DOIT répondre `200`

#### Scenario: Commissaire et administrateur
- WHEN le commissaire ou un administrateur lit une ligue privée
- THEN le serveur DOIT répondre `200` sans consulter les inscriptions

### Requirement: Le refus ne révèle pas l'existence de la ligue

Le refus de lecture d'une ligue privée DOIT être un `404` portant le MÊME
message qu'une ressource inexistante (« Ligue introuvable », « Saison
introuvable », « Pairing introuvable »). Il NE DOIT jamais être un `403`, qui
confirmerait l'existence de la ligue. Aucun calcul (classement, statistiques,
feuille) NE DOIT être lancé avant que la visibilité soit tranchée.

Le `403` reste réservé à ce qui est visible mais interdit : les rosters d'une
ligue publique pour un coach non inscrit, ou pour un coach seulement invité.

#### Scenario: Ligue inexistante et ligue cachée
- WHEN un tiers lit une ligue privée puis un id qui n'existe pas
- THEN les deux réponses DOIVENT être identiques (statut et corps)

#### Scenario: Rosters d'une ligue publique
- WHEN un coach non inscrit lit le roster d'une équipe d'une ligue publique
- THEN le serveur DOIT répondre `403`

### Requirement: Les lectures ouvertes restent ouvertes pour une ligue publique

Les lectures servies sans compte (poules, classements individuels et par
équipe, récap, bracket) DOIVENT rester accessibles sans authentification pour
une ligue publique, et DOIVENT être montées derrière `optionalAuthUser` afin
qu'une ligue privée soit servie à ses membres identifiés par leur jeton, et
introuvable pour les autres — visiteur anonyme compris.

#### Scenario: Visiteur anonyme sur une ligue publique
- WHEN un visiteur non connecté lit les poules ou le récap d'une ligue publique
- THEN le serveur DOIT répondre `200`

#### Scenario: Visiteur anonyme sur une ligue privée
- WHEN un visiteur non connecté lit les poules ou le récap d'une ligue privée
- THEN le serveur DOIT répondre `404`

#### Scenario: Lecture authentifiée sans jeton
- WHEN un visiteur non connecté lit le détail ou le classement d'une ligue
- THEN le serveur DOIT répondre `401`, ligue publique ou privée

### Requirement: Les listings suivent la même règle

Le listing général des ligues DOIT montrer une ligue privée à son
commissaire, ses inscrits et ses invités seulement, et le calendrier public
des saisons thématiques NE DOIT lister que les saisons de ligues publiques.

#### Scenario: Calendrier thématique
- WHEN le calendrier des saisons d'un thème est demandé
- THEN les saisons d'une ligue privée NE DOIVENT PAS y figurer

### Requirement: Rejoindre une ligue privée suppose de la voir

L'inscription d'une équipe à une saison par l'id de la saison DOIT être
refusée par un `404` à tout coach pour qui la ligue est invisible. Un coach
invité en attente DOIT pouvoir s'inscrire.

#### Scenario: Tiers qui devine l'id d'une saison privée
- WHEN un coach ni inscrit ni invité tente d'inscrire son équipe
- THEN le serveur DOIT répondre `404` sans créer d'inscription

#### Scenario: Coach invité
- WHEN un coach invité en attente inscrit son équipe à la saison
- THEN l'inscription DOIT être créée

### Requirement: Le champ documente la règle

Le commentaire du champ `League.isPublic` du schéma Prisma DOIT énoncer la
sémantique « privée » (qui voit la ligue, 404 pour les autres) et pointer la
résolution serveur unique, et le formulaire de ligue DOIT expliquer ce
qu'implique le choix « Privée ».

#### Scenario: Formulaire de création
- WHEN un commissaire ouvre le formulaire de ligue
- THEN un indice sous Publique / Privée DOIT expliquer qu'une ligue privée
  n'est ni listée ni lisible par un tiers
