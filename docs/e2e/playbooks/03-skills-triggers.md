# Playbook 03 — Déclenchement de compétences

**Objectif :** vérifier que les compétences clés déclenchent leurs
effets correctement et que l'UI les signale au coach.

**Durée estimée :** 20 minutes.

## Compétences à valider

Utilisable comme regression test après toute modification du
`skill-registry` ou de `skill-effects.ts`.

### Général

- [ ] **Block** : attaquant avec Block ignore un BOTH_DOWN.
- [ ] **Dodge** : défenseur avec Dodge transforme un STUMBLE en push.
- [ ] **Tackle** : annule le Dodge de la cible.
- [ ] **Dauntless** : joueur faible qui réussit le jet → gagne en ST pour
      le block.
- [ ] **Frenzy** : 2e block automatique si push réussit, même hors LoS.

### Mouvement

- [ ] **Sprint** : +1 GFI dans le tour.
- [ ] **Sure Feet** : relance gratuite sur échec de GFI.
- [ ] **Leap** : saute par-dessus une case adverse, jet d'agilité.
- [ ] **Jump Up** : un joueur stunned se relève et peut agir.

### Passing

- [ ] **Pass** : relance gratuite sur un jet de passe.
- [ ] **Strong Arm** : +1 sur les jets de passe longue.
- [ ] **Accurate** : +1 sur les jets de passe courte.
- [ ] **Catch** : relance gratuite sur un jet de réception.

### Blocking / défense

- [ ] **Guard** : +1 assist défensif pour toute cible adjacente.
- [ ] **Mighty Blow** : +1 sur le jet d'armure ou de blessure.
- [ ] **Thick Skull** : transforme un KO en Stunned.
- [ ] **Horns** : +1 ST en blitz uniquement.

### Star Players / spéciales

- [ ] **Hypnotic Gaze** (Skink Priest of Sotek) : action HYPNOTIC_GAZE
      dispo, cible devient hypnotisée (perte TZ).
- [ ] **Projectile Vomit** (Troll / Rat Ogre) : action PROJECTILE_VOMIT.
- [ ] **Regeneration** : relance sur casualty → joueur retour au dugout
      au lieu d'être casualty.
- [ ] **Animosity** : joueur avec animosity refuse un handoff/pass.
- [ ] **Always Hungry + Really Stupid** combo : Troll échoue un jet →
      mange son gobelin.

## Assertions transverses

- [ ] Quand une compétence se déclenche, son nom s'affiche dans le
      gameLog.
- [ ] Quand un skill propose un choix (utiliser la reroll ?), le popup
      UI apparaît uniquement pour le joueur concerné.
- [ ] Les compétences passives (Guard, Block) ne demandent pas de
      clic supplémentaire.

**Version / commit testé :** ______________
