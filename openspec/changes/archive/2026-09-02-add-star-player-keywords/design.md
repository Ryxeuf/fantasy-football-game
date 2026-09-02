# Design — Mots-clés des Star Players

## Contexte

Chaîne existante côté positions (à répliquer, pas à réinventer) :

```
data/positionnels-bloodbowl-2025.md
  └─ generate-keywords-season3.ts → KEYWORDS_SEASON3 (game-engine)
       └─ sync-rosters.ts → Position.keywords (DB)
            └─ transformPosition → keywords + keywordsEn (API)
                 └─ KeywordChips / PositionKeywordBrowser (web)
```

## Décisions

### 1. Table dédiée plutôt qu'un champ posé sur chaque définition

`star-players.ts` fait déjà 1 380 lignes. Poser `keywords:` dans les 68
définitions gonfle le diff et disperse la donnée. On isole la table dans
`star-player-keywords.ts` (miroir de `keywords-season3.ts`) et on la
recopie sur les définitions dans la boucle post-construction qui applique
déjà les règles spéciales par défaut. Effet de bord voulu : corriger un
mot-clé = éditer une seule ligne d'un seul fichier.

### 2. Pas de dépendance au ruleset

Les mots-clés de position sont `season_3` uniquement, parce que la source
markdown est BB2025 et que les positions `season_2` n'ont pas d'équivalent
nommé. Un Star Player, lui, est la **même personne** dans les deux
rulesets (`buildSeasonThreeStarPlayers` ne change que `hirableBy`). On
renseigne donc les deux rulesets : un mercenaire ne change pas de lignée
d'une saison à l'autre.

### 3. Vocabulaire fermé + garde de test

On réutilise strictement les libellés FR des positions (`Humain`,
`Gros Bras`, `Trois-quart`…), listés dans deux constantes exportées
(`STAR_PLAYER_LINEAGE_KEYWORDS`, `STAR_PLAYER_ROLE_KEYWORDS`). Le test
unitaire vérifie : couverture des 68 slugs, absence d'orphelin, premier
token = lignée, dernier token = type, format CSV `"A, B"`, et
traduisibilité EN de chaque token. Un seul nouveau token a dû être ajouté
au dictionnaire FR→EN : `Zoat` (Zolcath).

### 4. Repli API sur le game-engine

`Position.keywords` est peuplé par le bouton admin « Synchroniser les
rosters » ; les Star Players, eux, ne passent que par le seed. Pour ne pas
livrer une feature invisible tant que le seed n'a pas tourné en prod, le
mapper de route fait `sp.keywords ?? getStarPlayerKeywords(sp.slug)`. La
colonne DB reste prioritaire (elle permet une correction ponctuelle via
l'admin sans redéploiement).

### 5. Helpers de filtre extraits

`position-keyword-filter.ts` était typé sur `ListedPosition`. On extrait
l'implémentation dans `app/lib/keyword-filter.ts` (interface
`KeywordBearing = { keywords?, keywordsEn? }`), et l'ancien module devient
une façade typée position. Les deux surfaces partagent donc la
normalisation (casse/accents/tirets) et la sémantique ET du filtre.

## Alternatives écartées

- **Dériver le type de joueur par heuristique** (ST ≥ 5 ⇒ Gros Bras,
  `secret-weapon` ⇒ Spécial…) : séduisant car sans donnée à maintenir, mais
  faux sur plusieurs cas (Mighty Zug ST 5 n'est pas un Gros Bras, Lord
  Borak non plus). Une table explicite est corrigeable ; une heuristique
  fausse ne l'est pas.
- **Scraper une source externe** : le repo n'embarque pas la source, et
  recopier un PDF sous PI GW dans le dépôt public irait contre la règle
  déjà posée pour le compendium (reformulation obligatoire). Les mots-clés
  restent des données factuelles courtes, pas du texte de règle.
- **Attendre la source officielle avant d'implémenter** : bloquerait toute
  la chaîne (schéma, API, UI) pour une donnée corrigeable en une ligne.
