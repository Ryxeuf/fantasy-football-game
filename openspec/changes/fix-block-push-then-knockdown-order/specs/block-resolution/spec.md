# block-resolution (delta)

Capability : résolution d'une Action de Blocage une fois la face du dé
choisie — ordre des effets, case sur laquelle ils s'appliquent, et
compétences qui peuvent s'y opposer.

## ADDED Requirements

### Requirement: Le Repoussé précède le Plaquage
Sur un résultat **Défenseur Plaqué**, et sur un **Bousculé** dont la cible n'a
pas Esquive, le Repoussé DOIT être entièrement appliqué avant que la cible soit
Plaquée. Le Plaquage DOIT porter sur la case que la cible occupe **après** la
poussée, jamais sur celle qu'elle occupait avant.

#### Scenario: Une seule case de poussée disponible
- WHEN la poussée n'a qu'une destination sur le terrain
- THEN la cible DOIT être déplacée sur cette case
- AND la mise à terre, le Jet d'Armure et le Jet de Blessure DOIVENT porter sur cette case d'arrivée

#### Scenario: Le coach choisit la direction
- WHEN plusieurs cases de poussée sont libres et le choix est rendu au coach
- THEN aucun Jet d'Armure ne DOIT être effectué avant que la direction soit choisie
- AND une fois la direction choisie, la cible DOIT être Plaquée sur sa case d'arrivée

#### Scenario: La poussée sort la cible du terrain
- WHEN aucune case de poussée n'est sur le terrain
- THEN la cible NE DOIT PAS subir le Jet d'Armure du blocage, faute de case où la plaquer
- AND seule la Blessure par le Public DOIT s'appliquer
- AND la cible NE DOIT subir qu'UN SEUL Jet de Blessure au total

### Requirement: Le ballon tombe sur la case d'arrivée
Quand la cible Plaquée portait le ballon, celui-ci DOIT être lâché sur la case
qu'elle occupe après la poussée, et le rebond DOIT partir de cette case. Cela
vaut sur tous les chemins de résolution, y compris lorsque la direction a été
choisie par le coach.

#### Scenario: Porteur repoussé puis plaqué
- WHEN un porteur du ballon subit un Défenseur Plaqué et est repoussé d'une case
- THEN le ballon DOIT être lâché sur la case d'arrivée du porteur

#### Scenario: Porteur repoussé hors du terrain
- WHEN la poussée sort le porteur du terrain
- THEN le ballon DOIT rester sur la case que le porteur occupait en dernier sur le terrain

### Requirement: Stabilité et Parade restent utilisables
La cible étant **debout** au moment où le Repoussé s'applique, les compétences
qui réagissent au Repoussé DOIVENT rester disponibles sur un Défenseur Plaqué
comme sur un Bousculé. **Stabilité** DOIT pouvoir refuser la poussée ;
**Parade** DOIT pouvoir empêcher la Poursuite de l'attaquant.

#### Scenario: Stabilité sur un Défenseur Plaqué
- WHEN la cible d'un Défenseur Plaqué possède Stabilité et choisit de l'utiliser
- THEN elle NE DOIT PAS être déplacée
- AND elle DOIT être Plaquée sur sa propre case

#### Scenario: Parade sur un Défenseur Plaqué
- WHEN la cible d'un Défenseur Plaqué possède Parade
- THEN l'attaquant NE DOIT PAS Poursuivre sur la case libérée

### Requirement: Un blocage ne produit qu'un seul Jet de Blessure sur la cible
Quel que soit le chemin de résolution, une même Action de Blocage NE DOIT PAS
faire subir à la cible plus d'un Jet de Blessure. Un test automatisé DOIT
verrouiller ce point sur les chemins de sortie de terrain, où le cumul est
survenu.

#### Scenario: Défenseur Plaqué avec sortie de terrain
- WHEN un Défenseur Plaqué pousse la cible dans la foule
- THEN le journal de match NE DOIT contenir qu'un seul Jet de Blessure pour cette cible

### Requirement: Un blocage en cours survit au déploiement
Un `GameState` portant une poussée en attente créée avant ce change DOIT
rester résoluble. En l'absence du marqueur de Plaquage différé, la résolution
DOIT retomber sur l'ancien comportement plutôt que de plaquer deux fois ou de
perdre le blocage.

#### Scenario: Poussée en attente créée par l'ancien code
- WHEN un `PUSH_CHOOSE` porte sur une poussée en attente sans marqueur de Plaquage différé
- THEN la poussée DOIT être appliquée normalement
- AND la cible NE DOIT PAS subir un second Jet d'Armure
