# Tasks — Pages par position de roster

> Lot 1 = B.1 (page detail) + B.2 (indexation SEO). Front-only, reutilise
> `GET /api/rosters/:slug`. Aucune migration Prisma, aucun endpoint serveur.
> B.5 / B.4 / B.3 = suites explicites (cf. `design.md`), hors de ce change.

## 1. Prerequis — utilitaires purs & invariant (TDD)
- [ ] 1.1 Test d'invariant : pour chaque roster season_3, **tous** les slugs
      de positions commencent par `${roster.slug}_` (source
      `@bb/game-engine` rosters). Verrouille la reconstruction d'URL (D2/D5).
- [ ] 1.2 Util pur `resolvePosition(roster, segment)` : reconstruit
      `${roster.slug}_${segment}`, cherche dans `roster.positions`, fallback
      "match par suffixe", retourne `null` si introuvable. Tests : cas
      nominal, fallback, introuvable.
- [ ] 1.3 Util pur `cleanDisplayName(name)` : strip ` *` final + flag
      `isBigGuy`. Tests : "Homme-arbre *" -> { name:"Homme-arbre", bigGuy:true },
      nom normal inchange.
- [ ] 1.4 `pnpm typecheck` + tests verts pour le module util.

## 2. Brique 1 — Page detail position `/teams/[slug]/[position]`
- [ ] 2.1 `app/teams/[slug]/[position]/page.tsx` : fetch
      `GET /api/rosters/:slug?ruleset=` (defaut season_3, calque
      `/teams/[slug]/page.tsx`), `resolvePosition`, `notFound()` si null.
      ISR `revalidate = 3600`.
- [ ] 2.2 Rendu detail calque sur `/skills/[slug]` : header (nom nettoye +
      badge big guy + cout + min/max), bloc stats MA/ST/AG/PA/AV, fil
      d'Ariane (`Accueil / <Roster> / <Position>`), bouton retour roster.
- [ ] 2.3 Maillage interne (D4) : skills de base -> liens `/skills/[slug]` ;
      acces competences (G/A/S/P/M) -> liens `/skills?category=` ; positions
      liees (meme roster) -> `/teams/[slug]/<autre>`.
- [ ] 2.4 `generateMetadata` (titre `"<Position> — <Roster> | Blood Bowl"`,
      description, `keywords`, canonical `/teams/[slug]/[position]`, hreflang
      `fr-FR`/`en`/`x-default` -> meme URL, openGraph logo statique, twitter).
      Introuvable -> `robots: { index:false }`.
- [ ] 2.5 `position-detail-structured-data.ts` + composant `StructuredData`
      (calque `buildSkillDetailSchema` / `TeamStructuredData`) + test du
      builder.
- [ ] 2.6 Test de page : rendu depuis un roster fixture (stats, liens skills,
      positions liees) + `notFound()` sur segment inconnu.

## 3. Brique 3 — Liens depuis la page roster
- [ ] 3.1 `TeamDetailClient.tsx` : rendre chaque position cliquable vers
      `/teams/[slug]/<segment strippe>` (carrie le `?ruleset=` courant).
- [ ] 3.2 Verifier l'accessibilite du lien (focus, libelle) ; pas de
      regression du rendu desktop/mobile existant.

## 4. Brique 2 — Indexation SEO
- [ ] 4.1 `app/sitemap.ts` : bloc `positionPages` — boucle sur les rosters
      season_3, pour chacun fetch/utilise ses positions et emet
      `sitemapEntryWithAlternates('/teams/<slug>/<segment>', { priority:0.6,
      changeFrequency:'monthly' })`. Dedup par `Set`. Ajout au tableau
      retourne.
- [ ] 4.2 JSON-LD d'index par roster (option : `ItemList` des positions sur
      la page `/teams/[slug]`) — leger, calque `SkillsStructuredData`.
- [ ] 4.3 Test sitemap : URLs position season_3 presentes, season_2 absentes,
      pas de doublon.

## 5. Tests & cloture
- [ ] 5.1 Suite web verte (`vitest`) + `pnpm typecheck` exit 0.
- [ ] 5.2 Verifier l'absence de collision de route avec `/teams/comparer` et
      `/teams/tier-list` (smoke).
- [ ] 5.3 (Optionnel) E2E Playwright : `/teams/skaven` -> position -> skill.
- [ ] 5.4 `/opsx:sync` (delta-spec -> specs principales) puis `/opsx:archive`
      apres merge de la PR.
