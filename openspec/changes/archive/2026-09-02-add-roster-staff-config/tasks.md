# Tasks — Config staff par roster × format

## 1. Schéma & migration
- [x] 1.1 Modèle `RosterStaffConfig` (`@@unique([rosterId, format])`) + relation `Roster.staffConfigs` (schéma principal).
- [x] 1.2 Mirror sqlite (`apps/server/prisma/sqlite/schema.prisma`) + régénérer le client sqlite tracké.
- [x] 1.3 Migration additive `20260625120000_add_roster_staff_config` ; `prisma db push` + `generate` (conteneur + hôte).

## 2. game-engine (pur, paramétrable, fallback)
- [x] 2.1 `staff-config.ts` : type `RosterStaffConfig` + `defaultStaffConfig(slug, format)` (source seed + fallback).
- [x] 2.2 `team-value-calculator` : `staffConfig?`/`format?` optionnels ; coûts résolus ; bb11 sans config == historique.
- [x] 2.3 `formats.ts` : `StaffLimits` + `validateFormatSelection({ staffConfig })` (plafonds + apothicaire par roster).
- [x] 2.4 Tests : `staff-config`, `team-value-calculator` (rétro-compat + sevens), `formats` (staffConfig).

## 3. Seed / backfill
- [x] 3.1 `scripts/seed-roster-staff-config.ts` (create-only, idempotent, `--dry-run`) + fonction exportée.
- [x] 3.2 Appel depuis `seed.ts` après le seed des rosters.

## 4. Service serveur
- [x] 4.1 `services/roster-staff-config.ts` : `resolveStaffConfig{ByRosterId,BySlug}` (DB → fallback) + tests.

## 5. Admin
- [x] 5.1 `updateRosterStaffConfigSchema` (Zod) + tests.
- [x] 5.2 `GET /admin/data/rosters/:id` inclut `staffConfigs` ; `PUT /admin/data/rosters/:id/staff-config` (upsert 2 formats, audit).
- [x] 5.3 UI : section « Staff par format » (colonnes BB11 / BB7) sur la page d'édition roster.

## 6. Consommateurs
- [x] 6.1 `team-build-handler` : coûts/plafonds/apothicaire depuis la config résolue.
- [x] 6.2 `team-purchase-handler` : idem (reroll ×2, cheerleader, assistant, apothicaire).
- [x] 6.3 API publique `GET /api/rosters[/:slug]` expose `staffConfigs`.
- [x] 6.4 Builder web `me/teams/new` consomme la config (coûts, plafonds, validation, apothicaire).
- [x] 6.5 Vues lecture-seule équipe « me » : `GET /team/:id` expose `staffConfig`
      résolu ; `[id]/page`, `TeamInfoDisplay`, `TeamInfoEditor`,
      `TreasuryPurchasePanel`, `exportPDF` l'utilisent (repli défaut historique).
      Reste sur les défauts : page publique `teams/[slug]` (`TeamDetailClient`).

## 7. Vérification
- [x] 7.1 tsc (game-engine, server, web) ; `make check-shadow`.
- [x] 7.2 Tests verts (game-engine + server ciblés).
- [x] 7.3 Seed appliqué en dev (122 lignes) + idempotence vérifiée.
- [ ] 7.4 Staging/prod : `prisma db push` + `seed-roster-staff-config` après déploiement.
