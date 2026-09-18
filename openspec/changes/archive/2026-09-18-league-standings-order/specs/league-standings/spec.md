# league-standings

## ADDED Requirements

### Requirement: Critères de classement configurables

Une ligue DOIT pouvoir définir ses critères de départage, dans l'ordre de
priorité, parmi : points, points bonus, forfaits, différence de TD, TD
marqués, TD encaissés, différence de sorties, sorties infligées, sorties
subies, ELO de saison, victoires, matchs joués, nom. Le nom est TOUJOURS le
dernier critère effectif, pour garantir un ordre total.

Une ligue sans configuration — y compris toute ligue antérieure à la
colonne — DOIT être classée : points, points bonus, forfaits, différence de
TD, différence de sorties, nom. Une valeur illisible ou ne contenant aucun
critère connu DOIT retomber sur ce même ordre.

Le critère « forfaits » DOIT trier la colonne `forfeitPoints` (les points
retirés) en DÉCROISSANT : à égalité par ailleurs, l'équipe qui a déclaré le
moins de forfaits est devant.

#### Scenario: Bonus départageant deux équipes à points égaux
- WHEN deux équipes ont le même nombre de points et que l'une a plus de points bonus
- THEN elle DOIT être classée devant, avant même la différence de TD

#### Scenario: Forfait pénalisant au départage
- WHEN deux équipes ont les mêmes points et bonus et que l'une a déclaré forfait
- THEN celle qui n'a pas déclaré forfait DOIT être devant

#### Scenario: Départage à la BASH
- WHEN une ligue configure `["points", "cas_for"]`
- THEN à égalité de points, l'équipe ayant infligé le plus de sorties DOIT être devant

#### Scenario: Ligne servie par une API antérieure
- WHEN une ligne de classement ne porte ni points bonus ni points de forfait
- THEN ces critères DOIVENT la traiter comme valant zéro, jamais produire un classement indéterminé

### Requirement: L'ordre se choisit à la création, se corrige ensuite

Le créateur d'une ligue DOIT pouvoir composer l'ordre à la création
(`POST /leagues`) et tant que la ligue n'est pas verrouillée
(`PATCH /leagues/:id`). Les doublons, les slugs inconnus et l'absence de
sentinelle DOIVENT être normalisés à l'écriture ; une liste vide ou `null`
DOIT remettre la ligue sur l'ordre par défaut.

Une fois un match joué, la ligue est verrouillée pour tout le reste, mais
l'ordre du classement DOIT rester modifiable, par son commissaire
(`PATCH /leagues/:id/standings-order`) comme par un administrateur
(`PATCH /api/admin/leagues/:id/standings-order`) — y compris sur une ligue en
cours ou archivée. Le classement étant trié à la lecture, ce changement NE
DOIT modifier aucun compteur persisté.

Une ligue INVISIBLE au demandeur (ligue privée) DOIT répondre `404`, une
ligue visible dont il n'est ni commissaire ni administrateur, `403`.

L'écriture DOIT passer par un seul chemin, partagé par les deux routes.

#### Scenario: Correction en cours de saison
- WHEN le commissaire ou un administrateur réordonne les critères d'une ligue dont des matchs sont joués
- THEN le classement servi ensuite DOIT appliquer le nouvel ordre, sans qu'aucun compteur change
- AND le verrou d'édition de la ligue NE DOIT PAS être consulté

#### Scenario: Retour au défaut
- WHEN les critères sont remis à `null`
- THEN la ligue DOIT être classée selon l'ordre par défaut

#### Scenario: Slug inconnu refusé
- WHEN une écriture porte un critère qui n'existe pas
- THEN elle DOIT être refusée sans rien modifier

#### Scenario: Tiers sur une ligue privée
- WHEN un compte qui ne voit pas la ligue tente de réordonner ses critères
- THEN la réponse DOIT être `404`, et rien NE DOIT être écrit

### Requirement: Les réglages d'une ligue restent ATTEIGNABLES une fois lancée

La fiche d'une ligue DOIT exposer à son commissaire un accès à ses réglages
quel que soit l'état de la ligue, y compris verrouillée par un match joué.
L'écran de réglages NE DOIT PAS rediriger un commissaire : sur une ligue
verrouillée, il DOIT servir un panneau réduit qui énonce ce qui est gelé et
pourquoi, et n'expose que l'ordre du classement.

Un réglage annoncé comme modifiable et dépourvu de chemin d'accès équivaut à
un réglage absent.

#### Scenario: Ligue dont un match est joué
- WHEN le commissaire ouvre la fiche de sa ligue verrouillée
- THEN un accès à ses réglages DOIT être présent

#### Scenario: Écran de réglages d'une ligue verrouillée
- WHEN le commissaire l'ouvre
- THEN le formulaire complet NE DOIT PAS être servi
- AND l'ordre du classement DOIT être modifiable et enregistrable

#### Scenario: Non-commissaire
- WHEN un tiers ouvre l'écran de réglages
- THEN il DOIT être renvoyé vers la fiche de la ligue

### Requirement: L'ordre appliqué est visible

`GET /leagues/:id` DOIT servir l'ordre EFFECTIF (défaut compris) à côté de
la valeur CONFIGURÉE, et `GET /leagues/seasons/:seasonId/standings` DOIT
servir l'ordre effectif de la saison. Le tableau de classement DOIT
l'afficher : sans lui, un coach ne peut pas savoir pourquoi une équipe passe
devant une autre à points égaux.

La valeur configurée et l'ordre effectif DOIVENT rester distincts : une
ligue qui ne configure rien se relit avec une valeur VIDE, jamais avec le
défaut matérialisé.

#### Scenario: Ligue sans configuration
- WHEN la fiche d'une ligue qui ne configure rien est lue
- THEN la valeur configurée DOIT être nulle et l'ordre effectif DOIT porter le défaut

#### Scenario: Critère que le client ne sait pas nommer
- WHEN l'ordre servi contient un critère inconnu de l'écran
- THEN il DOIT être affiché tel quel, jamais masqué

### Requirement: La colonne ELO suit les critères

La colonne ELO du classement DOIT être affichée si et seulement si `season_elo`
fait partie des critères EFFECTIFS de la ligue.

#### Scenario: ELO réactivé par les réglages
- WHEN une ligue ajoute `season_elo` à ses critères
- THEN la colonne ELO DOIT apparaître dans son classement
