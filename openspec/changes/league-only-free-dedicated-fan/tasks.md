# Tasks — Fan Dévoué offert réservé aux équipes de ligue

## 1. Règle pure (moteur)

- [ ] 1.1 `packages/game-engine/src/rosters/dedicated-fans.ts` : `includedFreeDedicatedFans`, `paidDedicatedFans`, `dedicatedFansPurchaseCost`, `minDedicatedFans`, `planLeagueFreeFan` (`undefined` lu comme `null`), export depuis l'index du package — vérifier : tests unitaires en table (`null` / `false` / `true` / `undefined`, 0 fan, plafond atteint → remboursement).

## 2. Base

- [ ] 2.1 `Team.leagueFreeFan Boolean?` SANS `@default`, commentaire trois états, dans `prisma/schema.prisma` ET `apps/server/prisma/sqlite/schema.prisma` ; `dedicatedFans @default(1)` conservé, commentaire « (0-6) » mis à jour — vérifier : `prisma generate` des deux clients, typecheck serveur.

## 3. Construction (serveur)

- [ ] 3.1 `POST /team/build` : défaut 0, coût `dedicatedFansPurchaseCost(n, prix, false)`, `leagueFreeFan: false` écrit — vérifier : tests du handler (défaut 0, 2 fans facturés 2 ×, coupe sans fan offert, plafond).
- [ ] 3.2 `POST /team/create-from-roster`, `services/ai-practice`, `routes/league-test-data` : `dedicatedFans: 0`, `leagueFreeFan: false` — vérifier : tests existants mis à jour.
- [ ] 3.3 Schémas `team.schemas` (build et mise à jour) et `commissioner-team-edit.schemas` : minimum Zod 0 ; le minimum MÉTIER est appliqué par le handler (`minDedicatedFans`) — vérifier : `zod-schemas.test`, tests des schémas commissaire.
- [ ] 3.4 `team-mutation-handlers` (staff du coach) et `services/commissioner-team-settings` : borne basse = `minDedicatedFans(team.leagueFreeFan)`, message citant les bornes — vérifier : tests (0 accepté si `false`, refusé si `true` / `null`).
- [ ] 3.5 `team-roster-save-handler` et `services/team-budget-summary` : coût via la règle pure — vérifier : tests (`null` 3 fans = 2 payés, `false` 3 fans = 3 payés).

## 4. Fan offert au démarrage (serveur)

- [ ] 4.1 `services/league-free-fan` : octroi pour une saison — participants actifs `leagueFreeFan = false`, plan pur, écriture conditionnelle (`updateMany where leagueFreeFan: false`, `{ increment }` sur fans OU trésorerie), journal `team.league_free_fan` via `safeRecordTeamAudit` capturé avant / publié après, échec isolé par équipe — vérifier : tests Prisma mocké (fan, remboursement au plafond, rien pour `true` / `null` / `withdrawn`, course perdue = rien, échec journalisé sans lever).
- [ ] 4.2 Appel depuis `startSeason` et `regenerateSchedule` après le passage `in_progress`, dans un `try/catch` au point d'appel — vérifier : tests du scheduler (appel, démarrage qui réussit malgré un octroi en échec) ; garde `team-audit-coverage` verte.

## 5. Lectures et repli

- [ ] 5.1 Servir `leagueFreeFan` (optionnel) sur les lectures d'équipe consommées par le web : `GET /team/:id`, fiche publique (`public-team-view`), fiche admin, roster de ligue — vérifier : tests de lecture.
- [ ] 5.2 `routes/local-match` : `dedicatedFans ?? 0` au lieu de `|| 1` ; relire `pre-match-automation` et `league-match-sheet` (`?? 1` déjà correct pour 0) — vérifier : test du Facteur de Popularité à 0 fan.

## 6. Web

- [ ] 6.1 Builder `me/teams/new` : défaut 0, minimum 0, coût de chaque fan, mention de la règle de ligue à côté de la ligne ; clonage `fromTeamId` = fans PAYÉS de la source — vérifier : tests de page (défaut, budget « Restant », mention, clonage d'une équipe historique).
- [ ] 6.2 `me/teams/staff-cost`, `r/[token]/staff-lines`, `me/teams/[id]/page` (résumé), `TeamInfoDisplay` (« N achetés »), `TeamInfoEditor` (bornes « 0 à 6 » ou « 1 à 6 », mention du fan offert) : règle pure + marqueur servi — vérifier : tests unitaires des helpers et rendu des deux cas.
- [ ] 6.3 Retirer les replis `dedicatedFans || 1` (édition, trésorerie, fiche admin `admin/users`) au profit de `?? 0` — vérifier : rendu d'une équipe à 0 fan.
- [ ] 6.4 Fiche d'une équipe `leagueFreeFan = false` : « +1 offert au démarrage d'une saison de ligue » — vérifier : test de rendu.

## 7. Intégration

- [ ] 7.1 Spec e2e-api `tests/e2e-api/specs/league-free-dedicated-fan.spec.ts` : construction (0 fan, budget au prix plein), inscription, démarrage (+1, journal), seconde saison (rien), équipe à 6 fans (remboursement), équipe de coupe (aucun fan offert) — vérifier : verte sur SQLite.
- [ ] 7.2 Contrôles — vérifier : typecheck `@bb/game-engine`, `@bb/server`, `@bb/web` ; Vitest des trois paquets verts sur les fichiers touchés.
- [ ] 7.3 Aide du site (`aide/help-catalogue`) si elle décrit la construction ; `CLAUDE.md` : patron « un compte stocké n'est lisible qu'avec sa règle — marqueur à trois états, octroi au point de non-retour » + historique de session.

## Questions ouvertes (à trancher avant / pendant l'implémentation)

- Rattrapage des équipes historiques hors ligue (script d'opérateur en simulation par défaut) — recommandation : non.
- Amicaux en ligne qui font évoluer fans et trésorerie (`move-processor`) — hors de ce change.

## Workflow follow-up

- Une branche, commits atomiques par point, PR, surveillance CI et conflits jusqu'au vert.
- Après merge : `/opsx:sync` puis `/opsx:archive`.
