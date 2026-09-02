# Tasks — Mots-clés des Star Players

## 1. Donnée game-engine — FAIT
- [x] 1.1 `star-player-keywords.ts` : `STAR_PLAYER_KEYWORDS` (68 stars),
      listes de lignées/types autorisés, `getStarPlayerKeywords(slug)`.
- [x] 1.2 `StarPlayerDefinition.keywords` + application dans la boucle
      post-construction (deux rulesets).
- [x] 1.3 Token `Zoat` ajouté au dictionnaire FR→EN.
- [x] 1.4 Exports depuis `rosters/index.ts`.
- [x] 1.5 `star-player-keywords.test.ts` : couverture, orphelins,
      vocabulaire, format CSV, traduction EN (8 tests).

## 2. Persistance — FAIT
- [x] 2.1 `StarPlayer.keywords String?` dans `prisma/schema.prisma`.
- [x] 2.2 Migration `20260818100000_add_star_player_keywords`.
- [x] 2.3 Seed : écriture de `keywords` depuis la définition engine.

## 3. API — FAIT
- [x] 3.1 `routes/star-players.ts` : mapper unique `transformStarPlayer`
      (dédup des 4 payloads) + `keywords` / `keywordsEn` + repli engine.
- [x] 3.2 `team-star-player-handlers.ts` : `keywordsEn` sur les stars
      recrutés et disponibles (le catalogue engine ne porte que le FR).
- [x] 3.3 Admin CRUD : `keywords` dans les schémas Zod create/update, les
      handlers et l'audit.
- [x] 3.4 `star-players-keywords.test.ts` : liste, détail, repli engine,
      slug inconnu (4 tests).

## 4. Web — FAIT
- [x] 4.1 `KeywordChips` : prop `testId` optionnelle.
- [x] 4.2 `StarPlayerCard` : étiquettes bilingues (`star-player-keywords`).
- [x] 4.3 Fiche `/star-players/[slug]` : étiquettes sous le nom.
- [x] 4.4 `StarPlayerSelector` : étiquettes dans la liste de recrutement.
- [x] 4.5 `app/lib/keyword-filter.ts` : helpers génériques ;
      `position-keyword-filter.ts` devient une façade typée position.
- [x] 4.6 `/star-players` : filtre par mots-clés (ET logique, reset).
- [x] 4.7 JSON-LD `Keywords` + `metadata.keywords` de la fiche.
- [x] 4.8 Formulaires admin création/édition Star Player.
- [x] 4.9 Tests : `keyword-filter.test.ts` (5), `StarPlayerCard.test.tsx`
      (3), 3 cas ajoutés au structured data.

## 5. Doc — FAIT
- [x] 5.1 `docs/star-player-keywords-feature.md` (chaîne de données,
      provenance de la table, mise à jour prod).
- [x] 5.2 Changeset.

## 6. Suite (hors lot)
- [ ] 6.1 Confronter la table au PDF officiel GW « Star Players! » et
      corriger les lignées/types incertains (stars 2025 récents).
- [ ] 6.2 Page d'index par mot-clé (`/star-players/mots-cles/<kw>`) si le
      filtre client montre de l'usage.
