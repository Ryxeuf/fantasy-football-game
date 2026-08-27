# Audit — où le jeu lit encore le catalogue statique au lieu de la base (2026-08-27)

> Objectif produit : **tout** le moteur (construction, achats, VE, progression, feuilles de
> match, match en ligne, fiches publiques) doit s'appuyer sur les tables Prisma éditées en
> admin, et non sur le catalogue statique compilé dans `@bb/game-engine`
> (`packages/game-engine/src/rosters/*`, `skills/*`, `core/inducements.ts`,
> `utils/advancements.ts`). Les corrections sont faites en base, pas toujours dans le code.
>
> Périmètre : `apps/server/src`, `packages/game-engine/src`, `apps/web/app`, `apps/mobile`
> — hors tests, hors pages admin. Lecture seule. Version HTML (mise en page) :
> [`audit-statique-vs-bdd-2026-08-27.html`](./audit-statique-vs-bdd-2026-08-27.html).

## 1. Verdict

Le socle est sain : la VE/VEA (`utils/team-values.ts`), les coûts de staff
(`services/roster-staff-config.ts`), le catalogue Star Players côté serveur
(`utils/star-player-repository.ts`), les journaliers du match en ligne
(`services/journeymen.ts`), les rosters du builder (`utils/roster-helpers.ts`) et les
règlements de tournoi (`services/tournament-ruleset-repository.ts`) ont tous un résolveur
« base d'abord, catalogue en repli ». Le cœur du moteur de match (`mechanics/`, `actions/`,
`skills/skill-registry.ts`) ne lit **aucun** catalogue : il travaille sur le snapshot
`TeamPlayer`.

Les fuites sont donc des **call sites qui n'empruntent pas ces résolveurs**, concentrées sur
cinq chemins :

1. la progression « équipe libre » (`PUT /team/:id/players/:playerId/skills`) ;
2. les feuilles de match de ligue (journaliers, coups de pouce, remises, règles spéciales) ;
3. les validations de budget qui mélangent tarif base et tarif code ;
4. le contexte de coups de pouce du match en ligne / local (vide) ;
5. le front web, qui recalcule coûts et éligibilités depuis le catalogue alors que l'API sert
   déjà la donnée.

Deux familles de données n'ont **pas de table du tout** (coups de pouce, barème d'avancement),
deux tables existent sans être lues (`TeamSpecialRule`, `RegionalLeague` — vides en prod), et
trois seeders « sync » déclarent le code source de vérité et **écrasent les corrections admin**.

> **Mise à jour (lot 6 livré)** : les deux familles manquantes ont désormais leur table
> (`Inducement` ; `AdvancementCost` + `CharacteristicValue` + `RulesetConfig`) et les deux
> tables dormantes sont lues. Reste le lot 7 (gouvernance des seeders `sync-*`).

Chiffres : 11 causes structurelles (serveur/moteur), 18 points « haute » serveur, 19 points
« haute » front web, 5 tables/colonnes à créer, 2 tables à brancher, 0 usage statique de
données sur mobile.

## 2. Les 11 causes structurelles

Corriger la cause corrige tous les sites qu'elle regroupe.

### C1 · `resolveTeamRegionalRules` appelé sans son 4ᵉ paramètre `declaredRules`

Le paramètre optionnel (`packages/game-engine/src/rosters/regional-league-choice.ts:190-205`)
bascule silencieusement sur `TEAM_REGIONAL_RULES_BY_RULESET` compilé au lieu de
`Roster.regionalRules`.

- `utils/star-player-validation.ts:57` (embauche), `:159` (liste recrutable), `:209`
  (création d'équipe) ;
- `services/league-match-sheet.ts:2415` (remises de coups de pouce — avec en plus
  `DEFAULT_RULESET` forcé au lieu de `Team.ruleset`) et `:2462` (stars de la feuille).

Effet : une Ligue retirée/ajoutée en admin ne change ni l'embauche ni la feuille de match ;
l'UI propose (`GET /api/star-players/available/:roster` passe bien `declaredRules`), le POST
refuse — ou l'inverse. Roster DB-only → « Roster 'X' non reconnu ». Le pattern correct existe :
`routes/star-players.ts:428`, `routes/team-build-handler.ts:424`,
`routes/team-create-from-roster-handler.ts:178`, `services/commissioner-team-settings.ts:551`.

### C2 · Progression « équipe libre » 100 % statique

`routes/team-player-skills-handler.ts` :

- `:316` accès primaire/secondaire via `getPositionCategoryAccess`
  (`packages/game-engine/src/utils/skill-access.ts:31`, table `ACCESS_BY_POSITION` de
  **12 positions Saison 2**, sinon `ALL_CATEGORIES` y compris Trait) ;
- `:361`, `:382` existence et catégorie de la compétence via `SKILLS_BY_SLUG` ;
- `:342-346` pool du tirage `random-primary` = `SKILLS_DEFINITIONS` filtré par catégorie,
  **sans filtre ruleset** (seul `excludedFromSelection` vient de la base) ;
- `:187` → `services/team-advancement-editing.ts:229` règlement de tournoi via
  `getTournamentRuleset` statique.

Effet : ~95 % des postes n'ont aucune restriction d'accès (Mutation sur un Saurus, compétence
en primaire à prix PSP réduit → VE gonflée de 20 000 po par compétence) ; une compétence créée
en admin est refusée (« Competence inconnue ») ; une recatégorisation est ignorée. Le chemin
*ligue* (`services/post-match-league-sequence.ts:609-639`, `services/skill-access.ts`) lit la
base pour les mêmes règles : **deux vérités dans le même produit**. Idem
`RANDOM_PRIMARY_SKILL_TABLE_2025` (`post-match-league-sequence.ts:437,598`), dérivable de
`Skill.category` + ruleset.

### C3 · `getTournamentRuleset` du moteur appelé dans du code applicatif

Contredit la consigne de `CLAUDE.md`. Sites : `services/team-advancement-editing.ts:229`,
`services/commissioner-team-settings.ts:318,478`. Effet : barème PSP, taxe Élite, quota de
cumul, rosters autorisés, choix de Ligue régionale arbitrés sur l'ancienne version du
règlement. Le repository DB (`services/tournament-ruleset-repository.ts`) est utilisé partout
ailleurs (build, création, coupes : conformes).

### C4 · Journaliers de la feuille de match de ligue au catalogue

`services/league-sheet-journeymen.ts:81-170` lit `TEAM_ROSTERS_BY_RULESET` (poste, stats,
compétences **et coût**, repli `FALLBACK_COST = 50 000`). Consommé par :

- la VEA de match (`league-match-sheet.ts:252`, base du petty cash / CTV) ;
- le recrutement post-match (`:1254-1301` → `treasuryDebitHome/Away`,
  `league-offline-result.ts:409`) ;
- `league-offline-purchases.ts:484` (« position non résolue → joueur non créé » si un slug
  diffère : le journalier est **payé mais jamais matérialisé**).

Le match en ligne lit la base (`services/journeymen.ts`, `match-start.ts:200`,
`prematch-setup.ts:182`, `local-match.ts:552`). Bug annexe : `league-match-sheet.ts:1287`
appelle `surchargeForAdvancement` sans `isElite` (+10 000 po oubliés).

### C5 · `getPlayerCost` statique dans les validations de budget

- `routes/team-player-handlers.ts:181-190` : total des joueurs existants au tarif code, joueur
  ajouté au tarif base (`positionData.cost * 1000`, `:194`) → contrôle de budget mixte ;
- `routes/team-star-player-hire-handler.ts:81-90`, `routes/team-star-player-handlers.ts:141-150`
  : budget disponible pour un Star Player (autorise/refuse un recrutement) ;
- `routes/league.ts:1551` : « valeur du joueur » affichée ≠ `Team.teamValue` persistée (DB).

Le résolveur DB existe : `resolvePositionMetaForTeam` / `computeTeamValueBreakdownFor`
(`utils/team-values.ts`). Attention au double repli de `getPlayerCost`
(`team-value-calculator.ts:225-260`) : slug introuvable → table par **nom anglais** → `0`,
jamais d'erreur.

### C6 · Contexte de coups de pouce vide en match en ligne et local

`services/inducement-processor.ts:125-136`, `routes/local-match.ts:576-587` et `:706-712` :
`regionalRules: []` codé en dur, pas de `specialRules`. Effet :

- toutes les remises officielles perdues (Pots-de-vin 100 k au lieu de 50 k, Arbitre partial
  120 k au lieu de 80 k, Chef cuistot 300 k au lieu de 100 k chez les Halflings) ;
- plafonds majorés ignorés (Pots-de-vin 0-6) ;
- coups de pouce conditionnels (`mortuary_assistant`, `plague_doctor`, `riotous_rookies`)
  **refusés à toutes les équipes** ;
- `Team.regionalLeague` totalement ignoré.

Et `packages/game-engine/src/core/inducements.ts:420-423` (`getInducementCost`) tarifie /
valide les Star Players en inducement depuis `getStarPlayerBySlug` /
`getAvailableStarPlayers` compilés, **sans ruleset** (toujours S3) : c'est la seule fuite de
donnée statique dans le runtime du moteur. Un `StarPlayer.cost` corrigé en admin change la
feuille de ligue mais pas le match en ligne.

### C7 · Règles spéciales et apothicaire lus en direct dans la feuille de ligue

`services/league-match-sheet.ts:2420-2424` : `APOTHECARY_FORBIDDEN_ROSTERS.has(roster)` et
`getSpecialRulesForTeam(roster)` sans ruleset, alors que `RosterStaffConfig.apothecaryAllowed`
(`resolveStaffConfigBySlug`) et `resolveSpecialRulesForTeam` (`utils/team-values.ts:140`)
existent. Effet : prix, quantités et disponibilité des coups de pouce faux → débit de
trésorerie post-match faux.

### C8 · Liste de rosters autorisés figée (`ALLOWED_TEAMS`)

`constants/allowed-teams.ts:9-15` dérive de `Object.keys(TEAM_ROSTERS)` (S3 compilé) et garde
`/team/build` (`team-build-handler.ts:140`), `/team/create-from-roster` (`:124`),
`/team/rosters/:id` (`team-readonly-handlers.ts:172`). Un roster créé/activé uniquement en base
apparaît dans `/api/rosters` (DB) mais est refusé à la création (400).

### C9 · Front web : coûts, budgets et éligibilités recalculés depuis le catalogue

Alors que l'API sert déjà `positions[].cost`, `Roster.budget`, `staffConfig`, `budgetSummary`,
`playsFor`, `pairCost`, `primarySkills/secondarySkills`, `regionalLeagueOptions`. Détail en §5.
Souvent la donnée est **déjà chargée** dans le composant et non utilisée. Le bon modèle :
`me/teams/[id]/edit/page.tsx:553-557` (`dbCostByPosition`).

### C10 · Deux tables jamais lues, cinq données sans table

`TeamSpecialRule` et `RegionalLeague` ne sont écrites que par
`scripts/update-skills-and-rules-from-ocr.ts` et lues par personne (vides en prod au
2026-08-27) : les libellés/descriptions des règles spéciales et des Ligues viennent toujours
de `TEAM_SPECIAL_RULES` / `REGIONAL_LEAGUES`. **Nuance importante** : l'*attribution* d'un roster
à ses règles et Ligues (`Roster.specialRules`, `Roster.regionalRules`) est bien en base et bien
lue pour la création d'équipe — seul le *référentiel* (nom, description de chaque règle/Ligue)
reste dans le code. Sans table du tout : catalogue des coups de pouce, barème d'avancement,
paires obligatoires de Star Players, plafond de Gros Bras par roster, nom anglais des postes,
couleurs d'équipe. Détail en §6.

### C11 · Les seeders « sync » écrasent la base depuis le code

`seeders/sync-rosters.ts` (en-tête : « Source de vérité : `packages/game-engine/src/rosters/*` »),
`seeders/season3-skill-access.ts`, `seeders/sync-star-players.ts` (`syncOne` : cost, stats,
keywords, specialRule, skills, hirableBy). Exposés via `POST /admin/utilities/sync-rosters` et
`/reimport-season3-access`. Une correction admin est effaçable par un clic admin. Aggravant :
`utils/roster-helpers.ts:57` cache les rosters 5 min en prod — vérifier que
`invalidateRosterCache()` est appelé par les routes d'écriture admin (`routes/admin-data.ts`).

## 3. Détail serveur — sévérité haute

| # | Fichier | Statique utilisé | Équivalent base | Impact si divergence | Cause |
|---|---|---|---|---|---|
| S1 | `routes/team-player-skills-handler.ts:316` | `getPositionCategoryAccess` | `Position.primarySkills/secondarySkills` + `services/skill-access.ts` | Aucune restriction d'accès sur ~95 % des postes ; VE gonflée | C2 |
| S2 | `routes/team-player-skills-handler.ts:342,361,382` | `SKILLS_DEFINITIONS`, `SKILLS_BY_SLUG` | `Skill` (slug, ruleset, category) | Tirage hors ruleset ; compétence admin refusée ; recatégorisation ignorée | C2 |
| S3 | `services/team-advancement-editing.ts:229`, `services/commissioner-team-settings.ts:318,478` | `getTournamentRuleset` | `TournamentRuleset` via repository | Règlement admin ignoré (PSP, Élite, quotas, Ligue) | C3 |
| S4 | `services/league-sheet-journeymen.ts:81-170` | `TEAM_ROSTERS_BY_RULESET` | `Position` + `PositionSkill` | Journalier au mauvais prix/stats ; slug renommé → payé mais non créé | C4 |
| S5 | `routes/team-player-handlers.ts:181-190` | `getPlayerCost` (existant) vs DB (ajouté) | `Position.cost` | Contrôle de budget mixte | C5 |
| S6 | `routes/team-star-player-hire-handler.ts:81-90`, `routes/team-star-player-handlers.ts:141-150` | `getPlayerCost` | `Position.cost` | Star recruté au-delà du budget ou refusé à tort | C5 |
| S7 | `utils/star-player-validation.ts:57,159,209` | `resolveTeamRegionalRules` sans `declaredRules` | `Roster.regionalRules` | Stars recrutables bornées par le catalogue ; roster DB-only → « non reconnu » | C1 |
| S8 | `services/league-match-sheet.ts:2415,2462` | idem + `DEFAULT_RULESET` forcé | `Roster.regionalRules`, `Team.ruleset` | Remises régionales et offre de stars fausses, quelle que soit l'édition | C1 |
| S9 | `services/league-match-sheet.ts:2420-2424` | `APOTHECARY_FORBIDDEN_ROSTERS`, `getSpecialRulesForTeam` | `RosterStaffConfig.apothecaryAllowed`, `Roster.specialRules` | Prix/plafonds de coups de pouce faux → trésorerie post-match fausse | C7 |
| S10 | `services/inducement-processor.ts:125-136`, `routes/local-match.ts:576-587,706-712` | `regionalRules: []` | `Roster.regionalRules`, `Team.regionalLeague`, `Roster.specialRules` | Remises perdues, plafonds ignorés, coups de pouce conditionnels refusés | C6 |
| S11 | `packages/game-engine/src/core/inducements.ts:420-423` | `getStarPlayerBySlug`, `getAvailableStarPlayers` sans ruleset | `StarPlayer` via `getAvailableStarPlayersDb` | Star en inducement au catalogue compilé, toujours S3 | C6 |
| S12 | `routes/team-create-from-roster-handler.ts:238` | `calculateStarPlayersCost` sans ruleset | `StarPlayer` (slug_ruleset) | Équipe S2 : slug absent en S3 → coût 0 → **Star Player gratuit** | — |
| S13 | `utils/star-player-validation.ts:114-133,194` ; `team-build-handler.ts:448` ; `team-star-player-hire-handler.ts:122` ; `team-star-player-handlers.ts:292` | `STAR_PLAYER_PAIR_PARTNERS`, `requiresPair`/`validateStarPlayerPairs` sans ruleset | Aucun (pas de `pairWith` en base) | Paires S3 appliquées aux équipes S2 ; demi-paire achetée ou laissée seule | C10 |
| S14 | `constants/allowed-teams.ts:9-15` (3 routes) | `Object.keys(TEAM_ROSTERS)` | `Roster.slug WHERE ruleset` | Roster DB-only refusé à la création | C8 |
| S15 | `routes/team-build-handler.ts:185` | `FORMAT_CONSTRAINTS.startingBudget` (valeur client sinon) | `Roster.budget` (utilisé seulement pour les coupes) | Budget de construction en jeu libre = valeur client | — |
| S16 | `services/league-hate-trait.ts:108` | `getStarPlayerKeywords` | `StarPlayer.keywords` | Trait Haine post-match sur mots-clés périmés | — |
| S17 | `services/post-match-league-sequence.ts:437,598` | `RANDOM_PRIMARY_SKILL_TABLE_2025` | dérivable de `Skill.category` + ruleset | Tirage hors pool ou anti-triche qui refuse un choix légal | C2 |
| S18 | `seeders/sync-rosters.ts`, `season3-skill-access.ts`, `sync-star-players.ts` | le code écrase `Position`, `Roster.specialRules`, `StarPlayer` | — | Corrections admin effacées par un bouton admin | C11 |

## 4. Détail serveur — sévérité moyenne

| # | Fichier | Statique utilisé | Équivalent base | Impact |
|---|---|---|---|---|
| M1 | `routes/league.ts:1551,1579,1600` | `getPlayerCost`, `getPositionBySlug`, `TEAM_ROSTERS[].name` | `Position.cost/displayName`, `Roster.name` | Fiche roster de ligue : valeur joueur ≠ VE, noms périmés ou slugs bruts |
| M2 | `services/league-match-sheet.ts:1990,2002`, `services/league-player-stats.ts:46,52` | `TEAM_ROSTERS` | `Roster.name`, `Position.displayName` | Pickers de feuille et classements figés |
| M3 | `routes/team-star-player-handlers.ts:83` (+ spreads dans 5 handlers) | `DEFAULT_RULESET` en dur ; `{...sp, ...starPlayerData}` | `StarPlayer` du ruleset de l'équipe ; `TeamStarPlayer.cost` | Équipe S2 : stats S3 ou carte vide ; le coût *payé* est écrasé par le coût catalogue |
| M4 | `routes/star-players.ts:103,331` | `STAR_PLAYER_PAIR_PARTNERS` | Aucun | `pairWith/pairCost` jamais dérivés d'une star créée en admin |
| M5 | `routes/star-players.ts:68,75` | `STAR_PLAYER_RULE_SLUGS` (10 slugs) | flag/catégorie sur `Skill` | Pouvoir ajouté en base affiché en double |
| M6 | `utils/roster-helpers.ts:35`, `services/team-special-rules.ts:85`, `routes/public-rosters.ts:174` | `TEAM_SPECIAL_RULES` | `TeamSpecialRule` (jamais lue) | Libellé/description corrigés en base invisibles |
| M7 | `services/team-regional-league.ts:43`, `commissioner-team-settings.ts:329-528`, `routes/public-rosters.ts:207-252` | `getRegionalLeagueBySlug` | `RegionalLeague` (jamais lue) | Idem |
| M8 | `services/nfl-bb-derivation.ts:129-172` | `TEAM_ROSTERS_BY_RULESET.season_3` (cache process) | `Position` | Ingestion NFL Fantasy figée ; cache jamais invalidé |
| M9 | `services/league-match-sheet.ts:560-607` | — (coût du star engagé envoyé par le client) | `StarPlayer.cost` | Un client peut sous-évaluer un star à la soumission |
| M10 | `routes/team-create-from-roster-handler.ts:285-296`, `services/ai-practice.ts:141-153` | padding `position: 'Lineman'` 6/3/3/4/9 | `Position` | Slug inexistant → coût 0 en VE, bloque `PUT /roster` |
| M11 | `routes/local-match.ts:1649`, `services/practice-match.ts:89-100`, `team-name-generator.ts:407` | whitelist IA, familles de noms | Aucun | Roster ajouté en base : pas d'adversaire IA, noms génériques (configuration acceptable) |

## 5. Détail front web

Mobile : aucun import de donnée statique — tout vient de l'API (`lib/player-details.ts:14`
duplique la table de coûts PSP : une règle, pas une donnée base).

### Haute — budget, coût ou éligibilité présentés au coach

| # | Fichier | Statique utilisé | Donnée API disponible | Impact |
|---|---|---|---|---|
| W1 | `me/teams/[id]/page.tsx:938,1043,379`, `utils/exportPDF.ts:137-176` | `getPlayerCost` | `rosterDetail.positions[].cost` (déjà chargé l.203) | Colonne « Coût », carte PNG et PDF ≠ VE serveur |
| W2 | `me/teams/new/page.tsx:116,218,269,295` | `getFormatConstraints().startingBudget` | `rosters[].budget` (déjà chargé l.325) | Budget initial et « Restant » faux, divergence avec `POST /team/build` |
| W3 | `teams/[slug]/TeamDetailClient.tsx:127,176`, `roster-stats.ts:19` | `startingBudget`, `STANDARD_BUDGET_K = 1000` | `roster.budget` | Fiche publique du roster : budget et marge périmés |
| W4 | `me/teams/[id]/edit/page.tsx:1347`, `leagues/pairings/[id]/sheet/_components/SheetAdvancementsEditor.tsx:123,149` | `getPositionCategoryAccess`, `SKILL_ACCESS_SEASON3` | `Position.primarySkills/secondarySkills` | Catégories proposées que le serveur refuse ensuite |
| W5 | `me/teams/base-skills-data.ts:12-16` → `SkillTooltip.tsx:81` | `getPositionBySlug` (compétences de base) | `roster.positions[].skills` | Compétences de base affichées comme acquises, ou l'inverse |
| W6 | `star-players/StarPlayersClient.tsx:114,228-232` | `TEAM_REGIONAL_RULES` + 5 rosters en dur | `playsFor`, `/api/rosters` | Filtre « équipe » faux et limité à 5 rosters |
| W7 | `star-players/[slug]/page.tsx:296-302`, `components/StarPlayerCard.tsx:55`, `[slug]/card/route.ts:104,120` | `getStarPlayerPair(..., 'season_3')`, `getPlaysForCardLines` | `pairWith/pairCost`, `playsFor` | Deux prix de paire sur la même fiche ; carte PNG au statique, ruleset en dur |
| W8 | `ligues/page.tsx:37`, `ligues/[slug]/page.tsx:26-61` | `getRegionalLeaguesWithRosters`, `getRostersForRegionalLeague(…,"season_3")` | `regionalLeagueOptions` de `/api/rosters` | Pages « Ligues » : équipes éligibles fausses ; Ligue ajoutée en base → 404 |
| W9 | `me/teams/new/page.tsx:552` | `bigGuyLimitForRoster` | Aucune (colonne manquante) | Boutons Gros Bras selon le code |

### Moyenne — libellés et descriptions

| # | Fichiers | Statique utilisé | Donnée API | Impact |
|---|---|---|---|---|
| W10 | `components/RosterBadge.tsx:37` (8 appels), `leagues/…`, `cups/…` (10 fichiers), `plays-for.ts:33` | `getRosterName` | `/api/rosters?lang` | Nom de roster périmé, FR seulement |
| W11 | `me/teams/[id]/page.tsx`, `edit/page.tsx`, `career/page.tsx`, `exportPDF.ts` (11 appels) | `getDisplayName(positionSlug)` | `positions[].displayName` (déjà chargé) | Nom de poste périmé, non localisé |
| W12 | `utils/exportPDF.ts:23-67,158`, `lib/player-card/card-model.ts:347,409` | `ROSTER_DISPLAY_NAMES`, `getDisplayNames(skills)` | `/api/rosters?lang=en`, `/api/skills` | PDF et cartes : noms périmés, slug inconnu droppé |
| W13 | `me/teams/skills-data.ts:64,131` | `/api/skills` sans `?ruleset` ; repli statique synchrone | `/api/skills?ruleset=` | Équipe S2 servie en S3 ; flash de libellés périmés |
| W14 | `a-propos/page.tsx:20-40`, `skills/opengraph-image.tsx:17` | comptages sur les catalogues | `count` des endpoints | Pages indexées avec des chiffres faux |
| W15 | `leagues/pairings/[id]/sheet/_components/RosterSection.tsx:70` | `TEAM_ROSTERS_BY_RULESET` | `/api/rosters/:slug` | Postes du snapshot en slug ou périmés |

## 6. Ce qui n'existe pas (ou pas assez) en base

| Donnée | Où elle vit | Consommée par | À créer |
|---|---|---|---|
| Catalogue des coups de pouce (prix, plafonds, remises, conditions) | `core/inducements.ts:147-330` | match en ligne, local, feuille de ligue, schémas de packs | table `Inducement` (slug, ruleset, nameFr/En, baseCost, maxQuantity, discountRule/Cost/Roster, ruleMaxQuantity, condition) |
| Barème d'avancement (PSP par palier, surcoûts VE, +caractéristique, Élite) | `utils/advancements.ts:28-74` | post-match ligue, feuille, édition d'avancements, coupes, VE | table `AdvancementCost` |
| Paires obligatoires de Star Players | `rosters/star-players.ts:1579` | validation d'embauche, suppression, fiches | `StarPlayer.pairWith` + `pairCost` |
| Plafond combiné de Gros Bras par roster | `rosters/big-guy-limits.ts:30` | builder (serveur + web) | `Roster.maxBigGuys` |
| Nom anglais des postes, couleurs d'équipe, pouvoirs de Star Player | `position-names-en.ts`, `team-colors.ts`, `skills/star-player-rules.ts` | API publique, feuille, fiches | `Position.displayNameEn`, `Roster.primaryColor/secondaryColor`, catégorie `star_player_rule` sur `Skill` |
| Libellés des règles spéciales et des Ligues régionales | `team-special-rules.ts`, `regional-leagues.ts` | rosters publics, commissaire, création | **existent** (`TeamSpecialRule`, `RegionalLeague`) — à brancher et à peupler |

Frontière donnée/comportement : `Skill.slug` et `Position.slug` sont de facto un contrat de
code — le moteur ne connaît que le slug (`skill-registry.ts`), et l'admin ne peut pas modifier
un slug. Une compétence créée en admin avec un slug inconnu du registre est un pur libellé :
elle augmente la VE mais n'a aucun effet en match. À documenter côté admin.

## 7. Bugs connexes trouvés en chemin

- **Critique** — `team-create-from-roster-handler.ts:238` : `calculateStarPlayersCost` sans
  ruleset → Star Player à 0 po pour une équipe S2 dont la star n'existe pas en S3 (S12).
- **Critique** — `routes/local-match.ts:714-720,828-833` : lit `p.value`, champ inexistant sur
  `TeamPlayer` → CTV = 0 → **cagnotte toujours nulle en match local**. Utiliser
  `Team.currentValue`.
- **Élevé** — `league-match-sheet.ts:1287` : `surchargeForAdvancement` sans `isElite`.
- **Élevé** — `team-star-player-handlers.ts:83` : `DEFAULT_RULESET` en dur + spread qui écrase
  `TeamStarPlayer.cost` (M3).
- **Élevé** — `league-match-sheet.ts:560-607` : coût du star engagé fourni par le client (M9).
- **Moyen** — filtre de joueurs incohérent entre `services/match-start.ts:145-149`
  (`dead + firedAt + missNextMatch`) et `routes/match-state-handler.ts:172,176` (`!p.dead`).
- **Moyen** — `utils/roster-helpers.ts:57` : cache rosters 5 min en prod.
- **Moyen** — replis incohérents sur le fan dévoué côté web (`exportPDF.ts:145` : 10 000 ;
  `TeamInfoDisplay` / `TreasuryPurchasePanel` : 5 000).
- **Faible** — import mort `getDisplayName` dans `TreasuryPurchasePanel.tsx:5` ;
  `base-skills-data.ts:81` sans appelant.

## 8. Ce qui est déjà « base d'abord » — patterns de référence

- `utils/roster-helpers.ts:137` `getRosterFromDb` — rosters, positions, coûts, skills, Ligues.
- `services/roster-staff-config.ts:72` `resolveStaffConfigBySlug` — staff.
- `services/roster-regional-rules.ts:68` `effectiveRegionalRules` — résolution canonique des Ligues.
- `utils/team-values.ts` `resolvePositionMetaForTeam`, `resolveSpecialRulesForTeam`,
  `computeTeamValueBreakdownFor`.
- `utils/star-player-repository.ts` ; `services/star-player-plays-for.ts`.
- `services/tournament-ruleset-repository.ts` ; `services/journeymen.ts` ;
  `services/skill-access.ts` + `post-match-league-sequence.ts:609-639` ; `services/elite-skills.ts`.
- Web : `edit/page.tsx:553-557` (`dbCostByPosition`), `leagues/_components/LeagueForm.tsx:105`,
  `app/lib/tournament-rulesets.ts`.

Le moteur de match lui-même (`mechanics/`, `actions/`, `skills/skill-registry.ts`) est du
comportement indexé par slug : il ne doit pas migrer en base.

## 9. Plan de correction proposé

| Lot | Effort | Contenu |
|---|---|---|
| 1 | ≈ ½ j | Propager `declaredRules` (S7, S8) ; repository de règlements (S3) ; `calculateStarPlayersCost(…, ruleset)` (S12) ; `requiresPair`/`validateStarPlayerPairs(…, ruleset)` (S13) ; `team-star-player-handlers.ts:83` (M3). |
| 2 | ≈ 1 j | Progression « équipe libre » alignée sur le chemin ligue (S1, S2, S17). |
| 3 | ≈ 1 j | Coût des joueurs unifié (S5, S6, M1) ; journaliers de feuille → `Position` + `isElite` (S4) ; feuille de ligue → résolveurs DB règles spéciales/apothicaire (S9). |
| 4 | ≈ 1–2 j | Contexte de coups de pouce réel (S10, S11) ; catalogue de stars DB dans `getInducementCost` ; `p.value` (cagnotte nulle). |
| 5 | ≈ 1 j | Front web : W1–W5, W7 (données déjà chargées) ; W6/W8 ; résolveur `slug → nom` unique (W10–W12). |
| 6 | ≈ 4–5 j | **Arbitré le 2026-08-27, LIVRÉ → [lot6-modele-de-donnees-2026-08-27.md](./lot6-modele-de-donnees-2026-08-27.md).** Modèle de données : `TeamSpecialRule`/`RegionalLeague` branchées ; `Inducement`, `AdvancementCost`/`CharacteristicValue`/`RulesetConfig` créées ; colonnes `pairWithSlug`, `maxBigGuys`, `displayNameEn`, catégorie `StarPlayerRule` ; `ALLOWED_TEAMS` → `Roster` (S14) ; `Roster.budget` (S15). |
| 7 | ≈ ½ j | Gouvernance : seeders `sync-*` en diff-report, application champ par champ ; invalidation du cache rosters sur écriture admin. |

Après les lots 1–4, le catalogue statique ne sert plus que de repli (seed initial +
environnement sans base). Le lot 6 décide ce qui doit devenir administrable et mérite un
arbitrage produit avant code.
