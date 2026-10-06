# Tasks — L'invalidation d'une feuille n'est plus bloquée par un recrutement de feuille

## 1. Référence pure
- [x] 1.1 `services/league-offline-purchase-baseline.ts` : compteurs de
      référence (`baselineForPurchase` : recrutement = PSP + avancements +
      1 match, joueur acheté = zéro), redérivation depuis les achats du
      snapshot (alignement dans l'ordre, vérifié poste + nom, refus si un
      achat a été sauté), résolution trace → achats → zéro, prédicat
      « consommé DEPUIS la création ». Tests unitaires.

## 2. Service d'achats et reversion
- [x] 2.1 `applyOfflinePurchasesForTeam` consigne `createdPlayers` (état à la
      création de chaque joueur créé) dans la trace des mutations.
- [x] 2.2 `offlinePurchasesConsumed(mutations, purchases)` relit nom et poste,
      résout la référence de chaque joueur créé et ne refuse que ce qui a
      bougé depuis. Tests service (trace, redérivation, rejoué / progressé /
      mort, historique sans achats, un côté = ses achats).
- [x] 2.3 `reverseOfflineLeagueResult` passe les achats du snapshot au
      garde-fou ; compte tolérant des avancements partagé. Tests reversion
      (feuille antérieure, feuille récente, recrutement qui a rejoué).
- [x] 2.4 Snapshot : `createdPlayers` persisté avec la trace (test résultat).

## 3. Chaîne complète
- [x] 3.1 `leagues-sheet-raise-dead-undead.spec.ts` : invalidation après le
      recrutement du relevé (Zombie retiré, or rendu, mort adverse
      ressuscité, choix conservé) puis re-validation (recruté à nouveau).
- [x] 3.2 `leagues-sheet-journeymen-orc.spec.ts` : invalidation après le
      recrutement du journalier (Gobelin retiré, trésorerie rendue).

## 4. Documentation
- [x] 4.1 `docs/league-physical-purchases-2026-06-25.md` (garde-fou),
      `CLAUDE.md` (piège « comparer à l'état à la création »).
