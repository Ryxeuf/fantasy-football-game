# league-standings

## Purpose

Classement d'une saison de ligue — colonnes exposées par
l'API et rendu du tableau côté web. Les sorties du classement (Sor+/Sor-,
bonus « sorties infligées ») et des classements individuels partagent la
définition de la feuille de match : une élimination qui rapporte des PSP.

Ces compteurs étant PERSISTÉS à la validation d'une feuille, la lecture du
classement porte aussi leur rattrapage : une définition de la sortie qui
change ne vaut que si les valeurs déjà écrites la rejoignent.

## Requirements

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

### Requirement: Sorties du classement et des classements individuels = sorties qui rapportent des PSP

Les colonnes `Sor+` / `Sor-` (`casualtiesFor` / `casualtiesAgainst`), le
différentiel de sorties, les points bonus « sorties infligées »
(`cas_inflicted_gte`) et les classements individuels « Cogneurs » et
« Tueurs » de la saison NE DOIVENT compter que les éliminations qui
rapportent les PSP d'Élimination à leur auteur, selon la définition unique
de la feuille de match (`eliminationEarnsSpp`, options par feuille :
compétences du coup d'envoi et Prières). Les agressions restent comptées
dans la colonne `Agr`, les sorties par le public dans `SP`.

Le libellé de la catégorie « Meilleur castagneur » DOIT décrire cette règle,
et non une définition antérieure plus large.

#### Scenario: Validation d'une feuille avec agression
- WHEN une feuille validée porte 4 Éliminations sur Blocage et 1 agression avec blessure pour le domicile
- THEN le participant domicile DOIT recevoir `casualtiesFor + 4` (et non 5) et l'extérieur `casualtiesAgainst + 4`
- AND une règle bonus « 5 sorties infligées » NE DOIT PAS s'appliquer

#### Scenario: Cogneurs de la saison
- WHEN un joueur a 1 Élimination sur Blocage, un autre 1 agression avec blessure sans Frénésie d'Agression, un troisième 1 Élimination sur Action Spéciale sans Innovateur Violent
- THEN seul le premier DOIT figurer parmi les cogneurs, avec 1 sortie
- AND le deuxième DOIT figurer parmi les agresseurs

#### Scenario: Exceptions lues par feuille
- WHEN une feuille porte la Prière « Frénésie d'Agression » pour l'extérieur et un gel où le n°3 domicile a « Innovateur Violent »
- THEN l'agression avec blessure de l'extérieur et l'Action Spéciale du n°3 domicile DOIVENT compter comme sorties dans les cogneurs de la saison
- AND la même agression sur une autre feuille sans la prière NE DOIT PAS compter

#### Scenario: Libellé du castagneur
- WHEN le catalogue des classements individuels est servi
- THEN la description du « Meilleur castagneur » DOIT dire que seules comptent les éliminations qui rapportent des PSP


### Requirement: Éliminations SUBIES — plus large que les sorties, mais une blessure reste requise

Le classement « Sac de frappe » compte les éliminations SUBIES par un joueur.
Il est volontairement PLUS LARGE que les sorties infligées — un joueur sorti
par une agression ou par le public l'est bel et bien, même si personne n'en
touche les PSP — mais il NE DOIT compter qu'un évènement portant une blessure
effectivement consignée. Un atterrissage de coéquipier sur un adversaire
(Lancer de Coéquipier) qui le blesse DOIT y compter.

#### Scenario: Agression sans blessure
- WHEN une agression est consignée sans blessure
- THEN sa cible NE DOIT PAS gagner une élimination subie

#### Scenario: Agression avec blessure
- WHEN une agression blesse sa cible sans Frénésie d'Agression
- THEN la cible DOIT gagner une élimination subie, alors que son auteur NE DOIT PAS gagner de sortie infligée

#### Scenario: Atterrissage blessant
- WHEN un joueur lancé atterrit sur un adversaire et le blesse
- THEN l'adversaire DOIT gagner une élimination subie

### Requirement: Les sorties persistées se rattrapent d'elles-mêmes

Une feuille de match de LIGUE validée avant la règle « une sortie est une
élimination qui rapporte des PSP » a persisté des compteurs faux. La lecture
du classement d'une saison DOIT rattraper ces feuilles, sans intervention
d'opérateur, par la resynchronisation dédiée (compteurs des deux
participants, `TeamPlayer.totalCasualties` et PSP, points bonus du pairing,
snapshot du match) — idempotente et journalisée.

Chaque feuille rattrapée, ou dont la resynchronisation est refusée par
conception (saison clôturée, snapshot absent, rencontre de coupe), DOIT être
marquée pour ne plus être revisitée. Une feuille validée sous la règle
courante DOIT porter le marqueur dès sa validation. Le marqueur porte la
VERSION de la règle, afin qu'un changement ultérieur de la définition d'une
sortie remette les feuilles concernées au rattrapage sans backfill.

Le rattrapage est BEST-EFFORT : son échec NE DOIT PAS empêcher de servir le
classement.

#### Scenario: Classement d'une saison portant une feuille antérieure
- WHEN le classement d'une saison est lu et qu'une de ses feuilles validées ne porte pas le marqueur
- THEN ses sorties DOIVENT être resynchronisées avant le calcul du classement, et la feuille marquée

#### Scenario: Deuxième lecture
- WHEN le même classement est lu à nouveau
- THEN aucune resynchronisation NE DOIT être tentée

#### Scenario: Feuille non validée
- WHEN une feuille de la saison a été invalidée
- THEN elle NE DOIT PAS être marquée : c'est sa revalidation qui posera le marqueur

#### Scenario: Rattrapage en échec
- WHEN la resynchronisation lève
- THEN le classement DOIT être servi malgré tout
