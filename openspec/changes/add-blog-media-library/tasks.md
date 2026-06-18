# Tasks — Médiathèque & gestion des images du blog

> **Livré.** Listing disque direct (aucune migration Prisma, aucune nouvelle
> dépendance). Suite serveur blog verte (63 tests), suite web médiathèque verte
> (13 tests), `tsc` exit 0 (server + web).

## 1. Backend — store & parseur (TDD) — FAIT

- [x] 1.1 `utils/blog-image-dimensions.ts` : `parseImageDimensions(buf)` pur
      (PNG/GIF/JPEG/WEBP par offsets d'en-tête, jamais de throw) + test fixtures
      (11 cas, dont buffer tronqué → null).
- [x] 1.2 `utils/blog-upload.ts` : `getBlogUploadDir()` (lecture env à l'appel,
      miroir de `getReplaysDir()`), call sites migrés (`index.ts`, upload).
- [x] 1.3 `utils/blog-image-store.ts` : listing filtré + recherche + tri +
      pagination, sidecar `.<image>.json` (atomic tmp+rename), backfill dims
      borné, `resolveBlogImagePath` (regex + confinement anti-traversal),
      `lstat`/`unlink` symlink-safe, erreurs typées `BlogImageStoreError`.
- [x] 1.4 `utils/blog-image-store.test.ts` (18 cas) : listing/tri/pagination/
      recherche, anti-traversal, round-trip alt, backfill, delete image+sidecar,
      orphelin ignoré, anti-clobber concurrent.

## 2. Backend — endpoints — FAIT

- [x] 2.1 `schemas/blog.schemas.ts` : `blogImageFilenameParamSchema`,
      `patchBlogImageSchema`, `adminBlogImageListQuerySchema` (+ types inférés).
- [x] 2.2 `routes/admin-blog.ts` : `GET /images`, `PATCH /images/:filename`,
      `DELETE /images/:filename` (reference-check 409 + `?force`), audit
      `blog-image.update`/`blog-image.delete`, mapping `BlogImageStoreError`
      → 400/404. Sans `req.body as` (garde CI).
- [x] 2.3 `routes/admin-blog.ts` `/upload` : `recordUploadedImage` best-effort
      (dimensions capturées avec le buffer).
- [x] 2.4 `index.ts` : `express.static(..., { dotfiles: "ignore" })`.
- [x] 2.5 `routes/admin-blog-images.test.ts` (9 cas, vrai tmpdir + prisma mocké) :
      list/search, PATCH alt/404/400, DELETE ok/409/force/404, audit.

## 3. Frontend — médiathèque — FAIT

- [x] 3.1 `app/admin/blog/api.ts` : `listBlogImages`, `updateBlogImageAlt`,
      `deleteBlogImage` (+ `BlogImageInUseError` pour le 409), types `BlogImage`.
- [x] 3.2 `app/admin/blog/MediaLibrary.tsx` : galerie `manage`/`picker`, upload
      (bouton + drag&drop), recherche/tri/pagination, alt inline (auto-save),
      copie URL, suppression (confirm + re-confirm force sur 409).
- [x] 3.3 `app/admin/blog/MediaLibraryModal.tsx` : overlay `role="dialog"`
      (Échap/overlay/✕) wrappant la galerie en picker.
- [x] 3.4 `app/admin/blog/images/page.tsx` : page admin (gating admin) ; lien
      sidebar `🖼️ Médiathèque` (`app/admin/layout.tsx`) + bouton en-tête blog.
- [x] 3.5 `MediaLibrary.test.tsx` (7 cas) : rendu, alt, delete, 409+force, refus,
      picker, upload.

## 4. Frontend — réutilisation — FAIT

- [x] 4.1 `app/admin/blog/CoverImageField.tsx` : aperçu + upload + médiathèque +
      retirer + repli URL + drag&drop ; branché dans `BlogPostForm.tsx`.
- [x] 4.2 `BlogEditor.tsx` : bouton toolbar `📚` ouvrant le picker, insertion
      `setImage({ src, alt })`.
- [x] 4.3 `CoverImageField.test.tsx` (6 cas) : aperçu, upload, retirer, picker,
      URL manuelle.

## 5. Docs — FAIT

- [x] 5.1 `docs/blog-feature.md` : section « Médiathèque & gestion des images » + tests ; nettoyage des « Évolutions possibles ».
