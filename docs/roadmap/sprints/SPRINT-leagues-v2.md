# SPRINT Ligues v2 — Gestion complete des ligues Blood Bowl

> Statut : A faire (priorite haute, demarre apres S27 ou en parallele si capacite)
> Duree cible : ~12 jours (decoupable en 3 PR principaux : MVP / Jeu en Ligue / Polish)
> Theme : transformer l'infrastructure ligues existante (Sprint 17 archive) en
> produit utilisable par les coachs (creation, inscription, calendrier
> automatique, forfait, post-match Jeu en Ligue, awards de fin de saison).
> Pre-requis : aucune dependance bloquante. Reutilise l'infrastructure
> Sprint 17 (`League`, `LeagueSeason`, `LeagueParticipant`, `LeagueRound`,
> `services/league*.ts`, generateur round-robin, ELO saisonnier).

## Contexte

Le Sprint 17 (archive v1.73, taches L.1-L.9) a livre l'**infrastructure**
ligues : modeles Prisma, routes CRUD, generateur round-robin pur,
integration `recordLeagueMatchResult`, ELO saisonnier, themes mensuels.

**Mais** plusieurs maillons UX/metier manquent pour qu'un coach puisse
reellement gerer une ligue de bout en bout :

- Pas de page de **creation** ni d'edition de ligue cote UI.
- Pas de bouton **"Rejoindre cette saison"** : l'API existe mais n'est
  exposee nulle part.
- Le **generateur round-robin** (`generateRoundRobin`) n'est branche a
  aucune route ni a la persistance : aucun pairing n'est stocke. Les
  rounds existent en DB sans appariement, et les matchs doivent etre
  rattaches a la main via `POST /league/seasons/:id/rounds/:roundId/matches`.
- Aucun **modele de pairing** : impossible d'afficher "Skaven vs
  Lizardmen J3" tant que le match n'a pas ete cree.
- Aucun **forfait automatique** sur deadline depassee.
- Pas de **Jeu en Ligue** post-match : SPP sont calcules mais aucun
  flow level-up / hire-fire / treasury entre 2 matchs de saison.
- Pas d'**awards** ni de **champion** ligue (existe pour Cup, manque
  pour League).

Ce sprint comble ces manques en 3 lots livrables independamment.

## Decoupage en lots

| Lot | Theme | Objectif livrable | Estimation |
|-----|-------|-------------------|------------|
| **L2.A** | MVP ligue jouable | Creer ligue → inscrire equipes → demarrer saison → jouer matchs apparies → classement final | ~5 j |
| **L2.B** | Jeu en Ligue (post-match persistant) | Niveau-up joueurs entre matchs, hire/fire, treasury, lasting injuries appliquees | ~5 j |
| **L2.C** | Polish & long-terme | Awards, champion, playoffs, promotion/relegation, admin, mobile, SEO | ~2 j (extensions optionnelles) |

## Taches

### Lot A — MVP ligue jouable (priorite P0)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| L2.A.1 | Modele Prisma `LeaguePairing` + migration + index | DB | M | [ ] | Nouveau modele : `id, roundId, homeParticipantId, awayParticipantId, matchId? @unique, status enum('scheduled'|'in_progress'|'played'|'forfeit_home'|'forfeit_away'|'cancelled'), scheduledAt?, deadlineAt?, createdAt, updatedAt`. Index `(roundId)`, `(matchId)`, `(deadlineAt, status)`. Backfill : pour chaque `Match.leagueRoundId` existant, creer un `LeaguePairing` retro-actif (status `played` si match `ended`, sinon `in_progress`). |
| L2.A.2 | Service `league-scheduler.ts` (orchestration) | Backend | M | [ ] | `startSeason(seasonId, opts)` : verifie status `draft|scheduled` + min 2 participants, appelle `generateRoundRobin({participantIds: actifs, doubleRoundRobin: opts.doubleLeg})`, persiste `LeagueRound[]` + `LeaguePairing[]` en transaction, fixe `LeagueSeason.status='in_progress'`. Idempotent : refuse si rounds deja crees. `regenerateSchedule(seasonId)` : autorise si saison `scheduled` + aucun match joue. |
| L2.A.3 | Routes saison admin | API | M | [ ] | `POST /league/seasons/:id/open` (draft→scheduled, ouvre inscriptions), `POST /league/seasons/:id/start` (scheduled→in_progress, appelle `startSeason`), `POST /league/seasons/:id/regenerate` (regenere calendrier), `POST /league/seasons/:id/close` (force completion). Toutes reservees au creator de la ligue (verif `requireLeagueCreator(userId, seasonId)`). |
| L2.A.4 | Endpoint creation match depuis pairing | API | S | [ ] | `POST /league/pairings/:id/match` : valide que le pairing est `scheduled`, que l'utilisateur appelant possede une des 2 equipes, cree le `Match` avec les bons `TeamSelection`, met le pairing en `in_progress`, lie `Match.leagueSeasonId/leagueRoundId/leaguePairingId`. Empeche les doublons. |
| L2.A.5 | Liaison pairing → recordLeagueMatchResult | Backend | S | [ ] | Etendre `recordLeagueMatchResult` pour mettre a jour `LeaguePairing.status='played'` quand le match est compte. Verifier `roundCompleted` sur la base des pairings (et plus seulement des matchs), pour que les forfaits comptent comme termines. |
| L2.A.6 | Page `/leagues/new` (creation) | Frontend | M | [ ] | Formulaire React avec : nom (req), description, ruleset (radio S2/S3), public/prive (toggle), maxParticipants (number 2-32), allowedRosters (multi-select rosters chargeable depuis `/public-rosters`), config points (winPoints/drawPoints/lossPoints/forfeitPoints), bouton "Creer". Redirige vers `/leagues/:id` au succes. Validations Zod cote front + erreurs API affichees. |
| L2.A.7 | Page edition ligue tant que `status=draft` | Frontend | S | [ ] | Bouton "Modifier" sur `/leagues/:id` visible uniquement par le creator quand `status=draft`. Reutilise le formulaire L2.A.6 prefille. Endpoint `PATCH /league/:id` (additif, idempotent, reset interdit). |
| L2.A.8 | UI creation saison + admin saison | Frontend | M | [ ] | Sur `/leagues/:id`, bouton "Nouvelle saison" (creator only). Modale avec : nom (defaut "Saison N+1"), seasonNumber (auto), startDate?, endDate?, theme/themeYear (optionnels), doubleRoundRobin (toggle). Apres creation, panneau admin saison avec boutons "Ouvrir inscriptions" / "Demarrer la saison" / "Cloturer" gates par status. |
| L2.A.9 | UI "Rejoindre cette saison" | Frontend | M | [ ] | Sur la saison active (status `draft|scheduled`) : bouton "Inscrire une equipe" (visible aux non-creator authentifies). Modale qui liste les equipes de l'utilisateur filtrees par `allowedRosters` + `ruleset`, avec message clair si aucune ne matche ("Cree une equipe Skaven, Gnome, Lizardmen, Dwarf ou Imperial Nobility"). Appelle `POST /league/seasons/:id/join`. Bouton symetrique "Retirer mon equipe" si deja inscrit. |
| L2.A.10 | UI calendrier avec pairings | Frontend | M | [ ] | Refonte `SeasonCalendar.tsx` : pour chaque round, afficher les pairings `home vs away`, badge status, bouton "Lancer le match" (appelle L2.A.4) si l'utilisateur courant possede une des 2 equipes et le pairing est `scheduled`, lien vers le match si `in_progress`, score si `played`, badge "Forfait" si `forfeit_*`. |
| L2.A.11 | Forfait automatique sur deadline | Backend | M | [ ] | Cron job `apps/server/src/jobs/league-forfeits.ts` (executable via Docker schedule ou node-cron). Toutes les heures : selectionne pairings `scheduled` ou `in_progress` avec `deadlineAt < now()` et aucun `Match.leagueScoredAt`. Pour chaque : decide le forfait selon politique (a definir : "no-show des deux cotes" = no-contest 0-0 ; "un seul cote a cree le match" = forfait pour l'absent). Appelle un nouveau service `recordForfeit(pairingId, side)` qui ecrit un resultat 0-2 / 2-0 + `forfeitPoints` selon `League.forfeitPoints`. Idempotent via `LeaguePairing.status`. |
| L2.A.12 | Notifications round/forfait | Backend + UI | S | [ ] | Integrer `expo-push-notifications` + e-mail (best effort) : "Vous avez ete apparie a {coach} pour la J{n}, deadline {date}". Reminder J-3 et J-1. Toggle `roundReminderNotification` dans `NotificationPreference`. |
| L2.A.13 | Tests E2E Playwright "MVP ligue jouable" | Tests | M | [ ] | Scenario complet (apps/web/tests/e2e/leagues-mvp.spec.ts) : user A cree une ligue → user B/C/D inscrivent leurs equipes → A demarre la saison → 6 matchs joues round par round → classement final correct → champion identifie. Garde-fou anti-regression. |

### Lot B — Jeu en Ligue (post-match persistant) (priorite P1)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| L2.B.1 | Modele `LeaguePostMatchSequence` + suivi etat | DB | M | [ ] | Nouveau modele : `id, matchId @unique, seasonId, status enum('pending'|'awaiting_choices'|'completed'), winningsApplied bool, lastingInjuriesApplied bool, advancementsResolved bool, treasuryDeltaA int, treasuryDeltaB int, fanFactorDeltaA int, fanFactorDeltaB int, createdAt, completedAt?`. Stocke aussi un JSON `pendingChoices` (joueurs en attente de choix d'amelioration). Idempotence garantie par contraintes. |
| L2.B.2 | Service `post-match-league-sequence.ts` | Backend | XL | [ ] | Hook execute par `recordLeagueMatchResult` quand `recorded=true`. Sequence transactionnelle : (a) applique winnings + dedicatedFansChange (deja calcules par game-state) sur `Team.treasury` / `Team.dedicatedFans` ; (b) applique permanent injuries (`TeamPlayer.maReduction` etc., `nigglingInjuries`, `dead=true` si applicable) ; (c) calcule les SPP cumules par joueur, identifie les paliers atteints (6/16/31/51/76/176), genere les `pendingChoices` ; (d) recalcule `Team.teamValue / currentValue`. Cree le `LeaguePostMatchSequence`. Idempotent via flag `completed`. |
| L2.B.3 | Endpoint level-up / choix amelioration | API | M | [ ] | `GET /team/:teamId/pending-advancements` : liste les joueurs avec choix en attente. `POST /team/:teamId/players/:playerId/advancement` : body `{type: 'primary'|'secondary'|'random-primary'|'random-secondary', skill?: string, statBoost?: 'ma'|'st'|'ag'|'pa'|'av'}`. Reutilise `packages/game-engine/src/utils/advancements.ts` + valide la categorie eligible pour le poste, met a jour `TeamPlayer.skills` + `advancements` + recalcule `currentValue` + decremente `pendingChoices`. |
| L2.B.4 | UI level-up post-match | Frontend | L | [ ] | Page `/teams/:id/level-up` : liste joueurs en attente, modale par joueur avec 4 options (random skill primary D6+D6 / random secondary / chosen primary 6 PSP / chosen secondary 12 PSP) + selection skill ou stat. Reutilise les helpers `getNextAdvancementPspCost` et `SURCHARGE_PER_ADVANCEMENT`. Banner sur `/leagues/:id` apres match : "Tu as 3 ameliorations en attente". |
| L2.B.5 | UI hire/fire entre matchs ligue | Frontend | L | [ ] | Page `/teams/:id/manage` (refonte/extension de l'edition equipe) avec sections : embaucher rookie (par poste, cout depuis roster), embaucher Star Player (filtree par regional league de la ligue active), vendre/renvoyer un joueur, acheter relance/cheerleader/assistant/apothicaire/dedicated fan, et coup de mecene (max 1 fois par saison). Toutes les operations validees serveur : `POST /team/:id/hire-player`, `POST /team/:id/fire-player`, `POST /team/:id/buy-staff`. Bloque si saison en cours et limites atteintes. |
| L2.B.6 | Funeral & retraites (joueurs morts) | Backend | S | [ ] | Quand `TeamPlayer.dead=true` apres post-match, remplacer automatiquement par un slot vide + ajouter ligne historique "Funeral". Verifier `permanent-injuries.ts` existant et brancher si necessaire. |
| L2.B.7 | Lasting injury au prochain match | Backend | S | [ ] | Service deja existant (`permanent-injuries.ts`) — verifier qu'il est bien declenche par `post-match-league-sequence`. Empeche un joueur `missNextMatch=true` d'etre aligne au prochain match de la saison (validation cote `match-start.ts`). |
| L2.B.8 | Jeu en Ligue : variantes regles "Bagarreurs Brutaux" | Game-engine | S | [ ] | Equipes avec regle speciale "Bagarreurs Brutaux" : 3 PSP par elimination au lieu de 2, 2 PSP par TD au lieu de 3 (cf. extraction_blood_bowl.md). Etendre `services/spp-tracking.ts` pour lire `Team.specialRules` et appliquer le delta uniquement quand `Match.leagueSeasonId != null`. |
| L2.B.9 | Tests integration post-match league | Tests | M | [ ] | `post-match-league-sequence.test.ts` : verifie idempotence (rejouer 2x ne change rien), winnings appliques 1 fois, paliers SPP detectes, flag `dead` honore, special rule "Bagarreurs Brutaux". |

### Lot C — Polish & long-terme (priorite P2)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| L2.C.1 | Service `leagueScoring.ts` + awards fin de saison | Backend | M | [ ] | Symetrique de `cupScoring.ts` : `computeSeasonAwards(seasonId)` retourne `{topScorer, basher, bestDefense, mvpSeason, ...}` derive des matchs joues. Endpoint `GET /league/seasons/:id/awards`. Stocke le snapshot dans nouveau modele `LeagueSeasonAward` quand la saison se cloture. |
| L2.C.2 | Champion : badge titre + page recap | Backend + UI | M | [ ] | Etendre `coach-championships.ts` (deja en place pour cups+themes) : ajouter `leagueChampionships` (saisons gagnees, ligue + saison + annee). Composant `CoachLeagueChampionshipsBanner` sur `/coach/[slug]`. Page `/leagues/:id/seasons/:sid/recap` (publique) avec champion, awards, classement final. |
| L2.C.3 | Format playoff (top N -> bracket) | Backend + UI | L | [ ] | Champ `playoffSize` sur `LeagueSeason` (0 = pas de playoff, 4/8/16 = top N). Quand classement regulier termine, generation auto bracket reutilisant la logique cup bracket (`CupBracketView`). Nouveau modele `LeaguePlayoffMatch` ou reutilisation de la table `Cup`-like. |
| L2.C.4 | Promotion/relegation multi-tier | Backend | L | [ ] | Modele `LeagueTier` (D1/D2/D3) avec `League.tierId`. Service `applyPromotionRelegation(leagueId)` : top 2 montent / bottom 2 descendent au passage de saison. Optionnel : peut etre reporte a un sprint dedie si pas de demande. |
| L2.C.5 | Tie-break configurable | Backend | S | [ ] | Champ `tieBreakRules` JSON sur `League` : ordre de departage configurable parmi `points / td_diff / td_for / head_to_head / season_elo / cas_diff`. Default = ordre actuel (points / td_diff / td_for / season_elo / name). `computeSeasonStandings` lit ce champ. |
| L2.C.6 | Console admin `/admin/leagues` | Frontend | M | [ ] | Liste toutes les ligues (filtres status, public, ruleset), actions : forcer status, transferer creator, archiver, regenerer, supprimer (soft). Reservee `hasRole('admin')`. Ecrit dans `AuditLog` (S27.6). |
| L2.C.7 | Mobile parite ligues | Mobile | L | [ ] | Sur l'app Expo (`apps/mobile/app/leagues/`) : liste, detail saison, calendrier, classement, bouton inscription, bouton "Lancer match" qui redirige vers le flow match existant. Reutilise i18n module S27.3. |
| L2.C.8 | SEO schema.org `Event` saisons publiques | SEO | S | [ ] | Page publique `/leagues/seasons` (existe deja) + `/leagues/:id` exposent un JSON-LD `SportsEvent` par saison : nom, dateDebut/Fin, organizer, location virtuelle, competitors. Reutilise `event-schema.ts` deja present. Ajout au sitemap. |
| L2.C.9 | Archived leagues page | Frontend | S | [ ] | `/leagues/archived` symetrique de `/cups/archived` : filtre status `completed|archived`, paginee, accessible publiquement. |

## Definition of done

### Lot A (MVP)
- [ ] Un coach peut creer une ligue depuis `/leagues/new` sans toucher l'API a la main.
- [ ] Un coach peut inscrire son equipe depuis `/leagues/:id` via le bouton "Rejoindre", filtre `allowedRosters` respecte.
- [ ] Un creator peut "Demarrer la saison" : le calendrier round-robin complet est genere et affiche avec pairings (home vs away par round).
- [ ] Un coach peut "Lancer un match" depuis un pairing scheduled : un `Match` est cree et lie au pairing.
- [ ] La fin du match met a jour automatiquement le classement (deja en place via `recordLeagueMatchResult`) ET le statut du pairing.
- [ ] Forfait automatique declenche par cron a la deadline depassee.
- [ ] Test E2E Playwright "MVP ligue jouable" passe.

### Lot B (Jeu en Ligue)
- [ ] Apres un match de ligue, l'equipe gagnee a vu son `Team.treasury` et `Team.dedicatedFans` mis a jour.
- [ ] Un joueur ayant atteint 6 PSP voit une banner "1 amelioration en attente" et peut choisir une competence.
- [ ] Une lasting injury appliquee en match reduit les stats du joueur de maniere persistante au prochain match.
- [ ] Un coach peut embaucher un rookie / vendre un joueur / acheter une relance entre 2 matchs de saison.
- [ ] Test integration post-match league passe en idempotent (rejouable sans effet).

### Lot C (Polish)
- [ ] Page `/leagues/:id/seasons/:sid/recap` affiche champion + awards + classement final.
- [ ] Console admin `/admin/leagues` permet d'archiver / regenerer / forcer status.
- [ ] Mobile : ecran ligue jouable de bout en bout (lister, inscrire, lancer match).

## Dependances & risques

### Dependances
- L2.A.5 → L2.A.1 (le pairing doit exister avant que `recordLeagueMatchResult` puisse le mettre a jour).
- L2.A.10 → L2.A.4 (l'UI calendrier appelle l'endpoint creation match).
- L2.A.11 → L2.A.1 (le cron lit les pairings `deadlineAt`).
- Lot B suppose que Lot A est livre (les SPP league dependent de `Match.leagueSeasonId`).
- L2.B.4 / L2.B.5 dependent de L2.B.2 (sequence post-match calcule les `pendingChoices`).
- L2.C.2 reutilise `coach-championships.ts` (deja livre par S26.6d).
- L2.C.6 ecrit dans `AuditLog` qui sort en S27.6 — peut commencer sans, mais ideal avec.

### Risques

- **Backfill `LeaguePairing` (L2.A.1)** : risque sur les saisons existantes en prod si la backfill rate des cas. Mitigation : script idempotent + dry-run + couverture par test sur le seeder "Open 5 Teams".
- **Cron forfait (L2.A.11)** : risque de forfait abusif si la deadline est mal communiquee. Mitigation : 2 reminders avant deadline, page UI explicite, possibilite admin de "pardonner" un forfait.
- **Sequence post-match (L2.B.2)** : risque de double comptabilisation si le hook s'execute 2x. Mitigation : flag `LeaguePostMatchSequence.completed` + transaction unique + tests d'idempotence prioritaires.
- **Treasury / hire-fire (L2.B.5)** : risque d'incoherence avec la valeur d'equipe a l'inscription si on autorise l'achat de relances en cours de saison. Mitigation : option `tvCapAtStart` (Lot C), sinon laisser libre comme en regles BB officielles.
- **Bagarreurs Brutaux (L2.B.8)** : verifier que `Team.specialRules` est bien populate pour les rosters concernes avant de modifier le calcul SPP, sinon regression silencieuse.
- **Playoffs (L2.C.3)** : XL si on cree un nouveau modele dedie. Alternative : reutiliser le systeme `Cup` avec un lien `Cup.fromLeagueSeasonId`. A trancher en debut de Lot C.

## Migration / data

- 1 migration Prisma pour Lot A : `LeaguePairing` + champ `Match.leaguePairingId` optionnel.
- 1 migration Prisma pour Lot B : `LeaguePostMatchSequence`.
- 1 migration Prisma pour Lot C : `LeagueSeasonAward`, `LeagueTier?`, `League.playoffSize?`, `League.tieBreakRules?`.
- Seeder etendu : ajouter une 2e ligue d'exemple "Vieux Monde Ouvert" sans restriction `allowedRosters` pour montrer le mode generique.

## Ordre de livraison recommande

1. **PR1 (Lot A.1-A.5)** : modele + scheduler + routes admin saison. Pas d'UI, valide a la main via curl/tests.
2. **PR2 (Lot A.6-A.10)** : UI complete creation/inscription/calendrier. Demo jouable de bout en bout.
3. **PR3 (Lot A.11-A.13)** : forfait + notifications + e2e. MVP ferme.
4. **PR4 (Lot B.1-B.3)** : sequence post-match + endpoints level-up.
5. **PR5 (Lot B.4-B.7)** : UI level-up + hire/fire + funeral + lasting injuries.
6. **PR6 (Lot B.8-B.9)** : Bagarreurs Brutaux + tests integration.
7. **PR7+ (Lot C)** : awards, champion, playoffs, admin, mobile, SEO — etalable.

## Sources

- Audit code 2026-05-04 : analyse `apps/server/src/routes/league.ts`, `services/league*.ts`, `apps/web/app/leagues/`, modele Prisma, tests existants.
- `docs/roadmap/archive/v1.73/TODO.md` Sprint 17 (taches L.1-L.9 archivees).
- `extraction_blood_bowl.md` (regles officielles Saison 3, sections "Jeu en Ligue", "Bagarreurs Brutaux", "Ligues d'equipes").
- `packages/game-engine/src/utils/advancements.ts` (helpers level-up deja en place).
- `apps/server/src/cupScoring.ts` (modele de symetrie pour `leagueScoring.ts`).
- `apps/server/src/services/themed-season-closure.ts` (point d'extension reutilisable pour le champion).
