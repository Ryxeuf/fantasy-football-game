# Tasks — Règlements de tournoi (NAF World Cup 2027)

## 1. game-engine (registre pur)
- [x] 1.1 `rosters/tournament-rulesets.ts` : types + `NAF_WORLD_CUP_2027` (31 rosters season_3 : budget d'or × SPP × cumul × étoile, bannis, taxe, inducements, scoring) + helpers (`getTournamentRuleset`, `getTournamentRosterRules`, `tournamentStarPlayerSppTax`, `tournamentSkillCost`, `validateTournamentSkillPlan`, `maxTwoSkillPlayers`).
- [x] 1.2 Export via `rosters/index.ts` ; tests (tableau des tiers vs `TEAM_ROSTERS_BY_RULESET`, bannis vs `STAR_PLAYERS`, taxe, plan de compétences).

## 2. Schéma & migration
- [x] 2.1 `Team.tournamentRuleset String?` + `League.tournamentRuleset` + `Cup.tournamentRuleset` (schéma principal).
- [x] 2.2 Migration additive `20260824090000_add_tournament_ruleset`.
- [x] 2.3 Miroir sqlite + régénération du client sqlite tracké.

## 3. Serveur — création d'équipe
- [x] 3.1 `utils/tournament-ruleset-helpers.ts` (`parseTournamentRuleset` : null toléré, slug inconnu refusé).
- [x] 3.2 Zod : champ `tournamentRuleset` sur `buildTeamSchema` + `createFromRosterSchema`.
- [x] 3.3 `team-build-handler` : édition/format/roster exigés, budget + pool imposés, bans/autorisation stars, taxe SPP, plan de compétences validé, `BuildAdvancementCostFn` du pack injecté dans `applyCupBuildAdvancements`, cohérence coupe ↔ pack, persistance.
- [x] 3.4 `team-create-from-roster-handler` : validation + budget imposé + persistance (pool 0 : pas d'achat de compétences sur ce flux).
- [x] 3.5 Exposition : `GET /team/:id` (spread), `GET /team/mine` et `/team/list` (selects).
- [x] 3.6 Tests handlers (14 build + 5 create-from-roster).

## 4. Serveur — ligues & coupes
- [x] 4.1 `createLeagueSchema` + `CreateLeagueInput`/`UpdateLeagueInput` + `createLeague`/`updateLeague` (validation slug + édition).
- [x] 4.2 `addParticipant` : égalité stricte des slugs (les deux sens) ; erreurs mappées `tournament_ruleset_mismatch` (409) côté invitations.
- [x] 4.3 `createCupSchema` + `POST /cup` (validation + persistance) ; sérialisations coupe exposent le champ.
- [x] 4.4 `registerTeamToCup` : égalité stricte + `pspPoolGranted` = pool de build pour une coupe à règlement.
- [x] 4.5 Tests (ligue ×7, inscription coupe ×4).

## 5. Web
- [x] 5.1 Builder `me/teams/new` : select (défaut Aucun, seed URL, imposé par la coupe), verrous édition/format/budget/pool, panneau d'info du pack, taxe stars en direct (`onSelectedCostChange`), filtre des bannis (`excludedSlugs`), validation du plan + blocage submit.
- [x] 5.2 Fiche roster `me/teams/[id]` : badge 🏆 « Règlement : {label} ».
- [x] 5.3 `LeagueForm` (create/edit) + payloads + badge détail ligue + filtre `JoinSeasonModal`.
- [x] 5.4 Formulaire coupe (packs compatibles ruleset+format), badges liste/détail, filtre d'éligibilité inscription.
- [x] 5.5 i18n FR/EN.

## 6. Suivi (hors périmètre)
- [ ] 6.1 Intégrer la liste officielle des Elite Skills du pack (surcoût +2 SPP).
- [ ] 6.2 Modélisation des escouades (6 coachs, unicité roster/star, scoring d'escouade).
- [ ] 6.3 Résurrection côté ligues à règlement (neutraliser SPP/blessures comme `Cup.resurrectionMode`).
- [ ] 6.4 Enforcement en match de la liste fermée d'inducements du pack.
