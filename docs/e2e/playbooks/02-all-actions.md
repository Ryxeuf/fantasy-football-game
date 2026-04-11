# Playbook 02 — Checklist exhaustive des actions

**Objectif :** couvrir **chaque type d'action** au moins une fois dans
un match contrôlé. Utilisable comme smoke test avant release.

**Durée estimée :** 15–20 minutes (pas besoin de jouer jusqu'à la fin).

## Préparation

- [ ] Lancer un match avec deux équipes bien choisies :
  - équipe **A** : au moins 1 Passeur, 1 Coureur, 1 Bloqueur
  - équipe **B** : au moins 1 Bloqueur, 1 Sauteur (Gobelin…)
- [ ] Arriver en phase gameplay (tour 1 de chaque coach).

## Actions de mouvement

- [ ] **MOVE** : déplacer un joueur d'une case sans tackle zone adverse.
- [ ] **MOVE avec dodge** : déplacer un joueur depuis une tackle zone
      adverse, valider l'affichage du jet d'esquive + modificateurs.
- [ ] **MOVE avec pickup** : déplacer un joueur sur la balle, valider
      le jet de ramassage.
- [ ] **MOVE avec GFI** : dépasser la MA max d'un joueur, valider le
      jet "Go For It" + usage d'une relance éventuelle.

## Blocage

- [ ] **BLOCK** 1 dé (plaqueur = attaquant, score identique à la cible).
- [ ] **BLOCK** 2 dés pour l'attaquant (strength avantage).
- [ ] **BLOCK** 2 dés pour le défenseur (strength désavantage).
- [ ] **BLOCK_CHOOSE** : valider que l'équipe à l'avantage choisit bien.
- [ ] **PUSH_CHOOSE** : direction de poussée valide, hors plateau si
      crowd push disponible.
- [ ] **FOLLOW_UP_CHOOSE** : follow-up = true et = false.

## Blitz et coups spéciaux

- [ ] **BLITZ** : un joueur se déplace puis blocke, valide compteur de
      blitz par tour (1 / tour).
- [ ] **HYPNOTIC_GAZE** : un skink doré hypnotise un adversaire.
- [ ] **PROJECTILE_VOMIT** : un troll vomit sur un adversaire.

## Passes

- [ ] **PASS** courte / longue / bombe, avec le passeur non déplacé.
- [ ] **HANDOFF** : donner la balle à un coéquipier adjacent.
- [ ] **THROW_TEAM_MATE** : lancer un gobelin avec un ogre.
- [ ] **Interception** : adversaire dans le couloir de passe qui tente
      de l'intercepter, valider le jet + modificateurs.

## Fouls

- [ ] **FOUL** : un joueur cogne un joueur à terre, jet d'armure et
      jet de blessure, possible expulsion (double sur l'armor).

## Fin de tour

- [ ] **END_TURN** manuel (pas de turnover).
- [ ] **END_TURN automatique** sur turnover : échec dodge.
- [ ] **END_TURN automatique** sur turnover : fumble (balle au sol).
- [ ] **END_TURN automatique** sur touchdown.

## Cas d'apothecaire

- [ ] Provoquer une blessure grave (armure cassée, injury roll > 8).
- [ ] Choisir d'utiliser l'apothicaire → la blessure est rejouée.
- [ ] Vérifier que l'apothicaire n'est plus disponible pour la demi.

## Sanity checks

- [ ] Le `gameLog` affiche bien chaque action dans l'ordre.
- [ ] Aucune erreur console navigateur sur la durée du scénario.
- [ ] L'adversaire (autre navigateur) voit chaque action en temps réel.

**Version / commit testé :** ______________
