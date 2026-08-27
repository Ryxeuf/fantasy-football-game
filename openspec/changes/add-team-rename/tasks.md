# Tasks — Renommage d'équipe

- [x] Serveur : `renameTeamSchema` + `RenameTeamBody` dans
      `schemas/team.schemas.ts` (trim, 1..100, mêmes messages qu'à la
      création).
- [x] Serveur : service `services/team-rename.ts` (`renameTeam`,
      `TeamRenameError` typée `not_found` / `invalid_name`, no-op si nom
      identique, journal `team.rename` avec `before`).
- [x] Serveur : `routes/team-rename-handler.ts` + route
      `PATCH /team/:id/name` câblée dans `routes/team.ts` (re-export pour
      `team.test.ts`).
- [x] Serveur : libellé `team.rename` dans `ACTION_LABELS`
      (`services/team-audit-read.ts`).
- [x] Tests serveur : `services/team-rename.test.ts` +
      `routes/team-rename-handler.test.ts`.
- [x] Web : `TeamNameInlineEdit` sur `/me/teams/[id]` + clés i18n fr/en +
      test composant.
- [ ] Suite possible : modération (blocklist) du nom d'équipe, à appliquer
      À LA FOIS à la création et au renommage.
- [ ] Suite possible : exposer l'historique des noms dans l'onglet Journal
      (les données y sont déjà, seul le rendu manque).
