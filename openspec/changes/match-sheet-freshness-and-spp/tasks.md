# Tasks — feuille à jour, PSP complets

## 1. Élimination soignée

- [x] 1.1 `league-match-summary` : `eliminationOccurred`, `isEliminationOutcome`, `HEALED_ELIMINATION` ; `eliminationEarnsSpp` et `recordElimination` en partent, aucune blessure sans gravité — vérifier : tests du summarizer (blocage sans gravité et « aucune séquelle », agression / atterrissage soignés, auto-élimination).
- [x] 1.2 Zod `addEventSchema` accepte `healed` — vérifier : test du schéma.
- [x] 1.3 Sac de frappe sur `eliminationOccurred` — vérifier : test des classements.
- [x] 1.4 Web : option « Aucune séquelle », rappel sous « Élimination sur Blocage », code AS du PDF — vérifier : tests `event-fields` et adaptateur PDF.
- [x] 1.5 `CASUALTY_RULE_VERSION = 2` — vérifier : test de resync (élimination soignée validée sous la v1).

## 2. Lancer Sécurisé

- [x] 2.1 `safeThrows` (summarizer), `SPP_VALUES.safeThrow`, deux calculs de PSP — vérifier : tests `spp-tracking` et summarizer.
- [x] 2.2 `OfflinePlayerStatInput.safeThrows` : validation et reprise — vérifier : test `buildOfflineInputFromSummary`.
- [x] 2.3 Resync : Lancers Sécurisés et `newStatLine` (match joué) — vérifier : tests du plan et de l'application.
- [x] 2.4 PSP de saison : atterrissages et Lancers Sécurisés — vérifier : test Future Star.
- [x] 2.5 Web : libellé « Lancer de coéquipier réussi », rappel, légendes PDF — vérifier : tests `event-fields`.

## 3. Garde d'ouverture

- [x] 3.1 Module pur `league-sheet-open-guard` — vérifier : tests en table (statuts clos, journées, équipes, placeholder).
- [x] 3.2 `createMatchSheet` : refus `previous_match_pending` avec `details`, `force` commissaire, best-effort — vérifier : tests du service.
- [x] 3.3 Route : `createMatchSheetSchema`, 409 avec `code` + `details` (ligue et coupe) — vérifier : e2e.
- [x] 3.4 Web : `ApiClientError.details`, écran d'ouverture (rencontre à valider, « Ouvrir quand même ») — vérifier : tests client API, module pur et rendu.

## 4. Feuille périmée et mise à jour

- [x] 4.1 Module pur `league-sheet-snapshot-freshness` (instant du gel, changement après gel, joueurs orphelins, ids cités) — vérifier : tests unitaires.
- [x] 4.2 `getMatchSheet` sert `snapshotFreshness` — vérifier : tests du service.
- [x] 4.3 `refreshMatchSheetSnapshots` + `POST …/sheet/refresh` — vérifier : tests du service (droits, statut, gel refait, orphelins, échec).
- [x] 4.4 Web : bandeau et bouton — vérifier : tests du module pur et de rendu.

## 5. Intégration

- [x] 5.1 Spec e2e-api `leagues-sheet-freshness.spec.ts` (garde, forçage, feuille périmée puis à jour, refus) ; specs existantes adaptées — vérifier : suite e2e-api verte sur SQLite.
- [x] 5.2 Contrôles — vérifier : typecheck serveur et web, Vitest serveur et web.
- [x] 5.3 `CLAUDE.md` : patrons et historique.

## Workflow follow-up

- Une branche, commits atomiques par point, PR, surveillance CI et conflits jusqu'au vert.
- Après merge : `/opsx:sync` puis `/opsx:archive`.
