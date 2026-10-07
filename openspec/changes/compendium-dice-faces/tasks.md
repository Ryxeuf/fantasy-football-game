# Tasks — dés et faces dans le compendium

- [x] 1. Module pur `dice-notation` : en-tête → dé (`parseDiceColumn`),
      cellule → plage bornée (`parseRollRange`), nom → face du Dé de
      Blocage (`blockFaceForName`) — testé, dont un garde-fou qui exige que
      TOUTES les cellules des colonnes de jets publiées se dessinent.
- [x] 2. Bloc `dice` (type, JSON `des-de-blocage`, `meta.version`), pris en
      compte par la recherche et les tests d'intégrité du compendium.
- [x] 3. Rendu : `BlockDiceFigure`, `BlockFaceCell`, `DiceRollCell`
      (`CompendiumDice.tsx`), branchés dans `Blocks.tsx` — tests de rendu.
