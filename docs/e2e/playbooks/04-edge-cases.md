# Playbook 04 — Edge cases

**Objectif :** scénarios limites qui ont historiquement cassé le moteur
ou l'UI. À rejouer avant toute release majeure.

**Durée estimée :** 15–20 minutes.

## Fumble

- [ ] Joueur tente un pickup avec −1 sur le jet (pluie ou tackle zones
      adverses), échec → la balle bounce.
- [ ] Valider la direction du bounce (1d8).
- [ ] Valider le turnover immédiat.

## Interception

- [ ] Positionner un joueur adverse exactement dans le couloir de passe
      (ligne droite entre passeur et cible).
- [ ] Lancer le pass → l'UI propose le jet d'interception.
- [ ] Si l'interception réussit : l'adversaire prend la balle + turnover.
- [ ] Si elle échoue : la passe se résout normalement.

## Throw Team-Mate

- [ ] Un Ogre ou Troll avec Throw Team-Mate prend un Gobelin/Snotling.
- [ ] Lancer en diagonale, dépasser la tackle zone adverse.
- [ ] Valider que les trois jets se font dans l'ordre : lancer, landing,
      puis pickup si le gobelin tombe sur la balle.
- [ ] Cas `Always Hungry` : jet de Really Stupid raté → le Troll mange
      le gobelin.

## Foul avec expulsion

- [ ] Provoquer un foul à plusieurs modificateurs d'assist.
- [ ] L'arbitre voit l'action → double sur le jet d'armure = expulsion.
- [ ] Le joueur est retiré du terrain, placé dans le dugout des expulsés.
- [ ] Bribe utilisée depuis inducements → annule l'expulsion.

## Apothicaire

- [ ] Provoquer deux casualties dans la même mi-temps.
- [ ] L'apothicaire ne doit être utilisable qu'une seule fois.
- [ ] Après utilisation, la proposition n'apparaît plus.

## Turnover "en cascade"

- [ ] Un joueur tombe en dodge → turnover → pendant le reset, la balle
      est dans une tackle zone adverse → le tour adverse commence
      normalement.
- [ ] La balle n'est PAS ramassée automatiquement.

## Reroll d'équipe

- [ ] Première reroll utilisée : `rerollUsedThisTurn = true`.
- [ ] Tentative de reroll deuxième action → l'UI refuse proprement.
- [ ] Fin du tour : le compteur se remet à zéro.

## Kickoff events

- [ ] Provoquer chaque event du tableau kickoff au moins une fois sur
      plusieurs matchs :
  - [ ] Get the Ref
  - [ ] Riot
  - [ ] Perfect Defence (repositionnement)
  - [ ] High Kick
  - [ ] Cheering Fans
  - [ ] Brilliant Coaching
  - [ ] Changing Weather
  - [ ] Quick Snap (le receveur bouge chaque joueur une case)
  - [ ] Blitz (le botteur gagne un tour)

## Fin de drive / mi-temps

- [ ] Touchdown → reset complet du plateau, ball goes to kicker again.
- [ ] Tour 8 → mi-temps → le kicker alterne, les KO ont une chance de
      revenir sur 4+.
- [ ] Tour 16 → match terminé, ELO mis à jour.

**Version / commit testé :** ______________
