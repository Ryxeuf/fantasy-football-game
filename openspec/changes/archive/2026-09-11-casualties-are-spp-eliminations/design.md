# Design — Une sortie est une élimination qui rapporte des PSP

## Un prédicat plutôt que des exceptions éparpillées

Avant : le summarizer créditait le compteur d'équipe dans une branche, la
stat-line du joueur dans une autre, avec un gating différent par type
d'évènement (Innovateur Violent ne gatait que les PSP, pas le compteur
d'équipe ; l'agression n'était gatée nulle part). Le classement des cogneurs
réécrivait une troisième règle (« casualty + special_elim, quel que soit le
porteur »). Trois lectures, trois définitions.

**Décision** : UNE fonction pure, `eliminationEarnsSpp(event, options)`, qui
répond « cette élimination rapporte-t-elle les PSP d'Élimination à son
auteur ? ». C'est LA définition d'une sortie. Le compteur d'équipe et la
stat-line en dérivent dans le summarizer ; le classement des cogneurs
l'appelle sur chaque évènement de la saison. L'invariant « sorties d'équipe
= somme des sorties créditées aux joueurs » est testé (à l'exception près
d'une Élimination sur Blocage saisie sans acteur, qui compte pour l'équipe
sans pouvoir être attribuée).

## Les exceptions sont des OPTIONS, pas des données de l'évènement

Ce qui qualifie une sortie n'est pas dans l'évènement : c'est une compétence
du joueur AU COUP D'ENVOI (relue dans le gel de la feuille, cf.
`league-sheet-frozen-skills`) ou une Prière obtenue par l'équipe en
avant-match. Le summarizer reste pur : il reçoit ces options
(`violentInnovators`, `fatalFlighters`, `foulingFrenzy` par côté) et ne lit
ni Prisma ni la table des prières.

La Frénésie d'Agression est traitée par côté (`{ home, away }`) et non par
ensemble d'ids : une prière bénit toute l'équipe, journaliers et Star
Players engagés compris — qui n'ont pas de ligne `TeamPlayer` et seraient
absents d'un ensemble construit depuis le roster. Elle n'est PAS un bonus
additif du module des prières (comme 10 et 11) : c'est la qualification de
l'agression qui change, avec tout ce qui en découle (compteur d'équipe,
classement, PSP au barème du côté — 3 en Bagarreurs Brutaux, posture alignée
sur Innovateur Violent).

## Un seul constructeur d'options, trois consommateurs

`buildSheetSummaryOptions(players, sheet)` (pur) rapproche chaque côté de
SON gel — les numéros de maillot se répètent d'une équipe à l'autre — et lit
les prières de la feuille. La feuille l'appelle via `sheetSummaryOptions`
(lecture ET validation), le classement de saison le rappelle feuille par
feuille (les feuilles de la saison sont chargées avec leur gel, leurs
prières et les équipes de leur rencontre), la resynchronisation passe par
le chemin de la feuille. Aucun des trois ne peut diverger des deux autres.

Sans feuille exploitable (mocks, base sqlite sans le modèle), aucune
exception n'est supposée : seule l'Élimination sur Blocage classe.

## La Prière 12 reste hors périmètre

« Interaction avec les Fans » (2 PSP à qui pousse un adversaire dans le
Public) exigerait de saisir l'AUTEUR d'une sortie par le public, que la
feuille ne porte pas (« la foule n'a pas d'acteur »). Câbler la prière sans
l'acteur ne créditerait personne. Consignée en suite.

## Reprendre le passé sans rejouer la fin de match

Les compteurs persistés des feuilles validées sous l'ancienne règle sont
faux. Trois options :

1. **Invalider puis revalider** chaque feuille : rejoue toute la séquence de
   fin de match (jets de Haine à refaire, évolutions, achats) et se heurte
   aux garde-fous d'invalidation (évolution consommée, play-offs générés).
2. **Dériver les compteurs du classement à la lecture** : `casualtiesFor`
   est aussi alimenté par les résultats saisis à la main (sans feuille) et
   les forfaits ; le dériver aurait cassé ces chemins.
3. **Rejouer les seuls deltas** qui dépendent de la qualification des
   sorties, feuille par feuille. **Retenu.**

`planCasualtyResync` (pur) compare le snapshot `offlineResultInput` — ce que
l'invalidation reprendrait — au résumé re-dérivé, et décrit les deltas :
participants (sorties pour / contre), joueurs (`totalCasualties`, PSP au
barème du côté), bonus du pairing. L'application est une transaction ; le
snapshot est réécrit pour qu'une invalidation ultérieure reprenne exactement
ce qui est désormais appliqué ; chaque équipe reçoit une étape de journal
(`league.sheet.casualties.resync`). Idempotent : sans delta, rien n'est
écrit.

Le bonus du pairing est ré-évalué avec les règles COURANTES de la ligue
quand les sorties changent (même contexte que `recordLeagueMatchResult`) ;
les entrées du bonus commissaire, qui ne dépendent pas des sorties, sont
conservées telles quelles. Une saison clôturée est ignorée : son palmarès
est persisté, son classement est figé.

`prisma/migrations/` étant gitignoré (prod = `db push`), la reprise est un
script opérateur (`db:resync-sheet-casualties`, simulation par défaut,
`-- --apply` pour écrire), comme `db:repair-build-psp` avant lui.
