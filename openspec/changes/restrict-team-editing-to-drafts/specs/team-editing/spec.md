# team-editing (delta)

Capability : l'édition du roster d'une équipe par son **propriétaire**. Une
équipe est éditable tant qu'elle n'est pas **engagée** dans une compétition ; une
fois engagée, sa composition/budget est verrouillée (anti-triche), la progression
légitime (trésorerie, montée de niveau) passant par des surfaces dédiées. Surface
serveur (`apps/server`) + UI (`apps/web`). Distincte de l'édition **commissaire**
(`/leagues/:id/teams/:id/…`), non concernée par ces verrous.

## ADDED Requirements

### Requirement: Définition d'une équipe engagée
Une équipe DOIT être considérée comme **engagée** dès qu'il existe pour elle au
moins une `TeamSelection`, un `LocalMatch` non `cancelled` (en tant qu'équipe A
ou B), une `LeagueParticipant`, ou une `CupParticipant`. Sinon elle est un
**brouillon**.

#### Scenario: Brouillon jamais engagé
- WHEN une équipe n'a aucune sélection de match, aucun match local non annulé,
  aucune participation ligue ni coupe
- THEN elle DOIT être considérée comme un brouillon (éditable)

#### Scenario: Engagement par participation
- WHEN une équipe a au moins une `TeamSelection`, un `LocalMatch` non annulé, une
  `LeagueParticipant` ou une `CupParticipant`
- THEN elle DOIT être considérée comme engagée (verrouillée)

### Requirement: Verrouillage de la composition d'une équipe engagée
Les mutations de composition/budget par le propriétaire DOIVENT être refusées
(HTTP 403) pour une équipe engagée : ajout de joueur, suppression de joueur,
modification du staff/inducements (`PUT /:id/info`), renommage
(`PUT /:id`) et sauvegarde batch du roster (`PUT /:id/roster`).

#### Scenario: Refus d'ajout sur équipe engagée
- WHEN le propriétaire tente d'ajouter un joueur à une équipe engagée
- THEN la requête DOIT être refusée (HTTP 403)
- AND aucun joueur NE DOIT être créé

#### Scenario: Refus de suppression sur équipe engagée
- WHEN le propriétaire tente de retirer un joueur d'une équipe engagée
- THEN la requête DOIT être refusée (HTTP 403)
- AND aucun joueur NE DOIT être supprimé

#### Scenario: Refus de sauvegarde de roster sur équipe engagée
- WHEN le propriétaire soumet une sauvegarde batch du roster d'une équipe engagée
- THEN la requête DOIT être refusée (HTTP 403)
- AND le roster NE DOIT PAS être modifié

### Requirement: Progression légitime non verrouillée
La dépense de trésorerie (`POST /:id/purchase`) et la montée de niveau des joueurs
(avancement PSP) NE DOIVENT PAS être bloquées par l'engagement : ce sont des
progressions de jeu légitimes, pas des modifications de la composition initiale.

#### Scenario: Achat trésorerie sur équipe engagée
- WHEN le propriétaire achète un joueur/staff avec la trésorerie d'une équipe
  engagée (dans les limites de trésorerie)
- THEN l'achat DOIT être autorisé

#### Scenario: Montée de niveau sur équipe engagée
- WHEN le propriétaire fait progresser un joueur via ses PSP sur une équipe
  engagée
- THEN l'avancement DOIT être autorisé

### Requirement: Édition libre d'un brouillon
Pour une équipe brouillon, le propriétaire DOIT pouvoir modifier librement la
composition, y compris descendre transitoirement sous le minimum de joueurs du
format, sans blocage per-action (le budget peut être dépassé transitoirement dans
l'UI). Aucune contrainte de format/budget NE DOIT bloquer une action d'édition
individuelle sur un brouillon.

#### Scenario: Descendre sous le minimum sur un brouillon
- WHEN le propriétaire retire un joueur d'un brouillon déjà au minimum de joueurs
- THEN la suppression DOIT être autorisée (HTTP 200 pour l'endpoint unitaire ;
  ou retrait local dans l'éditeur)

### Requirement: Validation du roster à la sauvegarde
La sauvegarde batch du roster (`PUT /:id/roster`) d'un brouillon DOIT valider
l'état cible complet comme à la création avant de persister : nombre de joueurs
dans les bornes du format de l'équipe (BB11 : 11-16 ; Sevens : 7-11), min/max par
poste respectés, numéros uniques entre 1 et 99, noms non vides, et coût total
(joueurs + staff + Star Players) ≤ budget initial. En cas de succès, le diff
DOIT être appliqué de façon transactionnelle : suppression des joueurs absents,
mise à jour (nom/numéro) des conservés, création des nouveaux (stats dérivées du
poste), puis recalcul de la valeur d'équipe.

#### Scenario: Sauvegarde d'un roster valide
- WHEN le propriétaire sauvegarde un roster respectant bornes de format, postes et
  budget
- THEN les joueurs absents DOIVENT être supprimés, les conservés mis à jour, les
  nouveaux créés
- AND la valeur d'équipe DOIT être recalculée
- AND la réponse DOIT contenir l'équipe à jour (HTTP 200)

#### Scenario: Refus sous le minimum du format
- WHEN le roster soumis compte moins de joueurs que le minimum du format (ex. 10
  en BB11)
- THEN la sauvegarde DOIT être refusée (HTTP 400) avec un message indiquant les
  bornes autorisées

#### Scenario: Refus budget dépassé
- WHEN le coût total (joueurs + staff + Star Players) dépasse le budget initial
- THEN la sauvegarde DOIT être refusée (HTTP 400) avec un message de dépassement

#### Scenario: Refus numéros dupliqués
- WHEN deux joueurs partagent le même numéro
- THEN la sauvegarde DOIT être refusée (HTTP 400)

#### Scenario: Identifiant de joueur étranger
- WHEN un `id` de joueur fourni n'appartient pas à l'équipe
- THEN la sauvegarde DOIT être refusée (HTTP 400)

### Requirement: Éditeur inaccessible pour une équipe engagée
La page d'édition d'équipe DOIT rediriger vers la fiche de l'équipe lorsque
celle-ci est engagée, de sorte que l'UI d'édition ne soit jamais présentée pour
une équipe verrouillée.

#### Scenario: Redirection depuis l'éditeur
- WHEN le propriétaire ouvre la page d'édition d'une équipe engagée
- THEN il DOIT être redirigé vers la fiche de l'équipe
- AND l'UI d'édition NE DOIT PAS être affichée
