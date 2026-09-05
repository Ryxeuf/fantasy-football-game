# competition-documents

## ADDED Requirements

### Requirement: Dépôt de documents officiels par le commissaire

Toute compétition — ligue / championnat (`League`) comme coupe (`Cup`) — DOIT
pouvoir porter des **documents officiels** (règlement, calendrier, affiche).
Le dépôt DOIT être réservé au **commissaire** (créateur de la compétition) ou à
un **administrateur**, via
`POST /api/competitions/:kind/:competitionId/documents` (`kind` = `leagues` |
`cups`), le corps étant le **binaire brut** du fichier. Le titre et la
description facultatifs passent en query (`title`, `description`) ; sans titre,
le libellé DOIT être dérivé du nom de fichier d'origine, extension retirée.

#### Scenario: Le commissaire dépose un règlement PDF

- WHEN le créateur de la ligue envoie `POST /api/competitions/leagues/<id>/documents` avec un PDF en corps
- THEN le serveur DOIT répondre `201` avec le document créé (titre, type réel, poids, URL publique)
- AND le fichier DOIT être écrit sur le disque sous un nom généré par le serveur

#### Scenario: Un coach tiers est refusé

- WHEN un coach qui n'est pas le commissaire tente le même dépôt
- THEN le serveur DOIT répondre `403`
- AND NE DOIT écrire ni ligne en base ni fichier sur le disque

#### Scenario: Un administrateur dépose sur la compétition d'un autre

- WHEN un utilisateur portant le rôle `admin` dépose un document sur une compétition qu'il n'a pas créée
- THEN le dépôt DOIT réussir

### Requirement: Dépôt à la création comme à tout moment ensuite

Les documents DOIVENT pouvoir être ajoutés **au moment de la création** de la
compétition et **à n'importe quel moment ensuite**, y compris une fois la
compétition démarrée ou terminée. Aucun verrou de statut NE DOIT s'appliquer
(contrairement aux paramètres de scoring, figés dès le premier match joué).
La compétition n'ayant pas d'identifiant avant sa création, l'interface DOIT
mettre les fichiers de côté et les déposer juste après.

#### Scenario: Ajout sur une ligue en cours

- WHEN le commissaire dépose un document sur une ligue au statut `in_progress`
- THEN le dépôt DOIT réussir

#### Scenario: Documents choisis dans le formulaire de création

- WHEN un coach sélectionne des documents dans le formulaire de création d'une ligue ou d'une coupe
- THEN ils DOIVENT être déposés dès la compétition créée
- AND un échec de dépôt NE DOIT PAS annuler la compétition, mais être signalé à l'utilisateur

### Requirement: Formats acceptés et limite de taille

Un document DOIT être un PDF, PNG, JPEG, GIF ou WEBP, **déterminé par les
octets de signature du contenu** (jamais par le `Content-Type` client ni par
l'extension), et NE DOIT PAS dépasser **10 Mo**. Le nom du fichier sur le
disque DOIT être généré côté serveur : aucune portion du nom fourni par le
client ne DOIT pouvoir provoquer d'écriture ou de suppression hors du dossier
d'upload.

#### Scenario: Archive renommée en .pdf

- WHEN le corps envoyé est une archive ZIP alors que le nom annonce `.pdf`
- THEN le serveur DOIT répondre `415`
- AND NE DOIT rien écrire sur le disque

#### Scenario: Fichier de plus de 10 Mo

- WHEN le corps dépasse 10 Mo
- THEN le serveur DOIT répondre `413` sans lire l'intégralité du corps en mémoire

#### Scenario: Nom de fichier hostile

- WHEN le nom suggéré est `../../etc/passwd`
- THEN le nom stocké DOIT être un slug sûr suffixé d'un aléa, sans séparateur ni segment relatif

### Requirement: Consultation des documents

`GET /api/competitions/:kind/:competitionId/documents` DOIT lister les
documents triés par ordre d'affichage puis par date de création. Une
compétition **publique** DOIT être lisible par tous, y compris sans
authentification. Une compétition **privée** NE DOIT être lisible que par son
commissaire, un administrateur ou un coach inscrit.

#### Scenario: Visiteur anonyme sur une ligue publique

- WHEN un visiteur non connecté demande les documents d'une ligue publique
- THEN la liste DOIT être servie avec l'URL publique de chaque fichier

#### Scenario: Visiteur anonyme sur une compétition privée

- WHEN un visiteur non connecté demande les documents d'une compétition privée
- THEN le serveur DOIT répondre `403`

### Requirement: Modification et retrait

Le commissaire ou un administrateur DOIT pouvoir corriger le libellé, la
description et l'ordre d'affichage d'un document (`PATCH`), et le retirer
(`DELETE`). La suppression DOIT retirer la ligne **puis** le binaire : un
échec disque NE DOIT PAS laisser un document listé sans fichier.

#### Scenario: Suppression d'un document

- WHEN le commissaire supprime un document
- THEN la ligne DOIT disparaître de la base et le binaire du disque

#### Scenario: Binaire déjà absent

- WHEN le binaire a déjà disparu du disque (volume recréé)
- THEN la suppression DOIT réussir sans erreur

### Requirement: Administration transverse des documents

La console d'administration DOIT exposer **tous** les documents, toutes
compétitions confondues, via `GET /admin/competition-documents` : filtrage par
famille (`league` / `cup`), par compétition, recherche par sous-chaîne (titre,
nom d'origine, nom de compétition) et pagination. L'administrateur DOIT pouvoir
renommer (`PATCH`) et supprimer (`DELETE`) n'importe quel document. Toutes ces
routes DOIVENT être gardées par `authUser` + `adminOnly`.

#### Scenario: Listing filtré

- WHEN l'admin appelle `GET /admin/competition-documents?kind=cup&search=regle&page=2&limit=5`
- THEN la réponse DOIT porter la page demandée et le total, chaque entrée nommant sa compétition et son déposant

#### Scenario: Purge d'un document publié

- WHEN l'admin supprime un document déposé par un commissaire
- THEN la ligne et le binaire DOIVENT être retirés
- AND une entrée d'audit `competition-document.admin-delete` DOIT être enregistrée
