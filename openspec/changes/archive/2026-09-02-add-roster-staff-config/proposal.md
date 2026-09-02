# Config staff d'équipe en base, par roster et par format (BB11 / BB7)

## Why

Les valeurs de staff d'une équipe (coût de relance, plafond de relances,
apothicaire autorisé + coût, cheerleaders, coachs assistants, fans dévoués —
plafonds et coûts) n'étaient **pas** en base : elles étaient codées en dur et
éparpillées dans le package pur `@bb/game-engine` :

- [`reroll-costs.ts`](../../../packages/game-engine/src/rosters/reroll-costs.ts) — `REROLL_COSTS` (coût relance par slug).
- [`formats.ts`](../../../packages/game-engine/src/rosters/formats.ts) — `FORMAT_CONSTRAINTS` (plafonds + coûts unitaires par format, en kpo).
- [`apothecary-access.ts`](../../../packages/game-engine/src/rosters/apothecary-access.ts) — `APOTHECARY_FORBIDDEN_ROSTERS` (apothicaire par roster).
- [`team-value-calculator.ts`](../../../packages/game-engine/src/utils/team-value-calculator.ts) — `calculateStaffCost` **hardcodait 10k/50k en po et ignorait le format Sevens** (bug).

Conséquence : impossible de régler ces valeurs depuis l'admin
(`/admin/data/rosters/:id/edit`), et les coûts ne pouvaient pas différer par
roster ni par format au-delà du multiplicateur Sevens global.

## What Changes

- **Modèle** `RosterStaffConfig` (1 ligne par roster × format, coûts en **po**),
  back-relation `staffConfigs` sur `Roster`. Migration additive + mirror sqlite.
- **Package pur paramétrable, rétro-compatible** : `team-value-calculator`
  accepte un `staffConfig` optionnel ; `validateFormatSelection` accepte des
  `StaffLimits` par roster ; `defaultStaffConfig(slug, format)` dérive la config
  des constantes historiques — **source unique** du seed ET du fallback. Pour
  `bb11` sans config, les valeurs dérivées sont identiques à l'historique.
- **Seed/backfill** create-only (idempotent, n'écrase pas l'admin) + intégré au
  seed principal.
- **Résolution serveur** `resolveStaffConfig{ByRosterId,BySlug}` (DB → fallback).
- **Admin** : `GET /admin/data/rosters/:id` expose `staffConfigs` ;
  `PUT /admin/data/rosters/:id/staff-config` upsert les 2 formats ; UI : section
  « Staff par format » (deux colonnes BB11 / BB7) sur la page d'édition roster.
- **Consommateurs serveur (autoritaires) rebranchés** : `team-build-handler` et
  `team-purchase-handler` lisent les coûts/plafonds/autorisation apothicaire
  depuis la config résolue. Corrige le bug Sevens.
- **API publique** : `GET /api/rosters` et `/api/rosters/:slug` exposent
  `staffConfigs` par format. **Builder web** (`me/teams/new`) consomme la config
  (coûts, plafonds, validation, toggle apothicaire).

## Out of scope (suivi)

- Vues d'équipe **en lecture seule** (`exportPDF`, `TeamDetailClient`,
  `TeamInfoDisplay`, `TreasuryPurchasePanel`) : utilisent encore les défauts
  `@bb/game-engine` (corrects pour bb11). Refléter les surcharges admin y
  demande de porter la config résolue sur le payload d'équipe — petit suivi.
- Pas de transition de schéma sur `Team` (les colonnes staff de l'équipe sont
  inchangées) ; pas de nouveau format.

## Impact

- **Capability** : `roster-staff-config` (nouvelle).
- **Migration** : `20260625120000_add_roster_staff_config` (additive) + seed.
- **Tests** : game-engine (`staff-config`, `team-value-calculator`, `formats`),
  serveur (`roster-staff-config`, `admin-data.schemas`, handlers build/purchase).
