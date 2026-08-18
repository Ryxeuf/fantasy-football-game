---
"@bb/web": minor
---

Actif / Passif affiché partout où le détail d'une compétence ou d'un trait est montré : les infobulles au survol (roster, fiche d'équipe publique, Star Players, feuille de match de ligue) et le panneau « Compétence sélectionnée » du level-up portent désormais le même badge que la liste `/skills` et la fiche détail, avec une phrase d'explication au survol du badge. Le flag `isPassive` est propagé dans toute la chaîne de résolution (catalogue SSR, cache client, repli game-engine) ; son absence vaut « actif ».
