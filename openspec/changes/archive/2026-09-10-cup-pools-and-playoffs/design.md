# Design — Poules et play-offs de coupe

## Un seul moteur de bracket pour la ligue et la coupe

`league-playoffs.ts` portait le croisement des têtes de série
(`generatePlayoffSeedingFor`), la carte d'avancement (`ADVANCEMENT_SLOTS`) et
la sélection par quotas de poule (`selectSeedsFromPools`). Trois règles pures
qui ne dépendent d'AUCUNE table : elles ne manipulent que des identifiants
opaques et des rangs.

**Décision** : les extraire dans `services/bracket-seeding.ts`, que
`league-playoffs` importe ET ré-exporte (aucun appelant existant n'a bougé),
et que `cup-playoffs` consomme en lui passant des `teamId` là où la ligue
passe des `participantId`.

**Alternative écartée** : réimplémenter le croisement côté coupe. C'est
quinze lignes — mais ce sont quinze lignes de RÈGLE (1 vs 8, 4 vs 5…). Deux
exemplaires auraient divergé au premier ajustement, exactement comme les deux
saisies de match avant `cups-managed-like-leagues`.

## Une ronde par slot, une rencontre par ronde

La ligue crée UN `LeagueRound` par slot de bracket (demi 1 = N, demi 2 = N+1).
C'est contre-intuitif — on attendrait une ronde « demi-finales » à deux
rencontres — mais c'est ce qui permet à un slot d'exister AVANT que son
adversaire soit connu, et de se retrouver par sa ronde sans propager le slot
jusqu'à la rencontre.

La coupe reprend la convention telle quelle. Corollaire hérité de la ligue
(cf. CLAUDE.md, « Une colonne de RATTACHEMENT nullable ») : tout nouveau round
s'alloue `max(roundNumber) + 1`, jamais `round.roundNumber + 1` — le numéro
suivant appartient au round FRÈRE.

## Le placeholder encode « à déterminer »

`CupPairing.homeTeamId` est une FK NOT NULL. Une finale créée avant que la
seconde demie soit jouée n'a donc pas de moyen d'écrire « inconnu ».

**Décision** : `home === away` signifie placeholder — le premier qualifié
occupe les deux côtés, le second l'écrase à son arrivée. C'est déjà la
convention de la ligue (`advancePlayoffsWithWinner`), et elle a l'avantage de
ne demander AUCUNE colonne : `placeholder` est dérivé à la lecture.

**Alternative écartée** : rendre `awayTeamId` nullable. Mais `null` y veut
déjà dire EXEMPT (`status: "bye"`) côté phase de classement — le même `null`
aurait porté deux sens dans la même colonne.

## Publication : un booléen à trois états, encore

`prisma/migrations/` est gitignoré et la prod applique `db push` : aucune
migration ne peut backfiller. Un `Boolean @default(false)` masquerait d'un
coup les brackets des coupes existantes.

**Décision** : `Boolean?`. `null` = coupe antérieure à la colonne (VISIBLE),
`false` = généré non publié, `true` = publié. `startCupPlayoffs` écrit le
`false` explicite sur les brackets NEUFS. Même patron que
`LeagueSeason.playoffsPublished`.

Le piège qui va avec : gater `getCupBracket` seul ne suffit pas. Le
CALENDRIER (`GET /cup/:id`) sert lui aussi les rondes, et aurait annoncé les
têtes de série avant publication. D'où `visibleCupRounds` (pur), appliqué à
la lecture — et jamais au calcul du classement, qui doit rester assis sur
TOUTES les rondes : masquer une ronde ne doit pas changer les points d'un
exempt.

## Fenêtre d'édition des poules : la première ronde, pas le statut

Une poule qui change après qu'une ronde a été jouée réécrit rétroactivement
un classement : les points restent, mais ils changent de colonne.

**Décision** : `ensurePoolsEditable` refuse dès qu'une `CupRound` existe
(`cup_started`) ou que la coupe est terminée/archivée (`cup_closed`). Le
STATUT de la coupe ne suffisait pas : une coupe passe `en_cours` à la
validation, bien avant la première ronde — s'y arrimer aurait fermé la
composition avant qu'elle soit possible.

`updateCupPool` fait exception et laisse modifier le QUOTA après coup : il ne
gouverne que le seeding, qui n'a pas encore eu lieu. C'est ce qui permet de
corriger « 2 qualifiés par poule » en « 1 » quand on décide finalement une
demi-finale plutôt qu'un quart.

## Rondes communes, appariement par groupe

**Décision** : une ronde reste une ronde de la COUPE (contrainte unique
`(cupId, roundNumber)`), et c'est l'appariement qui se fait groupe par
groupe, chaque groupe passant par le moteur suisse ou le tirage avec SON
classement et SON historique.

**Alternative écartée** : une ronde par poule. Cela aurait dupliqué les
numéros de ronde, cassé la contrainte unique, et surtout obligé chaque
lecture (calendrier, suppression de la dernière ronde, garde-fou « ronde
précédente close ») à raisonner par poule.

Conséquence assumée : une ronde peut porter PLUSIEURS exempts, un par groupe
d'effectif impair. `CupRoundPlan.byes` est donc une liste — c'est le seul
endroit où la forme du plan a dû changer.
