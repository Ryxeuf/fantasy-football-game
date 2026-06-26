# Tasks

## Brique 1 — Index inverse Ligue→rosters (game-engine)
- [x] `regional-league-rosters.ts` : `getRostersForRegionalLeague` +
      `getRegionalLeaguesWithRosters` (purs, repli ruleset)
- [x] Export depuis `rosters/index.ts`
- [x] Tests unitaires (`regional-league-rosters.test.ts`) : inverse exact
      de `TEAM_REGIONAL_RULES`, multi-Ligues, slug inconnu, filtre ≥1 roster

## Brique 2 — Positions sur la page compétence
- [x] `positions-with-skill.ts` : `positionsWithStartingSkill` +
      `groupPositionsByRoster` (purs, segment d'URL, nettoyage big-guy, tri)
- [x] Tests unitaires (`positions-with-skill.test.ts`)
- [x] `/skills/[slug]/page.tsx` : fetch best-effort `GET /api/positions`
      sur le ruleset résolu + bloc « Positions avec cette compétence »
      (groupé par roster, liens vers `/teams/[slug]/[position]`)

## Brique 3 — Pages Ligues
- [x] `ligues/data.ts` : `fetchRosterMap` + `resolveRosters` (repli nom
      dérivé du slug) + test (`data.test.ts`)
- [x] `ligues/ligues-structured-data.ts` : JSON-LD index + détail + test
- [x] `ligues/page.tsx` : index (cartes par Ligue, ISR, metadata)
- [x] `ligues/[slug]/page.tsx` : détail (description + équipes éligibles,
      `generateMetadata`, `notFound` si slug inconnu, ISR)

## Brique 4 — Maillage retour & navigation
- [x] `TeamDetailClient.tsx` : pastilles Ligues → liens `/ligues/[slug]`
- [x] `Header.tsx` : entrée « Ligues » (dropdown desktop + menu mobile)

## Validation
- [x] `tsc --noEmit` (game-engine + web) au vert
- [x] Tests unitaires au vert
