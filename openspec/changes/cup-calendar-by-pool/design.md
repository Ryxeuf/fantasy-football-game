# Design — Calendrier de coupe groupé par poule

## Extraire plutôt que recopier

La tentation était d'écrire un `groupCupPairingsByPool` calqué sur
`groupPairingsByPool`. Quinze lignes — mais quinze lignes de RÈGLE, et le
repo a déjà payé ce prix (deux saisies de match avant
`cups-managed-like-leagues`, deux tris de classement évités dans
`cup-pools-and-playoffs`).

**Décision** : `lib/competition-pools.groupByPool` prend un `poolIdOf` en
argument et ne connaît AUCUN des deux modèles. La ligue lui passe
`(p) => poolIdByParticipantId[p.homeParticipant.id]`, la coupe
`(p) => poolIdByTeamId[p.homeTeam.id]`. Les deux adaptateurs font trois
lignes chacun.

`groupPairingsByPool` garde son nom, sa signature et son champ `pairings` :
ses six tests de non-régression et son rendu n'ont pas bougé. Seul son corps
a été remplacé par un appel au moteur commun.

## Le seuil de découpage fait partie de la règle

`groupByPool` rend `null` — pas un tableau à un élément — quand une seule
poule est représentée. C'est délibéré : `null` veut dire « affiche la liste
telle quelle », et un groupe unique coifferait chaque journée d'un bandeau
qui n'apprend rien. C'est aussi ce qui rend le changement invisible sur une
coupe sans poule, donc sur toutes les coupes existantes.

## Une ronde de bracket n'a pas de poule

C'est la seule chose que la coupe ajoute, et elle vit dans son adaptateur
(`round-pools.groupCupRoundByPool`), pas dans le moteur : la ligue n'en a pas
besoin, son bracket vivant dans un écran séparé (`PlayoffBracketView`).

Le test qui compte est celui qui échouerait sans : une finale entre le
vainqueur de la poule A et celui de la poule B, groupée par son équipe à
domicile, s'annoncerait « Poule A ».

## La poule du coach, quand il aligne deux équipes

`preferredPoolIdFor` retient la poule de la PREMIÈRE équipe affectée du
coach. Remonter les deux reviendrait à ne rien remonter, et il faut bien
trancher. Documenté dans le module plutôt que laissé implicite.

## Pourquoi servir `pools` et pas se contenter de `poolStandings`

`poolStandings` porte bien `poolId` + `poolName` pour chaque poule, y compris
vide — on aurait pu s'en servir. Mais c'est une donnée de CLASSEMENT : lier
le calendrier à sa forme, c'est promettre qu'elle ne changera pas pour des
raisons de classement. `pools` dit ce qu'il est, coûte une projection d'un
tableau déjà chargé par la requête, et évite au panneau de composition comme
au calendrier de deviner.
