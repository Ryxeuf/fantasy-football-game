---
"@bb/server": patch
"@bb/sim-engine": minor
---

Le bac à sable Pro League fonctionne à nouveau après une montée de version du moteur, et un match full driver se lit d'une seule commande.

**Un match de test n'est plus refusé par le pin de sa saison hôte.** `/admin/sim/test-match` range ses matchs dans la dernière saison active ; épinglée sur une version antérieure du moteur, elle bloquait toute simulation (« Engine version mismatch … pinned='0.21.0', current='0.30.0' »). Un match de bac à sable n'entre pas dans la compétition de la saison qui l'héberge : il tourne désormais sur le moteur courant. Les matchs de compétition restent gouvernés par leur saison.

**`pnpm sim:match`** joue un match en full driver sur de vrais rosters et l'affiche en résumé, en feuille de match papier (`--sheet`), en narration (`--narration`) ou en JSON comparable avec `sim:diff-replays` (`--json`). Au passage, `debug-match --full` ne joue plus à 2 contre 2.
