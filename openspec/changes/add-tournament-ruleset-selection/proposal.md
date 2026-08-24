# Règlements de tournoi à la création d'équipe (NAF World Cup 2027)

## Why

Les coachs veulent créer des équipes conformes à un pack de règles de
tournoi officiel (premier cas : **NAF World Cup 2027, draft ruleset
V2.1**) : budget d'or fixé par le tier du roster, budget de SPP à
dépenser en compétences à la création, restrictions de Star Players
(autorisation par roster, liste de bannis, taxe SPP), limites de cumul
de compétences, tournoi résurrection. Les axes existants ne couvrent pas
ce besoin : `ruleset` est l'**édition** des règles (season_2/season_3)
et `format` la variante de jeu (bb11/sevens). Il manque un **troisième
axe orthogonal** : le règlement de tournoi, choisi à la création (aucun
par défaut), affiché sur la fiche roster, et imposable par une ligue ou
une coupe à ses participants.

## What Changes

- **Registre pur `@bb/game-engine`** (`rosters/tournament-rulesets.ts`) :
  `TournamentRulesetDefinition` + définition complète du NAF World Cup
  2027 V2.1 (tableau des tiers des 31 rosters season_3, barème de
  compétences 6/10/8/12 + surcoût Elite, 16 Star Players bannis, taxe
  SPP 18/24/32 par tranche, inducements autorisés, scoring 5/2/0/−5,
  résurrection) + helpers (`getTournamentRuleset`,
  `getTournamentRosterRules`, `tournamentStarPlayerSppTax`,
  `tournamentSkillCost`, `validateTournamentSkillPlan`).
- **Schéma** : colonne nullable `tournamentRuleset` (slug) sur `Team`,
  `League` et `Cup`. Migration additive ; null = règles standard
  (comportement historique intact).
- **Création d'équipe** (`POST /team/build`, `/team/create-from-roster`) :
  champ `tournamentRuleset` optionnel ; s'il est fourni (ou imposé par la
  coupe cible), le serveur impose budget d'or + pool de SPP du tier,
  exige édition/format du pack, applique bans/autorisations de Star
  Players, déduit la taxe SPP, valide le plan de compétences (choix
  primaire/secondaire uniquement, quota de cumul) et décompte le pool au
  barème du pack (`BuildAdvancementCostFn` injecté dans
  `applyCupBuildAdvancements`).
- **Ligues et coupes** : sélection du règlement à la création ;
  inscription (join direct, invitation, inscription coupe) refusée par
  **égalité stricte** des slugs — une compétition à règlement n'accepte
  que des équipes créées avec ce règlement, et une équipe à règlement ne
  peut rejoindre qu'une compétition au même règlement.
- **Web** : liste déroulante au builder (défaut « Aucun », valeurs
  verrouillées quand un pack est actif, panneau d'information, filtres
  de Star Players bannis), badge 🏆 sur la fiche roster, sélection sur
  les formulaires ligue/coupe, badges sur les pages détail, filtres
  d'éligibilité dans les modales d'inscription.

## Out of scope (suivi)

- **Liste des Elite Skills** du pack : désignées mais non publiées dans
  les pages transcrites du PDF — `eliteSkills: []` (aucun surcoût tant
  que la liste officielle n'est pas intégrée).
- **Logique d'escouade** (6 coachs, un roster/star unique par escouade,
  scoring d'escouade) : documentée dans la définition, non modélisée.
- **Résurrection en ligue** : les coupes ont déjà `resurrectionMode`
  (toujours actif) ; aucune mécanique équivalente n'existe côté ligues —
  à traiter si des ligues à règlement doivent neutraliser SPP/blessures.
- **Inducements de match** : la liste fermée du pack est portée par la
  définition (affichage/référence) ; l'enforcement en match suivra le
  branchement inducements existant.

## Impact

- **Capability** : `tournament-ruleset` (nouvelle).
- **Migration** : `20260824090000_add_tournament_ruleset` (additive).
- **Tests** : game-engine (registre, taxe, plan de compétences), serveur
  (build ×14, create-from-roster ×5, ligue ×7, inscription coupe ×4).
