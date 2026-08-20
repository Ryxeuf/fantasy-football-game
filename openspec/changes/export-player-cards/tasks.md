# Tasks — Cartes joueur exportables

## 1. Modèle pur — FAIT
- [x] 1.1 `card-model.ts` : `PlayerCardData`, labels FR/EN, helpers
      (formatage po, troncature au mot, slug fichier, tailles de police,
      couleurs hex/ombrage/luminance).
- [x] 1.2 Builders `buildStarPlayerCardData` (règle spéciale FR/EN, ruban
      mega-star, coût de paire) et `buildTeamPlayerCardData` (carrière,
      rubans décédé/licencié, champs optionnels tolérés).
- [x] 1.3 `encodeCardPayload` / `decodeCardPayload` (base64url isomorphe,
      bornes par champ, contrôle des slugs, cap 8 Ko).
- [x] 1.4 `card-model.test.ts` (24 tests).

## 2. Template + rendu — FAIT
- [x] 2.1 `card-art.tsx` : gabarit satori 750×1050 (bandeau incliné, rail
      stats, badge coût, emblème flexGrow, rubriques, pied de carte),
      thème par roster + thème légende star, monogramme superposé
      (les `<text>` SVG ne sont pas rendus par satori).
- [x] 2.2 `render.tsx` : chargement TTF mis en cache process, en-têtes
      cache + attachment, `playerCardFileName`.
- [x] 2.3 Polices OFL committées `apps/web/assets/fonts/` + README licence.
- [x] 2.4 `card-art.test.tsx` (7 tests, arbre React expansé sans satori).

## 3. Routes — FAIT
- [x] 3.1 `GET /api/player-card` (payload validé, 400 sinon, download).
- [x] 3.2 `GET /star-players/[slug]/card` (fetch serveur revalidate 1 h,
      404 slug inconnu, 502 API en panne, prix de paire, `?lang`).
- [x] 3.3 `getPlaysForCardLines` dans `plays-for.ts` + 4 tests.

## 4. UI — FAIT
- [x] 4.1 Fiche star : liens Voir/Télécharger (`star-card-preview`,
      `star-card-download`), langue active propagée.
- [x] 4.2 Fiche équipe : `handleExportPlayerCard` + boutons desktop
      (`player-card-<id>`, `player-card-download-<id>`) et mobile
      (`player-card-mobile-<id>`…), event Umami `card-export`.

## 5. Validation — FAIT
- [x] 5.1 Rendus locaux vérifiés (star mega-star, star liste restreinte,
      joueur skaven carrière, joueur mort roster clair / nom long).
- [x] 5.2 `pnpm --filter web typecheck` + suites vitest ciblées vertes.

## 6. Hors scope (pistes notées)
- [ ] Portraits maison (pipeline webp→png) si des artworks propres au site
      sont produits un jour.
- [ ] Bouton carte sur les joueurs Pro League / carrière.
- [ ] Planche d'impression 3×3 (PDF A4) pour imprimer tout un roster.
