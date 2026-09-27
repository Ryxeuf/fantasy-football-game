# Tasks — pronostics de ligue

## 1. Serveur : modèle et règles
- [ ] 1.1 Schéma Prisma (PG + miroir SQLite, client SQLite régénéré) :
      `CompetitionPrediction`, `League.predictionsScope`,
      `LeaguePairing.predictionsClosedAt`, `LeagueRound.predictionsNotifiedAt`.
      Reset e2e (`/__test/reset`) étendu.
- [ ] 1.2 Module PUR `services/league-predictions-rules` : portée, cohérence
      score / vainqueur, note et points, clôture, éligibilité (motifs),
      groupe, classement. Tests unitaires sans Prisma.

## 2. Serveur : service et routes
- [ ] 2.1 `services/league-predictions` : lecture de saison (rien des autres
      avant la clôture, play-offs non publiés masqués), upsert, suppression,
      classement, portée, clôtures manuelles. Tests Prisma mocké.
- [ ] 2.2 Zod `schemas/league-predictions.schemas` + portée dans
      `createLeagueSchema` ; `createLeague` écrit `members` par défaut,
      `updateLeague` accepte la portée. Tests.
- [ ] 2.3 `routes/league-predictions` monté sur `/leagues`. Tests de route en
      chaîne Express réelle (401, 403, 404 ligue privée, 409, 400).

## 3. Serveur : hooks
- [ ] 3.1 Clôture posée par `addEvent` et `submitByCoach` (ligue seulement).
- [ ] 3.2 Règlement dans `recordLeagueMatchResult` (forfait en ligne ⇒
      `void`), reversion dans `reverseOfflineLeagueResult`.
- [ ] 3.3 Tests des hooks (et des suites existantes impactées).

## 4. Gains
- [ ] 4.1 Oracle au palmarès (`SeasonAwardsCatalogue.oracle`, lecture
      tolérante des palmarès persistés). Tests.
- [ ] 4.2 Succès de la catégorie `predictions`. Tests.
- [ ] 4.3 Notification `league.predictions_settled` par journée, une seule
      fois. Tests.

## 5. Web
- [ ] 5.1 `PredictionsScopeField` dans le formulaire de ligue (création,
      édition) et le panneau réduit d'une ligue verrouillée. Tests.
- [ ] 5.2 Panneau « Pronostics » sur la fiche de ligue (journée ouverte,
      choix, classement résumé, invitation à activer pour le commissaire).
      Tests.
- [ ] 5.3 Page `/leagues/[id]/seasons/[sid]/predictions` : toutes les
      journées, pronostics des autres après clôture, onglets Coachs /
      Tribunes, clôtures manuelles. Tests.
- [ ] 5.4 Oracle au récap de saison, catégorie « Pronostics » des succès,
      pictogramme de notification. Tests.

## 6. Bout en bout
- [ ] 6.1 `tests/e2e-api/specs/leagues-predictions-flow.spec.ts`.

## 7. Documentation
- [ ] 7.1 Mémoire `CLAUDE.md` et récit de session.

## Suites (hors périmètre, à remonter dans `openspec-suites.md` à l'archivage)
- Coupes (`cupPairingId`), Crowns (phase 2 et sa gate), widget « pronostics
  à faire » sur l'accueil, puce « ton prono » dans les cartes du calendrier,
  autres types de pronostics.
