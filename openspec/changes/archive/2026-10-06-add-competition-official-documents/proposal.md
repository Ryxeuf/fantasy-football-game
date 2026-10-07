# Documents officiels de compétition (ligues, championnats, coupes)

## Why

Une ligue ou une coupe se joue sur un **règlement**, un calendrier, parfois une
charte ou une affiche. Aujourd'hui ces documents vivent hors du site : le
commissaire les colle dans la description (limitée, non cliquable), les envoie
sur Discord ou les héberge ailleurs — et personne ne sait quelle version fait
foi. Rien dans le produit ne permet d'attacher un PDF à une compétition.

Le site sait déjà stocker des binaires uploadés (images du blog, logos
d'équipe, images de joueurs) : dossier servi par `express.static`, type détecté
par magic bytes, nom de fichier régénéré côté serveur. Il manquait le PDF, le
rattachement à une compétition et la gouvernance (qui dépose, qui modère).

## What Changes

- **Modèle** `CompetitionDocument` : rattachement **polymorphe** par deux FK
  nullables (`leagueId` XOR `cupId`), métadonnées (titre, description, type
  réel, poids, ordre d'affichage, auteur) — le binaire reste sur le disque.
  Mirror sqlite pour les tests E2E API.
- **Utilitaire** `utils/competition-document-upload` : plafond **10 Mo**,
  détection PDF/PNG/JPEG/GIF/WEBP par magic bytes, génération et validation du
  nom de fichier (anti path-traversal), URL publique
  `/documents/competitions/<fichier>`.
- **Service** `services/competition-documents` : seul chemin d'écriture. Tient
  l'invariant XOR des FK, garde disque et base cohérents (binaire orphelin
  retiré si l'insert échoue), et concentre le contrôle d'accès.
- **Routes commissaire** `/api/competitions/:kind/:competitionId/documents`
  (`kind` = `leagues` | `cups`) : `GET` (lecture), `POST` (corps binaire brut),
  `PATCH`, `DELETE`. **Écriture réservée au commissaire (créateur) ou à un
  admin**, sans verrou de statut : le dépôt reste possible une fois la
  compétition démarrée.
- **Console admin** `/admin/competition-documents` (+ routes
  `/admin/competition-documents`) : vue transverse, filtres famille /
  recherche, pagination, renommage et purge.
- **Web** : panneau « Documents officiels » sur la fiche de ligue et la fiche
  de coupe (téléchargement pour tous, gestion pour le commissaire) ; sélecteur
  de fichiers dans les **formulaires de création** de ligue et de coupe, déposé
  juste après la création (l'id n'existe pas avant).

## Decisions

- **Rattachement polymorphe plutôt que deux tables** : la règle métier est
  identique des deux côtés ; deux tables (et deux jeux de handlers) auraient
  fatalement divergé. Deux FK nullables conservent les cascades Prisma natives
  et donnent **une seule** table à administrer. L'invariant « exactement une
  des deux FK » n'est pas exprimable en Prisma : il est tenu par le service,
  seul chemin d'écriture.
- **Aucun verrou de statut** : contrairement aux paramètres de scoring (figés
  dès le premier match joué), un règlement doit pouvoir être corrigé en cours
  de saison. C'est la demande explicite.
- **Corps binaire brut, pas de multipart** : aligné sur les trois uploads
  existants du repo. Le plafond est appliqué par le parser `express.raw`
  lui-même (413 avant toute lecture complète en mémoire).
- **Lecture publique pour une compétition publique** : un règlement a vocation
  à être diffusé. Une compétition privée réserve ses documents à son
  commissaire, aux admins et aux coachs inscrits.

## Out of scope (suivi)

- **Versionnage des documents** : remplacer un règlement = supprimer puis
  redéposer. Un historique des versions demanderait une table dédiée.
- **Fichier servi sans contrôle d'accès** : comme les images du blog et les
  logos d'équipe, le binaire est servi par `express.static` sous un nom
  imprévisible. La liste d'une compétition privée est gardée, pas l'URL
  directe. Un `Content-Disposition` authentifié serait le suivi.
- **Réordonnancement à la souris** : `sortOrder` existe et est modifiable par
  l'API, l'UI ne l'expose pas encore.
- **Formats bureautiques** (docx, xlsx) : refusés — pas de détection fiable par
  magic bytes au-delà de la signature ZIP générique.

## Impact

- Schéma : 1 modèle, 3 back-relations (`League`, `Cup`, `User`). Aucune colonne
  ajoutée à une table existante, donc aucun backfill (rappel : `prisma db push`
  en prod, `prisma/migrations/` est gitignoré).
- Nouveau dossier d'assets à monter en volume en prod :
  `COMPETITION_DOCUMENT_UPLOAD_DIR` (+ `COMPETITION_DOCUMENT_ASSET_PUBLIC_BASE`,
  qui retombe sur `BLOG_ASSET_PUBLIC_BASE`).
