# Documents officiels de compétition

> Règlements, calendriers, affiches attachés à une **ligue / championnat** ou à
> une **coupe**. Déposés par le commissaire (ou un admin), consultables depuis
> la fiche de la compétition, administrés depuis
> `/admin/competition-documents`.

## Pourquoi

Une compétition se joue sur un règlement. Avant ce module, il vivait hors du
site (Discord, Google Drive, description de la ligue) : personne ne savait
quelle version faisait foi. Le site savait déjà stocker des binaires uploadés
(images du blog, logos d'équipe, images de joueurs) ; il manquait le PDF, le
rattachement à une compétition et la gouvernance.

## Modèle

`CompetitionDocument` (cf. `prisma/schema.prisma`, mirror sqlite dans
`apps/server/prisma/sqlite/schema.prisma`) porte les **métadonnées** ; le
binaire vit sur le disque.

| Colonne                | Rôle                                                                    |
| ---------------------- | ----------------------------------------------------------------------- |
| `leagueId` / `cupId`   | rattachement **polymorphe** : exactement une des deux est renseignée    |
| `title`, `description` | libellés éditables (défaut : nom d'origine sans extension)              |
| `filename`             | nom **généré par le serveur**, unique — la clé du fichier sur le disque |
| `originalName`         | nom côté client, conservé pour l'affichage                              |
| `mimeType`, `bytes`    | type **réel** (magic bytes) et poids                                    |
| `uploadedById`         | auteur, nullable (`onDelete: SetNull`)                                  |
| `sortOrder`            | ordre d'affichage, `max + 1` à la création                              |

Deux FK nullables plutôt que deux tables : la règle métier est la même des deux
côtés, la dupliquer la ferait diverger. On garde les cascades Prisma natives
(supprimer une ligue retire ses documents) et **une seule** table à
administrer. L'invariant « une seule des deux FK » n'est pas exprimable en
Prisma : il est tenu par `services/competition-documents.ts`, **seul chemin
d'écriture**.

> Rappel repo : `prisma/migrations/` est gitignoré, la prod applique le schéma
> par `prisma db push`. Ici c'est une table neuve — aucune colonne ajoutée à
> une table existante, donc aucun backfill nécessaire.

## Règles

- **Qui** : le commissaire (créateur de la compétition) **ou** un admin.
- **Quand** : à la création comme à tout moment ensuite, **y compris une fois
  la compétition démarrée**. Aucun verrou de statut — contrairement aux
  paramètres de scoring, figés dès le premier match joué.
- **Quoi** : PDF, PNG, JPEG, GIF, WEBP, **10 Mo maximum par fichier**.
- **Lecture** : compétition publique → tout le monde, même non connecté ;
  compétition privée → commissaire, admins et coachs inscrits.

## Sécurité

Trois gardes, reprises des uploads existants (`utils/blog-upload`,
`utils/team-logo-upload`) :

1. **Type par magic bytes**, jamais le `Content-Type` client ni l'extension —
   une archive ZIP renommée `.pdf` est refusée (`415`).
2. **Nom de fichier généré côté serveur** (`<slug>-<aléa>.<ext>`) : aucune
   portion du nom client ne survit, donc pas de path traversal. La suppression
   revalide le nom (`resolveCompetitionDocumentPath`) avant tout `unlink`.
3. **Plafond appliqué par le parser** `express.raw` : au-delà de 10 Mo, `413`
   sans lecture complète en mémoire.

Le binaire est ensuite servi par `express.static` sous un nom imprévisible,
comme les images du blog et les logos d'équipe : c'est la **liste** d'une
compétition privée qui est gardée, pas l'URL directe du fichier (cf. « Suites »).

## API

Routeur commissaire, monté sur `/api/competitions` — `:kind` = `leagues` |
`cups` :

| Méthode  | Route                              | Accès                                           |
| -------- | ---------------------------------- | ----------------------------------------------- |
| `GET`    | `/:kind/:id/documents`             | public si la compétition l'est, sinon membres   |
| `POST`   | `/:kind/:id/documents`             | commissaire ou admin — **corps = binaire brut** |
| `PATCH`  | `/:kind/:id/documents/:documentId` | commissaire ou admin                            |
| `DELETE` | `/:kind/:id/documents/:documentId` | commissaire ou admin                            |

Le `POST` accepte en query `filename` (nom d'origine), `title` et
`description`. Exemple :

```bash
curl -X POST \
  "https://api.nufflearena.fr/api/competitions/leagues/<id>/documents?filename=reglement.pdf&title=R%C3%A8glement%202027" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/pdf" \
  --data-binary @reglement.pdf
```

Routeur admin, monté sur `/admin/competition-documents` (`authUser` +
`adminOnly`) : `GET /` (filtres `kind`, `competitionId`, `search`, `page`,
`limit`), `PATCH /:documentId`, `DELETE /:documentId`.

Chaque écriture est tracée dans `AuditLog`
(`competition-document.upload|update|delete` et les variantes `admin-*`).

## Exploitation

| Variable                                 | Rôle                       | Défaut                                                 |
| ---------------------------------------- | -------------------------- | ------------------------------------------------------ |
| `COMPETITION_DOCUMENT_UPLOAD_DIR`        | dossier de stockage        | `apps/web/public/documents/competitions`               |
| `COMPETITION_DOCUMENT_ASSET_PUBLIC_BASE` | préfixe des URLs publiques | repli sur `BLOG_ASSET_PUBLIC_BASE`, sinon URL relative |

En prod les conteneurs web et server sont séparés : le dossier **doit** être un
volume persistant monté côté server (qui le sert via `express.static` sur
`/documents/competitions`), et la base publique doit pointer l'hôte API. Même
posture que `BLOG_UPLOAD_DIR` et `TEAM_LOGO_UPLOAD_DIR` (cf.
`docker-compose.prod.yml`).

## Suites possibles

- **Versionnage** : remplacer un règlement = supprimer puis redéposer ; un
  historique demanderait une table dédiée.
- **URL directe gardée** : servir le binaire derrière un contrôle d'accès
  (`Content-Disposition` authentifié) pour les compétitions privées.
- **Réordonnancement à la souris** : `sortOrder` est modifiable par l'API,
  l'UI ne l'expose pas encore.
