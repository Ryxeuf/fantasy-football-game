# Tasks — Contagieux

## 1. Module pur
- [x] 1.1 `RaiseSource`, `hasPlagueRiddenTrait` (slugs `contagieux` /
      `plague-ridden`), `raiseSourcesFor`, `isBigGuyVictim` (Mot-clé puis
      Solitaire), `eligibleRaiseVictims` avec `sources` + `own` (blocage d'un
      porteur du Trait ; ni Gros Bras, ni Décomposition, ni Régénération, ni
      Minus ; source par candidat, gratuite préférée), `deriveRaisedDead` →
      `source` + `hireCost` + « Contaminé (<poste>) », `buildRaisedDeadHire`
      payant pour `plague_ridden`. Tests unitaires.

## 2. Feuille de match (serveur)
- [x] 2.1 `sideRaiseSources` (règle spéciale base d'abord ET porteurs du
      Trait) ; `sideSheetPlayers` sert les mots-clés (base, catalogue, Star
      Players) ; `raiseDeadSideView` reçoit sources + joueurs du côté.
- [x] 2.2 `getMatchSheet` expose `raiseDead.sources`, `victims[].source`,
      `raisedDead.source` / `hireCost` ; `updateRaisedDead` et
      `loadSideRaisedDead` acceptent l'une ou l'autre règle (409 « ni la règle
      spéciale ni de joueur Contagieux »).
- [x] 2.3 Validation : achat `raised_dead` au prix fixé par la source, débit
      corrigé par `purchasesGoldDelta`. Tests service (Nurgle contre Humains).

## 3. Web
- [x] 3.1 `raisedDeadWording(source)` ; bandeau à une ou deux règles ;
      pickers, timeline, ligne d'achat et rappel de l'étape 4 sous ☣️ ; type
      d'achat « Contaminé (prix du poste) », coût pré-rempli et prix
      catalogue = `hireCost`. Tests composants + page.

## 4. Chaîne complète et documentation
- [x] 4.1 Fixtures `nurgle` (`/__test/seed-team`, `/__test/seed-rosters`) ;
      spec `tests/e2e-api/specs/leagues-sheet-contagious-nurgle.spec.ts`.
- [x] 4.2 `CLAUDE.md`, backlog des suites (suite livrée retirée), changeset.

## Hors périmètre (suites possibles)
- Blessures durables subies par le relevé pendant le match : non reportées
  s'il est recruté (même limite que le journalier).
- Deux relevés sur le même côté quand les deux règles jouent dans le même
  match : un seul choix par côté, la victime gratuite préférée.
