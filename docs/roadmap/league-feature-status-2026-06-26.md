# Point de suivi — Gestion de Ligue & Feuille de Match (26/06/2026)

Audit de la feuille de route FR1–FR18 (PDF « Log de suivi de validation »).
État réel **backend vs UI web**, vérifié dans le code.

## Constat transversal

Le **backend (services + routes + Prisma) est très complet**. Le point faible
est l'**UI web** : plusieurs fonctions « indispensables » existent côté serveur
mais n'ont aucune interface (poules, gestion des PO, édition d'équipe par le
commissaire). La **feuille de match (FR7→FR16) est le bloc le plus abouti**
(backend + UI). Tout est **gaté par feature flags** (`league`,
`league_match_sheet`, `league_leaderboards`, `league_invitations`,
`league_bonus_points`) → implémenté ≠ activé en prod.

## Tableau de synthèse

| FR | Criticité | Backend | UI | État |
|----|-----------|:--:|:--:|------|
| FR1 — Retirer une équipe avant saison | Souhaitable | ✅ | ⚠️ | Quasi (statut affiché, bouton retrait non trouvé) |
| FR2 — Multi-poules + qualif PO | Indispensable | ✅ | ❌ | Backend seul |
| FR3 — Modifier participants des PO | Indispensable | ✅ | ❌ | Backend seul |
| FR4 — Saisie / génération calendrier | Indispensable | ✅ | 🟡 | Génération OK ; saisie manuelle backend seul |
| FR5 — Planning par journée et par poule | Indispensable | ✅ | 🟡 | Par journée OK ; par poule absent |
| FR6 — Classements par poule | Indispensable | ✅ | 🟡 | Global OK ; by-pool backend prêt, pas affiché |
| FR7 — Joueurs saisissent la FDM | Indispensable | ✅ | ✅ | Implémenté |
| FR8 — Double validation + notif commissaire | Souhaitable | ✅ | ✅ | Implémenté |
| FR9 — Validation commissaire → effets | Indispensable | ✅ | ✅ | Implémenté |
| FR10 — Valider/invalider tant que pas rejoué | Indispensable | ✅ | ✅ | Implémenté |
| FR11 — Commissaire modifie toute la FDM | Indispensable | ✅ | ✅ | Implémenté |
| FR12 — Commissaire modifie les équipes des coachs | Indispensable | ✅ | ❌ | Backend seul |
| FR13 — FDM en 4 sections | Indispensable | ✅ | ✅ | Implémenté |
| FR14 — Section Avant-match | Indispensable | ✅ | ✅ | Implémenté (réserve « cash +50k ») |
| FR15 — Section Pendant le match | Indispensable | ✅ | ✅ | Implémenté |
| FR16 — Section Après-match | Indispensable | ✅ | ✅ | Implémenté (progression sur /level-up) |
| FR17 — Paramétrer coups de pouce de la ligue | Souhaitable | ❌ | ❌ | Absent |
| FR18 — Page stats ligue (équipe + joueur, top 5) | Indispensable | 🟡 | 🟡 | Partiel |

## Détails partiels / manquants

- **FR2/5/6 — Poules** : backend complet (`league-pool.ts` : CRUD, snake-draft,
  `qualifiesForPlayoffs` ; `generateMultiPoolRoundRobin` ; `/standings?byPool=true`).
  Routes montées (`/seasons/:id/pools` GET/POST, `/pools/assign`, `/pools/auto-assign`,
  `/pools/:id` PATCH/DELETE). **Aucune UI** (zéro référence « pool » dans `apps/web/app/leagues`).
- **FR3 — PO** : `overridePlayoffParticipants` + route
  `PATCH /seasons/:id/playoff-bracket/participants`. `PlayoffBracketView` en lecture seule.
- **FR12 — Édition commissaire** : routes `commissioner-team-edit`
  (`/leagues/:lid/teams/:tid/players/:pid/skills|characteristic`, `/treasury`, SPP + audit).
  Aucune UI ne les appelle.
- **FR18 — Stats** : page `seasons/[sid]/leaderboards` (global + par équipe, topN), 7 catégories.
  Manquent : Killer, Agresseur, Lanceur de coéquipier (catégories dédiées) ;
  « sac de frappe » = proxy `nigglingInjuries` ; scope carrière (pas par saison) ;
  page non liée depuis la vue saison.
- **FR14/16 — réserves** : « cash +50k équipe faible » non codé (cagnotte = différence VAE) ;
  progression des joueurs sur `/level-up` post-validation (pas dans la FDM).

## Plan d'action priorisé

**P1 — Indispensables, backend prêt → surtout du front : ✅ LIVRÉ (26/06/2026)**
1. ✅ UI Poules (FR2+5+6) : `PoolsManagerPanel` (CRUD + affectation + snake-draft),
   calendrier groupé par poule (`SeasonCalendar`), classements par poule
   (`/standings?byPool=true`), badges poule sur les participants.
2. ✅ UI Override participants PO (FR3) : éditeur de seeds dans `PlayoffBracketView`
   (`PATCH …/playoff-bracket/participants`), visible tant qu'aucun match PO n'est lancé.
3. ✅ UI Édition d'équipe commissaire (FR12) : `CommissionerTeamEditor` (trésorerie,
   SPP, compétences ±, caractéristiques ±) + nouvel endpoint lecture
   `GET /leagues/:lid/teams/:tid/roster`.
4. ✅ Stats FR18 : page liée depuis la saison ; catégories **Killer** + **Agresseur**
   ajoutées (agrégation `LeagueMatchEvent` par saison). « Sac de frappe » reste un
   proxy `nigglingInjuries` ; **Lanceur de coéquipier (Catapulte)** non traçable
   (aucun event `team_throw` — nécessiterait un nouveau type d'event).

**P3 (partiel) :** ✅ FR1 — bouton « Se retirer » (coach, avant démarrage,
`POST /seasons/:sid/leave`).

**Reste à faire :**
- FR4 : exposer la **saisie manuelle** de matchs (`league-manual-pairing` prêt côté
  serveur, pas d'UI).
- FR14 : clarifier/implémenter la règle « cash +50k » (actuellement cagnotte = diff VAE).
- FR16 : décider si la progression se saisit dans la FDM (aujourd'hui sur `/level-up`).
- FR17 : config des coups de pouce au niveau ligue — **nécessite une migration Prisma**
  (nouveau modèle), non incluse ici pour ne pas mêler une migration à ce lot UI.
- FR18 (suite) : catégorie « Catapulte » (ajouter un event `team_throw`) ; passer
  « sac de frappe » sur les events ; scope par-saison pour les compteurs career.

## Composants/fichiers ajoutés (P1)

- `apps/web/app/leagues/[id]/PoolsManagerPanel.tsx`
- `apps/web/app/leagues/[id]/CommissionerTeamEditor.tsx`
- `apps/web/app/leagues/[id]/PlayoffBracketView.tsx` (éditeur de seeds)
- `apps/web/app/leagues/[id]/SeasonCalendar.tsx` (groupement par poule)
- `apps/server/src/services/commissioner-team-edit.ts` (`getTeamForEdit`)
- `apps/server/src/services/league-player-stats.ts` (killers/aggressors)

## Fichiers clés

- Backend ligue : `apps/server/src/services/league*.ts`, `apps/server/src/routes/league.ts`
- UI ligue : `apps/web/app/leagues/[id]/*` (page, SeasonCalendar, SeasonStandings,
  SeasonAdminPanel, SeasonParticipants, PlayoffBracketView), `seasons/[sid]/leaderboards`
- FDM : `league-match-sheet.ts`, `league-offline-result.ts`, `leagues/pairings/[id]/sheet/`
