---
"@bb/server": minor
"@bb/web": minor
---

Retrait d'un joueur mort du roster de ligue sans licenciement : le commissaire peut désormais retirer un joueur mort à tout moment (le hard delete pré-saison restait bloqué par « l'équipe a déjà participé à un match » et le licenciement de feuille skippe les joueurs déjà inactifs). Retrait doux : la fiche, la provenance de la mort et l'historique sont conservés, l'invalidation de la feuille fautive reste réversible ; l'action est journalisée (`remove_dead_player`). Côté UI, la page roster de ligue affiche un bouton « Retirer » sur les morts pour le commissaire (flag `viewerIsCommissioner`), et l'éditeur commissaire propose « 🗑 Retirer » sur un mort même saison démarrée.
