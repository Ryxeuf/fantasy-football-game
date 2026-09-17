# Design — le tri est une donnée, pas un `if`

## Le comparateur sort du service Prisma

Le tri vivait au milieu de `services/league.ts` (~1400 lignes, Prisma
partout). Il part dans `services/league-standings-order`, module 100 % PUR,
calqué sur `services/cup-standings-order` écrit pour la coupe : slugs,
défaut, parse tolérant, normalisation d'écriture, comparateur. Les noms
exportés par `services/league.ts` (`TIE_BREAK_SLUGS`, `parseTieBreakRules`,
`makeStandingsComparator`, `isSeasonEloRanked`) deviennent de simples ALIAS,
et un test l'assert (`toBe`, pas `toEqual`) : c'est ce qui empêche une
seconde implémentation de réapparaître à côté.

Bénéfice immédiat : `schemas/league.schemas.ts` tenait un MIROIR MANUEL des
slugs, justifié à l'époque par la dépendance circulaire entre `schemas/` et
`services/`. Le module pur n'important rien, le miroir disparaît — ajouter
un critère au comparateur l'ouvre du même geste à l'API.

## « forfait décroissant » trie la colonne, pas le compteur

Le classement porte deux valeurs de forfait : `forfeits` (un compte) et
`forfeitPoints` (= `forfeits × League.forfeitPoints`, le barème étant
négatif par défaut, `-100`). C'est la SECONDE qui est affichée, sous
l'en-tête `For`, et c'est elle que le critère trie, en décroissant :

```
0 (aucun forfait)  >  -100 (un forfait)  >  -200 (deux forfaits)
```

Trier le COMPTE en décroissant aurait classé le forfaitaire devant. Trier
la colonne affichée garde le sens sportif, reste juste si une ligue
configure un barème de forfait positif, et surtout se lit directement dans
le tableau : le coach voit la colonne sur laquelle on l'a départagé.

## Rien à backfiller, comme toujours ici

`prisma/migrations/` est gitignoré (la prod applique `db push`) : aucun
backfill n'est possible. La colonne `League.tieBreakRules` existe déjà et
reste `String?`. Trois lectures en découlent, volontairement distinctes :

| Fonction | Rend | Pour |
|---|---|---|
| `readStoredLeagueTieBreakRules` | la liste TELLE QUE stockée, `null` si rien | les formulaires (création, édition, console) |
| `parseLeagueTieBreakRules` | l'ordre EFFECTIF, défaut compris | le tri et l'affichage |
| `normalizeLeagueTieBreakRules` | la liste assainie, `null` si vide | l'écriture |

La distinction n'est pas cosmétique : si le formulaire d'édition rechargeait
l'ordre EFFECTIF, le commissaire figerait le défaut dans sa colonne sans
l'avoir demandé — et une évolution ultérieure du défaut ne l'atteindrait
plus.

## Pourquoi une route admin dédiée plutôt que d'assouplir `PATCH /leagues/:id`

Le verrou de `PATCH /leagues/:id` (« un match a été joué ») protège des
champs dont la modification réécrirait le passé : le barème de points, les
rosters autorisés, les règles de bonus. L'ordre de classement n'en fait pas
partie — il est appliqué au tri, à la lecture, et rien de persisté n'en
dépend.

Deux options se présentaient : ouvrir une exception dans le handler
existant (« si admin ET que le body ne contient que `tieBreakRules` »), ou
poser une route dédiée. La seconde gagne : chaque route garde UN modèle
d'autorisation lisible, la console admin a une cible évidente, et le
handler du commissaire n'acquiert pas une branche conditionnelle sur le
contenu du body — exactement le genre de condition qu'on oublie de
maintenir en ajoutant un champ.

C'est aussi ce que fait la coupe (`PATCH /cup/:id`, commissaire OU admin,
barème et départages modifiables en cours de coupe) : la différence est que
la ligue, elle, a un verrou à respecter pour tout le reste.

## Un seul éditeur pour les deux compétitions

`components/TieBreakOrderEditor` est agnostique du catalogue : il reçoit la
liste des critères proposables, le dictionnaire de libellés et un préfixe de
`data-testid`. La coupe et la ligue n'ont pas les mêmes critères (points
d'action d'un côté, points bonus et forfaits de l'autre) mais exactement la
même manipulation — deux écrans auraient divergé au premier correctif. Les
helpers purs `toggleRule` / `moveRule` déménagent avec lui ; l'ancien
chemin de la coupe reste un alias, et ses `data-testid` sont inchangés.

Un slug absent du dictionnaire de libellés s'affiche TEL QUEL plutôt que de
disparaître : le serveur peut être en avance sur le client, et un critère
qui s'applique doit rester visible même sans son libellé.
