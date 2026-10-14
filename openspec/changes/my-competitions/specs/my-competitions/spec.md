# my-competitions

## Purpose

Permettre à chaque coach de retrouver SES ligues et coupes — celles qu'il a
créées ou auxquelles une de ses équipes participe — avec son rôle dans
chacune, depuis les listes existantes comme depuis une page dédiée.

## ADDED Requirements

### Requirement: Une compétition « à moi » répond à une règle unique

Une ligue ou une coupe DOIT être « à moi » si j'en suis le créateur
(commissaire), ou si une équipe dont je suis propriétaire est ou a été inscrite
à une de ses éditions (une saison de ligue, la coupe elle-même), quel que soit
le statut de l'inscription (retrait compris) et même si l'équipe a été
supprimée depuis. Une invitation en attente ne suffit pas, le rôle
d'administrateur non plus. Cette règle DOIT être résolue au même endroit pour
toutes les lectures qui l'appliquent.

#### Scenario: Commissaire
- **WHEN** un coach a créé une ligue sans y inscrire d'équipe
- **THEN** cette ligue DOIT être « à lui »

#### Scenario: Joueur retiré
- **WHEN** l'équipe d'un coach s'est retirée de la saison en cours d'une ligue
- **THEN** cette ligue DOIT rester « à lui »

#### Scenario: Saison passée
- **WHEN** l'équipe d'un coach a joué la saison 1 d'une ligue mais n'est pas inscrite à la saison 2 en cours
- **THEN** cette ligue DOIT être « à lui »

#### Scenario: Équipe supprimée
- **WHEN** un coach a supprimé une équipe qui avait joué une coupe privée terminée
- **THEN** cette coupe DOIT rester « à lui », sur la liste comme dans les archives

#### Scenario: Invité seulement
- **WHEN** un coach n'a qu'une invitation en attente pour une ligue
- **THEN** cette ligue NE DOIT PAS être « à lui »

#### Scenario: Administrateur
- **WHEN** un administrateur n'a ni créé une coupe ni inscrit d'équipe
- **THEN** cette coupe NE DOIT PAS être « à lui »

### Requirement: « Les miennes » est un sous-ensemble des compétitions visibles

Toute compétition servie comme « à moi » DOIT aussi être visible du même
lecteur selon les règles de visibilité en vigueur (ligue privée, coupe
privée). Aucune lecture « à moi » NE DOIT faire apparaître une compétition
que le listing général cacherait à ce lecteur.

#### Scenario: Ligue privée d'un joueur
- **WHEN** un coach inscrit à une ligue privée liste ses compétitions puis toutes les ligues
- **THEN** la ligue DOIT apparaître dans les deux listes

### Requirement: Le rôle du lecteur est servi par le serveur

Chaque compétition servie par `GET /leagues`, `GET /cup` et
`GET /competitions/me` DOIT porter `viewerRoles` : `commissioner` (booléen),
`participant` (`active`, `withdrawn`, `former` ou `null`) et les équipes du
lecteur engagées dans l'édition courante. L'édition courante d'une ligue est
sa saison de plus haut numéro ; `former` désigne une participation limitée à
des saisons antérieures. L'interface NE DOIT PAS recalculer ces rôles.

#### Scenario: Commissaire qui joue dans sa ligue
- **WHEN** le créateur d'une ligue y a inscrit une équipe à la saison courante
- **THEN** `viewerRoles` DOIT valoir `commissioner: true` et `participant: "active"` avec cette équipe

#### Scenario: Retrait
- **WHEN** l'équipe du lecteur s'est retirée de la saison courante
- **THEN** `participant` DOIT valoir `withdrawn`

#### Scenario: Ancienne saison
- **WHEN** le lecteur n'a joué que la saison 1 et que la saison 2 existe
- **THEN** `participant` DOIT valoir `former` et la liste des équipes engagées DOIT être vide

#### Scenario: Tiers
- **WHEN** le lecteur n'a aucun lien avec une ligue publique listée
- **THEN** `viewerRoles` DOIT valoir `commissioner: false` et `participant: null`

### Requirement: Les listings filtrent « les miennes » côté serveur

`GET /leagues` et `GET /cup` DOIVENT accepter `scope` (`all` par défaut,
`mine`). Avec `mine`, seules les compétitions « à moi » DOIVENT être servies,
les autres filtres (statut, pagination) s'appliquant par-dessus et le total
paginé portant sur ce sous-ensemble. Une valeur inconnue DOIT être refusée
en `400`.

#### Scenario: Ligues à moi, paginées
- **WHEN** un coach demande `GET /leagues?scope=mine&limit=10`
- **THEN** la réponse DOIT ne contenir que ses ligues et `meta.total` DOIT compter ses seules ligues

#### Scenario: Défaut inchangé
- **WHEN** un coach appelle `GET /cup` sans `scope`
- **THEN** la réponse DOIT être celle d'aujourd'hui : coupes publiques non archivées plus ses coupes privées

#### Scenario: Valeur invalide
- **WHEN** un client envoie `GET /leagues?scope=friends`
- **THEN** le serveur DOIT répondre `400`

### Requirement: Les listes proposent « Toutes / Les miennes »

Les pages `/leagues`, `/leagues/archived` et `/cups` DOIVENT proposer un
sélecteur « Toutes / Les miennes », positionné sur « Toutes » par défaut. Le
choix DOIT être porté par l'URL (`?scope=mine`) pour survivre au
rechargement, au bouton retour et au partage de lien. Chaque carte DOIT
afficher le rôle du lecteur (commissaire, inscrit, retiré).

#### Scenario: Arrivée sur la liste
- **WHEN** un coach ouvre `/leagues`
- **THEN** « Toutes » DOIT être sélectionné et la liste DOIT être celle d'aujourd'hui

#### Scenario: Lien partagé
- **WHEN** un coach ouvre `/cups?scope=mine`
- **THEN** « Les miennes » DOIT être sélectionné et seules ses coupes DOIVENT être listées

#### Scenario: Badge de rôle
- **WHEN** une ligue listée a été créée par le lecteur
- **THEN** sa carte DOIT afficher le badge « Commissaire »

### Requirement: Une phase commune aux ligues et aux coupes

Toute compétition servie par `GET /competitions/me` DOIT porter une phase
normalisée : `registration` (ligue `draft` ou `open`, coupe `ouverte`),
`in_progress` (ligue `in_progress`, coupe `en_cours`), `finished` (ligue
`completed`, coupe `terminee`) ou `archived` (ligue `archived`, coupe
`archivee`). Un statut inconnu DOIT être lu `in_progress`, jamais rejeté.

#### Scenario: Coupe ouverte
- **WHEN** une coupe a le statut `ouverte`
- **THEN** sa phase DOIT être `registration`

#### Scenario: Ligue terminée
- **WHEN** une ligue a le statut `completed`
- **THEN** sa phase DOIT être `finished`

### Requirement: La liste « mes compétitions » est servie par une route dédiée

`GET /competitions/me` DOIT exiger un utilisateur authentifié (`401`
sinon) et servir ses ligues et coupes « à moi », filtrables par `kind`
(`league`, `cup`), `role` (`commissioner`, `participant`) et `phase`
(`active` = inscriptions + en cours, `finished`, `archived`, `all` ; défaut
`active`), paginées (`limit` ≤ 100) avec un total. Tout paramètre invalide
DOIT être refusé en `400`.

#### Scenario: Filtre par rôle
- **WHEN** un coach demande `GET /competitions/me?role=commissioner&phase=all`
- **THEN** la réponse DOIT ne contenir que les ligues et coupes qu'il a créées, toutes phases confondues

#### Scenario: Défaut
- **WHEN** un coach appelle `GET /competitions/me` sans paramètre
- **THEN** la réponse DOIT contenir ses compétitions en inscriptions ou en cours, ligues et coupes mêlées

#### Scenario: Anonyme
- **WHEN** un visiteur sans jeton appelle `GET /competitions/me`
- **THEN** le serveur DOIT répondre `401`

### Requirement: La page « Mes compétitions »

La page `/me/competitions` DOIT être réservée aux utilisateurs connectés et
présenter leurs compétitions « à moi », ligues et coupes réunies, avec pour
chacune son type, sa phase, le rôle du lecteur, ses équipes engagées, son
prochain match et ses « à faire ». Les filtres de type, de rôle et de phase
DOIVENT être portés par l'URL ; la phase est « actives » par défaut.

#### Scenario: Ouverture
- **WHEN** un coach connecté ouvre `/me/competitions`
- **THEN** la page DOIT lister ses ligues et coupes actives avec son rôle sur chaque carte

#### Scenario: Aucune compétition
- **WHEN** un coach n'a aucune compétition « à lui »
- **THEN** la page DOIT l'indiquer et proposer des liens vers `/leagues` et `/cups`

#### Scenario: Non connecté
- **WHEN** un visiteur sans session demande `/me/competitions`
- **THEN** il DOIT être redirigé vers la connexion comme pour les autres pages `/me`

### Requirement: La page est atteignable depuis la navigation

Un utilisateur connecté DOIT trouver un lien « Mes compétitions » dans le
menu des compétitions et dans le menu de son compte, ainsi que sur les pages
`/leagues` et `/cups`. Le bouton « Mes compétitions » existant DOIT mener à
`/me/competitions`. Ces liens NE DOIVENT PAS être affichés à un visiteur non
connecté.

#### Scenario: Menu des compétitions
- **WHEN** un coach connecté ouvre le menu « Compétitions »
- **THEN** une entrée « Mes compétitions » DOIT pointer vers `/me/competitions`

#### Scenario: Visiteur
- **WHEN** un visiteur non connecté ouvre le menu « Compétitions »
- **THEN** aucune entrée « Mes compétitions » NE DOIT être affichée
