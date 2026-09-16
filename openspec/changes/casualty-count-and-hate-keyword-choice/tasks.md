# Tasks — Sorties rattrapées, Haine (X) choisie

## 1. Compteurs d'éliminations restants
- [x] 1.1 « Sac de frappe » : exiger une blessure effective, ajouter
      l'atterrissage sur un adversaire. Libellé du castagneur aligné sur la
      règle. Tests unitaires.

## 2. Rattrapage automatique des feuilles validées
- [x] 2.1 `LeagueMatchSheet.casualtyRuleVersion` (nullable) + écriture à la
      validation.
- [x] 2.2 `healSeasonCasualties` : balayage best-effort des feuilles non
      marquées d'une saison, marquage après passage (y compris sur refus par
      conception). Tests unitaires.
- [x] 2.3 Branchement dans `computeSeasonStandings`. Tests de non-régression
      (classement servi même si le rattrapage lève).

## 3. Haine (X) — choix du mot-clé
- [x] 3.1 Moteur : `resolveHateKeyword(csv, preferred)` pur. Tests.
- [x] 3.2 `buildHateCandidates` accepte les choix ; module pur de dérivation
      des candidats de feuille (`league-sheet-hate-choices`). Tests.
- [x] 3.3 Colonne `hateChoices`, schéma Zod, garde de côté, exposition par
      `getMatchSheet`, passage à la validation. Tests service + route.
- [x] 3.4 Web : sélecteur par blessé dans le panneau d'après-match. Tests
      composant.

## 4. Documentation
- [x] 4.1 Mémoire `CLAUDE.md` (rattrapage versionné, choix du mot-clé).
