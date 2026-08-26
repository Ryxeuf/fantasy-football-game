# Tasks — Journal d'équipe

## 1. Schéma
- [x] 1.1 Modèle `TeamAuditEvent` (schéma principal) : corrélation + étape, acteur, diff, snapshots, état résultant dénormalisé, index (`teamId,createdAt`), (`correlationId,step`), (`actorUserId,createdAt`), (`action,createdAt`).
- [x] 1.2 Mirror sqlite (colonnes Json → String) + régénération du client sqlite tracké.
- [x] 1.3 Vérifier qu'aucun backfill n'est requis (`prisma db push` en prod, journal initialement vide).

## 2. Contexte d'audit ambiant
- [x] 2.1 `utils/audit-context.ts` : `AsyncLocalStorage`, `createAuditContext`, `runWithAuditContext`, `runAsAuditJob`, `setAuditActor`, `nextAuditStep`, `resolveActorRole` (pur).
- [x] 2.2 `middleware/auditContext.ts` monté après `requestContext()` dans `index.ts`.
- [x] 2.3 `authUser` / `optionalAuthUser` appellent `setAuditActor` après vérification du token.
- [x] 2.4 Tests d'isolation entre requêtes concurrentes + dégradation hors contexte.

## 3. Service d'écriture
- [x] 3.1 `captureTeamState` (tolérant : rend `null` plutôt que de propager).
- [x] 3.2 `diffTeamState` (pur) + `countAdvancements` (tolérant CSV JSON / tableau).
- [x] 3.3 `recordTeamAudit` (sérialisation Json→String, acteur explicite prioritaire sur l'ambiant) + `safeRecordTeamAudit`.
- [x] 3.4 `withTeamAudit` (capture → exécute → recapture → journalise ; étape `.failed` sur exception, erreur propagée).
- [x] 3.5 Coupe-circuit `TEAM_AUDIT_DISABLED=1` (court-circuite aussi les lectures).

## 4. Instrumentation
- [x] 4.1 Création : `team-build-handler`, `team-create-from-roster-handler`.
- [x] 4.2 Économie de construction : `creditInitialTreasury`.
- [x] 4.3 VE : `updateTeamValues` (étape écrite seulement si VE ou VEA a bougé) + `updateTreasuryAfterMatch`.
- [x] 4.4 Coach : achats (`team-purchase-handler`), roster (`team-roster-save-handler`), infos/staff et renommage (`team-mutation-handlers`), joueurs (`team-player-handlers`), compétences et caractéristiques (`team-player-skills-handler`), pool de PSP et annulation d'amélioration (`team-advancement-editing`), Star Players (hire + release), suppression (`team-delete`).
- [x] 4.5 Ligue : économie d'après-match (`league-offline-result`), annulation de saisie (`league-offline-edit`), achats d'après-match (`league-offline-purchases`), mécène (`league-patron`).
- [x] 4.6 Commissaire : greffe unique dans `appendAudit` (+ `beforeSnapshot` sur trésorerie, staff, Ligue régionale, retrait de joueur).
- [x] 4.7 Statuts joueur : `applyPlayerStatus` / `revertPlayerStatus`.

## 5. Garde CI
- [x] 5.1 `team-audit-coverage.test.ts` : ratchet sur `services/` + `routes/`, regex couvrant aussi la forme castée `(prisma as any).teamPlayer…`.
- [x] 5.2 Exemptions justifiées, vérification qu'aucune n'est obsolète.

## 6. Lecture
- [x] 6.1 `services/team-audit-read.ts` : `parseJsonColumn` (PG/sqlite), `summarizeAuditEvent` (français, marque les échecs), `buildTeamAuditWhere`, `listTeamAuditEvents` (page bornée).
- [x] 6.2 `routes/team-audit-handlers.ts` : `parseTeamAuditQuery` (pur), `resolveJournalAccess` (coach / admin / commissaire), masquage de l'IP hors admin.
- [x] 6.3 `GET /team/:id/journal` monté dans `routes/team.ts`.

## 7. UI
- [x] 7.1 `journal-format.ts` (pur) : regroupement par opération, cumuls, libellés de champs, unités en or.
- [x] 7.2 Page `/me/teams/[id]/journal` : cartes dépliables, diff, état résultant à chaque étape, filtres action / « uniquement l'or et la VE », pagination.
- [x] 7.3 Liens depuis la fiche d'équipe (coach) et `/admin/teams` (admin).

## 8. Doc
- [x] 8.1 `docs/team-audit-journal.md` (mode d'emploi debug + ajout d'un nouveau flux).
- [x] 8.2 Mémoire `CLAUDE.md` : pattern du journal + contexte ambiant.

## 9. Recherche transversale admin
- [x] 9.1 `services/team-audit-search.ts` : `buildAdminAuditWhere` / `buildAdminAuditOrderBy` (purs), capacités provider INJECTÉES (`mode: insensitive` PG-only, `string_contains` vs `contains` sur les colonnes JSON).
- [x] 9.2 `resolveTeamIdFilter` (nom d'équipe / propriétaire → ids, borné) et `attachTeamContext` (jointure équipe+coach en UN aller-retour, contexte `null` si l'équipe est purgée).
- [x] 9.3 `summarizeAuditActivity` : agrégats `groupBy` par action / rôle / équipe, avec les nets de trésorerie et de VE.
- [x] 9.4 Exports purs `toCsv` (RFC 4180, BOM ajouté par la route, garde anti-formule sur les CHAÎNES seulement) et `toNdjson`.
- [x] 9.5 `schemas/admin-team-journal.schemas.ts` : coercition et bornes ; les handlers ne recastent jamais `req.query`.
- [x] 9.6 `routes/admin-team-journal.ts` : `/`, `/stats`, `/export`, `/facets` ; monté AVANT `/admin` pour éviter une double passe d'authentification.
- [x] 9.7 Client web `lib/teamJournal.ts` : `buildJournalQuery` pur (omission des filtres vides, borne de fin étendue à la journée, seuils kpo → po), téléchargement par Blob (l'endpoint exige un Bearer).
- [x] 9.8 Page `/admin/team-journal` : formulaire brouillon/appliqué, tableau parcourable, détail dépliable, rebond sur la corrélation, panneau d'agrégats à la demande, exports.
- [x] 9.9 Entrée de navigation « Journal des équipes » dans le layout admin.
