# Médiathèque & gestion complète des images du blog

## Why

Le blog admin sait déjà **uploader** une image (`POST /api/admin/blog/upload` :
magic bytes, 8 Mo, nom régénéré) et l'insérer dans l'éditeur TipTap. Mais il
n'existe **aucune interface de gestion** : impossible de voir les images déjà
uploadées, les réutiliser, éditer leur texte alternatif, consulter leurs
métadonnées ou les supprimer. La couverture d'article est un simple champ URL nu
(sans aperçu ni upload).

Demande de l'utilisateur : une **gestion complète** des images des articles.
Décision d'architecture validée : **listing disque direct** (le dossier
`BLOG_UPLOAD_DIR` reste la source de vérité, aucun modèle Prisma) — cohérent avec
les uploads n8n et les images historiques, et calqué sur le précédent
`routes/admin-sim-replays.ts`.

## What Changes

- **Brique 1 — Inventaire disque.** Module `utils/blog-image-store.ts` (toutes
  les fonctions prennent `dir`) : `listBlogImages` (filtre, recherche,
  pagination, tri), `getBlogImage`, `setBlogImageAlt`, `recordUploadedImage`,
  `deleteBlogImage`, `resolveBlogImagePath` (sécurité). Métadonnées éditables
  (alt + dimensions) persistées dans un **sidecar JSON caché par image**
  (`.<image>.json`), écriture atomique. Parseur de dimensions **maison sans
  dépendance** (`utils/blog-image-dimensions.ts`, PNG/GIF/JPEG/WEBP).
- **Brique 2 — Endpoints admin.** `GET /images` (liste paginée),
  `PATCH /images/:filename` (alt), `DELETE /images/:filename` (avec
  reference-check 409 + `?force`). `POST /upload` capture désormais les
  dimensions. Getter `getBlogUploadDir()` (testabilité). `express.static` durci
  (`dotfiles: "ignore"`).
- **Brique 3 — Médiathèque admin.** Galerie réutilisable `MediaLibrary`
  (`manage`/`picker`) : upload (bouton + glisser-déposer), recherche, tri,
  pagination, alt inline, copie d'URL, suppression. Page `/admin/blog/images`,
  lien sidebar, bouton dans l'en-tête du blog.
- **Brique 4 — Réutilisation.** `MediaLibraryModal` (picker) branché dans
  l'éditeur TipTap (bouton `📚`) et dans le nouveau champ `CoverImageField`
  (aperçu + upload + médiathèque + retirer + repli URL) du formulaire d'article.

## Impact

- **Capability** : nouvelle spec `blog-media`.
- **Code serveur** : `utils/blog-image-dimensions.ts` (+test),
  `utils/blog-image-store.ts` (+test), `utils/blog-upload.ts` (getter),
  `schemas/blog.schemas.ts` (3 schemas), `routes/admin-blog.ts` (3 routes +
  branchement upload), `routes/admin-blog-images.test.ts`, `index.ts`
  (dotfiles).
- **Code web** : `app/admin/blog/{MediaLibrary,MediaLibraryModal,CoverImageField}.tsx`
  (+tests), `app/admin/blog/images/page.tsx`, `api.ts` (client), `BlogEditor.tsx`,
  `BlogPostForm.tsx`, `app/admin/layout.tsx`, `app/admin/blog/page.tsx`.
- **Aucune migration Prisma, aucune nouvelle dépendance.**

## Non-Goals

- **Modèle Prisma `BlogImage`** : explicitement écarté au profit du listing
  disque + sidecar (pas de divergence avec le disque, pas de backfill).
- **Recadrage / redimensionnement / conversion** d'images : hors scope.
- **Nettoyage automatique des images orphelines** (non référencées) : la
  suppression reste une action admin explicite (le DELETE avertit déjà si une
  image est utilisée).
