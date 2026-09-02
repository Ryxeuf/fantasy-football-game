# Design — saisie en cases à cocher des Star Players

## Contexte

`StarPlayerHirableBy` porte `rule` (chaîne) **et** `rosterId`
(optionnel). Trois formes coexistent en base :

| Forme | `rule` | `rosterId` | Exemple |
|---|---|---|---|
| Mercenaire universel | `all` | `null` | Morg 'n' Thorg |
| Ligue / alignement | slug de règle | `null` | `old_world_classic` |
| Roster ciblé | slug du roster | id du roster | seed, si `rule` matche un roster |

Le formulaire ne connaissait que `rule`. Une seule liste de cases à
cocher ne peut donc pas représenter fidèlement l'état : deux entrées
peuvent porter le même `rule` avec ou sans roster.

## Décision 1 — deux grilles plutôt qu'une

**Retenue** : deux sélections indépendantes, `rules: string[]` (règles
globales) et `rosterIds: string[]` (rosters ciblés), recomposées au
`submit` par `hirableSelectionToPayload`.

**Rejetée** : une grille unique mélangeant règles et rosters. Le slug
d'un roster (`skaven`) et celui d'une règle sont dans le même espace de
noms — impossible de savoir, à la lecture d'une case cochée, s'il faut
réémettre une chaîne ou un couple `{ rule, rosterId }`. C'est
exactement ce qui faisait perdre le `rosterId` avant ce change.

Conséquence : la grille des rosters coche des **ids** et non des slugs.
`SlugOption` gagne donc un `hint` optionnel pour afficher le slug entre
parenthèses au lieu du cuid.

## Décision 2 — catalogue des règles dérivé du game-engine

`REGIONAL_LEAGUES` ne contient pas les alignements « Favori de… »
(`favoured_of_khorne`, `favoured_of_nurgle`, `favoured_of_hashut`), qui
conditionnent pourtant le recrutement de plusieurs Star Players du
Chaos. Le catalogue est donc l'union de :

1. `all` ;
2. `REGIONAL_LEAGUES` (libellés FR) ;
3. toute règle régionale portée par un roster dans
   `TEAM_REGIONAL_RULES_BY_RULESET`, tous rulesets confondus.

Dériver (3) plutôt que de recopier une liste en dur évite qu'un nouvel
alignement ajouté au game-engine devienne inatteignable depuis l'admin.
Les libellés connus sont traduits ; un slug inconnu retombe sur une
version « humanisée ».

## Décision 3 — filtrer les catalogues par ruleset

`Skill` est unique par `[slug, ruleset]` : `/admin/data/skills` sans
filtre remonte `block` deux fois. Les deux écrans interrogent donc
`/admin/data/skills?ruleset=…` et `/admin/data/rosters?ruleset=…`,
comme le fait déjà l'édition d'une position. En création, le ruleset
devient un champ du formulaire (`select`) et est envoyé à l'API :
sans lui, le serveur retomberait sur `DEFAULT_RULESET` et la résolution
des slugs échouerait pour un Star Player saison 3.

À noter : `resolveRuleset(undefined)` vaut `DEFAULT_RULESET`
(`season_3`), alors que la colonne Prisma a pour défaut `season_2`. On
aligne le Star Player sur `POST /admin/data/skills`, qui résout déjà de
cette façon : le ruleset persisté est explicitement celui qui a servi à
résoudre les slugs, plutôt qu'un défaut de colonne invisible depuis le
handler. Le formulaire, lui, envoie toujours un ruleset explicite.

Changer de ruleset vide les sélections (les slugs de l'autre ruleset
n'ont pas de raison d'exister) mais **ne démonte pas le formulaire** :
les champs déjà saisis (nom, coût, caractéristiques) sont conservés,
seul un indicateur « (chargement…) » s'affiche.

## Décision 4 — résoudre les compétences AVANT de supprimer

`PUT /admin/data/star-players/:id` supprime les `StarPlayerSkill` et
`StarPlayerHirableBy` existants avant de recréer. Si la résolution des
slugs échouait après ces suppressions, le Star Player se retrouverait
sans compétence ni règle de recrutement. La résolution (et le 404 sur
un id inconnu) passe donc **avant** les `deleteMany`, comme pour les
positions.

## Compatibilité

- Un slug de compétence hérité, hors du catalogue du ruleset, reste
  coché et est réémis tel quel : l'admin le voit (« hors catalogue »)
  et peut le décocher, mais un simple enregistrement ne le perd pas.
  Si ce slug n'existe dans aucun `Skill` du ruleset, l'API répond 400
  avec la liste des slugs introuvables plutôt que d'écraser en
  silence.
- Le payload `hirableBy` accepté par l'API est inchangé
  (`z.union([string, { rule, rosterId }])`) : aucun client existant
  n'est cassé.
