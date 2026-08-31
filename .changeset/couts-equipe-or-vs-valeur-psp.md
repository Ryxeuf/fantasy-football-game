---
"@bb/game-engine": minor
"@bb/server": minor
"@bb/web": minor
---

Coûts d'équipe : séparer l'or de la valeur d'équipe, et fiabiliser la comptabilité des PSP.

Cinq symptômes remontés sur une équipe Ogre construite sous « NAF World Cup 2027 » (budget 1 180k, pool de 66 PSP) découlaient de deux confusions : l'or de construction mélangé à la VE, et un coût en PSP re-dérivé au lieu d'être lu.

**Une VEA inférieure à la VE sans explication.** « Trois-quarts à vil prix » annule le Coût d'Embauche des Trois-quarts dans la VEA — 150k sur cette équipe, soit tout l'écart 1 415k → 1 265k. Le calcul était juste, rien ne le disait, et sur une équipe qui n'a joué aucun match l'écart passait pour une erreur. `TeamValueBreakdown` expose désormais `cheapLinemenWaived` et `unavailablePlayersCost`, avec l'invariant `VEA = VE − indisponibles − exonération`, et la fiche affiche les deux postes en nommant la règle.

**Des joueurs augmentés restés au tarif de recrue.** La colonne « Coût » de la composition, la carte PNG et la colonne « Valeur actuelle » du PDF montraient le coût d'embauche du poste : un Bloqueur Ogre recruté 140k et augmenté de deux compétences y restait à 140k, alors qu'il pesait 230k dans la VE affichée juste au-dessus. `GET /team/:id` sert maintenant la valeur de chaque joueur, calculée par la MÊME résolution que la VE — coûts de poste en base, barème de l'édition, surcoût Élite.

**« Budget dépassé ! −240k » sur une équipe au budget exact.** Les surcoûts d'avancement — payés en PSP, jamais en or — étaient imputés au budget de construction, côté web comme dans `buildTeamBudgetSummary`, qui pilote aussi la trésorerie d'un brouillon (`syncDraftTreasury`) et le garde-fou d'édition du staff. Le budget ne compte plus que les EMBAUCHES, ce que `PUT /team/:id/roster` a toujours fait : l'écran mentait seul.

**54 PSP dépensés annoncés sur un pool de 66.** Le build créditait le coût du règlement (Garde primaire Élite = 8 PSP) mais l'application débitait le barème standard (6). L'écart restait en SPP fantômes sur les joueurs — 12 au total, ce qui était exactement le « PSP disponibles » affiché — dépensables ensuite HORS des règles du tournoi, le financement « SPP du joueur » n'y étant pas soumis. Et faute de `pspCost` persisté, la comptabilité du pool retombait sur le barème standard. Le coût payé est désormais imposé au débit et persisté avec sa source. Les améliorations déjà écrites ne sont pas backfillables (`prisma/migrations/` est gitignoré, la prod applique `db push`) : elles sont rattrapées à la LECTURE au barème du règlement, et un script `db:repair-build-psp` (simulation par défaut) fige le calcul et reprend les SPP fantômes. Dans la même famille, `advancementCostFor` ne facturait pas le surcoût Élite d'un règlement qui ne republie pas sa liste — la même compétence coûtait 8 PSP au build et 6 le lendemain.

**Un bloc « Staff de l'équipe » flou.** Ses postes venaient d'une re-dérivation locale et pouvaient diverger de la VE que le « Résumé global » est censé totaliser ; les fans dévoués payants n'apparaissaient nulle part alors qu'ils sont bien débités. Les montants viennent maintenant du serveur, les fans sont affichés hors total avec la raison, et un détail dépliant du budget d'or complète le résumé.
