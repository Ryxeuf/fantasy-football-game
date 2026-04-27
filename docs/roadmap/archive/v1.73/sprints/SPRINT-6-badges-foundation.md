# Sprint 6 — Badges Foundation (P1)

> Phase 1 du système Badges/Titres/Récompenses. Voir [FEATURE-BADGES-TITLES-REWARDS.md](./FEATURE-BADGES-TITLES-REWARDS.md) pour le contexte global.
> À implémenter **dans la même PR que [SPRINT-7](./SPRINT-7-badges-match-cup-triggers.md)**.

## Objectif

Poser les fondations :
- Schéma Prisma complet (Badge, UserBadge, Title, UserTitle, Donation, UserStats, TutorialProgress)
- Seed du catalogue de badges et titres
- Service `AchievementService` (dispatch + règles + grant + notify)
- Règles d'onboarding (5 règles minimum)
- Endpoints profil `/api/me/badges`, `/api/me/titles`, `PUT /api/me/title`, `POST /api/me/tutorial-progress`
- Intégration dans `routes/team.ts` et `routes/user.ts`

## Tickets

### 6.1 — Migration Prisma : nouveaux modèles

**Fichier :** `prisma/schema.prisma`

**Ajouts :**

```prisma
model Badge {
  id            String      @id @default(cuid())
  slug          String      @unique
  category      String      // "onboarding" | "social" | "competitive" | "patron" | "veteran" | "fun"
  tier          String      @default("bronze") // "bronze" | "silver" | "gold" | "platinum" | "legendary"
  nameFr        String
  nameEn        String
  descriptionFr String
  descriptionEn String
  iconUrl       String?
  points        Int         @default(10)
  hidden        Boolean     @default(false)
  createdAt     DateTime    @default(now())
  userBadges    UserBadge[]
  @@index([category])
  @@index([hidden])
}

model UserBadge {
  id         String   @id @default(cuid())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     String
  badge      Badge    @relation(fields: [badgeId], references: [id], onDelete: Cascade)
  badgeId    String
  unlockedAt DateTime @default(now())
  context    Json?
  @@unique([userId, badgeId])
  @@index([userId])
  @@index([badgeId])
}

model Title {
  id         String      @id @default(cuid())
  slug       String      @unique
  scope      String      // "static" | "dynamic"
  nameFr     String
  nameEn     String
  rarity     String      @default("common") // "common" | "rare" | "epic" | "legendary"
  color      String?
  createdAt  DateTime    @default(now())
  userTitles UserTitle[]
}

model UserTitle {
  id         String   @id @default(cuid())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     String
  title      Title    @relation(fields: [titleId], references: [id], onDelete: Cascade)
  titleId    String
  label      String
  context    Json?
  unlockedAt DateTime @default(now())
  isActive   Boolean  @default(false)
  @@unique([userId, titleId, label])
  @@index([userId])
  @@index([userId, isActive])
}

model TutorialProgress {
  id          String    @id @default(cuid())
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String
  scriptSlug  String
  completed   Boolean   @default(false)
  completedAt DateTime?
  @@unique([userId, scriptSlug])
  @@index([userId])
}

model Donation {
  id          String   @id @default(cuid())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String
  amountCents Int
  currency    String   @default("EUR")
  provider    String   // "kofi" | "stripe" | "manual"
  externalId  String?
  message     String?
  createdAt   DateTime @default(now())
  @@index([userId])
  @@index([createdAt])
  @@index([provider, externalId])
}

model UserStats {
  id                  String    @id @default(cuid())
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId              String    @unique
  matchesPlayed       Int       @default(0)
  matchesWon          Int       @default(0)
  matchesLost         Int       @default(0)
  matchesDrawn        Int       @default(0)
  matchesForfeited    Int       @default(0)
  currentWinStreak    Int       @default(0)
  bestWinStreak       Int       @default(0)
  touchdownsScored    Int       @default(0)
  casualtiesInflicted Int       @default(0)
  cupsCreated         Int       @default(0)
  cupsCompleted       Int       @default(0)
  cupsWon             Int       @default(0)
  teamsCreated        Int       @default(0)
  totalDonatedCents   Int       @default(0)
  loginStreakDays     Int       @default(0)
  lastLoginAt         DateTime?
  updatedAt           DateTime  @updatedAt
}
```

**Modifs du modèle `User` :**

```prisma
badges           UserBadge[]
titles           UserTitle[]
activeTitleId    String?
donations        Donation[]
tutorialProgress TutorialProgress[]
stats            UserStats?
profilePoints    Int                @default(0)
```

**Étapes :**
1. Ajouter au schema
2. `pnpm prisma migrate dev --name add_badges_titles_rewards`
3. `pnpm prisma generate`
4. `pnpm prisma validate`

**Tests :** aucun (migration structurelle) — vérifier que `pnpm turbo build --filter=server` reste vert.

---

### 6.2 — Seed du catalogue Badge + Title

**Fichiers :**
- `prisma/seeds/badges.seed.ts` (nouveau)
- `prisma/seeds/titles.seed.ts` (nouveau)
- `prisma/seed.ts` (ajouter les appels)

**Contenu badges.seed.ts** (extraits, liste complète dans FEATURE-BADGES-TITLES-REWARDS.md) :

```ts
export const BADGES = [
  // Onboarding
  { slug: "tutorial_started", category: "onboarding", tier: "bronze",
    nameFr: "Apprenti coach", nameEn: "Apprentice coach",
    descriptionFr: "Démarrer un tutoriel.", descriptionEn: "Started a tutorial.", points: 5 },
  { slug: "tutorial_complete", category: "onboarding", tier: "silver",
    nameFr: "Diplômé du Collège des Coachs", nameEn: "Coaching College Graduate",
    descriptionFr: "Terminer tous les tutoriels.", descriptionEn: "Complete all tutorials.", points: 25 },
  { slug: "first_team", category: "onboarding", tier: "bronze",
    nameFr: "Premier recrutement", nameEn: "First recruitment",
    descriptionFr: "Créer sa première équipe.", descriptionEn: "Create your first team.", points: 10 },
  { slug: "first_match", category: "onboarding", tier: "bronze",
    nameFr: "Baptême du feu", nameEn: "Baptism of fire",
    descriptionFr: "Jouer son premier match.", descriptionEn: "Play your first match.", points: 10 },
  { slug: "first_win", category: "onboarding", tier: "silver",
    nameFr: "Première victoire", nameEn: "First victory",
    descriptionFr: "Gagner son premier match.", descriptionEn: "Win your first match.", points: 15 },
  { slug: "profile_complete", category: "onboarding", tier: "bronze",
    nameFr: "Coach présentable", nameEn: "Presentable coach",
    descriptionFr: "Profil complété (prénom, nom, date de naissance).",
    descriptionEn: "Profile filled (first name, last name, date of birth).", points: 5 },
  { slug: "roster_collector_bronze", category: "onboarding", tier: "bronze",
    nameFr: "Collectionneur bronze", nameEn: "Bronze collector",
    descriptionFr: "Posséder 3 rosters différents.", descriptionEn: "Own 3 different rosters.", points: 15 },
  { slug: "roster_collector_silver", category: "onboarding", tier: "silver",
    nameFr: "Collectionneur argent", nameEn: "Silver collector",
    descriptionFr: "Posséder 6 rosters différents.", descriptionEn: "Own 6 different rosters.", points: 30 },
  { slug: "roster_collector_gold", category: "onboarding", tier: "gold",
    nameFr: "Collectionneur or", nameEn: "Gold collector",
    descriptionFr: "Posséder tous les rosters.", descriptionEn: "Own all rosters.", points: 100 },
  // TODO: ajouter Compétition (13), Coupes (6), Faits du jeu (8), Soutien (6), Fun hidden (5)
  // Référence exhaustive : FEATURE-BADGES-TITLES-REWARDS.md
];
```

**Contenu titles.seed.ts** :

```ts
export const TITLES = [
  { slug: "rookie", scope: "static", nameFr: "Recrue", nameEn: "Rookie", rarity: "common", color: "#9ca3af" },
  { slug: "veteran", scope: "static", nameFr: "Vétéran", nameEn: "Veteran", rarity: "rare", color: "#3b82f6" },
  { slug: "assidu", scope: "static", nameFr: "Joueur assidu", nameEn: "Regular player", rarity: "common", color: "#14b8a6" },
  { slug: "mecene", scope: "static", nameFr: "Mécène", nameEn: "Patron", rarity: "rare", color: "#f59e0b" },
  { slug: "grand_mecene", scope: "static", nameFr: "Grand Mécène", nameEn: "Grand Patron", rarity: "epic", color: "#f97316" },
  { slug: "pilier", scope: "static", nameFr: "Pilier de Nuffle", nameEn: "Pillar of Nuffle", rarity: "legendary", color: "#eab308" },
  { slug: "champion_cup", scope: "dynamic",
    nameFr: "Champion de la {cupName} {year}", nameEn: "Champion of {cupName} {year}",
    rarity: "epic", color: "#eab308" },
  { slug: "vice_champion_cup", scope: "dynamic",
    nameFr: "Vice-champion de la {cupName} {year}", nameEn: "Runner-up of {cupName} {year}",
    rarity: "rare", color: "#cbd5e1" },
  { slug: "bug_hunter", scope: "static", nameFr: "Chasseur de bugs", nameEn: "Bug hunter", rarity: "rare", color: "#ef4444" },
  { slug: "beta_tester", scope: "static", nameFr: "Bêta-testeur", nameEn: "Beta tester", rarity: "rare", color: "#8b5cf6" },
  { slug: "coach_elite", scope: "static", nameFr: "Coach Élite", nameEn: "Elite Coach", rarity: "epic", color: "#ec4899" },
  { slug: "legende_vivante", scope: "static", nameFr: "Légende vivante", nameEn: "Living legend", rarity: "legendary", color: "#eab308" },
  { slug: "taulier_du_terrain", scope: "static", nameFr: "Taulier du terrain", nameEn: "Pitch boss", rarity: "epic", color: "#dc2626" },
  { slug: "nuffle_chosen", scope: "static", nameFr: "L'Élu de Nuffle", nameEn: "Nuffle's Chosen", rarity: "legendary", color: "#a855f7" },
  { slug: "dev", scope: "static", nameFr: "Dev de Nuffle Arena", nameEn: "Nuffle Arena Dev", rarity: "legendary", color: "#10b981" },
];
```

**Tests :**
- `tests/integration/seeds/badges-seed.test.ts` : après seed, `prisma.badge.count() === BADGES.length`, idempotence (seed 2x ne duplique pas).

---

### 6.3 — AchievementService : dispatch + grant + notify

**Fichiers à créer :**

```
apps/server/src/services/achievements/
├── index.ts
├── triggers.ts
├── types.ts
├── badge-grant.ts
├── title-grant.ts
├── stats-updater.ts
├── notify.ts
└── rules/
    └── onboarding.rules.ts
```

**`triggers.ts`** :

```ts
export enum Trigger {
  TEAM_CREATED = "TEAM_CREATED",
  PROFILE_UPDATED = "PROFILE_UPDATED",
  TUTORIAL_STEP_COMPLETED = "TUTORIAL_STEP_COMPLETED",
  // P2 : MATCH_ENDED, MATCH_FORFEITED, CUP_CREATED, CUP_COMPLETED
  // P3 : DONATION_RECEIVED
}
```

**`types.ts`** :

```ts
export interface AchievementContext {
  userId: string;
  [key: string]: unknown;
}

export interface RuleOutcome {
  badgesToGrant: { slug: string; context?: unknown }[];
  titlesToGrant: { slug: string; label: string; context?: unknown; autoActivate?: boolean }[];
}

export type Rule = (
  trigger: Trigger,
  ctx: AchievementContext,
  prisma: PrismaClient
) => Promise<RuleOutcome>;
```

**`index.ts`** (dispatcher, idempotent) :

```ts
export async function dispatch(
  trigger: Trigger,
  ctx: AchievementContext
): Promise<{ newBadges: UserBadge[]; newTitles: UserTitle[] }> {
  // 1. Update UserStats incrementally (stats-updater.ts)
  // 2. Run all rules matching the trigger in parallel
  // 3. Collect RuleOutcome[]
  // 4. For each badge slug, call grantBadge() (idempotent upsert)
  // 5. For each title, call grantTitle()
  // 6. Notify via notify.ts if new unlocks
  // 7. Return summary
}
```

**`badge-grant.ts`** :

```ts
export async function grantBadge(
  userId: string,
  slug: string,
  context?: unknown
): Promise<UserBadge | null> {
  const badge = await prisma.badge.findUnique({ where: { slug } });
  if (!badge) throw new Error(`Unknown badge slug: ${slug}`);
  try {
    const ub = await prisma.userBadge.create({
      data: { userId, badgeId: badge.id, context: context ?? undefined },
    });
    // Increment profilePoints
    await prisma.user.update({
      where: { id: userId },
      data: { profilePoints: { increment: badge.points } },
    });
    return ub;
  } catch (err) {
    // Unique constraint violation = already unlocked (idempotent)
    if (isPrismaUniqueError(err)) return null;
    throw err;
  }
}
```

**`title-grant.ts`** : similaire + support activation (désactive les autres dans une transaction si `autoActivate`).

**`notify.ts`** :

```ts
export function notifyUnlocks(userId: string, newBadges: UserBadge[], newTitles: UserTitle[]) {
  const io = getSocketIO();
  if (newBadges.length > 0 || newTitles.length > 0) {
    io.to(`user:${userId}`).emit("user:badge-unlocked", { badges: newBadges, titles: newTitles });
  }
  // Push notification (optionnel) : réutiliser push-notifications.ts selon NotificationPreference
}
```

**Tests :**
- `tests/unit/services/achievements/badge-grant.test.ts` — grant idempotent, grant inconnu → erreur, increment profilePoints
- `tests/unit/services/achievements/title-grant.test.ts` — grant + auto-activate désactive les autres
- `tests/unit/services/achievements/dispatch.test.ts` — dispatch lance les règles, agrège, notifie
- `tests/unit/services/achievements/stats-updater.test.ts` — incréments corrects

---

### 6.4 — Règles onboarding (5 minimum)

**Fichier :** `apps/server/src/services/achievements/rules/onboarding.rules.ts`

**Règles à implémenter :**

1. `firstTeamRule` — sur `TEAM_CREATED`, si `stats.teamsCreated === 1` → badge `first_team`.
2. `profileCompleteRule` — sur `PROFILE_UPDATED`, si `user.firstName && user.lastName && user.dateOfBirth` → badge `profile_complete`.
3. `tutorialStartedRule` — sur `TUTORIAL_STEP_COMPLETED`, si c'est le premier step complété → badge `tutorial_started`.
4. `tutorialCompleteRule` — sur `TUTORIAL_STEP_COMPLETED`, si **tous** les scripts disponibles du game-engine (`listTutorialScripts()`) sont `completed=true` → badge `tutorial_complete`.
5. `rosterCollectorRule` — sur `TEAM_CREATED`, calculer le nombre de rosters distincts (SELECT DISTINCT roster) → badges bronze/silver/gold selon seuils 3/6/all.

**Tests :** `tests/unit/services/achievements/rules/onboarding.rules.test.ts` — un test par règle + cas idempotence (ne ré-attribue pas un badge déjà présent).

---

### 6.5 — Schemas Zod

**Fichier :** `apps/server/src/schemas/badges.schemas.ts`

```ts
export const tutorialProgressSchema = z.object({
  scriptSlug: z.string().min(1).max(100),
  completed: z.boolean(),
});

export const setActiveTitleSchema = z.object({
  titleUserId: z.string().cuid().nullable(),
});
```

**Tests :** `tests/unit/schemas/badges.schemas.test.ts` — valid/invalid inputs.

---

### 6.6 — Routes API profil

**Fichiers :**
- `apps/server/src/routes/me-badges.ts` (nouveau)
- `apps/server/src/routes/me-titles.ts` (nouveau)
- `apps/server/src/routes/public-badges.ts` (nouveau)
- `apps/server/src/routes/public-profile.ts` (nouveau ou étendre existant)
- `apps/server/src/app.ts` (monter les routes)

**Endpoints :**

```
GET    /api/me/badges
  → { badges: [{ slug, category, tier, nameFr, nameEn, unlockedAt, context }],
      progress: [{ slug, current, target, percent }] }

GET    /api/me/titles
  → { titles: [{ id, slug, label, rarity, color, isActive, unlockedAt }] }

PUT    /api/me/title
  body: { titleUserId: string | null }
  → { activeTitleId }
  (transaction : désactive tous les UserTitle existants, active celui demandé)

POST   /api/me/tutorial-progress
  body: { scriptSlug, completed }
  → upsert TutorialProgress + dispatch(TUTORIAL_STEP_COMPLETED)

GET    /api/badges
  → catalogue public (hidden exclus)

GET    /api/users/:id/profile
  → { user: { id, coachName, eloRating, activeTitle, badgesVitrine: [6 badges non-hidden] } }
```

**Tests :** `tests/integration/routes/me-badges.test.ts`, `me-titles.test.ts`, `public-badges.test.ts`, `public-profile.test.ts`.

---

### 6.7 — Intégration dans routes existantes

**Modifications :**

**`apps/server/src/routes/team.ts`** — après création équipe réussie :

```ts
await dispatch(Trigger.TEAM_CREATED, { userId, teamId: team.id, roster: team.roster });
```

**`apps/server/src/routes/user.ts`** — après update profil :

```ts
await dispatch(Trigger.PROFILE_UPDATED, { userId });
```

**Tests :** étendre `tests/integration/routes/team.test.ts` pour vérifier qu'un badge `first_team` est attribué après création.

---

## Checklist de complétion P1

- [ ] 6.1 Migration Prisma appliquée, `prisma validate` vert
- [ ] 6.2 Catalogue badges + titres seedé (idempotent)
- [ ] 6.3 Service `AchievementService` implémenté + tests unit
- [ ] 6.4 5 règles onboarding implémentées + tests unit
- [ ] 6.5 Schemas Zod + tests
- [ ] 6.6 4 routes API + tests integration
- [ ] 6.7 Hooks dans `routes/team.ts` et `routes/user.ts`
- [ ] Coverage >= 80% sur `services/achievements/**`
- [ ] `pnpm turbo build` vert
- [ ] `pnpm turbo test --filter=server` vert
- [ ] `pnpm turbo lint` vert

## Dépendances

- **SPRINT-7** dépend de ce sprint (réutilise `dispatch`, `grantBadge`, `grantTitle`, `UserStats`).
- **Aucune dépendance externe** : Ko-fi webhook reporté en P3.
