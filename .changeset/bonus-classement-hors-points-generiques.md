---
"@bb/server": minor
"@bb/web": patch
---

Classement de ligue : le « Bonus au classement » accordé par le commissaire sur la feuille de match n'est plus ajouté aux points génériques (`LeagueParticipant.points` reste le pur barème victoire/nul/défaite). Il alimente désormais le snapshot bonus du pairing (`bonusPointsHome/Away` + entrée « Bonus commissaire » dans le breakdown) et apparaît donc dans la colonne dédiée « Bo » du classement, comme les bonus de règles. L'invalidation d'une feuille l'annule via la remise à zéro du snapshot bonus (plus de décrément de points). Le champ de saisie l'indique désormais explicitement.
