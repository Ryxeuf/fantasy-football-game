---
"@bb/web": minor
---

Nouvelle page `/aide-de-jeu` : le déroulé complet d'une partie en trois phases (avant / pendant / après le match), pensée pour être consultée sur mobile au-dessus d'un plateau. Chaque étape tient en une ou deux lignes et renvoie vers ses tables, qui s'ouvrent en panneau — bottom-sheet sur mobile, latéral sur desktop — sans quitter la page. 14 fiches (météo par type de terrain, événements de coup d'envoi 2D6 et D16, prières à Nuffle, coups de pouce, blessure, élimination et séquelles, contester la décision, PSP, améliorations, compétences, fans dévoués, erreurs coûteuses), dérivées du compendium publié et des tables de `@bb/game-engine` plutôt que recopiées. Une fiche ouverte est partageable par URL (`?fiche=`), et le retour du navigateur referme le panneau. Les étapes d'avant/après-match et les actions limitées du tour sont cochables et mémorisées sur l'appareil. Entrées ajoutées au menu, au pied de page et au sitemap.
