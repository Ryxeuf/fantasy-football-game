---
"@bb/game-engine": minor
"@bb/server": minor
---

« Trois-quarts à vil prix » (Ogres, Snotlings) est désormais appliquée au calcul de la Valeur d'Équipe Actuelle : le Coût d'Embauche des Trois-quarts compte pour 0 po dans la VEA, tandis que leurs augmentations de valeur (avancements) restent comptées normalement. La VE, elle, reste au tarif plein. C'est la seule exception au calcul standard VE/VEA. Le moteur reçoit `hireCost`/`lineman` par joueur et les règles spéciales d'équipe ; côté serveur, `updateTeamValues` résout le plafond du poste (`isLineman`) et les règles spéciales du roster depuis la base (repli sur les données statiques). La règle se propage partout où la VEA est recalculée : fiche d'équipe, page roster de ligue, CTV de feuille de match, recalcul d'équipe.
