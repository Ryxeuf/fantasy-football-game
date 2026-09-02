# Tasks — Règle « Capitaine »

- [x] Prisma : `TeamPlayer.isCaptain` (PG + mirror sqlite) + migration
      `20260722100000_add_team_player_captain` + client sqlite régénéré.
- [x] Game-engine : `Player.isCaptain` + `TeamPlayerData.isCaptain`,
      helpers purs `mechanics/captain.ts` (`isPlayerOnPitch`,
      `findCaptainOnPitch`, `findPlaceableCaptain`), relance gratuite sur 6
      dans `consumeTeamReroll`, refus de placement dans
      `validatePlayerPlacement`, priorité capitaine dans `autoSetupAITeam`.
      Tests `mechanics/captain.test.ts` (13).
- [x] Serveur : service `team-captain.ts` (CaptainError typée,
      `getCaptainStatus`, `designateCaptain`, `canFirePlayer`) + tests (20).
- [x] Serveur : routes `GET/POST /team/:id/captain` (Zod
      `designateCaptainSchema`, mapping erreurs → 400/404/409).
- [x] Serveur : propagation `isCaptain` vers le moteur (`match-start`,
      `local-match`, `match-state-handler`).
- [x] Serveur : garde licenciement capitaine dans `applyOfflineFirings`
      (feuille de match ligue) + test.
- [x] Web : `CaptainPanel` sur `/me/teams/[id]` (désignation, successeur,
      badge « C » dans le roster) + tests composant (6).
- [ ] Suite possible : hint UI dédié dans l'écran de setup online quand le
      capitaine n'est pas aligné.
- [ ] Suite possible : capitaine dans la Pro League simulée (sim-engine).
