# Lot 6 — modèle de données « base d'abord » : arbitrages et spécification (2026-08-27)

Suite de l'[audit statique vs base](./audit-statique-vs-bdd-2026-08-27.md) (§6 et §9, lot 6).
Arbitré avec le propriétaire le 2026-08-27.

## 1. Décisions

| # | Sujet | Décision | Effort |
|---|---|---|---|
| 6.1 | Coups de pouce | **Table `Inducement` complète** (prix, plafonds, remises, conditions en données) + admin CRUD ; le moteur reçoit le catalogue en paramètre | ~1,5 j |
| 6.2 | Barème d'avancement | **Table `AdvancementCost` par ruleset** (+ surcoûts de caractéristique, Élite) + admin en grille. Corrige au passage le bug « valeurs S3 appliquées aux équipes S2 » | ~1 j |
| 6.3 | Paires de Star Players | Colonne `StarPlayer.pairWithSlug`, `pairCost` dérivé | ~½ j |
| 6.4 | Plafond de Gros Bras | Colonne `Roster.maxBigGuys` | ~2 h |
| 6.5 | `TeamSpecialRule` / `RegionalLeague` | **Brancher** : seed « create-if-missing », lecture DB-first, admin CRUD, sélecteurs sur le formulaire roster | ~1 j |
| 6.6 | Confort | `Position.displayNameEn` ; catégorie `StarPlayerRule` sur `Skill` pour les 10 pouvoirs. **Pas** de couleurs d'équipe en base | ~3 h |
| 6.7 | Budget de construction | **Libre, `Roster.budget` comme défaut** : le coach peut saisir un budget (ligues maison), la valeur par défaut serveur *et* web vient de la base ; coupes/packs inchangés | ~2 h |
| 6.8 | `ALLOWED_TEAMS` | Remplacé par `Roster.slug WHERE ruleset` (cache court) | ~1 h |

Principes transverses (valables pour tout le lot) :

- **La base fait foi, le code est un repli.** Chaque référentiel a un service `services/<x>-repository.ts`
  sur le modèle de `tournament-ruleset-repository.ts` : lecture DB validée (Zod), repli sur le
  catalogue compilé **journalisé** (`serverLog.warn`) si la table est vide, cache mémoire court
  (TTL 5 min en prod, 0 ailleurs) avec `invalidate<X>Cache()` appelé par les routes d'écriture admin.
- **Seeds « create-if-missing »** : les seeders n'écrasent jamais une ligne existante (cf. lot 7 pour
  les seeders `sync-*` historiques). Un rapport de diff est disponible (`--report`) pour voir les
  écarts base / catalogue.
- **Le moteur reste pur** : `packages/game-engine` ne lit pas Prisma ; le serveur lui passe le
  catalogue résolu (comme il passe déjà les stats des journaliers et le `staffConfig`).
- **Les slugs restent un contrat de code** (non éditables en admin, création seule) : un coup de
  pouce ou une compétence créés en admin avec un slug inconnu du moteur n'ont pas d'effet en match
  (libellé + prix seulement) — à afficher dans l'admin.

## 2. Modèle de données

### 2.1 `Inducement` (nouvelle table)

```prisma
model Inducement {
  id                  String   @id @default(cuid())
  slug                String   // contrat moteur : bribe, wizard, star_player, mercenary_players…
  ruleset             Ruleset  @default(season_3)
  nameFr              String
  nameEn              String
  descriptionFr       String
  descriptionEn       String?
  baseCost            Int      // po ; 0 = coût variable (star_player, mercenary_players)
  maxQuantity         Int
  /// Remise : coût `discountCost` si l'équipe a la règle spéciale/Ligue `discountRule`
  /// OU si son roster est `discountRoster` (l'un ou l'autre, jamais les deux).
  discountRule        String?
  discountRoster      String?
  discountCost        Int?
  /// Plafond majoré si l'équipe a la règle `ruleMaxRule` (ex. bribe : 6 avec chantage_et_corruption).
  ruleMaxRule         String?
  ruleMaxQuantity     Int?
  /// Conditions d'achat (toutes celles renseignées doivent être vraies).
  requiresAnyRule     String?  // CSV de slugs de règles spéciales/Ligues : au moins une
  requiresRoster      String?  // slug de roster
  requiresApothecary  Boolean  @default(false)
  variableCost        Boolean  @default(false)
  enabled             Boolean  @default(true)
  sortOrder           Int      @default(0)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([slug, ruleset])
  @@index([ruleset, enabled])
}
```

Correspondance avec `core/inducements.ts` : les 4 `canPurchase` deviennent
`requiresAnyRule="maitres_de_la_non_vie"`, `requiresAnyRule="favori_de" + requiresRoster="nurgle"`,
`requiresAnyRule="trois_quarts_a_vil_prix"`, `requiresApothecary=true`. Le moteur expose un
`InducementCatalogue` (liste de définitions **données**, sans fonction) et une fonction pure
`canPurchaseInducement(def, ctx)` qui évalue ces champs. `INDUCEMENT_CATALOGUE` compilé devient
le repli et la source du seed. Les packs de tournoi continuent de surcharger `cost`/`max` par slug
(`applyPackInducementRules`) **par-dessus** le catalogue résolu.

### 2.2 `AdvancementCost` (nouvelle table)

```prisma
enum AdvancementKind { primary secondary random_primary random_secondary characteristic }

model AdvancementCost {
  id                 String          @id @default(cuid())
  ruleset            Ruleset
  kind               AdvancementKind
  step               Int             // 1..6 : n-ième amélioration du joueur
  sppCost            Int
  teamValueSurcharge Int             // po ajoutés à la VE (0 pour characteristic : cf. CharacteristicValue)
  @@unique([ruleset, kind, step])
}

model CharacteristicValue {
  id        String  @id @default(cuid())
  ruleset   Ruleset
  stat      String  // ma | st | ag | pa | av
  surcharge Int     // po ajoutés à la VE pour +1
  @@unique([ruleset, stat])
}
```

Le surcoût Élite reste une colonne de configuration par ruleset (`RulesetConfig.eliteSkillSurcharge`,
table clé-valeur à 1 ligne par ruleset, extensible). Le moteur reçoit un `AdvancementSchedule`
résolu ; `getNextAdvancementPspCost` / `surchargeForAdvancement` prennent ce schedule en paramètre
(signature actuelle conservée avec le barème compilé en défaut, pour les tests et le repli).
Seed : S3 = valeurs actuelles du code ; S2 = valeurs du livre 2020 (secondaire 12, caractéristique
18/20/24/28/32/40, `random_secondary` 20 k de surcoût) — à faire valider avant seed.

Consommateurs à brancher : `post-match-league-sequence.ts`, `league-sheet-advancements.ts`,
`team-advancement-editing.ts`, `routes/team-advancement.ts`, `cup-rules.ts`,
`cup-build-advancements.ts`, `league-match-sheet.ts:1286`, `utils/team-values.ts:215`.

### 2.3 Colonnes ajoutées

| Table | Colonne | Type | Rôle |
|---|---|---|---|
| `StarPlayer` | `pairWithSlug` | `String?` | Partenaire obligatoire (même ruleset). `pairCost` = somme des deux `cost` (le partenaire garde `cost` = 0 comme aujourd'hui). Remplace `STAR_PLAYER_PAIR_PARTNERS` dans `star-player-validation.ts`, `team-star-player-hire-handler.ts`, `team-star-player-handlers.ts`, `routes/star-players.ts` et le web |
| `Roster` | `maxBigGuys` | `Int?` | Plafond combiné de Gros Bras (null = pas de plafond). Remplace `bigGuyLimitForRoster` (serveur `team-build-handler.ts:398`, web `me/teams/new/page.tsx:552`) |
| `Position` | `displayNameEn` | `String?` | Remplace `position-names-en.ts` (`public-positions.ts:199`, `public-rosters.ts:477`) |
| `Skill` | `category = "StarPlayerRule"` | valeur | Marque les 10 pouvoirs de star (`skills/star-player-rules.ts`) ; `isStarPlayerRule(slug)` lit la catégorie DB avec repli code |

### 2.4 `TeamSpecialRule` et `RegionalLeague` (existantes)

Schéma inchangé. Seed depuis `TEAM_SPECIAL_RULES` (9) et `REGIONAL_LEAGUES` (12) pour les deux
rulesets. Lecture DB-first dans `utils/roster-helpers.ts:35` (`getTeamSpecialRuleBySlug`),
`services/team-special-rules.ts:85`, `routes/public-rosters.ts:174,207-252`,
`services/team-regional-league.ts:43`, `services/commissioner-team-settings.ts:329-528`.
Admin : deux pages CRUD `admin/data/special-rules` et `admin/data/regional-leagues` ; le formulaire
roster (`admin/data/rosters/[id]/edit`) propose les règles/Ligues **depuis ces tables** (cases à
cocher) au lieu du catalogue compilé.

### 2.5 Budget de construction (6.7)

- Serveur `team-build-handler.ts:185` et `team-create-from-roster-handler.ts` : le budget par défaut
  devient `Roster.budget` (lu via `getRosterFromDb`) quand le client n'en envoie pas ; une valeur
  client explicite reste acceptée dans les bornes du schéma (100–2000 kpo). Les coupes/packs
  imposent toujours le leur.
- Web `me/teams/new/page.tsx:116,218,269,295` et `teams/[slug]/TeamDetailClient.tsx:127,176` :
  défaut = `rosters[].budget` (déjà chargé).
- **À vérifier avant livraison** : en prod, `slann` (S3) a `budget = 1093` k, seul roster ≠ 1000 k.
  Valeur probablement erronée.

## 3. Ordre de livraison (chaque sous-lot livrable seul, avec tests)

| Sous-lot | Contenu | Effort |
|---|---|---|
| 6a | Colonnes simples + migration : `pairWithSlug`, `maxBigGuys`, `displayNameEn`, catégorie `StarPlayerRule` ; seed create-if-missing ; call sites serveur + web ; `ALLOWED_TEAMS` → `Roster` ; budget par défaut `Roster.budget` | ~1 j |
| 6b | `TeamSpecialRule` / `RegionalLeague` : seed, repositories DB-first, call sites, admin CRUD, sélecteurs roster | ~1 j |
| 6c | `Inducement` : migration, seed, repository, refactor moteur (`InducementCatalogue` en paramètre, `canPurchaseInducement` pur), branchement `inducement-processor.ts`, `local-match.ts`, `league-match-sheet.ts` (en même temps que le lot 4 : contexte `regionalRules`/`specialRules` réel), admin CRUD | ~1,5–2 j |
| 6d | `AdvancementCost` / `CharacteristicValue` / `RulesetConfig` : migration, seed S2+S3 (valeurs S2 à valider), repository, `AdvancementSchedule` en paramètre du moteur, 8 consommateurs, admin grille | ~1 j |

Prérequis : lot 1 (propagation `declaredRules`, repository de règlements) — indépendant mais à
livrer avant 6c pour que les contextes de coups de pouce soient justes.

## 4. Hors périmètre (décidé)

- Couleurs / logos / sprites d'équipe : restent en code (cosmétique, moteur de rendu).
- Whitelist des adversaires IA, familles de noms d'équipe : configuration en code, acceptable.
- Slugs de compétences et de postes : contrat de code, non éditables.
