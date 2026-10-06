# Tasks — Documents officiels de compétition

## 1. Schéma

- [x] 1.1 Modèle `CompetitionDocument` (FK polymorphe `leagueId` XOR `cupId`, `filename` unique) + back-relations `League.documents`, `Cup.documents`, `User.competitionDocuments`.
- [x] 1.2 Mirror sqlite (`apps/server/prisma/sqlite/schema.prisma`).

## 2. Utilitaire d'upload

- [x] 2.1 `utils/competition-document-upload` : plafond 10 Mo, `detectDocumentType` (PDF + images), `generateDocumentFilename`, `resolveCompetitionDocumentPath`, URL publique.
- [x] 2.2 Tests unitaires (magic bytes, path traversal, repli de nom, override d'env).

## 3. Service

- [x] 3.1 `services/competition-documents` : list / create / update / delete + listing admin paginé.
- [x] 3.2 Contrôle d'accès : écriture commissaire|admin, lecture publique ou participant.
- [x] 3.3 Nettoyage du binaire orphelin quand l'insert échoue ; suppression best-effort.
- [x] 3.4 Tests (Prisma mocké, disque réel en tmpdir).

## 4. Routes

- [x] 4.1 Schémas Zod (`schemas/competition-document.schemas`) — query d'upload, PATCH, listing admin.
- [x] 4.2 `routes/competition-documents` (GET/POST/PATCH/DELETE) + mapping des erreurs typées (403/404/413/415).
- [x] 4.3 `routes/admin-competition-documents` (GET/PATCH/DELETE, `authUser` + `adminOnly`).
- [x] 4.4 Montage dans `index.ts` + `express.static` du dossier de documents.
- [x] 4.5 Tests de routes (commissaire et admin).

## 5. Web

- [x] 5.1 Client `lib/competition-documents` (+ dépôt différé après création).
- [x] 5.2 `components/CompetitionDocuments` — panneau liste + gestion.
- [x] 5.3 `components/PendingCompetitionDocuments` — sélecteur pour les formulaires de création.
- [x] 5.4 Fiche de ligue et fiche de coupe : panneau branché (commissaire ou admin).
- [x] 5.5 Création de ligue (`LeagueForm` + `/leagues/new`) et création de coupe (`/cups`) : dépôt post-création.
- [x] 5.6 Console admin `/admin/competition-documents` + entrée de navigation.
- [x] 5.7 Tests (panneau, sélecteur, client).

## 6. Documentation

- [x] 6.1 `docs/competition-documents.md` (modèle, sécurité, exploitation).
- [x] 6.2 Mémoire projet (`CLAUDE.md`) : le pattern « upload de binaire » et le rattachement polymorphe.
