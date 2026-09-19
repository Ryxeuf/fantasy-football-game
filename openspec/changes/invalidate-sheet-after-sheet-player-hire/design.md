# Design — Le garde-fou compare à l'état À LA CRÉATION

## Le bug est une référence, pas une règle

`offlinePurchasesConsumed` a une bonne raison d'exister : la reversion
SUPPRIME les joueurs créés par les achats du match, et un joueur qu'une autre
feuille référence depuis (match ultérieur, évolution prise dans l'éditeur de
roster, mort) ne doit pas disparaître sous elle. La règle est juste ; c'est sa
référence qui était fausse. « A joué » se lisait `matchesPlayed > 0`, « a
progressé » `advancements.length > 0`, « a gagné des PSP » `spp > 0` — vrai
pour un joueur ACHETÉ, qui naît vierge, faux pour un joueur de FEUILLE
recruté, qui naît avec son match.

Le correctif ne touche donc ni à la règle ni aux compteurs : il change le
point de comparaison. Consommé = « plus qu'à la création ».

## Stocker le résultat, redériver le passé

Même patron que le journal d'équipe (« chaque étape stocke son RÉSULTAT ») :
`applyOfflinePurchasesForTeam` sait exactement ce qu'il écrit sur chaque
joueur créé (PSP, matchs joués, avancements) et le consigne dans la trace des
mutations (`createdPlayers`), à côté de `createdPlayerIds` qui reste la liste
canonique (ops de reversion, feuilles antérieures).

Pour les feuilles déjà validées — celle du testeur en premier — aucun
backfill n'est possible : la trace vit dans un JSON de `Match`, et la prod
applique le schéma par `db push`. Mais le snapshot porte déjà les achats
ENRICHIS par la validation (`input.purchasesHome/Away`), avec `kind`,
`position`, `spp` et `advancements` de chaque recrutement : la référence
se REDÉRIVE. `applyOfflinePurchasesForTeam` crée les joueurs dans l'ordre
des achats créateurs (`player` / `journeyman` / `raised_dead`) ; quand
autant de lignes ont été créées qu'il y a d'achats créateurs, rien n'a été
sauté et l'alignement est exact — chaque paire est en plus vérifiée (poste
quand l'achat en désigne un, nom quand il en porte un).

Quand un achat a été sauté (liste à 16, poste irrésoluble), l'alignement
n'est plus certain et on ne devine pas : la référence retombe sur zéro, le
comportement historique. Refuser une reversion à tort est réparable
(re-saisie, feuille récente avec trace) ; supprimer un joueur qu'un autre
match utilise ne l'est pas.

## Un module pur, trois lectures

`league-offline-purchase-baseline` ne lit pas Prisma : il prend les achats,
la trace et les lignes relues (nom, poste, compteurs) et rend la référence de
chaque joueur créé — trace d'abord, redérivation ensuite, zéro à défaut — puis
tranche « consommé ». Le service d'achats n'ajoute que la lecture des lignes
(désormais avec `name` et `position`), et la reversion n'ajoute que les achats
du snapshot à l'appel. Le compte tolérant des avancements (array PG / chaîne
sqlite) y vit aussi, et remplace les deux copies qui existaient.

## Alternatives écartées

- **Ne plus compter `matchesPlayed` pour les recrutements** : `spp` et
  `advancements` du match auraient bloqué de la même manière, et un
  recrutement qui a VRAIMENT rejoué devait rester refusé.
- **Marquer les recrutements dans la trace (`hiredIds`) et les exempter** :
  un journalier recruté qui a rejoué serait alors supprimable — c'est
  justement ce que le garde-fou empêche.
- **Chercher l'usage postérieur dans les autres feuilles** (évènements,
  snapshots des matchs suivants) : lecture lourde, et incomplète (évolution
  prise dans l'éditeur de roster, mort posée à la main).
