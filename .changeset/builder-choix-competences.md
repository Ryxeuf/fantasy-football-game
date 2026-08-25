---
"@bb/web": patch
---

Builder : nouveau sélecteur de compétences pour les améliorations au build.

L'allocateur de PSP alignait deux listes déroulantes par joueur — sans recherche, sans catégorie visible, et en proposant des choix que le serveur refusait ensuite.

- Sélecteur en feuille : plein écran sur mobile (poignée, `safe-area`, cibles tactiles ~44 px), dialogue centré sur desktop.
- Recherche plein texte, filtre par catégorie limité aux catégories réellement accessibles au type choisi, badge de catégorie et badge Élite sur chaque compétence.
- Les choix interdits restent affichés mais grisés avec leur motif : compétence déjà sur la fiche du poste, déjà choisie pour ce joueur, ou retirée de la sélection.
- Une carte par joueur : compétences de base rappelées, achats retirables, jauge du pool, coût total en PSP et surcoût de Valeur d'Équipe (les compétences Élite valent +10 000 po).
- Règlement de tournoi pris en compte : barème PSP du pack (1re/2e compétence, surcoût Élite) et quota de joueurs autorisés à cumuler deux compétences, avec le motif affiché quand l'ajout est refusé. L'UI ne propose plus un plan que `validateTournamentSkillPlan` rejetterait à la création.
