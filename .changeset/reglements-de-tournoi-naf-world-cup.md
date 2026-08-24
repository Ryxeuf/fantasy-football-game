---
"@bb/game-engine": minor
"@bb/server": minor
"@bb/web": minor
---

Règlements de tournoi à la création d'équipe (premier pack : NAF World Cup 2027 V2.1). Nouvel axe orthogonal au ruleset (édition) et au format : une liste déroulante « Règlement de tournoi » (défaut : aucun) au builder impose budget d'or et pool de SPP du tier du roster, les restrictions de Star Players du pack (rosters étoilés, 16 bannis, taxe SPP 18/24/32 par tranche de coût cumulé) et les limites de cumul de compétences (barème 6/10/8/12). Le règlement est affiché en badge sur la fiche roster, sélectionnable à la création d'une ligue ou d'une coupe, et imposé aux inscriptions par égalité stricte (une compétition à règlement n'accepte que des équipes créées avec ce règlement, et réciproquement). Registre pur `TOURNAMENT_RULESETS` dans `@bb/game-engine`, colonne nullable `tournamentRuleset` sur Team/League/Cup (migration additive, comportement historique intact sans règlement).
