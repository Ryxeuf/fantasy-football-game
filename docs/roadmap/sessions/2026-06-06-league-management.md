# Session Gestion des Ligues — audit "Liste de course Nuffle Arena"

> **2026-06-06** — 3 PRs livrees et auto-mergees (#886, #887, #888)
> couvrant l'integralite de l'audit "gestion des ligues" remonte par
> les premiers utilisateurs prod (fichier _Liste de course pour Nuffle
> Arena_). Toute la surface est derriere des feature flags `league_*`
> pour un rollout au compte-goutte.
>
> Demarrage : audit d'existant (12 points gestion + feuille de match +
> stats) par un agent d'exploration, puis implementation lot par lot.
> La PR #886 a aussi corrige un echec CI pre-existant (reference roster
> High Elf S3 desynchronisee, sans rapport avec la ligue).

## Recap des lots livres

| Lot | Titre | PR | Surface | Besoin (couleur fichier) |
|-----|-------|----|---------|--------------------------|
| **B** | Retrait equipe verrouille apres demarrage saison | #886 | server | 🔴 Indispensable |
| **A** | Invitations coachs (recherche + lien + accept/decline) | #886 | server + web | 🔴 |
| **F** | Saisie manuelle de rounds / pairings | #886 | server | 🔴/🔵 |
| **E** | Points bonus configurables (3 TD / 3 cas / clean sheet…) | #886 | server | 🔴 |
| **C.1** | Multi-poules : schema + CRUD + standings par poule | #886 | server | 🔴 |
| **D** | Override participants playoffs (desistement tardif) | #886 | server | 🔴 |
| **J** | Classements top-N joueurs (+ par equipe) | #886 | server + web | 🔴 / 🔵 |
| **I** | Edition ex-post des equipes par commissaire (audit) | #886 | server | 🔴 |
| **C.2** | Scheduler round-robin par poule (journees partagees) | #887 | server | 🔴 |
| **G.1** | Feuille de match v2 : modele + events + summarizer + FSM | #887 | server | 🔴 |
| **G.2** | Application des effets a la validation (pipeline offline) | #887 | server | 🔴 |
| **G.3** | UI feuille de match fonctionnelle | #887 | web | 🔴 |
| **H** | Alerte commissaire + liste des matchs a valider (cloche) | #887 | server + web | 🟢 Souhaitable |
| **Polish 1** | Panneaux pre/post-match (meteo/pop/inducements/MVP/achats) | #888 | server + web | 🔴 |
| **Polish 2** | Auto-calcul tresorerie (saisissable) | #888 | server + web | 🔴 |
| **Polish 3** | Fenetre d'invalidation post-validation | #888 | server + web | 🔴 |

## Modeles Prisma ajoutes (5)

| Modele | Lot | Migration | Description |
|--------|-----|-----------|-------------|
| `LeagueInvitation` | A | `20260605120000` | Invitation coach (code unique, statut, expiration 1-90j) |
| `LeaguePool` | C.1 | `20260605140000` | Poule d'une saison (qualifiesForPlayoffs, order, color) |
| `LeagueMatchSheet` | G.1 | `20260605160000` | Feuille de match 1-1 pairing (FSM + snapshots pre/post-match) |
| `LeagueMatchEvent` | G.1 | id. | Evenement unitaire normalise (10 kinds) |
| (champs) `League.bonusPointsConfig` | E | `20260605130000` | JSON regles de bonus |
| (champs) `LeaguePairing.bonusPoints*` | E | id. | Snapshot bonus applique + breakdown |
| (champs) `LeagueParticipant.poolId`, `LeagueRound.poolId` | C.1 | `20260605140000` | Rattachement poule (nullable) |

> Mirror SQLite (`apps/server/prisma/sqlite/schema.prisma`) mis a jour
> en parallele pour les colonnes Json -> String (cf. CLAUDE.md "parser
> tolerant PG + sqlite").

## Surfaces backend ajoutees

### Nouveaux services
- `league-invitation.ts` (A) — createInvitation (idempotent), accept/decline/cancel, expireOldInvitations, code crypto-safe.
- `league-manual-pairing.ts` (F) — createManualRound/Pairing, delete/update, garde-fous (doublon, played, round completed).
- `league-bonus-points.ts` (E, **pur**) — evaluateBonusRules + parseBonusConfig (PG/sqlite) + BONUS_PRESETS.
- `league-pool.ts` (C.1) — createPool/update/delete, assign/auto-assign (snake draft), computeSnakeDraftAssignment (pur).
- `league-player-stats.ts` (J) — computeLeaderboards (7 categories), computeLeaderboardsByTeam.
- `commissioner-team-edit.ts` (I) — adjustPlayerSpp/addSkill/removeSkill/adjustCharacteristic/adjustTreasury + AuditLog.
- `league-match-summary.ts` (G.1, **pur**) — summarizeMatchSheet (score/cas/blesses/stats joueurs), computeWinnings (Polish 2).
- `league-match-sheet.ts` (G.1/G.2/H/Polish) — FSM complete + validation (branchee sur recordOfflineLeagueResult) + invalidation (reverse) + pending list + notify commissaire.

### Services etendus
- `league.ts` — withdrawParticipant (LeagueWithdrawError, Lot B), bonusPointsConfig (E), computeSeasonStandingsByPool (C.1).
- `league-scheduler.ts` — buildSchedule (global vs multi-poules, C.2).
- `league-schedule.ts` — generateMultiPoolRoundRobin (pur, C.2).
- `league-playoffs.ts` — overridePlayoffParticipants (D).
- `league-match-result.ts` — application des points bonus (E).
- `notification-preferences.ts` / `push-notifications.ts` — NotificationType.LeagueMatchValidation (H).

### Routes
Toutes montees sous `/leagues` (+ `/admin/leagues` pour le force-withdraw).
Nouvelles familles : invitations, pools, manual pairings, playoff-bracket
override, leaderboards, commissioner team-edit, match sheet
(`/pairings/:id/sheet/*` : get/create/pre-match/post-match/events/
submit/unsubmit/validate/invalidate/can-invalidate), pending-validations.

## Feature flags (8)

`league` (umbrella historique) + 7 sous-flags : `league_invitations`,
`league_bonus_points`, `league_manual_pairings`, `league_pools`,
`league_leaderboards`, `league_commissioner_edit`, `league_match_sheet`.

> Tous OFF par defaut. Strategie d'activation : voir
> [`docs/roadmap/league-feature-flags-rollout.md`](../league-feature-flags-rollout.md).

## Tests

~260 tests ajoutes (majoritairement unit sur services purs + handlers).
Suite ligue verte sur les 3 PRs. Pattern de mock : prisma + services
reutilises mockes (cf. CLAUDE.md). Les fonctions pures (summarizer,
bonus rules, snake draft, winnings, multi-pool generator) sont
testees sans DB.

## Pieges rencontres

- **CI rouge pre-existante (#886)** : `validate-season3-rules.test.ts`
  echouait car le roster High Elf S3 (`season3-rosters.ts`) avait ete
  reecrit sans mettre a jour `season3-reference-data.ts`. Fix : aligner
  la reference sur le roster thematique (source de verite Hauts_elfes.md).
  Lecon : un `.js` compile gitignore peut masquer le `.ts` sous `tsc`
  nu — supprimer les artefacts pour tester contre la source.
- **typedRoutes Next.js** : `Link href={template}` echoue sous `tsc` nu
  (pas de `.next/types`) mais passe au `next build` CI tant que la route
  existe. Verifie en comparant aux pages deja mergees.
- **z.record** : signature 2 args (`z.record(z.string(), z.unknown())`)
  dans la version Zod du repo.

## Addendum 2026-06-25 — "Coup de mecene" opt-in commissaire

Le "coup de mecene" (+100k po, 1x par equipe et par saison, service
`league-patron.ts`) etait disponible par defaut des qu'une saison etait
`in_progress`. Il devient une **option activable par le commissaire**,
desactivee par defaut.

- **Schema** : `LeagueSeason.meceneEnabled Boolean @default(false)`
  (root `prisma/schema.prisma` + mirror `apps/server/prisma/sqlite/`).
- **Service** : `playMecene` rejette avec le code `mecene_disabled`
  (HTTP 400) si `season.meceneEnabled` est faux.
- **Route** : `PATCH /leagues/seasons/:seasonId/config`
  (`updateSeasonConfigSchema`, createur de la ligue uniquement) pour
  basculer `meceneEnabled`.
- **UI** : toggle dans `SeasonAdminPanel` (commissaire) ; le bouton
  `MeceneButton` cote coach n'apparait que si `season.meceneEnabled`.
- **Tests** : `mecene_disabled` (service), gating page, schema config.

## Reste / pistes futures

- Editeurs riches inducements / prieres de Nuffle / achats detailles
  (le backend stocke deja le JSON ; l'UI actuelle couvre le coeur).
- Per-season player stats (les classements Lot J sont sur les totaux
  carriere ; une agregation par-saison via les events de la feuille de
  match v2 serait plus precise — categories killer/catapulte/agresseur
  dependent de ces events).
