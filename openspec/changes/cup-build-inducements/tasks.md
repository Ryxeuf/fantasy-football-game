# Tasks — coups de pouce achetés à la création d'une équipe de coupe

> Une branche, un commit atomique par tâche (ou par paire tâche + test).
> Le lot 0 (groupes 1 à 4) corrige des bugs sans lire aucune colonne neuve
> et peut partir seul.

## 1. Lot 0 — Star Players du roster d'inscription sur la feuille (serveur + web)

- [x] 1.1 Créer `deriveSideStarPlayers({ side, inducements, frozenSnapshot, ruleset, competitionKind })` dans `services/league-sheet-star-players`. En coupe, elle fusionne les Star Players du roster figé et ceux saisis en avant-match, dédoublonne par slug et garde les ids `star-<side>-<slug>` — vérifier : tests unitaires (coupe avec stars figées seules, avant-match seul, les deux avec doublon, ligue qui ignore les stars figées, snapshot sans `starPlayers`).
- [x] 1.2 Faire passer TOUS les sites de dérivation par cette fonction : `withStarPlayers` de `getMatchSheet`, le repli de `sideSheetPlayers`, les lectures d'appartenance et de noms de la validation — vérifier : `grep deriveSheetStarPlayers` ne la trouve plus que dans le module + test de feuille de coupe où un Star Player figé est accepté comme acteur d'un touchdown et comme Joueur du Match (PSP non persistés).
- [x] 1.3 Refuser à `updatePreMatch` un Star Player sélectionné en avant-match s'il est déjà au roster d'inscription (400, code dédié) — vérifier : test de service (refus) + test qu'une feuille ancienne portant le doublon se lit sans erreur.
- [x] 1.4 Web : les Star Players figés apparaissent dans les sélecteurs d'acteur et de victime en saisie complète ET simplifiée — vérifier : tests de rendu de `leagues/pairings/[id]/sheet` dans les deux modes de coupe.
- [x] 1.5 Feuille papier : les Star Players figés sont listés dans la page de l'équipe avec leurs cases d'actions — vérifier : test de l'adaptateur `lib/competition-pdf/adapters/match-sheet`.

## 2. Lot 0 — Remises et plafond du règlement de tournoi (moteur + serveur + admin)

- [x] 2.1 Moteur : extraire `qualifiesForInducementDiscount(def, ctx)` de `getInducementCost`, sans changement de comportement — vérifier : tests existants de `inducements.test.ts` verts + tests de la fonction (règle spéciale, roster, ni l'un ni l'autre).
- [x] 2.2 Moteur : `TournamentInducementRule` gagne `discountCost?` et `maxWithSecretWeaponStar?`. Données NAF WC 2027 : Pots-de-vin `discountCost: 50_000`, `maxWithSecretWeaponStar: 2` ; Chef Cuistot `discountCost: 100_000` — vérifier : `tournament-rulesets.test.ts` (valeurs du pack).
- [x] 2.3 `applyPackInducementRules` reçoit le contexte de l'équipe : prix réduit si `qualifiesForInducementDiscount`, plafond = min(plafond du règlement sinon du moteur, plafond Arme Secrète si un Star Player recruté porte `secret-weapon`) — vérifier : `tournament-inducements.test.ts` (goblin ⇒ 50 000 po ×6, halfling ⇒ Chef 100 000, autre ⇒ 300 000, Arme Secrète ⇒ 2 Pots-de-vin).
- [x] 2.4 `schemas/tournament-ruleset.schemas` : validation (0 ≤ prix réduit ≤ prix, plafond ≥ 0), `serializeDefinition` et la lecture conservent les deux champs, une ligne incohérente est ignorée à la lecture — vérifier : `tournament-ruleset.schemas.test.ts`.
- [x] 2.5 Admin `admin/data/tournament-rulesets` : saisie du prix réduit et du plafond Arme Secrète par coup de pouce autorisé — vérifier : test du composant de section (édition + erreur de prix réduit > prix).
- [x] 2.6 Resynchroniser le seed sans écraser une édition admin (`syncTournamentRulesets`), et documenter le comportement `force: true` pour réinitialiser — vérifier : test du seeder (ligne absente ⇒ créée avec les nouveaux champs, ligne éditée ⇒ inchangée).

## 3. Lot 0 — Budget de coups de pouce d'une coupe sans trésorerie (serveur + web)

- [x] 3.1 `buildMatchSheetReference` reçoit la compétition. En coupe, `calculatePettyCash` est appelé sans bonus d'outsider et avec des trésoreries à 0 ; la ligue est inchangée — vérifier : tests (favori à 300 000 po de trésorerie ⇒ budget 0, outsider à 80 000 po d'écart ⇒ 80 000, ligue identique à l'existant).
- [x] 3.2 Le contrôle `inducement_over_budget` de `updatePreMatch` utilise le même budget — vérifier : test de service (sélection d'un favori de coupe refusée, ligue inchangée).
- [x] 3.3 Web : en coupe, l'éditeur de coups de pouce n'affiche plus la trésorerie comme cagnotte — vérifier : test de `MatchSheetPanels` (libellé de budget en coupe et en ligue).

## 4. Lot 0 — Inscription telle quelle contrôlée sur la dépense (serveur)

- [x] 4.1 `registerTeamToCup` compare le budget de la coupe à `buildTeamBudgetSummary(...).totalSpent`, et non plus à `team.teamValue` — vérifier : test (VE 1 000 kpo + 150 kpo de Star Players refusée à 1 000 kpo, équipe sans star dans le budget acceptée, message `budget_exceeded` détaillé).
- [x] 4.2 Mettre à jour `docs/cup-composition-rules.md` (contrôle sur la dépense) et `docs/cup-match-sheet.md` (Star Players figés, budget sans trésorerie) — vérifier : docs relues, cohérentes avec les tests des groupes 1 à 4.

## 5. Modèle de données et mode de coupe (serveur)

- [x] 5.1 Ajouter `Cup.inducementMode String?` et `Cup.allowedInducements Json?` (SANS `@default`, avec un commentaire « null = match / tout le catalogue à prix fixe ») et le modèle `TeamInducement` (`@@unique([teamId, slug])`, `onDelete: Cascade`) dans `prisma/schema.prisma` ET le miroir SQLite. Régénérer le client SQLite de test — vérifier : `pnpm --filter @bb/server typecheck`.
- [x] 5.2 Module pur `services/cup-inducement-mode` : `resolveCupInducementMode(raw, { pack, format })` (règlement ⇒ `build`, Sept sans `build`, inconnu/`null` ⇒ `match`) et parseur tolérant de `allowedInducements` (PG / SQLite) — vérifier : tests unitaires (toutes les combinaisons).
- [x] 5.3 `cupRulesConfigSchema` accepte `inducementMode` et `allowedInducements`. `POST /cup` écrit le mode explicitement (`build` en BB11 sans choix, `match` en Sept, `build` imposé sous règlement), et `build` demandé en Sept ⇒ 400. `PATCH /cup/:id/rules` applique les mêmes règles dans sa fenêtre existante — vérifier : tests de route (défauts, refus Sept, règlement qui force `build`, coupe validée ⇒ 400).
- [x] 5.4 `GET /cup/:id` sert `inducementMode` (effectif) et `allowedInducements` dans `rulesConfig` — vérifier : test de route (coupe à `null` ⇒ `match`).
- [x] 5.5 Ratchet `team-audit-coverage` : ajouter `teamInducement` aux modèles surveillés — vérifier : le test passe sur la base actuelle et échoue sur un écrivain fictif non journalisé.

## 6. Catalogue partagé et achat au build (serveur)

- [x] 6.1 Extraire `inducementOptionsFor` de `league-match-sheet.ts` vers `services/inducement-options`, sans changement de comportement — vérifier : tests de la feuille existants verts + test unitaire du service (mock Prisma) sur un roster avec et sans apothicaire.
- [x] 6.2 `buildInducementCatalogue({ roster, ruleset, regionalLeague, pack, allowlist, hiredStarSlugs })` : retire `star_player` et les coûts variables, applique le règlement (groupe 2) — vérifier : tests (règlement NAF ⇒ 5 options, coupe avec liste ⇒ intersection, Mercenaires absents).
- [x] 6.3 `GET /team/build-inducements` (`authUser`, `validateQuery`) : roster, édition, Ligue régionale, règlement ou `cupId` ; avec `cupId`, le serveur relit règlement, mode et liste de la coupe ; hors contexte autorisé, la liste est vide — vérifier : tests de route (coupe en `build`, coupe en `match` ⇒ vide, règlement seul, cupId inconnu ⇒ 404).
- [x] 6.4 Module pur `resolveBuildInducements(requested, catalogue)` : lignes au prix du catalogue, total en po, erreurs (hors catalogue, plafond, doublon) — vérifier : tests unitaires (dont « prix du client ignoré » : le schéma ne déclare pas `cost`).
- [x] 6.5 `team.schemas` : champ `inducements` (forme bornée). `team-build-handler` : refus hors contexte (`pack` ou coupe en `build`), validation après les Star Players, total ajouté à `totalBudgetUsed` avec une part nommée dans le message, écriture dans la transaction, détail dans `team.create` — vérifier : tests du handler (achat NAF accepté, Mage Météo NAF refusé, hors contexte refusé, budget dépassé, Arme Secrète ⇒ 3 Pots-de-vin refusés, journal).
- [x] 6.6 `buildTeamBudgetSummary` compte `inducementsCost` dans `totalSpent`, et `GET /team/:id` sert les `inducements` de l'équipe — vérifier : tests (dépense avec coups de pouce, VE inchangée).
- [x] 6.7 Sous règlement, le reliquat versable vaut 0 dans le résumé de budget, donc à la création ET au `resyncDraftTreasury` d'un brouillon ; sans règlement, le comportement est inchangé — vérifier : tests (`team-budget-summary`, édition de brouillon NAF qui reste à 0, équipe libre à 40 000 po).

## 7. Builder (web)

- [x] 7.1 Module pur `me/teams/new/build-inducements.ts` : total, bornage aux plafonds, réinitialisation au changement de roster, tri retenus / écartés pour le clonage — vérifier : tests unitaires.
- [x] 7.2 `BuildInducementPicker.tsx` : liste du catalogue servi, quantités ±, prix et plafond, total — vérifier : tests de rendu (bornes, `data-testid` stables : `build-inducements`, `build-inducement-<slug>`).
- [x] 7.3 `page.tsx` : la section n'apparaît que sous règlement ou pour une coupe en `build`. Elle charge le catalogue, ajoute `inducementsCost` au bandeau et au budget restant, envoie `inducements` au build, et rappelle que l'or non dépensé est perdu sous règlement — vérifier : tests de page (coupe en `build`, coupe en `match` sans section, jeu libre sans section, budget restant décompté).
- [x] 7.4 Clonage `?cupId=…&fromTeamId=…` : préremplit les coups de pouce retenus au prix de la coupe et signale les écartés — vérifier : test de page (Mage Météo écarté, Mascotte retenue).

## 8. Snapshot, feuille et papier en mode `build` (serveur + web)

- [x] 8.1 `buildRosterSnapshot` fige `inducements?` (`{ slug, name, quantity, unitCost }`) ; `parseRosterSnapshot` lit un snapshot sans le champ comme « aucun » — vérifier : tests de `cup-roster-snapshot` (capture, snapshot ancien).
- [x] 8.2 Feuille de coupe en `build` : `registeredInducements` servi par équipe depuis le roster figé ; catalogue vide et budget nul ; `updatePreMatch` refuse toute sélection (`inducements_locked`, 400). Même refus en `none` ; `match` est inchangé (groupe 3) — vérifier : tests de service (`build`, `none`, `match`, coupe à `null`).
- [x] 8.3 Web : en `build`, rappel en lecture seule des coups de pouce figés dans l'en-tête de chaque équipe, dans les deux modes de saisie, et aucun éditeur de coups de pouce ; en `none`, aucun éditeur — vérifier : tests de rendu (`build` complète, `build` simplifiée, `none`, `match`).
- [x] 8.4 Feuille papier : bloc « Coups de pouce (inscription) » par équipe pour une coupe en `build`, dans les deux modes, sans case d'achat — vérifier : tests de l'adaptateur et du rendu (« Mascotte d'Équipe ×1 », « Fûts de Blitz Premium ×2 »).

## 9. Inscription, fiche d'équipe et formulaire de coupe

- [x] 9.1 `registerTeamToCup` : une équipe porteuse de coups de pouce est refusée (`inducement_not_allowed`, message orientant vers « Adapter à la coupe ») si la coupe n'est pas en `build` ou si une ligne sort du catalogue effectif ou de son plafond — vérifier : tests (coupe en `match`, coupe en `build` avec liste restrictive, coupe en `build` compatible acceptée).
- [x] 9.2 Fiche d'équipe `me/teams/[id]` : liste des coups de pouce, coût compté dans la dépense à côté des Star Players — vérifier : test de rendu.
- [x] 9.3 Extraire de `LeagueForm` la liste à cocher des coups de pouce dans un champ partagé, sans changer le formulaire de ligue — vérifier : tests existants de `LeagueForm` verts + test du champ.
- [x] 9.4 `cups/page.tsx` (« Règles de composition ») : mode en trois choix (`build` présélectionné en BB11, imposé et grisé sous règlement, absent en Sept) et liste autorisée ; `cups/[id]` affiche le mode et la liste — vérifier : tests du formulaire (défauts, valeurs envoyées) et du détail.
- [ ] 9.5 Documentation : `docs/cup-composition-rules.md` (mode, liste, achat au build, snapshot, inscription) et une section « Coups de pouce de coupe : build / match / none » dans `CLAUDE.md`, avec le piège de la trésorerie fictive d'une coupe — vérifier : docs relues, cohérentes avec les specs.
- [ ] 9.6 Consigner les suites hors périmètre dans `docs/roadmap/backlog/openspec-suites.md` : jet de Débutants Déchaînés par ronde, ligues à règlement (trésorerie résiduelle, achat au build), `create-from-roster` en contexte de coupe, règle d'égalité de VEA de `calculatePettyCash` à confirmer dans le livre. Retirer la ligne « Enforcement en match de la liste fermée de coups de pouce » (déjà livrée) — vérifier : fichier relu.
- [ ] 9.7 Changeset `.changeset/coups-de-pouce-creation-coupe.md` (`@bb/game-engine`, `@bb/server`, `@bb/web` : patch) — vérifier : `pnpm changeset status` liste le fichier.

## 10. Intégration

- [ ] 10.1 Spec e2e-api `tests/e2e-api/specs/cups-build-inducements.spec.ts` : coupe NAF WC 2027 → build goblin avec Pots-de-vin (50 000 po) et un Star Player → inscription → feuille ouverte : Star Player proposé, coups de pouce rappelés, sélection d'avant-match refusée → validation sans écriture sur l'équipe — vérifier : la spec passe localement (serveur de test sur le port 18002 arrêté avant le run).
- [ ] 10.2 Lancer `pnpm --filter @bb/game-engine test`, `pnpm --filter @bb/server test`, `pnpm --filter web vitest run` et `pnpm -w run typecheck` — vérifier : tout est vert.

## Workflow follow-up

- Après merge : `/opsx:sync` puis `/opsx:archive`. Le change crée `openspec/specs/cup-inducements/` et met à jour `tournament-ruleset`, `cup-match-sheet`, `league-match-sheet` et `competition-pdf-exports`.
- Ajouter l'entrée de session à l'historique de `CLAUDE.md`.
