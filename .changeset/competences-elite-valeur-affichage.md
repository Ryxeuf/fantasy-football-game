---
"@bb/game-engine": minor
"@bb/server": minor
"@bb/web": minor
---

Compétences d'Élite : le statut Élite (`Skill.isElite`) est maintenant exposé par l'API `/api/skills` et affiché partout où une compétence apparaît (badge « ⭐ Élite » sur les pastilles de roster, infobulles, liste et fiche `/skills`, sélecteurs d'évolution, tableau du compendium avec légende). Leur valeur est corrigée : une compétence Élite coûte +10 000 po de valeur d'équipe additionnels (`ELITE_SKILL_SURCHARGE`), soit 30 000 po pour une primaire Élite au lieu de 20 000 — pris en compte dans le recalcul de VE/VEA serveur (`updateTeamValues`), la valeur par joueur des rosters de ligue, les ajouts/retraits de compétence du commissaire et les aperçus de coût côté client.
