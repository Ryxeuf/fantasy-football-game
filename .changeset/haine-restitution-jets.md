---
"@bb/server": minor
"@bb/web": minor
---

Haine (X) : le jet d'après-match est désormais restitué à l'écran. Le D6 étant lancé côté serveur à la validation de la feuille, un trait pouvait apparaître sur la fiche d'un joueur sans explication — et un jet raté ne laissait aucune trace. La feuille validée affiche maintenant un récapitulatif « Haine (X) — jets d'après-match » : un dé par ligne, avec le joueur sorti, son équipe, le mot-clé en jeu et l'issue réelle, **jets ratés compris**. Le récap est persisté dans le snapshot du match (`hateRolls`) et relu à la lecture de la feuille : il survit à un rechargement, et les matchs validés avant ce champ le reconstituent depuis les traits accordés.

Un 4+ qui n'accorde finalement rien (compétence impossible à créer, écriture en échec) est distingué d'un jet raté au lieu d'afficher « 4+ requis » sur un 5. Corrige au passage l'invisibilité d'un trait fraîchement créé : le catalogue public de compétences étant mémoïsé 5 minutes, une variante inédite (`hate-homme-lezard`) s'affichait en slug brut sur la fiche du joueur jusqu'à expiration du cache, désormais purgé à la création.
