---
"@bb/game-engine": minor
"@bb/server": minor
"@bb/web": minor
---

Fans Dévoués : ils ne comptent plus DU TOUT dans la valeur d'équipe (VE) ni dans la valeur d'équipe actuelle (VEA). Leur achat coûte toujours de la trésorerie (création d'équipe, achat en cours de saison), mais leur valeur n'entre plus dans `calculateTeamValue`/`calculateCurrentValue` — donc partout où la VE/VEA est recalculée : fiche équipe, page roster de ligue, feuille de match, recalcul d'équipe. Le détail des coûts de la fiche équipe ne liste plus de part « Fans Dévoués ». Les budgets d'achat restent inchangés (le premier fan n'y est toujours pas facturé).
