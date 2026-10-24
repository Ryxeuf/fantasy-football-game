# commissioner-team-settings

## MODIFIED Requirements

### Requirement: Modification du staff par le commissaire
Le commissaire DOIT pouvoir modifier tout ou partie du staff d'une équipe de sa
ligue, y compris après le démarrage de la saison (le gel de roster opposé au
coach ne s'applique pas au commissaire). Les valeurs DOIVENT respecter les
plafonds résolus du roster × format et le minimum de Fans Dévoués de
l'équipe (1 si son fan offert est compté, 0 sinon — cf. `team-dedicated-fans`).
Chaque modification DOIT être journalisée et DOIT déclencher le recalcul de la
VE/VEA.

#### Scenario: Ajout d'un élément de staff
- WHEN le commissaire porte les relances de 2 à 3 sur une équipe dont le
  plafond est 8
- THEN l'équipe DOIT être mise à jour
- AND l'action DOIT être journalisée (`AuditLog`)

#### Scenario: Refus au-delà du plafond du roster
- WHEN la valeur demandée dépasse le plafond résolu (ou passe sous le minimum
  de l'équipe pour les fans dévoués)
- THEN la modification DOIT être refusée (`staff_out_of_bounds`, HTTP 400)
- AND le message DOIT citer les bornes applicables

#### Scenario: Fans d'une équipe inscrite avant le démarrage
- WHEN le commissaire ramène à 0 les Fans Dévoués d'une équipe inscrite dont
  le fan offert n'est pas encore accordé (`leagueFreeFan = false`, saison non
  démarrée)
- THEN la modification DOIT être acceptée

#### Scenario: Refus de l'apothicaire pour un roster qui n'y a pas droit
- WHEN le commissaire active l'apothicaire sur un roster dont la config
  l'interdit
- THEN la modification DOIT être refusée (`apothecary_not_allowed`, HTTP 400)

#### Scenario: Aucun changement demandé
- WHEN toutes les valeurs fournies sont déjà celles de l'équipe
- THEN la modification DOIT être refusée (`no_change`, HTTP 409)
