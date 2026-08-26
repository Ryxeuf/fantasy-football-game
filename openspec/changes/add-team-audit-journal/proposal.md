# Journal d'équipe : tracer chaque modification, son auteur et son résultat

## Why

Des écarts de **trésorerie** et de **valeur d'équipe (VE/VEA)** sont observés
en ligue sans qu'aucune source ne permette de les reconstituer :

- `AuditLog` ne trace que les actions **admin** (`recordAdminAction` est appelé
  depuis `routes/admin*.ts` uniquement). Un achat de coach, une économie
  d'après-match ou un recalcul de VE n'y figurent jamais.
- `appendAudit` (commissaire) écrit bien dans `AuditLog`, mais indexé par
  **admin et par action**, pas par équipe : impossible de lire la frise d'une
  équipe donnée.
- `TeamPlayerStatusEvent` ne couvre que morts et licenciements.
- Aucune source ne stocke **l'état résultant** : même en devinant l'ordre des
  mutations, on ne sait pas quelle trésorerie ni quelle VE chaque étape a
  produites.

Or une seule requête HTTP produit **plusieurs** écritures en cascade — un achat
de joueur débite la trésorerie (`team-purchase-handler`) *puis* déclenche
`updateTeamValues` qui réécrit `teamValue`/`currentValue`. Sans la séquence
ordonnée et son résultat à chaque pas, un chiffre faux est indiscernable d'un
chiffre juste calculé sur un état intermédiaire faux.

## What Changes

- **Modèle** `TeamAuditEvent` : journal **append-only** par équipe. Porte
  l'auteur (`actorUserId` + `actorRole` + `actorLabel` figé + `impersonatorId`),
  l'acte (`action` en dot-case, `details`), le diff (`changes`), les snapshots
  `before`/`after`, et l'**état résultant** dénormalisé (`treasury`,
  `teamValue`, `currentValue`, `treasuryDelta`, `teamValueDelta`).
  `correlationId` (= `requestId` HTTP) + `step` regroupent et ordonnent les
  étapes d'une même opération. Additif, mirroré sqlite, **lisible sans
  backfill** (le journal démarre vide, aucune colonne de gating).
- **Contexte d'audit ambiant** (`utils/audit-context.ts`, `AsyncLocalStorage`)
  posé par un middleware Express monté juste après `requestContext()`, et
  rempli par `authUser`/`optionalAuthUser` (`setAuditActor`). Évite de threader
  `{ userId, ip, requestId }` sur des dizaines de signatures. `runAsAuditJob`
  couvre les jobs et scripts.
- **Service d'écriture** (`services/team-audit.ts`) : `captureTeamState`
  (snapshot complet équipe + staff + joueurs + Star Players), `diffTeamState`
  (pur), `recordTeamAudit` / `safeRecordTeamAudit` (résilient : l'échec du
  journal ne fait jamais échouer une mutation committée) et `withTeamAudit`
  (capture → exécute → recapture → journalise, y compris une étape `.failed`
  quand la mutation lève).
- **Instrumentation de tous les flux** qui touchent le roster, le staff, la
  trésorerie ou la VE : création (build + from-roster), sauvegarde de roster,
  achats entre matchs, staff, joueurs (ajout/retrait/identité), améliorations
  et pool de PSP, Star Players, suppression d'équipe, crédit du reliquat de
  budget, **recalcul de VE**, économie d'après-match de ligue et son
  annulation, achats d'après-match, mécène, statuts joueur (mort/licenciement
  et leur reversion). Les actions **commissaire** sont miroitées en une seule
  greffe dans `appendAudit`.
- **Garde CI** `team-audit-coverage.test.ts` : ratchet qui fait échouer tout
  module de `services/`/`routes/` écrivant sur `Team`/`TeamPlayer`/
  `TeamStarPlayer` sans journaliser, sauf exemption justifiée. Le journal ne
  vaut que s'il est exhaustif ; c'est cette garde qui l'en empêche de dériver.
- **Lecture** : `services/team-audit-read.ts` (parsing tolérant PG/sqlite,
  résumés français, `where` testable, pagination bornée à 200) +
  `GET /team/:id/journal` — coach propriétaire, admin, ou commissaire d'une
  ligue où l'équipe est inscrite. L'IP de l'acteur n'est servie qu'aux admins.
- **UI** : page `/me/teams/[id]/journal` — une carte par opération, dépliable
  en étapes, avec le diff et l'état résultant à chaque pas. Liens depuis la
  fiche d'équipe (coach) et depuis `/admin/teams` (admin).
- **Coupe-circuit** d'exploitation `TEAM_AUDIT_DISABLED=1` (le journal ajoute
  une lecture d'état par mutation ; il doit pouvoir être coupé sans déploiement).

## Out of scope (suivi)

- **Rétention / purge** du journal : la table croît sans plafond. À cadrer une
  fois le volume réel observé (candidat : purge des étapes non économiques
  au-delà de N mois).
- **Vue transversale admin** (« toutes les équipes, filtré par action ») :
  aujourd'hui l'entrée admin se fait équipe par équipe depuis `/admin/teams`.
- **Détection automatique d'anomalie** (alerte sur un saut de trésorerie sans
  étape correspondante) : les colonnes dénormalisées la rendent possible, elle
  n'est pas implémentée.
- Les mutations de match **en cours** (`move-processor`) restent hors journal :
  ce n'est pas de l'état de roster persistant.

## Impact

- **Capability** : `team-audit-journal` (nouvelle).
- **Schéma** : `TeamAuditEvent` (additif, `prisma db push`, pas de migration
  versionnée — cf. `prisma/migrations/` gitignoré) + mirror sqlite régénéré.
- **Perf** : chaque mutation journalisée ajoute 1–2 lectures d'équipe + 1
  insert. Acceptable sur des flux pilotés par un coach ; le coupe-circuit
  couvre le cas contraire.
- **Tests** : `team-audit` (18), `team-audit-read` (13), `audit-context` (8),
  `team-audit-handlers` (13), `team-audit-coverage` (3, ratchet),
  `journal-format` web (15).
