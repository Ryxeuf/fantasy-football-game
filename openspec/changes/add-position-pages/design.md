# Design — Pages par position de roster

## Contexte

`apps/web` (Next.js 14, app router) expose deja deux surfaces qui servent
de modele :

- `/skills` (index) + `/skills/[slug]` (detail) : le **template** a calquer
  — ISR 3600, `generateMetadata`, hreflang single-URL, structured data,
  related same-category, fil d'Ariane, page de detail rendue a la demande
  puis cachee (pas de `generateStaticParams`, on ne depend pas du backend
  au build).
- `/teams/[slug]` : page roster qui **fetch `GET /api/rosters/:slug` et
  liste deja les positions** (mais non cliquables).

L'endpoint `GET /api/rosters/:slug?ruleset=` renvoie chaque position avec
`slug, displayName, cost, min, max, ma, st, ag, pa, av, skills` (CSV de
slugs de competences), `primarySkills`, `secondarySkills`. Suffisant pour
une page detail riche, sans nouvel I/O.

## Le declic : MVP front-only

```
            GET /api/rosters/:slug?ruleset=season_3   (deja en cache ISR)
                              |
                              v
   { roster: { slug, name, tier, budget, naf,
               positions: [ { slug, displayName, cost, min, max,
                              ma, st, ag, pa, av,
                              skills:"dodge,animosity",
                              primarySkills:"G,A", secondarySkills:"S" }, ... ] } }
                              |
         +--------------------+--------------------+
         v                                         v
   /teams/[slug] (existe)            /teams/[slug]/[position] (NOUVEAU)
   liste les positions          find(p => p.slug === reconstruit) -> detail
```

La page detail ne fait **aucun** appel nouveau : meme fetch que
`/teams/[slug]`, on selectionne la position et on rend. B.4 (endpoint
dedie) reste une optimisation differee (~10 positions / payload, surcout
nul).

## Decisions

### D1 — Route imbriquee `/teams/[slug]/[position]`
On garde le roster dans le chemin (contexte primaire) et la position en
segment enfant. Pas de collision : `/teams/comparer` et `/teams/tier-list`
sont des **freres statiques** de `[slug]`, resolus avant le dynamique par
Next.js. Le segment enfant `[position]` n'affecte pas ces routes.

### D2 — Segment d'URL = slug prive du prefixe roster
Les slugs DB sont prefixes du roster (`skaven_lineman`,
`old_world_alliance_trois_quart_humain`). Trois options :

| Option | URL exemple | Pour | Contre |
|--------|-------------|------|--------|
| (a) slug brut | `/teams/skaven/skaven_lineman` | zero transfo | redondant, moche |
| **(b) prefixe strippe + reconstruction** | `/teams/skaven/lineman` | propre, lisible | suppose `roster.slug` == prefixe |
| (c) slug SEO derive du nom | `/teams/skaven/trois-quart-humain` | ideal SEO | mapping stocke + collisions |

**Retenu : (b).** Verifie sur les 30 rosters season_3 : la cle roster
prefixe **toujours** le slug de ses positions (`amazon` ->
`amazon_guerriere_aigle`). Au lookup on reconstruit `${rosterSlug}_${segment}`,
avec **fallback "match par suffixe"** si un roster derogeait. Un test
(D5) verrouille l'invariant. Util pur `resolvePosition(roster, segment)`,
testable sans Prisma.

### D3 — Ruleset : canonical season_3, sitemap season_3 only
`/teams/[slug]` choisit le ruleset via `?ruleset=` (defaut `season_3`).
Le sitemap des skills n'enumere que `season_3` (`sitemap.ts:215`). On
calque : **canonical = season_3 sans param**, sitemap positions = seuls
rosters season_3 (~30 x 6-11 ~= 200-280 pages). `?ruleset=season_2`
accessible mais hors sitemap (edition legacy), comme les competences.

### D4 — Maillage interne (gain SEO quasi gratuit)
La position porte `skills` = CSV de slugs **qui sont exactement les slugs
de `/skills/[slug]`**, plus `primary/secondarySkills` (codes G/A/S/P/M).
La page detail tisse donc :

```
  [position skaven/gutter_runner]
     |- skills de base   -> liens /skills/dodge, /skills/animosity ...
     |- acces (G/A)      -> /skills?category=General | Agility
     |- positions liees  -> /teams/skaven/<autres positions>
     '- fil d'Ariane     -> /teams/skaven
```

Chaque page position renforce les surfaces existantes (competences +
roster) sans contenu neuf. Effet de reseau interne.

### D5 — Garde d'invariant de slug (test)
Un test (vitest) charge les rosters season_3 et asserte que, pour chaque
roster, **tous** les slugs de positions commencent par `${roster.slug}_`.
Si l'invariant casse un jour (nouveau roster mal nomme), la
reconstruction d'URL (D2) tomberait sur le fallback suffixe ; le test
documente et protege la convention.

### D6 — Nettoyage du `displayName`
Certains noms portent un marqueur ` *` ("Homme-arbre *", "Ogre *",
probablement "big guy" / 0-1). Le **slug** n'en contient pas (URLs
saines). Seul l'affichage (h1, `<title>`, canonical alt-text) est
nettoye : `cleanDisplayName()` strip le ` *` final et, en option, expose
un flag "big guy" pour un badge. Util pur testable.

## Suites explicites (hors perimetre, cadrees ici)

- **B.5 — Normalisation bilingue.** Ajouter `Position.displayNameEn`
  (migration + backfill + seed) et un FR propre pour Season 2 (dont les
  positions sont nommees en anglais : "Lineman", "Thrower"), tandis que
  Season 3 est en francais ("Lanceur Humain"). NON bloquant : le hreflang
  single-URL existant tolere une page mono-langue (comme `/teams/[slug]`
  aujourd'hui). B.5 ajoutera le sous-titre EN + les keywords EN et lissera
  l'incoherence S2/S3.
- **B.4 — Endpoint `/api/positions` dedie.** Le proxy web
  `app/api/positions/route.ts` appelle `${SERVER_API_BASE}/api/positions`
  qui **n'existe pas** cote serveur. A brancher pour les filtres
  (attribut/skill) et eviter de charger tout le roster pour une position.
  Differable.
- **B.3 — Etudes/stats d'usage par position.** Agreger pick-rate /
  win-rate / SPP / casualties / MVP% par `position.slug` depuis les
  replays Pro League (snapshot lazy, cf. `proPlayerCareerSnapshot`). La
  page de cette brique est la surface ou ces stats s'afficheront.

## Risques & mitigations

| Risque | Detail | Mitigation |
|--------|--------|------------|
| Prefixe roster non garanti | Un roster dont les positions ne commencent pas par `${slug}_` casserait la reconstruction d'URL | Util avec fallback "match par suffixe" + test d'invariant D5 sur les 30 rosters |
| Slug redondant si option (a) | URLs longues/dupliquees | Option (b) retenue (segment strippe) |
| `*` qui fuit dans title/URL | "Homme-arbre *" en `<title>` | `cleanDisplayName()` ; slug n'a pas de `*` (URLs deja saines) |
| 404 incoherent | Position inexistante dans le roster | `notFound()` comme `/skills/[slug]` ; meta `robots: noindex` sur introuvable |
| Confusion avec star players | `/star-players/[slug]` existe (joueurs nommes) | Surface distincte : position generique != star player ; pas de route partagee |
| Volume sitemap | ~200-280 URLs supplementaires | Dedup par `Set` (comme skills) ; priorite 0.6 ; pages rendues a la demande puis cachees |
| Drift de langue S2/S3 | Pages season_3 en FR, season_2 en EN | Canonical = season_3 (FR coherent) ; B.5 lisse plus tard |

## Alternatives ecartees

- **Route globale `/positions/[slug]`** (hors roster) : perd le contexte
  roster, complexifie le breadcrumb et les positions liees, et ne reutilise
  pas la hierarchie `/teams/[slug]` existante. Ecartee.
- **Endpoint dedie `/api/positions` requis pour le MVP** : inutile, la
  donnee est deja inline dans `/api/rosters/:slug`. Reporte (B.4).
- **`generateStaticParams` (SSG complet)** : creerait une dependance au
  backend au build et alourdirait le CI ; on suit le choix `/skills`
  (ISR a la demande).
- **Slug SEO derive du nom (option c)** : meilleur theoriquement mais
  impose un mapping stocke et gere les collisions ; surdimensionne pour le
  MVP. Reservable a une passe SEO ulterieure.

## Plan de test

- **Unit (pur)** : `resolvePosition(roster, segment)` (reconstruction +
  fallback suffixe + introuvable) ; `cleanDisplayName()` (strip ` *`,
  detection big guy) ; builder structured data position.
- **Invariant (D5)** : prefixe roster sur les 30 rosters season_3.
- **Composant / page** : rendu du detail a partir d'un roster fixture
  (stats, skills lies, positions liees, breadcrumb) ; `notFound()` si
  segment inconnu ; `generateMetadata` (titre, canonical, hreflang).
- **Sitemap** : presence des URLs position season_3, absence des season_2,
  dedup.
- **Non-regression** : suite web verte + `pnpm typecheck` exit 0 ; pas de
  collision de route avec `/teams/comparer` et `/teams/tier-list`.
- **E2E (Playwright, optionnel)** : depuis `/teams/skaven`, clic sur une
  position -> page detail -> clic sur une competence -> `/skills/[slug]`.
