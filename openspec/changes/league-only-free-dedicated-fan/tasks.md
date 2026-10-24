# Tasks — Fan Dévoué offert réservé aux équipes de ligue

## 1. Règle pure (moteur)

- [ ] 1.1 `packages/game-engine/src/rosters/dedicated-fans.ts` : `includedFreeDedicatedFans`, `paidDedicatedFans`, `dedicatedFansPurchaseCost`, `minDedicatedFans`, `planLeagueFreeFanGrant`, `planLeagueFreeFanRevoke` (`undefined` lu comme `null`), export depuis l'index des rosters — vérifier : tests unitaires en table (`null` / `false` / `true` / `undefined`, 0 fan, plafond → remboursement, reprise : fan, 0 fan, remboursement couvert / non couvert / sans fan).

## 2. Base

- [ ] 2.1 `Team.leagueFreeFan Boolean?`, `LeagueParticipant.freeFanGrant String?`, `LeagueParticipant.freeFanRefund Int?` SANS `@default`, commentaires, dans `prisma/schema.prisma` ET `apps/server/prisma/sqlite/schema.prisma` ; `dedicatedFans @default(1)` conservé — vérifier : `prisma generate` des deux clients (client SQLite de test régénéré et versionné), typecheck serveur.

## 3. Construction (serveur)

- [ ] 3.1 `POST /team/build` : défaut 0, coût `dedicatedFansPurchaseCost(n, prix, false)`, `leagueFreeFan: false` écrit — vérifier : tests du handler (défaut 0, fans facturés, coupe sans fan offert).
- [ ] 3.2 `POST /team/create-from-roster`, `services/ai-practice`, `routes/league-test-data` : `dedicatedFans: 0`, `leagueFreeFan: false` — vérifier : tests existants mis à jour.
- [ ] 3.3 Schémas `team.schemas` (build et mise à jour) et `commissioner-team-edit.schemas` : minimum Zod 0 ; le minimum MÉTIER est appliqué par le handler (`minDedicatedFans`) — vérifier : tests des schémas.
- [ ] 3.4 `team-mutation-handlers` (staff du coach) et `services/commissioner-team-settings` : borne basse = `minDedicatedFans(team.leagueFreeFan)` — vérifier : tests (0 accepté si `false`, refusé si `true` / `null`).
- [ ] 3.5 `team-roster-save-handler` et `services/team-budget-summary` : coût via la règle pure — vérifier : tests (`null` 3 fans = 2 payés, `false` 3 fans = 3 payés).

## 4. Fan offert : octroi et reprise (serveur)

- [ ] 4.1 `services/league-free-fan` : `createLeagueParticipant` (plan pur, transaction team conditionnelle + inscription, journal `team.league_free_fan.granted`) et `withLeagueFreeFanRevoked` (plan pur, transaction reprise + opération de départ, journal `team.league_free_fan.revoked`) — vérifier : tests Prisma mocké (fan, remboursement, rien pour `true` / `null`, course perdue = inscription sans octroi, reprise fan / remboursement / repli fan / rien, passage direct sans inscription concernée).
- [ ] 4.2 `addParticipant` crée l'inscription par `createLeagueParticipant` — vérifier : tests de `league` (octroi, aucun octroi sur refus).
- [ ] 4.3 `withdrawParticipant`, `removeTeamFromLeague`, `removeCoachFromSeason`, suppression de ligue (`competition-lifecycle`) passent par `withLeagueFreeFanRevoked` — vérifier : tests des quatre chemins ; garde `team-audit-coverage` verte.

## 5. Lectures et replis

- [ ] 5.1 Servir `leagueFreeFan` (optionnel) sur les lectures d'équipe consommées par le web (`GET /team/:id`, fiche publique, fiche admin) — vérifier : tests de lecture.
- [ ] 5.2 `routes/local-match` : `dedicatedFans ?? 0` au lieu de `|| 1` — vérifier : test du Facteur de Popularité à 0 fan.

## 6. Web

- [ ] 6.1 Builder `me/teams/new` : défaut 0, minimum 0, coût de chaque fan, mention de la règle de ligue ; clonage `fromTeamId` = fans PAYÉS de la source — vérifier : tests de page.
- [ ] 6.2 `me/teams/staff-cost`, `r/[token]/staff-lines`, `me/teams/[id]/page` (résumé), `TeamInfoDisplay`, `TeamInfoEditor` : règle pure + marqueur servi — vérifier : tests unitaires des helpers et rendu des deux cas.
- [ ] 6.3 Replis `dedicatedFans || 1` (édition, trésorerie, fiche admin) remplacés par `?? 0` — vérifier : rendu d'une équipe à 0 fan.
- [ ] 6.4 Fiche d'une équipe `leagueFreeFan = false` : « +1 offert à l'inscription en ligue » — vérifier : test de rendu.

## 7. Intégration

- [ ] 7.1 Spec e2e-api `tests/e2e-api/specs/league-free-dedicated-fan.spec.ts` : construction (0 fan, budget au prix plein), inscription (+1, journal), retrait (−1), réinscription (+1), équipe à 6 fans (remboursement), construction pour une coupe (aucun fan offert) — vérifier : verte sur SQLite.
- [ ] 7.2 Contrôles — vérifier : typecheck `@bb/game-engine`, `@bb/server`, `@bb/web` ; Vitest des trois paquets verts sur les fichiers touchés.
- [ ] 7.3 `CLAUDE.md` : patron « un compte stocké n'est lisible qu'avec sa règle — marqueur à trois états, reprise par l'inscription qui a accordé » + historique de session.

## Workflow follow-up

- Une branche, commits atomiques par point, PR, surveillance CI et conflits jusqu'au vert.
- Après merge : `/opsx:sync` puis `/opsx:archive`.
- Hors périmètre, à trancher à part : amicaux en ligne qui font évoluer fans et trésorerie (`move-processor`).
