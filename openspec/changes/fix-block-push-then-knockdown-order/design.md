# Design — Repoussé avant Plaquage

## Le nœud : où vit « la cible sera plaquée après la poussée »

`handlePushWithChoice` a trois sorties, dont une **asynchrone** :

| Chemin | Case d'arrivée connue ? |
|---|---|
| Une seule direction libre | Oui, immédiatement |
| Aucune direction sur le terrain (sortie) | Oui — il n'y a pas de case, la foule s'en charge |
| Plusieurs directions | **Non** — `pendingPushChoice`, résolu au `PUSH_CHOOSE` suivant |

Le Plaquage doit donc franchir une frontière de tour. C'est ce qui distingue
ce change d'un simple déplacement de deux lignes.

## Alternatives écartées

### A. Prédire la destination avant de pousser
`willBePushedOffPitch` (posé par #1005) fait exactement ça pour le seul cas
« sortie de terrain », où la réponse ne dépend pas du choix du coach. L'étendre
à « quelle case exactement » est impossible par construction : c'est le coach
qui décide. Écarté.

### B. Forcer une direction pour supprimer le cas différé
Supprimerait le problème en supprimant une règle du jeu. Écarté.

### C. Rouler l'armure d'avance et n'appliquer le résultat qu'après
Garderait l'ordre du RNG intact (donc pas de re-snapshot du bench, pas de
tests à relire) : on tire les dés avant, on applique après. Mais un jet
d'armure dépend de l'état au moment où il est fait — Blessure par le Public sur
sortie de terrain, compétences de la cible, modificateurs de l'attaquant. Faire
diverger « quand on tire » de « quand ça compte » recrée exactement la classe
de bug qu'on répare. Écarté : l'économie porte sur le coût du change, pas sur
sa justesse.

### D. (retenue) Marquer l'intention dans `pendingPushChoice`
`pendingPushChoice` porte déjà `blockResult` (`'POW'` / `'STUMBLE'`). Le
`PUSH_CHOOSE` sait donc déjà qu'un Plaquage est dû ; il ne le fait simplement
pas. On formalise l'intention et on applique le Plaquage après
`applyChainPush`, dans le même ordre que les deux chemins synchrones.

Conséquence acceptée : l'ordre de consommation du RNG change. C'est un coût
mesurable et outillé (re-snapshot du bench + relecture des tests à seed fixe),
pas un risque diffus.

## Point d'attention : la reprise des matchs en cours

Un `GameState` sérialisé avant le déploiement peut porter un
`pendingPushChoice` sans le marqueur. Le lire avec un repli — marqueur absent
⇒ comportement actuel (pas de Plaquage différé, il a déjà eu lieu) — évite de
plaquer deux fois ou de perdre le blocage. Même posture que les colonnes de
gating nullables du repo : **lisible sans backfill**.

## Ordre de travail suggéré

Faire d'abord Stabilité et Parade **sans** toucher au RNG (ils dépendent de
l'état `stunned`, pas d'un tirage), pour isoler les échecs de tests dus au
décalage du RNG de ceux dus à un vrai changement de comportement. Déplacer le
jet d'armure ensuite, en dernier.
