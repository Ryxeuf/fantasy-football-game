# commissioner-team-settings

## Purpose

L'édition, par le **commissaire** d'une ligue, des réglages
d'ÉQUIPE d'un participant — staff (relances, cheerleaders, assistants,
apothicaire, fans dévoués) et Ligue régionale. Distincte de
`commissioner-team-edit` (attributs de JOUEUR + trésorerie) et de
`commissioner-team-removal` (suppression dure).

## Requirements

### Requirement: Lecture des réglages d'une équipe
Le commissaire DOIT pouvoir lire, pour une équipe inscrite dans sa ligue : le
staff courant, les plafonds et coûts unitaires résolus pour le couple
roster × format, la Ligue régionale courante, les Ligues ouvertes à ce roster
et les Star Players déjà recrutés.

#### Scenario: Réglages d'une équipe de la ligue
- WHEN le commissaire demande les réglages d'une équipe inscrite dans sa ligue
- THEN la réponse DOIT contenir le staff, les plafonds/coûts (`RosterStaffConfig`
  résolue, défaut du moteur à défaut de ligne) et les options de Ligue régionale

#### Scenario: Équipe hors de la ligue
- WHEN l'équipe visée n'est inscrite dans aucune saison de la ligue
- THEN la lecture DOIT être refusée (`team_not_in_league`)

### Requirement: Modification du staff par le commissaire
Le commissaire DOIT pouvoir modifier tout ou partie du staff d'une équipe de sa
ligue, y compris après le démarrage de la saison (le gel de roster opposé au
coach ne s'applique pas au commissaire). Les valeurs DOIVENT respecter les
plafonds résolus du roster × format. Chaque modification DOIT être journalisée
et DOIT déclencher le recalcul de la VE/VEA.

#### Scenario: Ajout d'un élément de staff
- WHEN le commissaire porte les relances de 2 à 3 sur une équipe dont le
  plafond est 8
- THEN l'équipe DOIT être mise à jour
- AND l'action DOIT être journalisée (`AuditLog`)

#### Scenario: Refus au-delà du plafond du roster
- WHEN la valeur demandée dépasse le plafond résolu (ou passe sous le minimum,
  1 pour les fans dévoués)
- THEN la modification DOIT être refusée (`staff_out_of_bounds`, HTTP 400)
- AND le message DOIT citer les bornes applicables

#### Scenario: Refus de l'apothicaire pour un roster qui n'y a pas droit
- WHEN le commissaire active l'apothicaire sur un roster dont la config
  l'interdit
- THEN la modification DOIT être refusée (`apothecary_not_allowed`, HTTP 400)

#### Scenario: Aucun changement demandé
- WHEN toutes les valeurs fournies sont déjà celles de l'équipe
- THEN la modification DOIT être refusée (`no_change`, HTTP 409)

### Requirement: Répercussion optionnelle sur la trésorerie
Le différentiel de coût du staff DOIT être calculé au barème du roster et
renvoyé, mais il NE DOIT être débité (ou remboursé) de la trésorerie QUE si la
demande le réclame explicitement. Un débit qui rendrait la trésorerie négative
DOIT être refusé sans aucune écriture.

#### Scenario: Correction sans refacturation
- WHEN le commissaire ajoute une relance sans demander la répercussion
- THEN la trésorerie NE DOIT PAS changer
- AND le coût théorique DOIT être renvoyé

#### Scenario: Achat répercuté
- WHEN le commissaire ajoute une relance en demandant la répercussion
- THEN la trésorerie DOIT être diminuée du coût de la relance

#### Scenario: Retrait remboursé
- WHEN le commissaire retire un élément de staff en demandant la répercussion
- THEN la trésorerie DOIT être augmentée du coût de cet élément

#### Scenario: Refus si la trésorerie devient négative
- WHEN le débit demandé dépasse la trésorerie de l'équipe
- THEN la modification DOIT être refusée (`insufficient_treasury`, HTTP 400)
- AND ni le staff ni la trésorerie NE DOIVENT être modifiés

### Requirement: Modification de la Ligue régionale par le commissaire
La Ligue régionale, immuable pour le coach après la création, DOIT pouvoir être
corrigée par le commissaire. La Ligue demandée DOIT appartenir aux Ligues
déclarées par le roster (résolution unique `effectiveRegionalRules` +
`getRegionalLeagueOptions`, la même que la création d'équipe). La valeur `null`
DOIT être acceptée (retour à l'union historique des règles du roster). Chaque
changement DOIT être journalisé.

#### Scenario: Correction d'un choix de Ligue
- WHEN le commissaire choisit une Ligue ouverte au roster, différente de
  l'actuelle
- THEN `Team.regionalLeague` DOIT être mis à jour
- AND l'action DOIT être journalisée (`AuditLog`)

#### Scenario: Ligue non ouverte au roster
- WHEN la Ligue demandée n'est pas déclarée pour ce roster
- THEN le changement DOIT être refusé (`invalid_regional_league`, HTTP 400)
- AND le message DOIT énumérer les choix possibles

#### Scenario: Axe régional neutralisé par un règlement de tournoi
- WHEN le règlement de tournoi de l'équipe neutralise le choix de Ligue
- THEN le changement DOIT être refusé (`regional_choice_unavailable`, HTTP 409)

#### Scenario: Star Players devenus inéligibles
- WHEN le nouveau choix rend inéligibles des Star Players déjà recrutés
- THEN ces Star Players DOIVENT être renvoyés dans `orphanedStarPlayers`
- AND ils NE DOIVENT PAS être retirés de l'équipe

### Requirement: Autorisation et périmètre
Seul le commissaire de la ligue DOIT pouvoir lire ou modifier les réglages
d'une équipe, et uniquement pour une équipe inscrite dans une saison de CETTE
ligue.

#### Scenario: Coach non commissaire
- WHEN un coach qui n'est pas le créateur de la ligue appelle une de ces routes
- THEN la requête DOIT être refusée (HTTP 403)
