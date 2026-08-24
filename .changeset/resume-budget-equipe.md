---
"@bb/game-engine": minor
"@bb/server": minor
"@bb/web": minor
---

Résumé du budget de la fiche d'équipe : valeur d'équipe et trésorerie justes.

Le bloc « Résumé du budget » recalculait ses montants côté web avec
`getPlayerCost(position, roster)` — sans le ruleset de l'équipe, sans les
surcoûts d'avancement, avec sa propre formule de staff. Résultat : un « Coût
actuel » et un « Budget restant » qui ne collaient ni à la VE calculée par le
serveur, ni à la trésorerie affichée juste en dessous (10K face à 0K).

- Moteur : `calculateTeamValueBreakdown` expose le détail VE/VEA (joueurs,
  joueurs disponibles, staff, relances) ; `calculateTeamValue` et
  `calculateCurrentValue` en sont désormais de simples projections.
- Serveur : `GET /team/:id` renvoie un `budgetSummary` complet (budget initial,
  joueurs, Star Players, staff, relances, fans, dépensé, reliquat, trésorerie,
  VE, VEA) calculé par la même logique que `updateTeamValues`. La VE/VEA
  stockée est re-persistée si elle a dérivé (règles Élite, fans dévoués…).
- Serveur : la VE lit les coûts de poste et la config staff **de la base**
  (roster × ruleset × format) — c'est ce que les handlers débitent — au lieu
  des seules données statiques du package, et le format de l'équipe n'est plus
  ignoré (Sevens valorisait son staff au tarif BB11).
- Serveur : le reliquat du budget de construction part en trésorerie
  (`creditInitialTreasury`) au lieu d'être perdu, dans les deux flux de
  création. Script de rattrapage pour les équipes existantes :
  `pnpm --filter server db:backfill-treasury -- --apply`.
- Web : les quatre tuiles et le bloc « Staff de l'équipe » affichent les
  montants du serveur ; « Budget restant » est la trésorerie, la même valeur
  qu'en dessous.
