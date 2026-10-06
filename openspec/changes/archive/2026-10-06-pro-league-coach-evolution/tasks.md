# Tasks — l'évolution persistée du coach

Un commit atomique par groupe, tests avec chaque point.

## 1. Sim-engine (pur)
- [x] 1.1 `coach/adaptation.ts` : récompense, mémoire EMA, influence des
      stratégies, pas borné, rappel vers l'ancre, raisons ; test « trois
      saisons » qui vérifie la borne quoi qu'il arrive.
- [x] 1.2 `coach.ts` : suivi des drives (possession, tours, turnovers, issue),
      `report()` ; forme par joueur (`formPenalty`, température).
- [x] 1.3 `SimRosterPlayer.form`, `SimResult.coachReport`,
      `ReplayJournal.profiles` ; `ENGINE_VER 0.30.0`, baseline et changelog.

## 2. Serveur
- [x] 2.1 Prisma `ProCoach` + `ProCoachMemory` (+ miroir SQLite).
- [x] 2.2 `pro-coach-profile.ts` (pur) : nom, philosophie, relecture JSON,
      résumé ; tests.
- [x] 2.3 `pro-coach.ts` : create-if-missing, profil vivant, adaptation en
      transaction + journal, réglage admin = ancre, reset, évolution
      best-effort par côté ; tests Prisma mockés.
- [x] 2.4 `pro-roster-form.ts` : momentum → forme, écriture en transaction ;
      tests.
- [x] 2.5 Runner : profil du coach, forme dans le roster, évolution après le
      commit (jamais pour un match de test, jamais bloquante) ; tests.
- [x] 2.6 Routes admin `/teams/:id/coach` (GET, PATCH, reset, memory) avec
      Zod partiel ; section `coach` de la fiche publique (optionnelle) ; tests.

## 3. Web
- [x] 3.1 `CoachPanel` admin : ancre sur 15 curseurs, vivant en regard, nom,
      philosophie, reset, journal ; garde-fou des paramètres relu dans la
      source du moteur ; tests.
- [x] 3.2 `TeamCoachSection` publique ; tests.

## 4. Docs
- [x] 4.1 Change OpenSpec, récit de session, CLAUDE.md, changelog.

## Suites (hors lot, à remonter dans `docs/roadmap/backlog/openspec-suites.md`)
- [ ] S.1 Gazette : un paragraphe « le coach » par match à partir du résumé
      d'évolution (`ProCoachMemory.summary`).
- [ ] S.2 Comparer deux coachs d'une même race après une saison (console
      admin) ; alerte si un profil reste collé à une borne de la bande.
- [ ] S.3 Relire l'historique (`ProCoachMemory`) pour recalculer la mémoire
      si la règle d'adaptation change (script `db:replay-coach-memory`).
