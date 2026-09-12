# Design — Contagieux, seconde source d'un même joueur synthétique

## Une mécanique, deux sources — pas deux mécaniques

Le Contaminé et le mort relevé sont le MÊME objet pour la feuille : un
Trois-quart de la fiche qui joue le match en réserve sans exister au roster,
puis se recrute à l'étape EMBAUCHES. Tout ce qui a été construit pour Maîtres
de la Non-vie (id `raised-<side>-1`, choix stocké / joueur dérivé, pickers,
PSP, évolution, tirage, achat `raised_dead`, cap de la liste) resservait tel
quel. Seuls DIFFÈRENT : qui rend la victime relevable, et le prix.

D'où `RaiseSource = "masters_of_undeath" | "plague_ridden"`, porté par chaque
candidat (`RaiseVictimCandidate.source`) et par le joueur dérivé
(`SheetRaisedDead.source`, `hireCost`). Alternative rejetée : un second module
`league-sheet-plague-ridden` avec ses propres colonnes et son propre type
d'achat — le service aurait dû tester deux familles partout où il en teste
une, et le web deux bandeaux.

## La source n'est pas stockée

`LeagueMatchSheet.raisedDeadHome/Away` garde `{ victimId, position }`. La
source se REDÉRIVE de l'éligibilité de la victime à chaque lecture, comme le
relevé lui-même se redérive des évènements : si l'auteur du blocage change
(correction de saisie) ou perd son Trait, le Contaminé disparaît avec la
raison qui l'a fait naître. Quand les deux règles s'appliquent à la même
victime, la gratuite l'emporte — un coach n'a aucune raison de préférer
payer.

Pas de colonne nouvelle, donc pas de `db push` pour ce change.

## Le blocage se lit dans le résumé, le Trait chez SOI

`InjuredPlayer` porte déjà `cause` (`causeDetail ?? kind`) et
`causedByPlayerId` (le Trait Haine en avait besoin). Une sortie « sur
blocage » est un `casualty` sans détail (ou `block` / `blitz`) ; `self` et les
autres genres (agression, public, chute, temporisation) n'en sont pas.
L'auteur doit être un joueur du côté qui relève : `eligibleRaiseVictims`
reçoit donc `own` en plus de `opponents`, et `sideSheetPlayers` sert les deux
côtés — c'est la même liste (roster, journaliers, Star Players).

## Gros Bras : le Mot-clé fait foi, Solitaire en repli

« On ne peut pas utiliser ce Trait contre des joueurs Gros Bras. » Gros Bras
est un MOT-CLÉ de poste en Saison 3 (« Rejeton, Gros Bras »), lu base d'abord
(`Position.keywords`), catalogue `KEYWORDS_SEASON3` en repli, table
`STAR_PLAYER_KEYWORDS` pour un Star Player engagé. Sans mots-clés (roster
antérieur), l'heuristique du moteur (`isBigGuy` : Solitaire) tranche — mais
jamais pour un Star Player, dont la table est toujours connue : il a Solitaire
sans être un Gros Bras.

## Le prix vient de la règle, pas de la saisie

`buildRaisedDeadHire` ne force le coût à 0 que pour `masters_of_undeath` ;
pour `plague_ridden` il vaut le poste plus le surcoût de l'évolution, comme
`buildJourneymanHire`. `purchasesGoldDelta` répercute l'écart entre le montant
saisi et le montant enrichi sur le débit — un coach qui laisse 0 paie quand
même, un coach qui saisit 40 000 pour un mort relevé ne paie rien.

## Vocabulaire côté web

`raisedDeadWording(source)` est l'unique table : 🧟 / Mort relevé / Maîtres
de la Non-vie / « Mort relevé (gratuit) » ou ☣️ / Contaminé / Contagieux /
« Contaminé (prix du poste) ». Sans `source` (serveur antérieur), c'est
Maîtres : la seule règle que ce serveur connaissait. Le type d'achat garde la
valeur `raised_dead` et change de libellé.
