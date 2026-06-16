# Feature : Accès compétences Primaire/Secondaire par position

> Modélise, pour chaque position (BB Season 3), les **catégories d'accès** aux
> compétences en montée de niveau (primaire vs secondaire), valide le level-up
> des équipes utilisateur contre ce pool, et l'expose dans l'UI (picker filtré +
> affichage public). Intègre les corrections d'accès de l'errata de mai 2026.

## Contexte / motivation

Avant : on ne stockait que les **compétences de départ** d'une position
(`Position` → `PositionSkill` → `Skill`). L'**accès** en montée de niveau
(catégories `G/A/S/P/M/K` où le joueur peut piocher, séparées en primaire/
secondaire) n'était modélisé **nulle part** côté équipes utilisateur :

- le level-up acceptait n'importe quel slug en texte libre (`applyAdvancementChoice`
  ne validait que le SPP et le compteur) ;
- la Pro-League avait un accès, mais **hardcodé par archétype générique**
  (`pro-position-skill-access.ts`), pas par position de roster.

Deux corrections de l'errata de mai 2026 portaient justement sur l'accès
**secondaire** (Coureur Nain +Agilité, Ogre −Mutation) → inapplicables sans ce
modèle.

## Modèle

`prisma/schema.prisma` — `Position` :

```prisma
primarySkills   String?  // CSV codes catégorie "G,A,S,P,M,K" (ordre canonique)
secondarySkills String?
```

Sémantique des valeurs :

| Valeur | Sens | Validation level-up |
|--------|------|---------------------|
| `null` | accès non géré (ex: season_2) | **désactivée** (rétro-compat) |
| `""`   | renseigné mais pool vide (positions animales) | active (pool vide) |
| `"G,S"`| pool de catégories | active |

Codes canoniques : `G` Général, `A` Agilité, **`S` = Force/Strength**, `P` Passe,
`M` Mutation, **`K` = Sournoiserie** (catégorie DB « Scélérates »).

⚠️ Collision de notation : la **source officielle FR (BB2025)** abrège Force `F`
et Sournoiserie `S`, alors qu'en interne `S` = Force et `K` = Sournoiserie. La
conversion **`F→S` et `S→K`** se fait **à l'import** (générateur). Côté runtime
(serveur, admin, UI), les valeurs sont déjà canoniques ; on tolère seulement
l'alias `F→S` pour les saisies admin historiques. Affichage : Force = « F » (FR)
/ « S » (EN) ; Sournoiserie = « S » (FR) / « K » Skulduggery (EN, pour éviter la
collision avec Strength).

Migration : `prisma/migrations/20260529000000_add_position_skill_access`
(colonnes additives nullables). Schéma SQLite de test mis à jour aussi
(`apps/server/prisma/sqlite/schema.prisma`).

## Données (season_3)

Source autoritaire : **`data/positionnels-bloodbowl-2025.md`** (fichier unique,
une section `## <Équipe>` par roster, colonnes **Primaire** / **Secondaire** par
position — notation officielle FR mordorbihan). Générées dans
`packages/game-engine/src/rosters/skill-access-season3.ts` (map
`slug -> { primary, secondary }`) par :

```bash
tsx scripts/generate-skill-access-season3.ts          # rapport (dry-run)
tsx scripts/generate-skill-access-season3.ts --write  # écrit le fichier
```

Le générateur : parse chaque section, convertit la notation source en codes
canoniques (**`F→S` Force, `S→K` Sournoiserie**, dédup), aligne chaque ligne au
slug `season3-rosters.ts` (match roster par nom + alignement par ordre intra-
roster, **31 rosters / 163 positions**), puis applique les **corrections errata**
(`ERRATA` dans le script).

Le seed (`apps/server/src/seed.ts`) applique ce map aux positions **season_3**
uniquement ; season_2 reste `null` (non géré). Re-seed complet :

```bash
docker exec -w /app/apps/server nufflearena_server pnpm run db:seed
```

### Mise à jour ciblée des accès (sans re-seed complet)

Pour réécrire **uniquement** `primary/secondarySkills` sur les positions
season_3 existantes (idempotent, ne touche ni équipes ni compétences) après
régénération de la source :

- **Bouton admin** : `/admin/utilities` → « Réimporter les accès Saison 3 »
  (`POST /admin/utilities/reimport-season3-access`).
- **CLI conteneur** :

```bash
docker compose exec server npx tsx scripts/reimport-season3-access.ts
```

Service : `apps/server/src/seeders/season3-skill-access.ts`
(`reimportSeason3SkillAccess`).

### Errata mai 2026 (accès) intégré

- `dwarf_coureur_nain` : **+Agilité (A)** en secondaire (`A,S`).
- `human_ogre`, `imperial_nobility_ogre`, `old_world_alliance_ogre` :
  **−Mutation (M)** en secondaire (déjà conforme dans la source S3 → override
  no-op explicite, traçable).

> Les 4 autres items errata (Chaos Renegade Ogre Solitaire 3+/Châtaigne,
> Halfling Hopeful 0-3, Goblin PA 4+, Treeman +Solitaire) concernent les
> **compétences de départ / stats** (positions.ts), **hors périmètre** de cette
> feature d'accès.

## Validation serveur

`apps/server/src/services/skill-access.ts` (helpers purs + DB) :
`dbCategoryToCode`, `normalizeAccessLetter` (`F→S`), `parseAccessCsv` (robuste
`"G,S"`/`"GS"`), `checkSkillAccess` (`ok`/`out-of-pool`/`no-data`),
`categoryCodeForSkill` (lookup `Skill.category`), `toCanonicalAccessCsv`.

`applyAdvancementChoice` (`post-match-league-sequence.ts`) résout la `Position`
du joueur (`TeamPlayer.position` + `Team.roster` + `Team.ruleset`) puis, **si
l'accès est renseigné**, rejette `skill-not-in-pool` quand la catégorie de la
skill choisie n'est pas dans le pool du type (`primary`/`secondary` ;
`random-*` = même pool). Validation **souple** : skip si `null` (season_2,
position inconnue) → aucune régression.

## UI

- **Level-up** (`apps/web/app/me/teams/[id]/level-up/page.tsx`) : l'input texte
  libre devient un `<select>` filtré sur le pool éligible (catalogue `/skills?
  ruleset=`, filtré par code catégorie selon le type). `pending-advancements`
  renvoie `position`/`primarySkills`/`secondarySkills` + `ruleset`. Fallback
  saisie libre si accès non renseigné.
- **Admin** (`/admin/data/positions` new + edit) : composant `SkillAccessSelector`
  (cases G/A/S/P/M + Sournoiserie) Primaire/Secondaire. Routes `admin-data` + schémas Zod
  (`skillAccessCsv`). `normalizeAccessInput` : CSV canonique, vide → `null`
  (évite d'activer la validation sur une position non gérée).
- **Public** (`apps/web/app/teams/[slug]`) : badges d'accès sous les compétences
  (primaire vert / secondaire gris). Exposé par `public-positions` +
  `public-rosters`.

## Limitations connues

- **Périmètre season_3** uniquement (season_2 sans source d'accès).
- **Qualité de la source** : les `.md` season_3 sont parfois incohérents
  (une catégorie en primaire **et** secondaire, divergences entre fichiers pour
  des positions équivalentes). Le parti pris est **permissif** (on ne rejette
  jamais un pick légal à tort, quitte à être un peu laxiste sur certains
  secondaires). Affinable position par position via l'admin.
- La Pro-League conserve son propre `pro-position-skill-access.ts` (archétype
  hardcodé) ; unifier sur la DB serait un lot futur.

## Tests

- `apps/server/src/services/skill-access.test.ts` — helpers (mapping dont
  Scélérates→K, F→S, parse, checkSkillAccess Sournoiserie, toCanonicalAccessCsv,
  categoryCodeForSkill).
- `apps/server/src/seeders/season3-skill-access.test.ts` — réimport idempotent
  (écriture canonique par position, skip des positions sans accès).
- `apps/server/src/services/post-match-league-sequence.test.ts` — validation
  d'accès dans `applyAdvancementChoice` (rejet hors-pool, accept in-pool,
  primaire vs secondaire, skip si `null`).

```bash
cd apps/server && pnpm exec vitest run src/services/skill-access.test.ts \
  src/services/post-match-league-sequence.test.ts
```
