# league-playoff-launch

## MODIFIED Requirements

### Requirement: Restitution de l'état des playoffs au commissaire
Tant qu'aucun bracket n'existe, l'interface DOIT exposer au commissaire la
taille du bracket configurée (avec le nombre d'équipes qu'elle engage),
l'état d'avancement de la phase régulière, la cohérence des quotas de poule,
et une action de démarrage. Les quotas DOIVENT être présentés comme un TOTAL,
accompagné du quota de chaque poule. Les refus serveur DOIVENT être restitués
en clair. Pour les autres utilisateurs, l'affichage DOIT rester inchangé (rien
tant qu'il n'y a pas de bracket).

#### Scenario: Panneau commissaire sans bracket
- WHEN le commissaire consulte une saison dont le bracket n'est pas généré
- THEN il DOIT voir la taille configurée, l'état de la phase régulière, la
  cohérence des quotas et un bouton de démarrage

#### Scenario: Total des quotas détaillé par poule
- WHEN la saison a 2 poules qualifiant chacune 4 équipes pour un bracket de 8
- THEN le panneau DOIT annoncer 8 qualifiés AU TOTAL
- AND DOIT détailler 4 qualifiés pour chacune des deux poules
- AND NE DOIT PAS présenter 8 comme un nombre de qualifiés par poule

#### Scenario: Refus restitué
- WHEN le démarrage est refusé par le serveur
- THEN le motif DOIT être affiché en français dans le panneau

#### Scenario: Utilisateur non commissaire
- WHEN un utilisateur non commissaire consulte une saison sans bracket
- THEN aucun panneau de playoffs NE DOIT être affiché

### Requirement: Réglage de la taille du bracket en cours de saison
Le commissaire DOIT pouvoir modifier `playoffSize` (0, 2, 4 ou 8) après la
création de la saison, tant qu'aucun round de playoff n'existe et que la saison
n'est pas `completed`.

#### Scenario: Tour de bracket créé à la main
- WHEN un tour `kind="regular"` porte un `bracketSlot`
- THEN la modification de `playoffSize` DOIT être refusée comme après la
  génération du bracket

## ADDED Requirements

### Requirement: Quota de poule corrigeable jusqu'à la génération du bracket
Le commissaire DOIT pouvoir modifier le nombre de qualifiés
(`qualifiesForPlayoffs`) d'une poule tant qu'aucun tour de bracket n'existe
(round `kind="playoff"`, ou tour créé à la main portant un `bracketSlot`) et
que la saison n'est pas `completed`, y compris sur une saison `in_progress`.
C'est la même fenêtre que celle de la taille du bracket. Toute autre
modification d'une poule (création, suppression, affectation, nom, ordre,
couleur) DOIT rester refusée dès le démarrage de la saison.

#### Scenario: Quota corrigé en cours de saison
- WHEN le commissaire passe le quota d'une poule de 2 à 4 sur une saison
  `in_progress` sans round de playoff
- THEN la nouvelle valeur DOIT être enregistrée

#### Scenario: Composition toujours figée
- WHEN le commissaire renomme une poule d'une saison `in_progress`
- THEN la modification DOIT être refusée (HTTP 409)

#### Scenario: Quota figé par le bracket
- WHEN le commissaire modifie un quota alors qu'un round `kind="playoff"` existe
- THEN la modification DOIT être refusée (`playoffs_started`, HTTP 409)

#### Scenario: Tour de bracket créé à la main
- WHEN un tour `kind="regular"` porte un `bracketSlot`
- THEN il DOIT fermer la fenêtre du quota comme un round `kind="playoff"`

#### Scenario: Quota figé par la clôture
- WHEN la saison est `completed`
- THEN la modification du quota DOIT être refusée (HTTP 409)
