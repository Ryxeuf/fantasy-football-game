# Tasks — Morts & licenciements réversibles

- [x] Prisma : `TeamPlayer.status/statusAt/statusSource/statusSourceId` +
      modèle `TeamPlayerStatusEvent` (PG + mirror sqlite + client régénéré),
      migration `20260725100000_add_player_status_provenance` avec backfill
      `legacy` des morts/licenciés existants.
- [x] Serveur : service `player-status.ts` — `ACTIVE_PLAYER_WHERE`,
      `isActivePlayer`, `statusOf`, `applyPlayerStatus(es)`,
      `revertPlayerStatus`, `revertPlayerStatusesBySource`,
      `getPlayerStatusHistory`. Tests `player-status.test.ts` (20).
- [x] Serveur : feuille de match ligue — morts (`applyOfflineInjuries`) et
      licenciements (`applyOfflineFirings`) passent par `player-status` avec
      la provenance `match_sheet` + `matchId`.
- [x] Serveur : invalidation de feuille (`league-offline-edit`) — reversion
      VERIFIEE des morts et des licenciements (plus d'`updateMany` aveugle),
      TV recalculée sur les équipes réellement touchées.
- [x] Serveur : match en ligne — `persistPlayerDeaths` reçoit le `matchId`
      (`move-processor`) et enregistre la provenance `online_match`.
- [x] Serveur : annulation (`POST /admin/matches/:id/cancel`) et suppression
      (`DELETE /admin/matches/:id`) d'un match → résurrection des joueurs
      tués par ce match + audit log + TV recalculée.
- [x] Serveur : filtres roster actif corrigés — `match-start` (un licencié
      ne peut plus être aligné), `post-match-league-sequence` (plus de
      level-up pour un licencié), `cup-registration` + `cup-roster-snapshot`
      (un mort ne part plus en coupe).
- [x] Serveur : garde CI `player-status-filters.test.ts` — interdit les
      filtres partiels `dead: false` / `firedAt: null` dans `services/` et
      `routes/`, avec liste d'exceptions justifiées (ratchet).
- [x] API : `GET /leagues/:id/teams/:teamId/roster-view` expose
      `statusAt` + `statusSource`.
- [x] Web : origine de la mort en tooltip sur la fiche roster de ligue ;
      avertissement « joueurs réintégrés » à l'invalidation d'une feuille
      (en plus de l'avertissement « ressuscités » existant) + tests
      composant.
- [ ] Suite possible : aligner `ProTeamRoster.status` (Pro League) sur le
      même mécanisme et réverser l'induction Hall of Fame sur résurrection.
- [ ] Suite possible : exposer `getPlayerStatusHistory` sur la fiche joueur
      (« mort au match J3 contre X, ressuscité le … »).
- [ ] Suite possible : renumérotation automatique quand un licencié
      réintégré entre en conflit de numéro avec un achat post-match.
