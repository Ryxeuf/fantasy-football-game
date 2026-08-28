---
"@bb/server": patch
"@bb/web": patch
---

Feuille de match : deux corrections d'après-match.

**Le joueur mort quitte l'équipe tout seul.** Séquence de fin de match (livre p.68) : un joueur mort est retiré AVANT toute autre action d'après-match, ce qui libère sa place et son numéro pour un recrutement. La mort ne posait que `dead` — le joueur restait sur la feuille d'équipe jusqu'à un clic « Retirer » du coach ou du commissaire. Elle pose désormais aussi `firedAt` (l'état « sorti du roster » du modèle), en gardant `dead` / `diedAt` et la provenance : invalider la feuille lève les deux et remet le joueur au roster, comme le promet déjà l'avertissement « … sera ressuscité ». La feuille de match continue d'afficher les morts (badge ☠), sans quoi les évènements du match qui vient de les tuer perdraient leur nom ; la composition d'une équipe n'affiche ni ne compte plus les joueurs sortis du roster.

**Les journaliers annoncés sont ceux du coup d'envoi.** Une feuille validée annonçait « X aligne N journaliers (moins de 11 joueurs disponibles) » pour un match qui s'était joué au complet : la dérivation repartait du roster courant, sur lequel la validation venait d'appliquer le mort et les blessures « rate le prochain match » de ce match — elle décrivait donc la rencontre SUIVANTE. Les journaliers sont maintenant dérivés de la « version du match » figée à l'ouverture de la feuille. Correction rétroactive : les feuilles déjà figées se relisent correctement, sans reprise de données.
