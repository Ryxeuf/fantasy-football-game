# Tasks — retrait d'équipe et double validation (coupes)

## 1. Retrait d'une équipe (serveur)

- [ ] 1.1 `services/cup-team-removal` : décision PURE `decideCupTeamRemoval` (propriétaire / commissaire / admin + `force`, coupe ouverte / close / terminée, rencontre ouverte) — vérifier : tests unitaires en table.
- [ ] 1.2 `removeTeamFromCup` : faits (coupe, inscription, rencontres ouvertes), suppression de l'inscription, notification `cup.team_removed` au coach si un tiers retire (best-effort) — vérifier : tests avec Prisma mocké (suppression, refus, notification, échec de notification toléré).
- [ ] 1.3 `POST /cup/:id/unregister` délègue au service et mappe les codes (400 / 403 / 404 / 409) — vérifier : tests de route sur la vraie chaîne Express (commissaire, propriétaire, tiers, rencontre ouverte).
- [ ] 1.4 `services/cup-playoffs` : seeding sans poules limité aux inscrits — vérifier : test (équipe retirée bien classée non qualifiée).
- [ ] 1.5 `GET /cup/:id` : ligne de classement `withdrawn: true` pour une équipe non inscrite, sortie des classements par poule — vérifier : test du helper pur.

## 2. Retrait d'une équipe (web)

- [ ] 2.1 Page de coupe : bouton « Retirer » par équipe pour le commissaire / admin (coupe ni terminée ni archivée), confirmation nommant équipe et coach ; « Retirer mon équipe » inchangé pour le propriétaire — vérifier : test de rendu / helper pur de visibilité.
- [ ] 2.2 `CupStandings` : badge « retirée » et pas de lien de roster sur une ligne `withdrawn` — vérifier : test de rendu.

## 3. Double validation (serveur)

- [ ] 3.1 `Cup.sheetDoubleValidation Boolean @default(false)` dans `prisma/schema.prisma` ET `apps/server/prisma/sqlite/schema.prisma` — vérifier : `prisma generate`, typecheck.
- [ ] 3.2 Schémas `createCupSchema` / `updateCupSchema`, `POST /cup` (défaut `false`), `PATCH /cup/:id` (à tout moment), `GET /cup/:id` — vérifier : tests de route.
- [ ] 3.3 `services/sheet-double-validation` (pur) : `missingCoachSubmissions` (exception forfait) — vérifier : tests unitaires.
- [ ] 3.4 `CompetitionSheetRules.doubleValidation` (ligue `false`, coupe = colonne) — vérifier : tests du contexte.
- [ ] 3.5 `validateByCommissioner` refuse `coach_submissions_missing` (409) — vérifier : tests du service et du mapping HTTP.

## 4. Double validation (web)

- [ ] 4.1 Champ partagé « Double validation » dans la création et l'édition de coupe — vérifier : tests des formulaires (défaut, valeur envoyée).
- [ ] 4.2 Feuille : bandeau, bouton du commissaire désactivé avec le côté manquant, soumission ouverte au commissaire-coach — vérifier : tests de rendu + helper pur.

## 5. Intégration

- [ ] 5.1 Contrôles — vérifier : `pnpm --filter @bb/server typecheck`, `pnpm --filter @bb/web typecheck`, Vitest serveur et web verts sur les fichiers touchés.
- [ ] 5.2 `CLAUDE.md` : patron « retrait = suppression d'inscription, classement dérivé » + historique de session.

## Workflow follow-up

- Une branche, commits atomiques par point, PR, surveillance CI et conflits jusqu'au vert.
- Après merge : `/opsx:sync` puis `/opsx:archive`.
