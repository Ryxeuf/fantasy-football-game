# Tasks — saisie en cases à cocher des Star Players

## 1. Composant partagé
- [x] 1.1 `SlugCheckboxGrid` déplacé de `data/rosters/_components/` à `data/_components/` (partagé rosters + Star Players) ; imports des trois écrans roster mis à jour.
- [x] 1.2 `SlugOption.hint` optionnel : texte affiché entre parenthèses quand la valeur cochée n'est pas lisible (id de roster → slug).

## 2. Catalogues et conversions (purs)
- [x] 2.1 `star-player-options.ts` : `HIRABLE_RULE_OPTIONS` = `all` + `REGIONAL_LEAGUES` + règles dérivées de `TEAM_REGIONAL_RULES_BY_RULESET` (alignements « Favori de… »), sans doublon.
- [x] 2.2 `hirableSelectionFromApi` : éclate la réponse API en `{ rules, rosterIds }`, dédoublonne, tolère `null`.
- [x] 2.3 `hirableSelectionToPayload` : réémet chaînes + couples `{ rule, rosterId }` ; ignore un roster hors catalogue.
- [x] 2.4 `toggleValue` immutable.

## 3. Sélecteurs
- [x] 3.1 `SkillCheckboxPicker` : cases à cocher groupées par catégorie, filtre texte (slug/FR/EN), compteur, dédoublonnage par slug, conservation des slugs « hors catalogue ».
- [x] 3.2 `HirableByPicker` : grille des règles + grille filtrable des rosters (cochés par id, affichés par slug).

## 4. Écrans
- [x] 4.1 `star-players/[id]/edit` : champs CSV remplacés par les deux sélecteurs, catalogues filtrés sur le ruleset du joueur, ruleset affiché dans l'entête.
- [x] 4.2 `star-players/[id]/edit` : confirmation par relecture serveur après enregistrement (comme l'édition d'un roster).
- [x] 4.3 `star-players/new` : idem + `select` de ruleset qui recharge les catalogues sans démonter le formulaire.

## 5. Serveur
- [x] 5.1 `POST /admin/data/star-players` : `resolveSkillIdsForRuleset` + `connect: { id }` + `ruleset` persisté.
- [x] 5.2 `PUT /admin/data/star-players/:id` : résolution et 404 **avant** les `deleteMany` ; `connect: { id }`.
- [x] 5.3 `SkillResolutionError` mappé en `400` sur les deux routes.
- [x] 5.4 `createStarPlayerDataSchema` accepte `ruleset` optionnel.

## 6. Tests
- [x] 6.1 `star-player-options.test.ts` — catalogue et conversions (9 cas).
- [x] 6.2 `SkillCheckboxPicker.test.tsx` — cochage, filtre, hors catalogue, dédoublonnage (5 cas).
- [x] 6.3 `star-players/[id]/edit/page.test.tsx` — état initial, payload envoyé, disparition des champs CSV, filtre ruleset (5 cas).
- [x] 6.4 `admin-data-star-player-skills.test.ts` — connexion par id, refus sans suppression, couple roster préservé, POST avec ruleset, 404 (5 cas).
