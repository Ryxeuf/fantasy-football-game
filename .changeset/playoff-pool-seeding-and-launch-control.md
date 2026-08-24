---
"@bb/server": minor
"@bb/web": minor
---

Playoffs de ligue : les quotas de qualification par poule (`qualifiesForPlayoffs`) déterminent enfin les seeds du bracket. Les qualifiés de chaque poule sont pris en ordre serpentin (tous les 1ers, puis tous les 2èmes…), ce qui évite les duels intra-poule au premier tour à quotas égaux. Une configuration incohérente (total des qualifiés ≠ taille du bracket, poule plus petite que son quota) est refusée explicitement au lieu de produire un bracket qui contredit les quotas affichés. Les saisons sans poule conservent le seeding sur le classement global.

Le commissaire prend la main sur le lancement : la taille du bracket est modifiable en cours de saison (tant qu'aucun bracket n'existe), un panneau dédié affiche l'état de la phase de poule et la cohérence des quotas, et un bouton « Lancer les playoffs » permet de rattraper un déclenchement automatique manqué — avec une option de clôture anticipée qui annule les matchs de poule restants. Le démarrage est désormais refusé tant que la phase régulière n'est pas terminée, sauf clôture anticipée explicite.
