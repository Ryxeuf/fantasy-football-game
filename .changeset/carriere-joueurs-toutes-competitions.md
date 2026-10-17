---
"@bb/server": patch
"@bb/web": patch
"@bb/mobile": patch
---

Les statistiques des matchs de coupe et de ligue sont prises en compte partout, pour les joueurs comme pour les équipes.

**La carte joueur affichait « 0 match, 0 TD, 0 sortie » après toute une coupe.** Une feuille de coupe n'écrit rien sur les équipes (c'est sa règle), et une feuille de ligue ne créditait un match qu'aux joueurs ayant marqué, sorti ou été élus Joueur du Match. La carrière d'un joueur se calcule désormais à partir des feuilles validées : matchs joués (tout joueur aligné compte), touchdowns, sorties, passes, interceptions et titres de Joueur du Match, coupe comprise. Une feuille invalidée sort du calcul d'elle-même.

**Les mêmes chiffres partout** : carte joueur, page carrière (qui gagne aussi un bilan d'équipe toutes compétitions), roster d'une équipe de ligue (avec une colonne MJ), fiche admin, moyennes des pages de poste, écran joueur de l'application mobile, et feuille de roster PDF, dont les colonnes PSP / RPM / BP n'étaient jamais remplies.

**Classements de saison** : les classements individuels et les colonnes P, Agr, SP et Exclu ne comptent plus que les feuilles validées, comme le classement lui-même.

**Succès et compteurs du coach** : « Jouer N matchs », « Remporter N matchs », « Marquer N touchdowns »… comptent enfin la ligue et la coupe ; le compteur « Matchs suivis » de l'accueil, le profil et l'application mobile comptent les rencontres de coupe des équipes du coach ; la statistique publique des matchs sur table compte la ligue.
