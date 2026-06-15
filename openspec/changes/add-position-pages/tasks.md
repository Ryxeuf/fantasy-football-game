# Tasks — Pages par position de roster

> **Lot 1 livré** (B.1 page détail + B.2 indexation + liens roster + garde
> d'invariant). Front-only, réutilise `GET /api/rosters/:slug`. Aucune
> migration Prisma, aucun endpoint serveur. Suite web verte (155 fichiers /
> 1342 tests), `tsc` exit 0, prettier clean.
> Suites explicites hors lot (cf. `design.md`) : B.5 / B.4 / B.3.

## 1. Prerequis — utilitaires purs & invariant (TDD) — FAIT
- [x] 1.1 `position-slug.invariant.test.ts` : pour chaque roster season_3,
      tous les slugs de positions commencent par `${roster.slug}_`. Source
      `@bb/game-engine` (`TEAM_ROSTERS_BY_RULESET.season_3`, aliasé en vitest
      web). **31 cas verts** — l'invariant tient sur les 30 rosters.
- [x] 1.2 `position-slug.ts` → `resolvePosition(roster, segment)` :
      reconstruit `${roster.slug}_${segment}`, replis slug-complet puis
      suffixe, `null` sinon. Tests nominal/replis/introuvable.
- [x] 1.3 `position-slug.ts` → `cleanDisplayName(name)` : strip ` *` final +
      flag `isBigGuy`. Tests "Homme-arbre *"/"Ogre *"/nom normal.
- [x] 1.4 Utils annexes `parseSkillCsv` / `parseAccessCodes` (F→S) /
      `prettifySlug` + tests. `tsc` exit 0, tests verts.

## 2. Brique 1 — Page detail position `/teams/[slug]/[position]` — FAIT
- [x] 2.1 `app/teams/[slug]/[position]/page.tsx` : fetch `GET /api/rosters/:slug`
      (défaut season_3), `resolvePosition`, `notFound()` si null, ISR 3600.
- [x] 2.2 Rendu détail (header nom nettoyé + badge Big Guy + coût + min/max,
      grille stats MA/ST/AG/PA/AV réutilisant les boîtes colorées du roster,
      fil d'Ariane, retour roster).
- [x] 2.3 Maillage interne : skills de base → liens `/skills/[slug]` (via map
      slug→nomFR, repli `prettifySlug`) ; accès G/A/S/P/M → `/skills?category=` ;
      positions liées (même roster) → `/teams/[slug]/<autre>`.
- [x] 2.4 `generateMetadata` : titre, description stats, `keywords`, canonical
      `/teams/[slug]/[position]`, hreflang fr-FR/en/x-default → même URL,
      openGraph logo, twitter. Introuvable → `robots.index=false`.
- [x] 2.5 `position-detail-structured-data.ts` (`DefinedTerm` +
      `BreadcrumbList` 4 niveaux, calque skills) + test du builder.
- [x] 2.6 `page.test.ts` : `generateMetadata` connu/inconnu + `PositionDetailPage`
      rend (connu) / `notFound()` (segment inconnu). serverApi mocké via
      `vi.hoisted`.

## 3. Brique 3 — Liens depuis la page roster — FAIT
- [x] 3.1 `TeamDetailClient.tsx` : nom de position cliquable (table desktop +
      cartes mobile) vers `/teams/[slug]/<segment strippé>`, ruleset porté si
      non-défaut (`positionHref`).
- [x] 3.2 Lien accessible (texte = nom, `data-testid="position-link"`) ; suite
      web verte → pas de régression du rendu existant.

## 4. Brique 2 — Indexation SEO — FAIT (4.2 optionnel différé)
- [x] 4.1 `app/sitemap.ts` : bloc `positionPages` — rosters season_3 + détails
      en parallèle, `stripRosterPrefix`, dedup `Set`, priorité 0.6, ajouté au
      tableau retourné.
- [ ] 4.2 *(optionnel)* JSON-LD `ItemList` des positions sur `/teams/[slug]`.
      **Non fait** : l'indexation est déjà couverte par le sitemap (4.1) + la
      structured data par-position (2.5). À reprendre si besoin SEO supplémentaire.
- [x] 4.3 `sitemap.test.ts` : URLs position season_3 présentes, dedup, fetch
      `ruleset=season_3` (jamais season_2). `fetch` mocké.

## 5. Tests & cloture
- [x] 5.1 Suite web verte (`vitest run`) : **155 fichiers / 1342 tests**,
      `tsc -p tsconfig.json --noEmit` exit 0, prettier `--check` clean.
- [x] 5.2 Pas de collision de route : `/teams/comparer` & `/teams/tier-list`
      sont des frères **statiques** de `[slug]` (résolus avant le dynamique) ;
      `[slug]/[position]` est un enfant — la suite complète passe.
- [ ] 5.3 *(optionnel)* E2E Playwright `/teams/skaven` → position → skill.
      Non lancé dans cet environnement (infra E2E non provisionnée).
- [ ] 5.4 `/opsx:sync` (delta-spec → specs principales) puis `/opsx:archive`
      après merge de la PR.
