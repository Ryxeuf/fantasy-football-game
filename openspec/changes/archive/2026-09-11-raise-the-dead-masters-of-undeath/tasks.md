# Tasks — Relever le Mort

## 1. Dérivation pure
- [x] 1.1 `services/league-sheet-raised-dead.ts` : ids `raised-<side>-1`,
      parse du choix, `eligibleRaiseVictims` (adversaire tué, Force ≤ 4, sans
      Minus), `deriveRaisedDead` (poste choisi ou Trois-quart de base, sans
      Solitaire, numéro suivant, nom du mort), `canHireRaisedDead`,
      `buildRaisedDeadHire` (coût 0, valeur pleine). Tests unitaires.
- [x] 1.2 `isSyntheticSheetPlayerId` / `syntheticSheetPlayerSide` couvrent la
      troisième famille ; `reviewJourneymanAdvancements` /
      `traceJourneymanAdvancements` acceptent un id relevé.

## 2. Feuille de match (serveur)
- [x] 2.1 Colonnes `raisedDeadHome/Away` (`Json?`, schéma racine + miroir
      SQLite, clients regénérés).
- [x] 2.2 `getMatchSheet` expose `raiseDead` (victimes, postes, choix,
      `canHire`) et `raisedDead` au porteur de la règle ; le relevé entre dans
      les PSP (JDM sans stat-line).
- [x] 2.3 `updateRaisedDead` + `PATCH /leagues/pairings/:id/sheet/raise-dead`
      (Zod `raiseDeadSchema`) : côté du coach, règle spéciale de l'équipe,
      victime, poste ; erreurs `raise_dead_*` mappées 403 / 409 / 400.
- [x] 2.4 Appartenance d'une évolution stagée, tirage « Hasard », Mots-clés de
      Haine et noms d'actions de coupe connaissent le relevé.
- [x] 2.5 Achat `raised_dead` : enrichissement gratuit à la validation (PSP,
      évolution, doublon, relevé mort, liste pleine), matérialisation comme un
      journalier recruté, débit inchangé. Tests service + purchases + schémas.

## 3. Web
- [x] 3.1 `RaiseDeadPanel` (victimes, poste, annulation, relevé en réserve,
      avertissement liste pleine) ; `PlayerSelect`, timeline, estimation de
      PSP, éditeur d'évolutions et `RosterSection` intègrent le relevé.
- [x] 3.2 Type d'achat « Mort relevé (gratuit) » : proposé aux seules équipes
      qui en ont un, nom et poste pré-remplis, coût 0, rappel + ajout en un
      clic à l'étape 4.
- [x] 3.3 `parsePurchases` extrait en module pur et corrigé (conserve
      `journeyman` / `raised_dead` et `journeymanId`). Tests composants + page.

## 4. Chaîne complète et documentation
- [x] 4.1 Fixtures `/__test/seed-team` (`undead`) et `/__test/seed-rosters`
      (roster `undead` avec `specialRules`, Squelette et Zombie, Régénération)
      ; spec `tests/e2e-api/specs/leagues-sheet-raise-dead-undead.spec.ts`.
- [x] 4.2 Catalogue moteur : description anglaise « Stunty ».
- [x] 4.3 `CLAUDE.md` (troisième famille synthétique, pièges), suite
      « Contagieux » dans `docs/roadmap/backlog/openspec-suites.md`.

## Hors périmètre (suites possibles)
- Trait **Contagieux** (Nurgle) : même recrutement, déclenché sur un Blocage
  du porteur du Trait, victime sans Décomposition / Régénération / Minus.
- Blessures durables subies par le relevé pendant le match : non reportées
  s'il est recruté (même limite que le journalier).
