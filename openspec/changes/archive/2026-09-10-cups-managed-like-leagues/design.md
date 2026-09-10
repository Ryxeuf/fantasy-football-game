# Design — les coupes se gèrent comme les ligues

## La question centrale : une feuille ou deux ?

`league-match-sheet.ts` fait ~4 000 lignes et porte des règles coûteuses à
écrire : gel « version du match », journaliers panachables, PSP de réception,
prières de Nuffle, coups de pouce bornés par le règlement, séquence
d'après-match dans l'ordre du livre. Trois options :

| Option | Coût | Risque |
|---|---|---|
| A. `CupMatchSheet` + `CupMatchEvent`, service dédié | ~4 000 lignes dupliquées | Divergence GARANTIE : deux implémentations d'une même règle finissent toujours par diverger (le dépôt en a déjà l'expérience avec `Roster.regionalRules`) |
| B. Feuille polymorphe, un seul service | Refactor chirurgical (~20 sites) | Une régression sur la feuille touche les deux compétitions |
| C. Faire porter les rencontres de coupe par des `LeaguePairing` fictifs | Faible | Une coupe devient une ligue déguisée : saison, journées, participants fantômes |

**B retenue.** C'est le patron déjà documenté dans ce dépôt pour
`CompetitionDocument` : deux FK nullables, cascades Prisma natives, une seule
table à administrer, invariant tenu par le service. Le risque de B est réel
mais il est couvert par les tests — et il est symétrique du bénéfice : un
correctif profite aussi aux deux.

### Comment ne PAS toucher 4 000 lignes

La clé est que toutes les fonctions de la feuille prennent `{ pairingId }`.
`loadPairingContext` devient polymorphe (`LeaguePairing` d'abord,
`CupPairing` ensuite — les `cuid()` sont uniques d'une table à l'autre) et
rend un contexte enrichi de `kind`, des deux `teamId` et d'un JEU DE RÈGLES.
Les trois helpers qui lisaient encore le pairing (`loadSheetOrThrow`,
`loadSheetTeams`, `captureMatchSnapshots`) prennent ce contexte au lieu d'un
id. Tout le reste est inchangé.

Le branchement se limite alors à quatre endroits : validation, invalidation,
fenêtre d'invalidation, et la boîte « matchs à valider » du commissaire.

### Pourquoi un jeu de règles plutôt qu'un `if (kind === "cup")`

`CompetitionSheetRules` nomme ce qui change (`sppEnabled`,
`injuriesPersisted`, `economyEnabled`, `advancementsEnabled`,
`purchasesEnabled`, `firingsEnabled`, `resurrection`) au lieu de disséminer
des tests sur le type de compétition. Le jour où une ligue amicale voudra
« sans blessures », c'est une constante de plus, pas une branche de plus. Le
jeu de règles est aussi SERVI à l'UI, qui masque les panneaux sans avoir à
redéduire la règle.

## Faire remonter un résultat de coupe au classement

Le classement d'une coupe est **dérivé** de ses `LocalMatch` terminés
(`computeCupStandings`), comme le sont les podiums par action et les
classements individuels. Deux façons de lui faire voir une feuille :

1. apprendre aux trois lectures à lire aussi les feuilles ;
2. **matérialiser** la feuille validée en `LocalMatch` complété + actions.

La seconde gagne : elle ne touche aucune des trois lectures, elle rejoue le
journal en gestes que le barème sait déjà compter, et elle rend
l'invalidation triviale (supprimer le match suffit, le classement revient de
lui-même). C'est exactement ce que la ligue fait avec son `Match` offline
synthétique. `LocalMatch.cupPairingId` étant unique, une revalidation réécrit
le même match au lieu d'en empiler un second.

Ce que la traduction retient : touchdown, sortie au contact (blocage/blitz),
sortie à l'agression, passe réussie, interception — les seuls gestes que le
barème d'une coupe sait compter. Une sortie sans auteur au contact (esquive
ratée, foule) n'entre pas : elle n'a pas d'auteur à créditer. La feuille reste
la source de vérité complète de la rencontre.

## Le tirage au sort n'est pas un second moteur

`generateSwissRound` apparie les équipes DANS L'ORDRE qu'on lui donne, en
évitant les rematches (avec retour arrière), en faisant tourner l'exempt et en
équilibrant les réceptions. Un tirage au sort, c'est le même appariement sur
un ordre mélangé. `random-pairing` se réduit donc à un Fisher-Yates piloté par
une graine, puis délègue — et hérite gratuitement des trois garanties.

La graine est `<cupId>:<roundNumber>` : le tirage est REJOUABLE (un double
clic ne produit pas deux rondes différentes, et une ronde supprimée puis
régénérée revient à l'identique), et deux rondes de la même coupe ne partagent
pas leur ordre. `Math.random()` n'aurait donné aucune de ces deux propriétés.

## Saisie manuelle : ce qu'on refuse, et ce qu'on accepte

Refusé, parce que le classement serait FAUX : une équipe deux fois dans la
ronde, une équipe contre elle-même, une équipe hors de la coupe, deux exempts
(l'exempt est par définition celui qui reste).

Accepté : une équipe inscrite ABSENTE de la saisie. Elle ne joue pas cette
ronde — report, forfait à venir, contrainte de calendrier. C'est précisément
ce qui distingue une ronde manuelle d'une ronde générée ; l'interdire
reviendrait à réécrire un générateur.

L'écran retire des listes les équipes déjà engagées : la faute que le serveur
refuserait devient impossible à saisir.

## Roster « version du match » d'une coupe

« Chaque match se joue avec le roster initial tel quel » se traduit
littéralement : le gel de la feuille part du snapshot d'inscription
(`CupParticipant.rosterSnapshot`) et non de l'état live. Sans snapshot
(participant historique), le gel live prend le relais plutôt que de bloquer
l'ouverture de la feuille.

## Alternatives écartées

- **Renommer `LeagueMatchSheet` en `CompetitionMatchSheet`.** Plus juste, mais
  `db push` traite un renommage de modèle comme DROP + CREATE : toutes les
  feuilles existantes seraient perdues. Le nom reste, la documentation du
  schéma dit ce qu'il porte.
- **Une page de feuille dédiée aux coupes.** Copier 1 500 lignes de page +
  2 500 lignes de panneaux pour changer un lien de retour, c'était garantir
  que les deux versions divergent. La route `/cups/pairings/[id]/sheet`
  ré-exporte la page, qui s'adapte au `competitionKind` servi par l'API.
