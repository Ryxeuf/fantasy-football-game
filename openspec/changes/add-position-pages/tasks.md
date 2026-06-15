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

## Lot 2 — B.4 Durcissement `/api/positions` — FAIT
- [x] 2b.1 Typage : `PositionRow` / `TransformedPosition` (fin du `any` dans
      `routes/public-positions.ts` ; le client prisma est `any` repo-wide).
- [x] 2b.2 `public-positions.schemas.ts` : `validateQuery` (lang/ruleset/
      rosterSlug) + `validateParams` (slug), schemas `.passthrough()`
      (jamais de 400 sur GET public). Erreurs `error: unknown` typees.
- [x] 2b.3 `public-positions.test.ts` : liste, lang=en, filtre rosterSlug,
      detail, 404+repli, displayNameEn connu/null (7 tests).

## Lot 3 — B.5 Noms anglais des positions — FAIT
- [x] 3b.1 Module pur `@bb/game-engine` `position-names-en` : map curee
      slug -> nom anglais officiel (GW/BB2020) + `getPositionNameEn`. ~88%
      des positions season_3 (repli FR). Exporte depuis l'index.
- [x] 3b.2 Test garde : toute cle est un slug season_3 valide + couverture
      > 60% + lookups (3 tests).
- [x] 3b.3 API : `public-positions` + `public-rosters` exposent
      `displayNameEn` (`getPositionNameEn(slug) ?? null`).
- [x] 3b.4 Page position : sous-titre anglais quand present. Choix : pas de
      colonne Prisma (positions code-definies + synchronisees ; evite
      migration + mirror sqlite). `*` big guy deja nettoye cote front (B.1).

## Lot 4 — B.3 Stats d'usage par position — FAIT
- [x] 4b.1 Service `position-usage-stats` : un `groupBy TeamPlayer` (roster +
      ruleset) -> count + sommes -> moyennes carriere par joueur. Pas de
      N+1, pas de scan replays, pas de snapshot/migration.
- [x] 4b.2 Endpoint `GET /api/rosters/:slug/positions-stats` (memoize 5 min).
- [x] 4b.3 Page : fetch optionnel (`safeServerJson`, ne bloque pas le rendu),
      lookup displayName brut puis nettoye, section "Chez les coachs"
      masquee si 0 donnee. **Pas de win-rate** (donnee non disponible).
- [x] 4b.4 Test service (3 cas dont division par zero).

## Cloture globale (Lots 1-4)
- [x] Suites vertes : **server 267 fichiers / 3900 tests**, **web 156 / 1346**,
      game-engine map (3). `tsc` exit 0 (server/web/game-engine). Prettier
      clean (hors churn pre-existant volontairement non touche : `index.ts`
      game-engine non-conforme sur main).
