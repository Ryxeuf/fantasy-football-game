---
"@bb/server": patch
"@bb/web": patch
---

Feuille de match : la passe réussie enregistre son réceptionneur.

Une « Passe réussie » ne retenait que le lanceur, alors que deux joueurs concluent l'action. Le champ manquait pour tout ce qui récompense celui qui attrape le ballon — au premier rang la Prière à Nuffle « Réception Étourdissante » (D16 = 11), qui accorde 1 PSP à chaque joueur de l'équipe réceptionnant le ballon à la suite d'une Action de Passe : sans le nom du réceptionneur, la feuille ne permettait pas de savoir à qui.

La saisie propose donc un réceptionneur, choisi dans la MÊME équipe que le lanceur (journaliers et Star Players engagés compris) — c'est la seule cible du journal qui ne soit pas un adversaire. Le résumé de match en tire une statistique `receptions` par joueur, distincte de la Réussite qui reste au lanceur : conforme aux règles, une réception ne rapporte aucun PSP par elle-même. Le champ est facultatif (les feuilles déjà saisies restent lisibles telles quelles) et un joueur ne peut pas réceptionner sa propre passe.
