# Tasks — Page publique d'un roster partagé

## Serveur

- [x] `services/public-team-view.ts` : `PublicTeamView` explicite (ni
      `ownerId`, ni `shareToken`, ni `isPublic`), `buildPublicTeamView`
      (enrichissements isolés) et `getPublicTeamViewByToken`.
- [x] `routes/public-teams.ts` : `GET /api/public/teams/:token` sert la vue
      enrichie.
- [x] Tests `services/public-team-view.test.ts` : chiffres servis, VE
      fraîche vs colonne stockée, champs internes absents, dégradation
      d'un enrichissement en échec, repli du format.
- [x] `tests/e2e-api/specs/team-share-preview.spec.ts` : la route token
      exercée contre le miroir SQLite (le catalogue y est vide — les
      enrichissements DOIVENT dégrader sans 500).

## Web

- [x] `app/r/[token]/PublicRosterTable.tsx` (client) : compétences via
      `SkillTooltip` (base vs acquise, `dbBaseSkills`), `SkillAccessBadges`,
      `KeywordChips`, libellé de poste base-d'abord avec repli
      `prettifySlug`, colonne « Coût » sur `playerValues`, cartes sous `md`.
- [x] `app/r/[token]/staff-lines.ts` (pur) : 5 postes de staff avec coût,
      totaux servis prioritaires, premier fan dévoué offert, poste non
      acheté sans coût.
- [x] `app/r/[token]/page.tsx` : logo (`TeamLogo`), fluff en exergue,
      `SkillsCatalogProvider` + détail roster chargés en parallèle, bande
      VE / VEA / trésorerie / effectif / Star Players.
- [x] Tests `PublicRosterTable.test.tsx`, `staff-lines.test.ts`,
      `page.render.test.tsx`.
