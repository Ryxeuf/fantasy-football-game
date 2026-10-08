# Tasks — mode de saisie de la feuille de coupe

## 1. Modèle et jeu de règles (serveur)

- [x] 1.1 Ajouter `sheetEntryMode String?` au modèle `Cup` dans `prisma/schema.prisma` ET `apps/server/prisma/sqlite/schema.prisma`, SANS `@default`, avec un commentaire « null = complète, la création écrit simplified » ; régénérer le client SQLite de test — vérifier : `pnpm --filter @bb/server typecheck` passe.
- [x] 1.2 `services/competition-match-sheet-context` : `entryMode` dans `CompetitionSheetRules` (`full` pour la ligue et `CUP_SHEET_RULES`), parseur pur `parseSheetEntryMode` (inconnu/null ⇒ `full`) et `cupSheetRules(mode)` — vérifier : tests unitaires (null, `full`, `simplified`, valeur inconnue, ligue toujours `full`).
- [x] 1.3 `resolveCompetitionPairing` lit `sheetEntryMode` dans le `select` de la coupe et pose `cupSheetRules(...)` — vérifier : test de résolution d'une rencontre de coupe en simplifié et d'une coupe à `null`, et `GET /cup/pairings/:id/sheet` sert `competitionRules.entryMode`.
- [x] 1.4 Consigner dans `CLAUDE.md` le piège « une colonne de réglage à défaut différent pour l'existant et le neuf : pas de `@default`, la création écrit la valeur » — vérifier : section relue, cohérente avec `playoffsPublished`.

## 2. Création et édition d'une coupe (serveur)

- [x] 2.1 `schemas/cup.schemas` : `sheetEntryMode: z.enum(["full", "simplified"]).optional()` dans `createCupSchema` et `updateCupSchema` — vérifier : tests de schéma (valeurs acceptées, valeur inconnue refusée).
- [x] 2.2 `POST /cup` écrit `body.sheetEntryMode ?? "simplified"` — vérifier : test de route (sans champ ⇒ `simplified`, `full` explicite conservé).
- [x] 2.3 `PATCH /cup/:id` accepte `sheetEntryMode` en cours de coupe — vérifier : tests de route (changement avec rondes jouées accepté, valeur inconnue ⇒ 400, coupe archivée ⇒ 409 inchangé).
- [x] 2.4 `seed.ts` : la coupe de démonstration (« Test 1 », seule coupe du seed) écrit explicitement `simplified` à sa création, comme une coupe neuve, et sa mise à jour ne réécrit pas le mode — vérifier : `pnpm --filter @bb/server typecheck` (le seed exige Postgres ; le mode complet se montre en basculant la coupe depuis son édition).

## 3. Sortie sur agression sans gravité (serveur)

- [x] 3.1 `sheetEventsToLocalMatchActions` compte une agression comme sortie si `injurySeverity` OU `meta.eliminated === true` — vérifier : tests unitaires (marquée sans gravité ⇒ `elimine`, ni gravité ni marque ⇒ pas de sortie, gravité seule ⇒ `elimine` comme avant).
- [x] 3.2 Mettre à jour `docs/cup-match-sheet.md` (mode de saisie, profil simplifié, marque `meta.eliminated`, défauts) — vérifier : doc relue, tableau des effets toujours exact.

## 4. Profil de saisie partagé (web, pur)

- [ ] 4.1 Créer `apps/web/app/lib/sheet-entry-profile.ts` (`sheetEntryProfile({ competitionKind, competitionRules })` : types d'évènements et libellés, mi-temps/tour, détails de blessure, réceptionneur, avant-match, poste des journaliers, mort relevé), les libellés étant CEUX DE LA LIGUE (seul « Élimination sur Agression » est nouveau) — vérifier : tests unitaires (ligue ⇒ complet, coupe sans `entryMode` ⇒ complet, coupe `simplified` ⇒ 5 types et champs masqués, libellés identiques à ceux de la ligue).

## 5. Feuille de match (web)

- [ ] 5.1 `leagues/pairings/[id]/sheet/page.tsx` : le MÊME bloc « Ajouter un évènement » suit le profil (types, mi-temps/tour, gravité, séquelle, réceptionneur, coup d'envoi retirés en simplifié), sans nouveau composant ni nouvelle mise en page — vérifier : tests de rendu en coupe simplifiée et en coupe complète (complète identique à l'existant).
- [ ] 5.2 Onglets et parcours inchangés en simplifié : « Avant-match » ne garde que le forfait (le panneau n'envoie que `{ forfeitSide }`), « En cours » reste l'onglet de saisie, boutons de soumission, de validation et d'invalidation identiques — vérifier : test de rendu (mêmes onglets et boutons que la saisie complète) + test que le corps du PATCH ne porte que `forfeitSide`.
- [ ] 5.3 « Élimination sur Agression » envoie `kind: "aggression"`, la cible et `meta.eliminated: true` ; la timeline affiche « [Sortie] » pour une agression marquée sans gravité — vérifier : tests (corps envoyé, libellé de timeline, y compris en saisie complète).
- [ ] 5.4 Masquer en simplifié les panneaux journaliers et mort relevé et les séparateurs de mi-temps qu'aucune saisie n'a renseignés ; garder les rosters et les journaliers dans les sélecteurs — vérifier : tests de rendu.
- [ ] 5.5 Bandeau de coupe : annonce du mode et lien vers `/aide#saisie-de-coupe` — vérifier : test de rendu dans les deux modes.

## 6. Formulaires de coupe (web)

- [ ] 6.1 Création (`cups/page.tsx`) : choix « Simplifiée — recommandé » / « Complète », simplifiée pré-sélectionnée, phrase d'explication et lien vers l'aide ; le champ est envoyé — vérifier : test du formulaire (défaut, valeur envoyée).
- [ ] 6.2 Édition (`cups/[id]/edit`) : même choix sur la valeur courante (`null` affiché « Complète »), modifiable coupe lancée — vérifier : test de la page d'édition.

## 7. Feuille papier (web)

- [ ] 7.1 `lib/competition-pdf/adapters/match-sheet.ts` et le gabarit de feuille suivent le profil : en simplifié, en-tête + forfait, page par équipe TD / Sor / Agr / Pas / Int, journal réduit (type, acteur, cible), signatures, sur le MÊME gabarit que la feuille de ligue ; ni popularité, coups de pouce, prières, météo, pile ou face, table de coup d'envoi, légende de gravité — vérifier : tests de l'adaptateur et du rendu dans les deux modes.

## 8. Aide du site (web)

- [ ] 8.1 `HelpFeature.details?: readonly string[]` rendu en liste à puces sur la carte — vérifier : test de rendu de `/aide`.
- [ ] 8.2 Carte `saisie-de-coupe` dans la catégorie « Coupes » (ce que demande chaque mode, qui le choisit et quand, défaut des nouvelles coupes, classement et tops identiques) — vérifier : tests du catalogue (ancres uniques, liens vivants) et de rendu.

## 9. Intégration

- [ ] 9.1 Spec e2e-api (étendre `tests/e2e-api/specs/cup-match-sheet-flow.spec.ts` ou en créer une) : coupe créée sans mode ⇒ feuille servie `simplified` ; sortie sur agression marquée validée ⇒ points d'agression au classement, agresseur et victime aux tops ; passage en complet en cours de coupe ⇒ classement inchangé — vérifier : suite e2e-api verte (tuer tout serveur resté sur le port 18002 avant).
- [ ] 9.2 Contrôles complets — vérifier : `pnpm --filter @bb/server typecheck`, `pnpm --filter @bb/web typecheck`, tests Vitest serveur et web verts.

## Workflow follow-up

- Une branche, commits atomiques par groupe, PR, surveillance CI et conflits jusqu'au vert (consignes de vague du `CLAUDE.md`).
- Après merge : `/opsx:sync` puis `/opsx:archive`. Le delta `site-help` est en `ADDED` : il s'applique que `site-help-page` soit archivé avant ou après.
- Ajouter une entrée à l'« Historique sessions » du `CLAUDE.md`.
