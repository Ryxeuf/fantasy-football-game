# Tasks — thèmes de dés

- [x] 1. Catalogue pur serveur (`dice-theme-catalogue`) : défaut, possession,
      thème effectif, refus de sélection — testé.
- [x] 2. `User.diceTheme` (nullable), service + route `GET|PUT /dice-themes/me`
      (Zod, erreurs typées), flag `dice_themes` (KNOWN_FLAGS, seed OFF, seed
      e2e ON) — route testée (flag OFF, 401, défaut, repli, 400, 404).
- [x] 3. Web : `DiceThemeRenderer`, thème « Nuffle » (art actuel + D6),
      registre, miroir du catalogue — cohérence testée.
- [x] 4. `BlockDieIcon` / `D6Icon` + `DiceThemeProvider` (no-op hors provider)
      monté dans `ClientLayout` — testés.
- [x] 5. Branchements : lanceur de dés et tuiles de la home, jets de Haine (X)
      de l'après-match.
- [x] 6. Sélecteur `/me/profile` (actif, possédé, verrouillé) — testé.
- [ ] 7. Suites : achat en Crowns, nouveaux thèmes, dés du plateau en ligne.
