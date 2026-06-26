# Tasks — Couleurs, accès coups de pouce, auto-calculs & évolutions inline

## 1. Coups de pouce par équipe + couleurs
- [x] 1.1 `reference.inducements` devient `{home, away}` filtré par `canPurchase` + coût régional (`inducementOptionsFor`).
- [x] 1.2 `reference.colors {home, away}` (hex via `getTeamColors`).
- [x] 1.3 Frontend : chaque éditeur de coups de pouce consomme son catalogue d'équipe.
- [x] 1.4 Tests : accès apothicaire par équipe, couleurs hex.

## 2. Saisie évènements + timeline colorée
- [x] 2.1 Bloc de saisie affiché avant la timeline.
- [x] 2.2 Timeline colorée par équipe (bordure + pastille de tour).
- [x] 2.3 En-tête de récap coloré (barres + liserés du score).

## 3. Fin de match — auto-calculs
- [x] 3.1 SPP estimés par joueur (read-only) côté UI + total par équipe.
- [ ] 3.2 SPP **autoritaire** calculé côté serveur (modificateur d'équipe) et exposé dans la réponse ; l'UI l'affiche au lieu de l'estimation.
- [ ] 3.3 Gains auto (popularité) surfacés en read-only dans le panneau fin de match.

## 4. Onglet Évolutions + édition inline
- [x] 4.1 Onglet « Évolutions » avec rappel de la règle de staging.
- [ ] 4.2 Extraire `AdvancementEditor` (composant partagé) depuis la page level-up.
- [ ] 4.3 Page level-up : réutilise `AdvancementEditor`.
- [ ] 4.4 Onglet Évolutions : monte `AdvancementEditor` (équipe du coach, après validation, gate flag `league`).
- [ ] 4.5 Tests : `AdvancementEditor` (liste + apply), non-régression page level-up.

## 5. Vérification
- [x] 5.1 `tsc` server + web (lots 1-3.1, 4.1).
- [ ] 5.2 Tests verts après extraction + serveur SPP autoritaire.
