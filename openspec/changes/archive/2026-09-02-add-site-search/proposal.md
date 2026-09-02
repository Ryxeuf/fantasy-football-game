# Moteur de recherche du contenu public du site

## Why

Le site expose plusieurs corpus publics — le compendium des règles, les
compétences, les positions, les rosters et les star players — mais aucun
moyen de **chercher transversalement** dedans. Un visiteur qui cherche
« blocage » ou « pluie battante » doit deviner dans quelle section
regarder. Les pages existantes n'offrent qu'un filtre local (ex. la page
compétences), pas une recherche unifiée.

## What Changes

- Nouvelle page **`/recherche`** : recherche plein-texte sur **tout le
  contenu public** (règles + compétences + positions + équipes + star
  players), résultats classés et filtrables par type, liens profonds.
- **Compendium indexé finement** : un résultat par chapitre ET par
  section (titre de niveau 2), avec **lien profond ancré**
  (`/compendium/<slug>#<ancre>`).
- **Surlignage** des termes dans le titre et l'extrait ; recherche
  **insensible à la casse et aux accents**.
- **Points d'entrée** : champ de recherche dans le hero du compendium
  (formulaire GET → fonctionne sans JS) et entrée « Rechercher » dans le
  menu (desktop + mobile).

## How

- **Logique pure, testable** (sans réseau ni React) :
  - `search.ts` — `fold` (repli d'accents à **longueur constante** pour
    des extraits alignés), `searchRecords` (ET sur les termes, score
    titre > sous-titre > corps, extrait), `countByType`.
  - `build-records.ts` — builders : compendium (local, via `chapterToc`
    pour les ancres) + skills / positions / rosters / stars (données
    d'API).
- **Agrégation serveur** : `/recherche` (server component, ISR 3600)
  charge les corpus en parallèle via `safeServerJson` (**tolérant** : une
  API en panne n'ôte que sa source), construit les enregistrements et les
  passe à un client `SearchClient` sous `Suspense`.
- **UI client** : champ synchronisé à `?q=` (URL partageable, mise à jour
  différée), filtres par type, surlignage, liens profonds.

## Out of scope

- Pas d'**index persistant** ni de moteur externe (Algolia/Meilisearch) :
  les corpus publics tiennent en mémoire (quelques centaines
  d'enregistrements), la recherche s'exécute côté client après un seul
  chargement.
- Pas d'indexation des **parties privées** (équipes de coachs, ligues,
  pro-league) : uniquement le contenu public.
- Le contenu reste celui déjà publié ; aucune modification des données
  sources (compendium, API).

## Impact

- **Capability** : `site-search` (nouvelle).
- **Frontend** : `app/recherche/*` (page, client, modules purs, tests),
  `app/compendium/page.tsx` (champ hero), `app/components/Header.tsx`
  (entrées menu).
- **APIs consommées** (existantes, publiques) : `/api/skills`,
  `/api/positions`, `/api/rosters`, `/star-players`.
- **Tests** : `search`, `build-records`, `SearchClient`.
