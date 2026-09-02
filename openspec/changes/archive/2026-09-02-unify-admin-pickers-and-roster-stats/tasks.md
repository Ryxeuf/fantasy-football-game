# Tasks — Sélecteurs admin unifiés & stats de roster

## 1. Sélecteur partagé
- [x] 1.1 `admin/data/_components/ChipMultiSelect.tsx` : chips + recherche + suggestions groupées + filtres, valeurs hors catalogue conservées. Tests.
- [x] 1.2 `admin/data/_components/SkillMultiSelect.tsx` : wrapper compétences (couleurs/labels des catégories BB) ; positions branchées dessus, ancien `SkillSelector` supprimé.

## 2. Star Players
- [x] 2.1 Compétences des formulaires new/edit via `SkillMultiSelect` (hors catalogue préservé) ; `SkillCheckboxPicker` supprimé.
- [x] 2.2 `HirableByPicker` réécrit sur `ChipMultiSelect` : règles/ligues groupées (Générique / Ligues régionales / Favoris & autres), rosters avec slug en sous-libellé ; props `onChangeRules`/`onChangeRosters` ; `toggleValue` retiré.
- [x] 2.3 Tests des deux pages adaptés (chips + suggestions au lieu des cases).

## 3. Fiche publique d'équipe
- [x] 3.1 `teams/[slug]/roster-stats.ts` : `playerCostRange`, `startingElevenCost`, `budgetHeadroom` (purs, testés).
- [x] 3.2 Carte « Statistiques du roster » : retrait de « Joueurs max », « Coût minimum », « Coût maximum » ; nouvelles tuiles branchées.
- [x] 3.3 i18n FR/EN : nouvelles clés, anciennes retirées.

## 4. Vérification
- [x] 4.1 `pnpm --filter web typecheck`
- [x] 4.2 `vitest run` (suite web complète)
- [x] 4.3 `next build`
