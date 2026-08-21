---
"@bb/game-engine": minor
"@bb/server": minor
"@bb/web": minor
---

Fans Dévoués dans la valeur d'équipe : chaque fan compte désormais sa valeur (5 000 po en BB11, 20 000 en Sevens) dans la VE et la VEA — l'ancien calcul `(fans − 1) × coût` décalait toutes les équipes de −5 kpo (off-by-one : seul l'ACHAT du premier fan est gratuit à la création, pas sa valeur). Corrigé dans le calculateur du moteur (`calculateTeamValue`/`calculateCurrentValue`, donc partout où la VE est recalculée : page roster de ligue, feuille de match, recalcul d'équipe) et dans le détail du staff de la fiche équipe. Les budgets d'achat (création, sauvegarde de roster, achat d'un fan) restent inchangés : le premier fan n'y est toujours pas facturé.
