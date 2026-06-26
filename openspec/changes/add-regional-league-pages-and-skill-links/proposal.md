# Pages de Ligues régionales + maillage compétence→positions

## Why

Deux demandes de maillage interne (SEO + navigation) sur les pages
publiques de référence, sans nouvelle donnée à produire :

1. **Compétence → positions.** La page `/skills/[slug]` décrit une
   compétence mais ne dit pas **quels postes la possèdent dès le
   recrutement**. Or la donnée existe déjà : chaque position porte un CSV
   de slugs de compétences de départ (`skills`) servi par
   `GET /api/positions`. Lister les positions concernées (liens vers les
   pages position) crée un maillage compétence↔position aujourd'hui absent.

2. **Ligues régionales.** Le game-engine définit déjà les 10 Ligues
   régionales officielles (`REGIONAL_LEAGUES` : description FR/EN) et le
   mapping roster→Ligues (`TEAM_REGIONAL_RULES`). Aucune **page publique**
   ne décrit une Ligue ni ne liste les équipes qui peuvent y participer.
   Ces pages (calquées sur `/skills` et `/teams`) décrivent chaque Ligue
   et lient vers les fiches d'équipe — maillage `/ligues`↔`/teams`.

Aucune migration Prisma, aucun nouvel endpoint : pure addition front +
un helper pur game-engine (index inverse Ligue→rosters).

## What Changes

- **Brique 1 — Index inverse Ligue→rosters (game-engine).** Helper pur
  `getRostersForRegionalLeague(leagueSlug, ruleset)` + agrégat
  `getRegionalLeaguesWithRosters()` (Ligues avec ≥1 roster), dérivés de
  `TEAM_REGIONAL_RULES_BY_RULESET`. 100 % testable.
- **Brique 2 — Positions sur la page compétence.** Bloc « Positions avec
  cette compétence » sur `/skills/[slug]` : positions qui **démarrent**
  avec la compétence, groupées par roster, liées vers
  `/teams/[slug]/[position]`. Helper pur `positions-with-skill`
  (filtre + groupage) ; fetch best-effort de `GET /api/positions` (jamais
  bloquant pour l'affichage de la compétence).
- **Brique 3 — Pages Ligues.** `/ligues` (index : carte par Ligue,
  description + compteur + aperçu des équipes) et `/ligues/[slug]`
  (description complète + liste des équipes éligibles, liens fiche
  d'équipe). ISR 1 h, `generateMetadata`, JSON-LD (CollectionPage +
  ItemList + BreadcrumbList). Noms d'équipes depuis `GET /api/rosters`.
- **Brique 4 — Maillage retour & navigation.** Les pastilles de Ligues
  régionales de `/teams/[slug]` deviennent des liens vers `/ligues/[slug]` ;
  entrée « Ligues » ajoutée au menu (desktop + mobile).

## Impact

- **Capabilities** : `regional-league-pages` (nouvelles pages publiques) +
  `skill-position-links` (enrichissement de la page compétence).
- **Code** :
  - `packages/game-engine/src/rosters/regional-league-rosters.ts` (nouveau)
    + export depuis `rosters/index.ts` ;
  - `apps/web/app/skills/positions-with-skill.ts` (nouveau) +
    `apps/web/app/skills/[slug]/page.tsx` (bloc positions) ;
  - `apps/web/app/ligues/{page.tsx,[slug]/page.tsx,data.ts,
    ligues-structured-data.ts}` (nouveaux) ;
  - `apps/web/app/teams/[slug]/TeamDetailClient.tsx` (pastilles cliquables) ;
  - `apps/web/app/components/Header.tsx` (entrée nav).
- **Aucune migration Prisma, aucun nouvel endpoint serveur.** Réutilise
  `GET /api/positions` et `GET /api/rosters`.

## Non-Goals

- **Sitemap des pages `/ligues`** : pourra suivre (calque du bloc skills),
  hors scope du MVP.
- **Filtres/tri sur la page Ligue** (par tier, style de jeu) : la liste
  triée par nom suffit pour le maillage.
- **Compétences *apprenables* (accès G/A/S/P/M) sur la page compétence** :
  on n'expose que les compétences de **départ** (donnée fiable et factuelle).
