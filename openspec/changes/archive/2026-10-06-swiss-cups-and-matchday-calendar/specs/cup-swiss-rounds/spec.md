# cup-swiss-rounds

## ADDED Requirements

### Requirement: Génération d'une ronde suisse

Le **commissaire** (créateur de la coupe) ou un administrateur DOIT pouvoir
générer la ronde suivante d'une coupe via `POST /cup/:id/rounds/swiss`. La
coupe DOIT être validée (`en_cours`), compter au moins deux inscrits, et la
ronde précédente NE DOIT plus avoir de rencontre ouverte (`scheduled` ou
`in_progress`), sinon `409`. Un coach tiers DOIT être refusé (`403`).

Les équipes DOIVENT être appariées dans l'ordre du classement courant
(exempts compris), chacune contre l'adversaire le plus proche qu'elle n'a
pas encore rencontré ; un rematch n'est accepté que si aucun appariement
complet sans rematch n'existe. En nombre impair, la dernière équipe non
encore exemptée DOIT être exempte (`status = bye`, `awayTeamId = null`).

#### Scenario: Première ronde à cinq équipes
- WHEN le créateur d'une coupe validée à 5 inscrits appelle `POST /cup/<id>/rounds/swiss`
- THEN la réponse DOIT être `201` avec une ronde de 2 rencontres `scheduled` et 1 exempt

#### Scenario: Ronde suivante trop tôt
- WHEN une rencontre de la dernière ronde est encore `scheduled`
- THEN `POST /cup/<id>/rounds/swiss` DOIT renvoyer `409`

#### Scenario: Pas de rematch
- WHEN la ronde 1 a opposé A à B
- THEN la ronde 2 NE DOIT PAS opposer A à B tant qu'une autre combinaison existe

### Requirement: Le match local matérialise la rencontre

`POST /local-match` DOIT accepter `cupPairingId` : la coupe est déduite de
la rencontre, les deux équipes DOIVENT être celles de la rencontre (`400`
sinon), la rencontre DOIT être `scheduled` sans match (`409` sinon). Une
seule rencontre par match (`LocalMatch.cupPairingId` unique) : un second
match pour la même rencontre DOIT être refusé (`409`). La création passe la
rencontre `in_progress` ; la fin du match (`/complete`) la passe `played`
et complète la ronde quand toutes ses rencontres sont terminales ; un match
annulé ou supprimé DOIT libérer la rencontre (`scheduled`).

#### Scenario: Doublon refusé
- WHEN un coach crée un match pour une rencontre qui en a déjà un
- THEN la réponse DOIT être `409`

### Requirement: Exempt au classement

Un exempt DOIT valoir les points d'une victoire (`winPoints`) au classement
de la coupe, sans compter comme match joué ni en touchdowns ; `GET
/cup/:id` DOIT exposer `standings[].byes` et `rounds`.

#### Scenario: Points d'exempt
- WHEN une équipe est exempte de la ronde 1 et n'a joué aucun match
- THEN sa ligne de classement DOIT afficher `byes = 1`, `matchesPlayed = 0` et `totalPoints = winPoints`

### Requirement: Gestion des rondes par le commissaire

Le commissaire DOIT pouvoir supprimer la dernière ronde tant qu'aucune de
ses rencontres n'a de match local ni de résultat (`DELETE
/cup/:id/rounds/last`, `409` sinon), annuler une rencontre sans match
(`POST /cup/pairings/:id/cancel`), et poser une date prévisionnelle sur
une rencontre ouverte (`PATCH /cup/pairings/:id/schedule`, également ouvert
aux deux coachs de la rencontre ; `403` pour un tiers ; refus sur un exempt).
