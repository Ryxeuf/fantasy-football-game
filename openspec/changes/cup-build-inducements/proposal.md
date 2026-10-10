# Coups de pouce achetés à la création d'une équipe de coupe

## Why

Une coupe se joue en résurrection : le roster d'inscription rejoue à
l'identique à chaque ronde. C'est la logique d'un tournoi, et le règlement
NAF World Cup 2027 transcrit dans le moteur le dit en toutes lettres : les
coups de pouce s'achètent UNE fois, avec le budget d'or, à la création ;
l'or non dépensé est perdu ; toutes les équipes sont réputées à la même VEA.
Le code n'applique que le régime de LIGUE (achat d'avant-match, petite
monnaie, trésorerie), et cet écart produit des bugs concrets :

- le builder et `POST /team/build` n'offrent aucun coup de pouce, alors que
  le pack les place à la création ;
- les Star Players achetés au build n'apparaissent pas sur la feuille de
  match : ils ne peuvent ni marquer, ni être blessés, ni être Joueur du
  Match, sauf à être rachetés sur la feuille ;
- le reliquat d'or part en trésorerie, et une coupe n'écrivant rien, cette
  trésorerie devient un fonds de coups de pouce réutilisable à CHAQUE ronde ;
- la petite monnaie de ligue (écart de VEA) double la compensation des
  coupes à paliers de budget ;
- les prix du pack écrasent les remises par équipe (Pots-de-vin à 100 000 po
  pour une équipe Chantage et Corruption, Chef Cuistot à 300 000 po pour les
  Halflings), et sa limite de Pots-de-vin abaissée par un Star Player à Arme
  Secrète n'est qu'un texte ;
- l'inscription « telle quelle » contrôle la VE (sans Stars ni trésorerie)
  au lieu de ce que l'équipe a réellement dépensé.

## What Changes

- **Mode de coups de pouce par coupe** (`build` | `match` | `none`) :
  - `build` : achat au builder sur le budget d'or, valable à chaque ronde,
    aucun achat d'avant-match ;
  - `match` : achat d'avant-match, petite monnaie = écart de VEA, sans
    trésorerie ;
  - `none` : aucun coup de pouce.
  
  Les coupes existantes restent en `match`, sans reprise de données. Une
  coupe neuve en BB11 naît en `build`. Une coupe à règlement est toujours en
  `build`, et une coupe à Sept ne peut pas l'être. Le réglage vit avec les
  règles de composition : modifiable jusqu'à la clôture des inscriptions.
- **Liste autorisée par la coupe** quand elle n'a pas de règlement ; le
  règlement, lui, impose sa liste fermée et ses prix.
- **Builder** : une section « Coups de pouce » quand le contexte le permet
  (coupe en `build`, ou règlement de tournoi). Elle est comptée dans le
  budget, avec un prix calculé par le serveur, jamais par le client.
- **Persistance** : les coups de pouce achetés au build sont rattachés à
  l'équipe (table dédiée, voisine des Star Players). Ils sont figés dans le
  snapshot d'inscription, affichés sur la fiche d'équipe, recopiés par
  « Adapter à la coupe ». Ils n'entrent jamais dans la VE.
- **Feuille de coupe** :
  - les Star Players du roster d'inscription jouent le match, dans les deux
    modes de saisie ;
  - en mode `build`, les coups de pouce de l'équipe sont rappelés en lecture
    seule et l'avant-match n'en vend pas ;
  - en coupe, la trésorerie n'entre plus jamais dans le budget des coups de
    pouce ;
  - la feuille papier reprend les coups de pouce achetés à l'inscription.
- **Règlement de tournoi** :
  - l'or non dépensé à la création est perdu (trésorerie nulle) ;
  - le règlement porte ses remises et le plafond de Pots-de-vin en
    DONNÉES, éditables dans l'admin des règlements.
- **Inscription « telle quelle »** : le budget de la coupe se compare à la
  DÉPENSE de construction (joueurs, staff, Star Players, coups de pouce),
  plus à la VE. Une équipe ne peut pas apporter un coup de pouce que la
  coupe n'autorise pas.

## Capabilities

### New Capabilities

- `cup-inducements` : le régime des coups de pouce d'une coupe. Il couvre le
  mode et sa liste, l'achat au build et sa validation, la persistance et le
  snapshot, la lecture sur la feuille, la fiche d'équipe, le clonage et le
  contrôle d'inscription.

### Modified Capabilities

- `tournament-ruleset` : coups de pouce du règlement achetés à la création,
  avec remises et plafond conditionnel ; or non dépensé perdu.
- `cup-match-sheet` : Star Players du roster d'inscription sur la feuille ;
  budget de coups de pouce d'une coupe sans trésorerie.
- `league-match-sheet` : le budget « petite monnaie + trésorerie » est celui
  de la LIGUE ; une feuille de coupe suit `cup-inducements`.
- `competition-pdf-exports` : la feuille de rencontre d'une coupe imprime
  les coups de pouce achetés à l'inscription.

## Impact

- **Base** (`db push`, aucune reprise de données) :
  - `Cup.inducementMode String?` et `Cup.allowedInducements Json?`, tous
    deux SANS `@default` ;
  - nouvelle table `TeamInducement` (équipe, slug, quantité, prix unitaire
    figé), dans `prisma/schema.prisma` ET le miroir SQLite ; régénérer le
    client SQLite de test.
- **Moteur** : `TournamentInducementRule` gagne `discountCost` et
  `maxWithSecretWeaponStar` ; données NAF WC 2027 mises à jour.
- **Serveur** :
  - extraction de `inducementOptionsFor` (`league-match-sheet`) en un
    service partagé ;
  - `tournament-inducements` (remises et restrictions du pack) ;
  - `team-build-handler` + `team.schemas` (champ `inducements`) ;
  - `team-budget-summary` (dépense, reliquat perdu sous pack) ;
  - `cup-roster-snapshot`, `cup-registration`, `cup.schemas` + `routes/cup`
    (mode et liste) ;
  - `league-match-sheet` (Stars d'inscription, budget de coupe,
    verrouillage en `build`) ;
  - schéma et éditeur des règlements de tournoi ; ratchet
    `team-audit-coverage` ;
  - nouvelle route de lecture du catalogue pour le builder.
- **Web** :
  - `me/teams/new` (section et budget) ;
  - `me/teams/[id]` (fiche) ;
  - `cups/page.tsx` + `cups/[id]` (réglage et affichage) ;
  - feuille de match ;
  - `lib/competition-pdf` ;
  - `admin/data/tournament-rulesets`.
- **Hors périmètre** :
  - jet de Débutants Déchaînés par ronde (journaliers dérivés) ;
  - coups de pouce au build des ligues à règlement ;
  - assistant « première équipe » (`create-from-roster`) ;
  - match en ligne ;
  - règle d'égalité de VEA en ligue, à confirmer dans le livre.
