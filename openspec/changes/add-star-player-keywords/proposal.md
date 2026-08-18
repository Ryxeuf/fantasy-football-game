# Mots-clés des Star Players (parité avec les positionnels)

## Why

Depuis 2026-06-16, chaque **positionnel** porte ses mots-clés officiels
Blood Bowl 2025 (lignée/race + type de joueur, ex. `Elfe, Trois-quart`) :
`KEYWORDS_SEASON3` → `Position.keywords` en base → `keywords`/`keywordsEn`
dans l'API → étiquettes et filtre côté web
(cf. [`docs/position-keywords-feature.md`](../../../docs/position-keywords-feature.md)).

Les **Star Players** n'avaient rien : ni colonne, ni donnée, ni affichage —
alors qu'ils sont des joueurs comme les autres sur la fiche officielle et
portent, eux aussi, une lignée et un type. Conséquence concrète : sur
`/star-players` on ne peut pas répondre à « montre-moi les Gros Bras
ogres » ou « les blitzers humains », alors que `/teams/positions` le fait
déjà, et la fiche d'un star n'annonce pas sa lignée.

## What Changes

- **Donnée** : nouvelle table curée `STAR_PLAYER_KEYWORDS` (68 stars) dans
  `packages/game-engine/src/rosters/star-player-keywords.ts`, même
  vocabulaire FR que `KEYWORDS_SEASON3`. `StarPlayerDefinition` gagne un
  champ `keywords` renseigné automatiquement pour les deux rulesets.
- **Persistance** : colonne `StarPlayer.keywords` (migration
  `20260818100000_add_star_player_keywords`), écrite par le seed.
- **API** : `keywords` + `keywordsEn` sur les 4 routes `/star-players*`
  (mapper unique) et sur les endpoints star players d'une équipe. Repli sur
  la table game-engine tant que la base n'a pas été re-seedée.
- **Web** : étiquettes sur la carte de listing, la fiche détail et le
  sélecteur de recrutement ; **filtre par mots-clés** (ET logique) sur
  `/star-players`, calqué sur `PositionKeywordBrowser` ; mots-clés dans le
  JSON-LD et les `metadata.keywords` de la fiche.
- **Admin** : champ « Mots-clés » dans les formulaires de création/édition
  d'un Star Player (parité avec les positions).

## Impact

- Migration additive (colonne nullable) : aucun risque sur l'existant.
- Le seed doit être rejoué en prod pour peupler la colonne ; en attendant,
  l'API sert les mots-clés depuis le game-engine (aucune régression
  visible).
- ⚠️ **Provenance de la donnée** : il n'existe pas de source markdown des
  Star Players dans le repo (contrairement à
  `data/positionnels-bloodbowl-2025.md`). La table est donc curée à la main
  depuis la fiche de chaque star (lore, illustration, profil, compétences)
  et doit être confrontée au PDF officiel GW « Star Players! ». Toute
  correction se fait dans le seul fichier `star-player-keywords.ts`.
