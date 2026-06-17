# Feature : Blog

> Première version du blog éditorial Nuffle Arena. Articles rédigés depuis
> l'admin via éditeur WYSIWYG TipTap, stockés en HTML sanitizé,
> exposés publiquement via SSR + ISR sur `/blog` et `/blog/[slug]`.

## Stack

- **Backend** : modèle Prisma `BlogPost` + routes Express (`admin-blog`,
  `public-blog`), validation Zod, sanitization `sanitize-html`, audit log,
  cache `memoizeAsync` 5 min côté public.
- **Frontend** : pages Next.js App Router (server components SSR + ISR
  300s pour le public, client components pour l'admin), éditeur TipTap
  (StarterKit + Link + Image + Placeholder), rendu prose via plugin
  `@tailwindcss/typography`.

## Modèle Prisma

`prisma/schema.prisma` (en fin de fichier) :

```prisma
model BlogPost {
  id            String    @id @default(cuid())
  slug          String    @unique
  title         String
  excerpt       String?    // max 280 chars (SEO meta description)
  contentHtml   String     // sanitizé serveur-side avant écriture
  coverImageUrl String?
  status        String    @default("draft")  // "draft" | "published"
  publishedAt   DateTime?
  author        User?     @relation("BlogPostAuthor", fields: [authorId], references: [id], onDelete: SetNull)
  authorId      String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  @@index([status, publishedAt])
  @@index([authorId])
}
```

`publishedAt` est set côté serveur lors de la **première** transition
`draft → published` (jamais ré-écrit ensuite, même si on repasse en
brouillon puis republie).

## Backend

### Routes admin (`/api/admin/blog/*`, auth + adminOnly)

- `GET /posts?status=draft|published&search=…` — liste tous statuts
- `GET /posts/:id` — récupère un article (avec contentHtml brut)
- `POST /posts` — création, sanitize HTML, set publishedAt si published
- `PATCH /posts/:id` — update partielle, sanitize si contentHtml fourni,
  set publishedAt à la première publication uniquement
- `DELETE /posts/:id` — suppression définitive
- `POST /upload?filename=<slug>` — **upload d'image** (voir ci-dessous)

Chaque mutation déclenche `safeRecordAdminActionFromRequest` (audit log)
+ `invalidatePublicBlogCache()` (drop cache memoizeAsync namespace
`public-blog`).

### Upload d'images (`POST /api/admin/blog/upload`)

Endpoint authentifié (`authUser + adminOnly`, comme tout `/api/admin/blog/*`)
qui stocke une image et renvoie son URL publique. Pensé pour l'éditeur admin
**et** pour une automatisation externe (workflow n8n).

- **Corps** : le **binaire brut** de l'image (pas de multipart). Le serveur
  parse via `express.raw` (`apps/server/src/routes/admin-blog.ts`).
- **Query** : `?filename=<base>` optionnel (slug de l'article) — sert de base
  de nom ; le serveur **régénère** un nom unique `\<base\>-\<rand\>.\<ext\>`.
- **Validation** : type déterminé par **magic bytes** (PNG/JPEG/GIF/WEBP),
  jamais par le `Content-Type` client ; taille max **8 Mo** ; nom de fichier
  régénéré côté serveur (pas de path traversal). Helpers + tests :
  `apps/server/src/utils/blog-upload.ts`.
- **Réponse 201** : `{ url, filename, mime, bytes }`. `url` est insérable tel
  quel dans `coverImageUrl` ou dans le contenu (img). Erreurs : 400 (corps
  vide / invalide), 413 (trop gros), 415 (format non supporté).

**Stockage & service** — point d'architecture important :

- Dossier de destination : `BLOG_UPLOAD_DIR` (env). Défaut dev :
  `apps/web/public/images/blog` (servi par Next). Le dossier **n'est pas
  versionné** (`.gitignore` + `.gitkeep`).
- Le **serveur Express sert lui-même** le dossier via
  `express.static("/images/blog", …)`. En prod, les conteneurs `web` et
  `server` sont **séparés** (images GHCR distinctes, pas de volume partagé) :
  Next ne voit donc pas les fichiers uploadés. C'est pourquoi le serveur les
  sert, sur un **volume persistant**.
- Prod (`docker-compose.prod.yml`) : volume `blog_uploads` monté sur
  `/data/blog-images`, `BLOG_UPLOAD_DIR=/data/blog-images`,
  `BLOG_ASSET_PUBLIC_BASE=https://api.nufflearena.fr` (URLs renvoyées
  **absolues** sur l'hôte API). En dev, base vide ⇒ URL relative
  `/images/blog/x` servie par Next.
- Les quelques visuels historiques déjà commités dans `apps/web/public/images/blog`
  restent servis par le build Next (URLs relatives) ; seuls les nouveaux
  uploads passent par le serveur.

**Usage n8n** (remplace l'upload ImgBB du workflow `n8n-blog-generator`) :
le workflow se logge déjà via `POST /api/auth/login` (compte admin) → JWT, puis
poste l'article sur `/api/admin/blog/posts`. Le même JWT autorise l'upload :

```bash
curl -X POST "https://api.nufflearena.fr/api/admin/blog/upload?filename=mon-slug" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @image.png
# => { "url": "https://api.nufflearena.fr/images/blog/mon-slug-ab12cd34ef56.png", ... }
```

Côté éditeur admin, le bouton **⬆️🖼️** (`BlogEditor.tsx`) ouvre un sélecteur de
fichier et insère l'image uploadée ; le bouton **🖼️** garde l'insertion par URL.

### Routes publiques (`/api/blog/*`, cache 5 min)

- `GET /blog/posts?page=1&limit=20` — articles publiés paginés
- `GET /blog/posts/:slug` — un article publié

Filtres systématiques : `status === "published"` ET `publishedAt != null`.

### Sanitization HTML — `apps/server/src/utils/sanitize-blog-html.ts`

Allowlist stricte alignée sur les extensions TipTap utilisées :

- Tags : p, br, strong, em, u, s, code, pre, blockquote, ul, ol, li,
  h1-h4, a, img, hr
- Attributs `a` : href, title, target, rel — forcés à
  `rel="noopener noreferrer nofollow"` + `target="_blank"`
- Attributs `img` : src, alt, title, width, height
- Schemes : http, https, mailto (img : http/https uniquement)

Le HTML est re-sanitizé à chaque PATCH (ne fait pas confiance à ce qui
est en DB — défense en profondeur).

### Schémas Zod — `apps/server/src/schemas/blog.schemas.ts`

- `slug` en kebab-case strict (regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`)
- `title` 3..200, `excerpt` max 280, `contentHtml` 1..200_000
- `coverImageUrl` : path `/...` ou URL http(s)
- `status` enum `draft | published`

## Frontend

### Pages publiques (App Router)

- `app/blog/page.tsx` — server component, `revalidate = 300`, fetch via
  `fetchServerJson`. Grille de cards 1/2/3 colonnes selon viewport.
  Cover via `<img>` standard (URLs externes arbitraires non whitelist
  Next/Image).
- `app/blog/[slug]/page.tsx` — server component, `revalidate = 300`,
  `generateMetadata` dynamique avec OG + Twitter + JSON-LD
  `BlogPosting` (schema.org). 404 via `notFound()` si introuvable.
- `app/blog/error.tsx` — boundary erreur SSR (pattern aligné sur `/skills`).
- `app/blog/BlogArticle.tsx` — composant présentationnel pur (couverture
  + en-tête + contenu) partagé entre la page publique et l'aperçu admin,
  pour un **rendu final identique**.

Le rendu HTML utilise `dangerouslySetInnerHTML` — la confiance vient
de la sanitization serveur côté écriture (jamais du client).

### Aperçu admin d'un brouillon (`/blog/preview/[id]`)

- `app/blog/preview/[id]/page.tsx` — client component qui rend **n'importe
  quel article (y compris un brouillon non publié)** dans le chrome public
  réel du site (layout racine Header/Footer) via le composant partagé
  `BlogArticle` → c'est strictement le « rendu final ».
- La donnée provient de l'API **admin** (`getAdminBlogPost`, middleware
  `authUser + adminOnly`, Bearer token localStorage). Un non-admin reçoit
  une erreur 401/403 et voit un message — jamais le contenu. Aucune route
  serveur ajoutée : `GET /api/admin/blog/posts/:id` exposait déjà le
  contenu brut des brouillons.
- Une bannière affiche le statut (« Brouillon — non publié » / « Publié »),
  un retour vers `/admin/blog`, et un lien vers la page publique si publié.
- Liens « 👁 Aperçu » ajoutés dans la liste admin (tous statuts) et sur la
  page d'édition (ouverture nouvel onglet).

### Pages admin (`/admin/blog`, client components)

- `app/admin/blog/page.tsx` — liste, filtres status + recherche, actions
  Modifier / Aperçu / Voir publié / Supprimer.
- `app/admin/blog/new/page.tsx` — création, redirige vers l'edit après
  succès.
- `app/admin/blog/[id]/edit/page.tsx` — édition, affiche le statut +
  publishedAt actuel.
- `app/admin/blog/BlogPostForm.tsx` — formulaire partagé (titre,
  slug auto-généré + override manuel, excerpt avec compteur, cover URL,
  éditeur, sélecteur status).
- `app/admin/blog/BlogEditor.tsx` — wrapper TipTap avec toolbar (H2/H3,
  gras/italique/strike/code, listes, citation, code block, lien, image,
  séparateur, undo/redo).
- `app/admin/blog/api.ts` — client typé pour les 5 endpoints admin
  (Bearer token via localStorage, throw `Error` sur non-2xx).

### Header

Lien direct `📝 Blog` ajouté entre Compendium et Soutenir (desktop +
section dédiée en mobile). Clé i18n `nav.blog` (FR + EN).

### Sidebar admin

Item `📝 Blog` ajouté dans le bloc Administration (au-dessus de
Feedback).

## Tests

`apps/server/src/routes/admin-blog.test.ts` (11 tests) — couvre :

- list (avec/sans filtre status)
- create : sanitize HTML (drop script + force rel), set publishedAt si
  published, conflit slug (P2002 → 409), validation Zod (slug invalide → 400)
- update : publication initiale (set publishedAt), republication
  (préserve publishedAt original), 404 sur introuvable
- delete : audit + invalidation cache, 404 sur introuvable

Lancer : `cd apps/server && pnpm exec vitest run src/routes/admin-blog.test.ts`

## Migration

Schéma poussé via `prisma db push` (pas de migrations versionnées pour
cette feature). En prod : `make db-migrate` puis créer la migration
correspondante.

## Installation des deps (dev) — piège volumes OrbStack

Les containers `nufflearena_server` et `nufflearena_web` ont leur **propre**
`node_modules` (volume Docker). `pnpm add` sur l'host n'y propage pas.
Après ajout d'une dépendance, installer aussi côté container :

```bash
# Server (sanitize-html, etc.)
docker exec nufflearena_server sh -c \
  'pnpm config set store-dir /root/.local/share/pnpm/store/v3 --global; \
   cd /app/apps/server && pnpm add <pkg>'

# Web (TipTap, @tailwindcss/typography, etc.)
docker exec nufflearena_web sh -c \
  'pnpm config set store-dir /root/.local/share/pnpm/store/v3 --global; \
   cd /app/apps/web && pnpm add <pkg>'

# Puis restart le container concerné
docker restart nufflearena_server   # ou nufflearena_web
```

Sinon : `Error: Cannot find module 'X'` au démarrage.

⚠️ **Piège** : ne pas lancer `make db-reset-pg` depuis l'host dev
quand Cursor IDE écoute aussi sur `localhost:5433` — passer par le
container `nufflearena_server` (cf. memory `feedback_nuffle_db_reset_via_container`).

## Sécurité — points clés

1. **Auth admin** : middleware `authUser` + `adminOnly` sur toute
   route `/api/admin/blog/*`.
2. **Sanitization HTML** : TOUS les écrits (POST + PATCH) passent par
   `sanitizeBlogHtml`. Pas de bypass.
3. **rel + target sur liens** : forcés à
   `noopener noreferrer nofollow` + `_blank` (sauf `_self` explicite).
4. **Schemes restreints** : http/https/mailto pour les liens, http/https
   pour les images. Pas de `javascript:`, `data:`, etc.
5. **Cap longueur** : 200 KB max sur `contentHtml` (Zod) — protège
   contre les payloads abusifs.
6. **Slug regex** : kebab-case strict — pas d'injection dans l'URL
   publique.

## Évolutions possibles (non implémentées)

- Catégories / tags
- Commentaires
- Auteur multiple, brouillon collaboratif
- Pagination publique en UI (l'API supporte déjà `page`/`limit`)
- Upload d'image directement depuis l'éditeur (actuellement : URL
  manuelle uniquement)
- Sitemap dédié `/sitemap-blog.xml`
- RSS feed
- Newsletter / notifications publication
