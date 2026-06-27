# Tasks — Suppression d'équipes/joueurs par le commissaire

> TDD : gardes d'abord (toutes les branches d'erreur), puis happy paths.
> Calque sur le contrat de `specs/commissioner-team-removal/spec.md`.

## 1. Service de suppression (serveur)
- [x] 1.1 `commissioner-team-edit.ts` : exporter `appendAudit` (+ `AuditEntry`)
      pour réutilisation par le service soeur.
- [x] 1.2 `commissioner-team-removal.ts` : `hasTeamPlayedInLeague(leagueId, teamId)`
      — pairing engagé (`in_progress`/`played`/`forfeit_home`/`forfeit_away`)
      scopé ligue, via `round.season.leagueId` + OR home/away.
- [x] 1.3 `CommissionerRemovalError` typée (codes `season_not_found`,
      `team_not_found`, `team_not_in_league`, `player_not_found`,
      `player_not_in_team`, `season_started`, `team_has_played`).
- [x] 1.4 `removeTeamFromLeague` : saison de la ligue + participant existant,
      garde `draft`/`scheduled`, garde « aucun match joué », hard delete du
      `LeagueParticipant`, audit `remove_team`.
- [x] 1.5 `removePlayerFromTeam` : équipe inscrite dans la ligue, garde « aucun
      match joué », joueur appartient à l'équipe, hard delete du `TeamPlayer`,
      audit `remove_player`.

## 2. Routes + schéma + mapping d'erreur
- [x] 2.1 `commissioner-team-edit.schemas.ts` : `commissionerRemovalSchema`
      (`{ reason?: string ≤ 500 }`) + type inféré.
- [x] 2.2 `routes/league.ts` : handlers `handleRemoveTeamFromLeague` /
      `handleRemovePlayerFromTeam`, gardés par `ensureLeagueCommissioner`,
      corps typé via le schéma (pas de `req.body as`).
- [x] 2.3 `routes/league.ts` : enregistrer `DELETE …/seasons/:seasonId/teams/:teamId`
      et `DELETE …/teams/:teamId/players/:playerId` (`authUser` + `validate`).
- [x] 2.4 `domainError` : mapper `CommissionerRemovalError` (404 / 409).

## 3. UI commissaire (web)
- [x] 3.1 `SeasonParticipants` : props `seasonId`/`seasonStatus`, bouton
      « Supprimer » (confirmation inline) visible commissaire + pré-saison,
      appel `DELETE`, affichage erreur, `onChanged`.
- [x] 3.2 `CommissionerTeamEditor` : prop `canRemovePlayers`, bouton
      « Supprimer » par joueur (confirmation inline), appel `DELETE`.
- [x] 3.3 `leagues/[id]/page.tsx` : passer `seasonId` + `seasonStatus`.

## 4. Tests
- [x] 4.1 `commissioner-team-removal.test.ts` : 13 tests (gardes + happy paths +
      vérif appel `AuditLog`).
- [x] 4.2 `SeasonParticipants.test.tsx` : 5 tests (gating + flux confirmation +
      erreur API).

## 5. Vérification
- [x] 5.1 `vitest run` service removal (13/13) + edit (23/23) + route league (33/33).
- [x] 5.2 `vitest run` web : `SeasonParticipants` (5/5) + `page`/`SeasonStandings` (27/27).
- [x] 5.3 Garde-fou `routes/no-raw-body-cast.test.ts` vert (81/81).
- [x] 5.4 `pnpm --filter web typecheck` vert.
- [ ] 5.5 `pnpm --filter server typecheck` — à valider en CI (client Prisma
      non générable hors-ligne dans le sandbox).

## 6. Correctif + retrait de coach (suivi post-merge #930)
- [x] 6.1 Bug : `DELETE` sans corps faisait échouer `validate` ("expected
      object, received undefined"). `commissionerRemovalSchema` → `.default({})`
      pour normaliser l'absence de corps. Test de régression schéma.
- [x] 6.2 `removeCoachFromSeason` : supprime toutes les équipes du coach sur la
      saison (mêmes gardes) + annule ses invitations en attente (best-effort) +
      audit `remove_coach`. Code d'erreur `coach_not_in_league` (404).
- [x] 6.3 Route `DELETE /leagues/:leagueId/seasons/:seasonId/coaches/:coachUserId`
      + handler + mapping d'erreur.
- [x] 6.4 UI : bouton « Retirer le coach » (confirmation inline) dans
      `SeasonParticipants`, gated pré-saison.
- [x] 6.5 Tests : service (6 cas coach) + schéma (4) + UI (2 cas coach).
