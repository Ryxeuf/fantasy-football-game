# Tasks — Aide de jeu

## 1. Fiches (contenu dérivé)
- [x] 1.1 `app/aide-de-jeu/data/sheets.ts` : `SheetSourceError`, `tableFromChapter`, fiches météo + prières depuis `@bb/game-engine`, catalogue `SHEETS` et `getSheet(id)`.
- [x] 1.2 Tests `sheets.test.ts` : chaque fiche se construit, captions du compendium présentes, `tableFromChapter` lève sur caption inconnu, météo = 12 terrains, prières = 16 entrées.

## 2. Déroulé
- [x] 2.1 `app/aide-de-jeu/data/sequences.ts` : trois phases, leurs étapes, pastilles de fiche, actions limitées du tour, liste des turnovers.
- [x] 2.2 Tests `sequences.test.ts` : ids uniques, toute pastille pointe une fiche existante, tout lien compendium pointe un chapitre existant.

## 3. Panneau
- [x] 3.1 `components/SheetPanel.tsx` : bottom-sheet mobile / latéral desktop en CSS, `role="dialog"`, focus, `Escape`, scroll verrouillé.
- [x] 3.2 `components/SheetContent.tsx` : rendu table / liste / texte, sélecteur de terrain pour la météo, lien vers le chapitre.
- [x] 3.3 Tests `SheetPanel.test.tsx` : ouverture/fermeture, `Escape`, attributs ARIA.

## 4. Page
- [x] 4.1 `app/aide-de-jeu/page.tsx` (server, ISR 3600) + `layout.tsx` : metadata, JSON-LD, disclaimer GW.
- [x] 4.2 `AideDeJeuClient.tsx` : onglets de phase, deep-link `?fiche=`, `popstate`, ouverture/fermeture du panneau.
- [x] 4.3 `components/PhaseTabs.tsx` + `components/StepCard.tsx`.
- [x] 4.4 Tests `AideDeJeuClient.test.tsx` : rendu des phases, ouverture d'une fiche, `?fiche=` initial, fiche inconnue ignorée.

## 5. Checklist
- [x] 5.1 `useChecklist.ts` : lecture en `useEffect`, écriture tolérante aux erreurs, `toggle` et `reset`.
- [x] 5.2 Tests `useChecklist.test.ts` : persistance, reset, `localStorage` indisponible.

## 6. Points d'entrée
- [x] 6.1 Entrée « Aide de jeu » dans `Header.tsx` (desktop + mobile) et lien pied de page.
- [x] 6.2 Entrée `/aide-de-jeu` dans `sitemap.ts` + lien depuis le compendium.

## 7. Vérification
- [x] 7.1 `pnpm --filter web typecheck`
- [x] 7.2 `pnpm --filter web vitest run app/aide-de-jeu`
- [x] 7.3 `pnpm --filter web lint`
