# league-standings (delta)

Capability : classement d'une saison de ligue — colonnes exposées par
l'API et rendu du tableau côté web.

## ADDED Requirements

### Requirement: Colonnes étendues dérivées de la feuille de match
Le classement DOIT exposer, par participant, les compteurs suivants en
plus des compteurs matérialisés existants : différentiel de sorties
(`casualtyDifference`), nombre de forfaits (`forfeits`), points en
retrait dus aux forfaits (`forfeitPoints`), passes réussies (`passes`),
agressions (`aggressions`), sorties infligées par le public
(`crowdSurges`) et exclusions subies (`expulsions`).

Ces compteurs DOIVENT être dérivés des `LeagueMatchEvent` des feuilles
de match de la saison et du `status` des `LeaguePairing`. Ils NE DOIVENT
PAS être matérialisés sur `LeagueParticipant`.

#### Scenario: Passes et agressions attribuées à l'équipe autrice
- WHEN une feuille de match porte 4 events `pass_complete` et 2 events `aggression` avec `team="home"`
- THEN le participant domicile DOIT avoir `passes=4` et `aggressions=2`
- AND le participant visiteur DOIT avoir `passes=0` et `aggressions=0`

#### Scenario: Sorties public et exclusions attribuées au côté de l'event
- WHEN une feuille porte un event `crowd_surge` et un event `expulsion` avec `team="away"`
- THEN le participant visiteur DOIT avoir `crowdSurges=1` et `expulsions=1`

#### Scenario: Cumul sur l'ensemble des feuilles de la saison
- WHEN un participant joue deux rencontres avec 2 puis 5 passes réussies
- THEN son `passes` DOIT valoir 7

#### Scenario: Kinds non suivis ignorés
- WHEN une feuille porte des events `touchdown`, `casualty`, `stalling` ou `other_elim`
- THEN aucune colonne étendue NE DOIT être incrémentée par ces events

#### Scenario: Correction ex-post du commissaire reflétée
- WHEN le commissaire corrige les évènements d'une feuille déjà validée
- THEN le classement recalculé DOIT refléter immédiatement les nouveaux compteurs

### Requirement: Colonne « For » exprimée en points
La colonne `forfeitPoints` DOIT valoir `forfeits × League.forfeitPoints`
(le barème de la ligue, généralement négatif) et représente donc des
points déjà inclus dans `points`. Elle NE DOIT jamais être sérialisée
en `-0`.

#### Scenario: Barème appliqué au nombre de forfaits
- WHEN une ligue a `forfeitPoints=-3` et qu'un participant a déclaré forfait 2 fois
- THEN son `forfeits` DOIT valoir 2 et son `forfeitPoints` DOIT valoir -6

#### Scenario: Aucun forfait
- WHEN un participant n'a déclaré aucun forfait
- THEN son `forfeitPoints` DOIT valoir exactement `0` (et non `-0`)

### Requirement: Les colonnes étendues ne peuvent pas faire échouer le classement
Si l'agrégation des colonnes étendues échoue, le classement DOIT être
renvoyé malgré tout, avec ces colonnes à zéro, et l'erreur DOIT être
journalisée côté serveur.

#### Scenario: Échec de l'agrégation
- WHEN la requête d'agrégation des stats étendues lève une erreur
- THEN `computeSeasonStandings` DOIT renvoyer les lignes de classement avec leurs points et compteurs matérialisés
- AND les colonnes étendues DOIVENT valoir 0

### Requirement: Ordre des colonnes du tableau
Le tableau de classement DOIT présenter ses colonnes dans l'ordre
`Pts | Bo | MJ | For | TD+ | TD- | Diff TD | Sor+ | Sor- | Diff Sor |
P | Agr | SP | Exclu | V | N | D`. La colonne `ELO` DOIT rester en
dernière position et n'être affichée que lorsqu'elle est classante. La
colonne `Bo` DOIT être affichée même lorsqu'aucune équipe n'a de bonus.

#### Scenario: Ordre en vue synthétique
- WHEN le classement est affiché sans être déplié
- THEN les en-têtes DOIVENT être exactement `Pts, Bo, MJ, For, TD+, TD-, Diff TD, Sor+, Sor-, Diff Sor`

#### Scenario: Ordre en vue dépliée
- WHEN le classement est déplié
- THEN les colonnes `P, Agr, SP, Exclu, V, N, D` DOIVENT être ajoutées à la suite, dans cet ordre

#### Scenario: ELO non classant
- WHEN l'ELO n'est pas un critère de départage de la ligue
- THEN aucune colonne ELO NE DOIT être rendue, y compris en vue dépliée

### Requirement: Vue synthétique dépliable
Le tableau DOIT s'afficher par défaut en version synthétique (de `Pts` à
`Diff Sor`) et proposer une bascule permettant d'afficher le détail
complet, puis de revenir à la vue synthétique.

#### Scenario: Détail masqué par défaut
- WHEN le classement est affiché
- THEN les cellules des colonnes de détail NE DOIVENT PAS être présentes dans le DOM

#### Scenario: Bascule dans les deux sens
- WHEN l'utilisateur active la bascule puis la désactive
- THEN les colonnes de détail DOIVENT apparaître puis disparaître
- AND l'état DOIT être reflété par `aria-expanded` sur le bouton

#### Scenario: Classement vide
- WHEN aucune équipe n'est inscrite
- THEN le message d'état vide DOIT être affiché, sans tableau ni bascule

### Requirement: Rétro-compatibilité du contrat API
Tous les champs étendus DOIVENT être optionnels. L'UI DOIT traiter un
champ absent comme `0`, et DOIT recalculer le différentiel de sorties
depuis `casualtiesFor - casualtiesAgainst` lorsque `casualtyDifference`
est absent.

#### Scenario: Réponse d'une API antérieure
- WHEN l'API ne renvoie ni `passes` ni `forfeitPoints` ni `casualtyDifference`
- THEN les cellules `P` et `For` DOIVENT afficher `0`
- AND la cellule `Diff Sor` DOIT afficher `casualtiesFor - casualtiesAgainst`
