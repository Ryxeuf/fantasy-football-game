# Tasks — Les coupes se gèrent comme les ligues

## 1. Schéma
- [x] 1.1 `Cup.tieBreakRules` (nullable, lue avec repli — aucun backfill possible).
- [x] 1.2 `LeagueMatchSheet` polymorphe : `pairingId` nullable + `cupPairingId` unique, `CupPairing.matchSheet`.
- [x] 1.3 `CupRound.system` documente ses trois valeurs. Miroir SQLite + client généré.

## 2. Critères de classement et édition d'une coupe
- [x] 2.1 `services/cup-standings-order` (pur) : 13 slugs, parse tolérant, comparateur. Tests.
- [x] 2.2 `computeCupStandings` consomme le comparateur ; ordre historique préservé. Tests.
- [x] 2.3 `PATCH /cup/:id` + `GET /cup/:id` sert les critères effectifs. Schémas Zod. Tests.
- [x] 2.4 Web : affichage des critères, `/cups/[id]/edit`, éditeur d'ordre pur. Tests.

## 3. Feuille de match de coupe
- [x] 3.1 `services/competition-match-sheet-context` : résolution polymorphe + jeu de règles. Tests.
- [x] 3.2 `league-match-sheet` : contexte threadé, gel depuis le roster d'inscription.
- [x] 3.3 `services/cup-match-sheet` : matérialisation, réversion, fenêtre d'invalidation. Tests.
- [x] 3.4 Branchements validation / invalidation / boîte de validation / coups de pouce.
- [x] 3.5 `routes/cup-match-sheet` monte les handlers de la ligue.
- [x] 3.6 Web : `/cups/pairings/[id]/sheet`, lien retour, phases masquées, bandeau. Tests.
- [x] 3.7 e2e-api `cup-match-sheet-flow` (saisie, non-écriture, invalidation, 403/404).

## 4. Systèmes d'appariement
- [x] 4.1 `services/random-pairing` (pur) : mélange à graine + délégation au moteur suisse. Tests.
- [x] 4.2 `buildManualRound` (pur) : garde-fous de la saisie. Tests.
- [x] 4.3 `generateCupRound` + `POST /cup/:id/rounds` (+ alias `/swiss`). Tests de route.
- [x] 4.4 Web : sélecteur de système, éditeur manuel, badge par ronde. Tests.
- [x] 4.5 e2e-api : tirage rejouable, ronde manuelle, doublon refusé.

## 5. Construction d'une équipe pour une coupe
- [x] 5.1 `isCupAdjusted` compte le règlement de tournoi. Tests.
- [x] 5.2 Règlement imposé introuvable : annoncé et bloquant. Tests.
- [x] 5.3 Lien de secours « Créer une équipe » porte le contexte de la coupe.

## 6. Documentation
- [x] 6.1 `docs/cup-match-sheet.md`, mise à jour de `docs/cup-swiss-rounds.md`.
- [x] 6.2 CLAUDE.md : patrons de la feuille polymorphe et du tirage délégué.

## Hors périmètre (à remonter dans le backlog à l'archivage)
- Parité UI complète : poules, playoffs de coupe, export PDF d'une ronde,
  relance des coachs d'une ronde, page de récapitulatif et palmarès dédiés,
  éditeur de roster commissaire côté coupe.
- i18n de `cups/[id]/page.tsx` (encore majoritairement en français en dur).
- `POST /team/create-from-roster` n'applique ni coupe ni pool de PSP.
- Miroir SQLite : `LeagueMatchEvent.meta` y est `String?` et refuse l'objet
  que PostgreSQL accepte (mi-temps / tour non testables en e2e).
