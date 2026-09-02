# league-playoff-launch (delta)

Capability : la construction des seeds du bracket de playoffs à partir des
quotas de qualification par poule, et le contrôle explicite du lancement des
playoffs par le commissaire (taille du bracket, déclenchement manuel, clôture
anticipée de la phase de poule). Surface serveur (`apps/server`) + UI
commissaire (`apps/web`). Distincte de la progression du bracket
(`advancePlayoffsWithWinner`) et de l'override des participants
(`overridePlayoffParticipants`), inchangés.

## ADDED Requirements

### Requirement: Seeding des playoffs à partir des quotas de poule
Quand une saison possède des poules dont la somme des `qualifiesForPlayoffs` est
strictement positive, les seeds du bracket DOIVENT être sélectionnés poule par
poule : les `qualifiesForPlayoffs` premiers de chaque poule, à l'exclusion des
participants `withdrawn`. L'ordre des seeds DOIT être « en serpentin » : tous les
premiers de poule (par `pool.order` croissant), puis tous les deuxièmes, et ainsi
de suite. Les participants non affectés à une poule NE DOIVENT PAS être
qualifiés.

#### Scenario: Deux poules qualifiant chacune deux équipes
- WHEN une saison a 2 poules avec `qualifiesForPlayoffs = 2` et `playoffSize = 4`
- THEN les seeds DOIVENT être `[1er poule 1, 1er poule 2, 2e poule 1, 2e poule 2]`
- AND les demi-finales DOIVENT opposer des équipes de poules différentes

#### Scenario: Participants retirés exclus
- WHEN un participant `withdrawn` figure dans les premiers de sa poule
- THEN il NE DOIT PAS être retenu comme seed
- AND le qualifié suivant de la même poule DOIT prendre sa place

#### Scenario: Participants non affectés à une poule
- WHEN des participants ne sont affectés à aucune poule
- THEN ils NE DOIVENT PAS apparaître dans les seeds

### Requirement: Préservation du seeding global sans quota de poule
En l'absence de poule, ou lorsque toutes les poules ont `qualifiesForPlayoffs = 0`,
les seeds DOIVENT continuer d'être calculés sur le classement global de la
saison, à l'identique du comportement existant.

#### Scenario: Saison sans poule
- WHEN une saison sans aucune poule atteint la génération du bracket
- THEN les seeds DOIVENT être les `playoffSize` premiers du classement global

#### Scenario: Poules sans quota
- WHEN toutes les poules d'une saison ont `qualifiesForPlayoffs = 0`
- THEN les seeds DOIVENT être les `playoffSize` premiers du classement global

### Requirement: Cohérence entre quotas de poule et taille du bracket
La génération DOIT être refusée si la somme des `qualifiesForPlayoffs` diffère de
`playoffSize`, ou si une poule compte moins de participants éligibles que son
quota. Aucun round ni pairing de playoff NE DOIT être créé dans ces cas.

#### Scenario: Somme des quotas différente de la taille du bracket
- WHEN la somme des quotas vaut 6 alors que `playoffSize` vaut 4
- THEN la génération DOIT être refusée avec la raison `pool-qualification-mismatch`
- AND aucun round `kind="playoff"` NE DOIT être créé

#### Scenario: Poule trop petite pour son quota
- WHEN une poule qualifie 4 équipes mais n'en compte que 3 éligibles
- THEN la génération DOIT être refusée avec la raison `insufficient-participants`

### Requirement: Garde de fin de phase régulière
Le démarrage des playoffs DOIT être refusé tant qu'un round non-playoff de la
saison n'est pas `completed`, sauf clôture anticipée explicitement demandée.

#### Scenario: Phase régulière encore en cours
- WHEN le commissaire demande le démarrage des playoffs alors qu'un round
  régulier n'est pas `completed`, sans clôture anticipée
- THEN la demande DOIT être refusée avec la raison `regular-season-incomplete`
- AND aucun round `kind="playoff"` NE DOIT être créé

#### Scenario: Déclenchement automatique inchangé
- WHEN le dernier round régulier passe `completed` et que `playoffSize > 0`
- THEN le bracket DOIT être généré automatiquement comme aujourd'hui
- AND la saison DOIT rester `in_progress`

### Requirement: Clôture anticipée de la phase de poule par le commissaire
Le commissaire DOIT pouvoir clôturer la phase de poule avant son terme et
enchaîner sur les playoffs. Les pairings réguliers `scheduled` ou `in_progress`
DOIVENT alors passer `cancelled`, et les rounds réguliers non terminés
`completed`. Cette clôture DOIT être journalisée. Elle NE DOIT PAS contourner les
autres refus (`playoffs-disabled`, `playoffs-already-started`,
`pool-qualification-mismatch`, `insufficient-participants`), ni annuler quoi que
ce soit lorsque l'un d'eux s'applique.

#### Scenario: Clôture anticipée acceptée
- WHEN le commissaire demande le démarrage avec clôture anticipée alors que des
  matchs réguliers restent à jouer et que la configuration est cohérente
- THEN les pairings réguliers non joués DOIVENT passer `cancelled`
- AND les rounds réguliers non terminés DOIVENT passer `completed`
- AND le bracket DOIT être généré
- AND l'action DOIT être journalisée

#### Scenario: Clôture anticipée sur configuration incohérente
- WHEN le commissaire demande la clôture anticipée alors que les quotas de poule
  ne correspondent pas à `playoffSize`
- THEN la demande DOIT être refusée
- AND aucun pairing NE DOIT être annulé

#### Scenario: Réservée au commissaire
- WHEN un utilisateur qui n'est pas le créateur de la ligue demande le
  démarrage des playoffs
- THEN la demande DOIT être refusée (HTTP 403)

### Requirement: Réglage de la taille du bracket en cours de saison
Le commissaire DOIT pouvoir modifier `playoffSize` (0, 2, 4 ou 8) après la
création de la saison, tant qu'aucun round de playoff n'existe et que la saison
n'est pas `completed`.

#### Scenario: Modification avant génération du bracket
- WHEN le commissaire passe `playoffSize` de 0 à 4 sur une saison `in_progress`
  sans round de playoff
- THEN la nouvelle valeur DOIT être enregistrée

#### Scenario: Refus après génération du bracket
- WHEN le commissaire tente de modifier `playoffSize` alors qu'un round
  `kind="playoff"` existe
- THEN la modification DOIT être refusée (`playoff_already_started`, HTTP 409)

#### Scenario: Refus sur saison clôturée
- WHEN la saison est `completed`
- THEN la modification DOIT être refusée (HTTP 409)

### Requirement: Restitution de l'état des playoffs au commissaire
Tant qu'aucun bracket n'existe, l'interface DOIT exposer au commissaire la
taille du bracket configurée, l'état d'avancement de la phase régulière, la
cohérence des quotas de poule, et une action de démarrage. Les refus serveur
DOIVENT être restitués en clair. Pour les autres utilisateurs, l'affichage DOIT
rester inchangé (rien tant qu'il n'y a pas de bracket).

#### Scenario: Panneau commissaire sans bracket
- WHEN le commissaire consulte une saison dont le bracket n'est pas généré
- THEN il DOIT voir la taille configurée, l'état de la phase régulière, la
  cohérence des quotas et un bouton de démarrage

#### Scenario: Refus restitué
- WHEN le démarrage est refusé par le serveur
- THEN le motif DOIT être affiché en français dans le panneau

#### Scenario: Utilisateur non commissaire
- WHEN un utilisateur non commissaire consulte une saison sans bracket
- THEN aucun panneau de playoffs NE DOIT être affiché
