# Faces des Dés de Blocage Blood Bowl

Ce dossier contient les différentes faces des dés de blocage extraites de l'image `bb_dice_sides.png`.

## Le dé : six faces, cinq icônes

Le Dé de Blocage est un D6 décoré de **cinq icônes** différentes plutôt que
des chiffres 1 à 6. C'est **Repoussé** qui occupe **deux faces** ; les quatre
autres résultats n'en occupent qu'une chacun.

La table de référence est `BLOCK_DIE_FACES` /`BLOCK_DIE_FACE_INFO`
(`packages/game-engine/src/mechanics/block-dice-faces.ts`) — c'est elle qui
fournit les libellés affichés par `BlockDiceIcon`.

## Faces disponibles

| Fichier | Résultat (VF) | Faces | Effet |
|---|---|---|---|
| `player_down.png` | Attaquant Plaqué | 1 | L'attaquant est Plaqué, comme si la cible l'avait bloqué. Turnover. |
| `both_down.png` | Les Deux Plaqués | 1 | Les deux joueurs sont Plaqués, chacun sur sa case (Blocage / Lutte peuvent modifier l'issue). |
| `push_back.png` | Repoussé | **2** | La cible recule de 1 case ; l'attaquant peut Poursuivre. |
| `stumble.png` | Bousculé | 1 | Avec Esquive, devient Repoussé ; sinon, devient Défenseur Plaqué. |
| `pow.png` | Défenseur Plaqué | 1 | On applique le Repoussé, PUIS la cible est Plaquée sur sa case d'arrivée. |

> Il n'y a **que cinq images** : une par icône. `player_down_2.png` — un
> doublon au bit près de `player_down.png`, produit par une extraction qui
> supposait à tort deux faces « Attaquant Plaqué » — a été supprimé. La face
> en double est **Repoussé**, et `push_back.png` la couvre déjà.

## Utilisation dans le jeu

Ces images sont affichées par `BlockDiceIcon` (`@bb/ui`) pour les résultats de
blocage : popup de choix du dé, journal de match, notifications.

## Source

Extrait de l'image `bb_dice_sides.png` située dans le dossier parent.
