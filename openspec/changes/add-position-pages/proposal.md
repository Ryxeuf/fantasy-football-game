# Pages par position de roster (detail + indexation SEO)

## Why

On dispose deja d'une page par competence (`/skills/[slug]` : index +
detail + structured data + sitemap longue-traine). L'audit `/ideas` du
2026-06-15 demande la meme chose **par position de chaque roster** : une
page detail par poste (Lineman, Blitzer, Gutter Runner, Trois-Quart
Humain...) qui servira de socle aux futures etudes/stats joueurs.

L'exploration (`/opsx:explore`, consignee dans
`docs/roadmap/backlog/future-ideas.md` Annexe B) a etabli le point cle :
**la donnee d'une position est deja servie en entier** par l'endpoint
existant `GET /api/rosters/:slug`. Chaque position y porte deja `slug`,
`displayName`, `cost`, `min`/`max`, `ma`/`st`/`ag`/`pa`/`av`, `skills`
(CSV de slugs de competences), `primarySkills`, `secondarySkills`. La page
roster `/teams/[slug]` les **liste deja** — mais aucune n'est cliquable
vers une page dediee.

Il manque donc uniquement :
1. la **page detail** par position (front, calquee sur `/skills/[slug]`) ;
2. l'**indexation** de ces ~200-280 URLs season_3 (sitemap + JSON-LD).

Aucun nouvel endpoint, aucune migration Prisma : le MVP est une addition
purement front qui reutilise un fetch deja en cache ISR (1h).

## What Changes

- **Brique 1 — Page detail position** `/teams/[slug]/[position]`. Route
  Next.js imbriquee calquee sur `/skills/[slug]` : header stats
  (MA/ST/AG/PA/AV) + cout + bornes min/max + skills de base **lies vers
  `/skills/[slug]`** + acces competences (categories G/A/S/P/M) + positions
  liees (meme roster) + fil d'Ariane + `generateMetadata` + structured
  data. Reutilise `GET /api/rosters/:slug` et selectionne la position par
  slug reconstruit.
- **Brique 2 — Indexation SEO.** Enumerer les URLs position des rosters
  season_3 dans `apps/web/app/sitemap.ts` (calque du bloc skills) +
  JSON-LD d'index. Canonical = season_3 sans param.
- **Brique 3 — Liens & garde d'invariant.** Rendre les positions de
  `/teams/[slug]` cliquables, et ajouter un test verifiant que
  `roster.slug` prefixe bien le slug de chacune de ses positions (les 30
  rosters S3) — invariant dont depend la reconstruction du slug d'URL.

## Impact

- **Capability** : nouvelle spec `position-pages` (page detail par
  position + resolution de slug + maillage interne + indexation + invariant
  de prefixe).
- **Code (front uniquement)** :
  - `apps/web/app/teams/[slug]/[position]/page.tsx` (nouveau) +
    `position-detail-structured-data.ts` (+ `layout.tsx` si metadata
    separee) ;
  - `apps/web/app/teams/[slug]/TeamDetailClient.tsx` (positions cliquables) ;
  - `apps/web/app/sitemap.ts` (bloc positions season_3) ;
  - util pur de resolution/nettoyage de slug + tests.
- **Aucune migration Prisma, aucun nouvel endpoint serveur, aucun
  changement de contrat d'API.** Reutilise `GET /api/rosters/:slug`.

## Lots de suite (realises dans la meme PR)

Les lots B.4/B.5/B.3 — initialement non-goals — ont ete enchaines dans la
meme PR sur demande. Detail des taches dans `tasks.md`, exigences dans
`specs/`.

- **Lot 2 — B.4 Durcissement `/api/positions`.** L'endpoint existait deja
  (`routes/public-positions.ts`) mais sans typage/validation/tests. Typage
  `PositionRow`/`TransformedPosition` (fin du `any`), `validateQuery` +
  `validateParams` Zod, erreurs typees, tests unitaires.
- **Lot 3 — B.5 Noms anglais (`displayNameEn`).** Pas de colonne Prisma :
  map curee pure `@bb/game-engine` `position-names-en` (slug -> nom anglais
  officiel, ~88% season_3, repli FR) exposee via `getPositionNameEn` et
  branchee dans `public-positions` + `public-rosters` (`displayNameEn`) ;
  sous-titre EN sur la page position. Evite migration + mirror sqlite.
- **Lot 4 — B.3 Stats d'usage par position.** Service `position-usage-stats`
  (un `groupBy TeamPlayer` -> count + moyennes carriere), endpoint
  `GET /api/rosters/:slug/positions-stats` (memoize), section "Chez les
  coachs" sur la page. **Pas de win-rate** (aucun lien fiable evenement de
  match <-> slug de position) : on n'expose que des metriques fiables.

## Non-Goals

- **Colonne Prisma `displayNameEn` + CRUD admin des noms EN** : la map
  game-engine suffit (positions definies en code, synchronisees) ; une
  colonne editable reste un futur possible.
- **Win-rate / stats par-match par position** : necessiterait de
  denormaliser un `positionSlug` sur `TeamPlayer` + les evenements de match
  (migration + backfill). Hors scope ; cf. `design.md`.
- **B.4.bis ItemList JSON-LD sur la page roster** et **OG image dynamique
  par position** : optionnels, non faits.
