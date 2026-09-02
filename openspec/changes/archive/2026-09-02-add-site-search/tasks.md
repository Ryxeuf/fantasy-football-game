# Tasks — Moteur de recherche du contenu public

## 1. Moteur pur
- [x] 1.1 `app/recherche/search.ts` : type `SearchRecord`/`SearchHit`, `fold` (longueur constante), `queryTerms`, `searchRecords` (ET, scoring, extrait), `countByType`.
- [x] 1.2 Tests `search.test.ts` (fold, terms, ranking titre>corps, ET, extrait, vide, comptage).

## 2. Builders d'enregistrements
- [x] 2.1 `app/recherche/build-records.ts` : `compendiumRecords` (chapitre + sections ancrées via `chapterToc`), `skillRecords`, `positionRecords` (lien profond roster/position), `rosterRecords`, `starRecords`.
- [x] 2.2 Tests `build-records.test.ts` (ancres, liens profonds, pas de marqueur illisible, mapping API).

## 3. Page serveur
- [x] 3.1 `app/recherche/page.tsx` (server, ISR 3600) : agrège les corpus via `safeServerJson` (tolérant), construit les enregistrements, rend `SearchClient` sous `Suspense` + metadata.

## 4. UI client
- [x] 4.1 `app/recherche/SearchClient.tsx` : champ synchronisé à `?q=`, filtres par type avec compteurs, surlignage des termes, liens profonds, états vide/aucun-résultat.
- [x] 4.2 Tests `SearchClient.test.tsx` (invite vide, résultats + href, filtre par type).

## 5. Points d'entrée
- [x] 5.1 Champ de recherche dans le hero du compendium (form GET `/recherche`, sans JS).
- [x] 5.2 Entrée « Rechercher » dans le menu desktop + mobile (`Header.tsx`).

## 6. Vérification
- [x] 6.1 `tsc` web.
- [x] 6.2 Tests verts (search + build-records + SearchClient ; compendium non régressé).
- [ ] 6.3 Vérification visuelle (staging / capture) — au déploiement.
