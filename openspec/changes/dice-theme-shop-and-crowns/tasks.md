# Tasks — boutique de thèmes de dés et Couronnes

- [x] 1. `@bb/ui/dice` : skins des 36 thèmes (PNG + palette), contexte, faces
      PNG / D6 / chiffrées — testés (dont existence des 540 PNG référencés).
- [x] 2. Match en ligne : `BlockDiceIcon`, journal, popup de résultat, toasts
      de dés, dé animé Pixi (palette, chiffre au-delà de 6, face de blocage).
- [x] 3. Site : renderers construits depuis les skins, `NumberDieIcon`,
      `DiceThemeProvider` pose le skin ; D8 d'amélioration thémés.
- [x] 4. Serveur : catalogue compilé (36), table `DiceTheme` + repository +
      seed create-if-missing, `UserDiceTheme`, achat atomique, `GET /crowns/me`,
      flag `crowns` — testés.
- [x] 5. Web : contexte Crowns, boutique `/me/dice-themes`, cartes du profil,
      entrée du menu — testés.
- [x] 6. Admin : routes + écrans catalogue et cosmétiques des coachs, lien
      fiche utilisateur, journal admin — testés.
- [x] 7. Spec e2e-api du parcours complet (crédit → achat → retrait →
      remboursement → cadeau).
- [ ] 8. Suites : sources de Crowns hors Pro League, mobile, upload de faces.
