---
"@bb/game-engine": patch
"@bb/sim-engine": patch
"@bb/ui": patch
"@bb/web": patch
---

Dés de blocage : faces officielles, libellés du livre et ordre « repousser puis plaquer ».

Le simulateur de la page d'accueil tirait la bonne distribution mais annonçait
des noms qui n'existent sur aucune face (« Joueur à terre », « Hésitation »,
« Tous à terre », « POW ! »), alors que les descriptions de Compétences servies
ailleurs sur le site parlent bien d'« Attaquant Plaqué », « Bousculé » ou
« Les Deux Plaqués ». L'illustration `pow` portait même en `aria-label` le nom
d'une autre face.

- Table unique `BLOCK_DIE_FACES` / `BLOCK_DIE_FACE_INFO` (`@bb/game-engine`) :
  six faces, cinq icônes, `Repoussé` en double, avec les noms VF/VO du livre et
  l'effet de chaque résultat. `blockResultFromRoll` et le resolver
  `@bb/sim-engine` (qui avait son propre ordre de faces) en dérivent désormais.
- Page d'accueil : le lanceur affiche les noms officiels et détaille l'effet du
  meilleur dé obtenu. Miroir web verrouillé par
  `block-dice-faces-consistency.test.ts` (faces, ordre, libellés FR/EN).
- Nouveau chapitre publié `/compendium/des-de-blocage` (résumés reformulés) :
  les cinq icônes, leur nombre de faces, et la résolution d'un joueur Repoussé.
- `@bb/ui` (icône, popup de choix, journal de match, notifications) et les
  traductions mobile reprennent les mêmes libellés.
- `@bb/sim-engine` passe en `ENGINE_VER` 0.26.0 et `bench/bench-baseline.json`
  est re-snapshoté : le resolver ne place plus STUMBLE en 5 et POW en 6, donc
  les issues de match à seed constant bougent légèrement (la distribution du dé,
  elle, est inchangée — écarts de 1 à 3 points sur 200 matchs).
- Correction de règle dans le moteur : Défenseur Plaqué et Bousculé appliquaient
  le Plaquage AVANT la poussée. Une cible poussée hors du terrain encaissait
  donc le jet de blessure du blocage PUIS la Blessure par le Public — deux jets,
  deux « morts » sur un seul blocage. Le porteur du ballon le lâchait aussi sur
  sa case de départ au lieu de sa case d'arrivée.
