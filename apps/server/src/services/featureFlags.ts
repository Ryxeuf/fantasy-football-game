import { prisma } from "../prisma";
import { hasRole } from "../utils/roles";

/**
 * Feature Flag service.
 *
 * Règle d'évaluation : un flag est actif pour un utilisateur si
 *  - FEATURE_FLAGS_FORCE_ENABLED=true (bypass CI/tests), OU
 *  - l'utilisateur a le rôle "admin" (bypass admin), OU
 *  - le flag est globalement activé (enabled === true), OU
 *  - une entrée d'override existe pour (flagId, userId).
 */

/**
 * Clé du flag qui gate toute la partie "Jouer en ligne" du site.
 * Centralisée ici pour éviter les typos et permettre un usage typé.
 */
export const ONLINE_PLAY_FLAG = "online_play" as const;

/**
 * Clé du flag qui gate la fonctionnalité "Entrainement contre l'IA"
 * (POST /local-match/practice et POST /local-match/:id/ai-next-move).
 */
export const AI_TRAINING_FLAG = "ai_training" as const;

/**
 * Sprint Ligues v2 (PR2) — gate les nouveaux ecrans frontend de gestion
 * de ligue : creation `/leagues/new`, edition draft, creation saison,
 * panneau admin saison (open/start/regenerate/close), bouton "Rejoindre
 * cette saison", calendrier interactif avec pairings et bouton
 * "Lancer le match". Le backend reste ouvert (les routes API existaient
 * deja avant l'introduction du flag) ; ce flag controle uniquement la
 * visibilite des nouveaux composants UI tant que la feature n'est pas
 * pretement annoncee aux utilisateurs.
 */
export const LEAGUES_V2_UI_FLAG = "leagues_v2_ui" as const;

/**
 * Nuffle Coach (fantasy NFL skinne BB) — gate l'UI publique du
 * module : liens de menu, sous-nav, et pages user (catalogue
 * players, fiche player, standings d'une league, draft, about).
 *
 * Les routes API `/api/nfl-fantasy/*` restent ouvertes — ce flag
 * controle uniquement la visibilite des composants UI tant que la
 * feature n'est pas annoncee publiquement.
 */
export const NUFFLE_COACH_FLAG = "nuffle_coach" as const;

/**
 * Nuffle Coach — bac a sable de test. Quand actif pour un user, debloque
 * les garde-fous "snap-to-next-window" cote creation de championnat :
 *
 *   - createLeague accepte n'importe quel cycleId, meme si le cycle est
 *     `active` ou `closed` (utile pour simuler des championnats finis
 *     sur la saison 2025 avec stats reelles deja en base).
 *   - GET /api/nfl-fantasy/cycles retourne TOUTES les saisons + cycles
 *     y compris closed, pour que l'UI affiche les options de test.
 *   - UI /nfl-fantasy/new affiche un selecteur saison + cycle + banner
 *     "Mode test actif".
 *
 * STRICTEMENT OFF en prod (jamais globalement ON). Override individuel
 * via le panneau admin /admin/feature-flags pour les comptes dev.
 */
export const NUFFLE_COACH_TEST_FLAG = "nuffle_coach_test" as const;

/**
 * Sprint P (Lot P.A.1) — kill-switch global qui met le site en mode
 * "maintenance" : toutes les routes non-essentielles retournent 503
 * avec `Retry-After`. Routes preservees : `/health/*`, `/admin/*`,
 * `/auth/login`, `/auth/refresh`, `/auth/me`, `/auth/logout`. Le
 * frontend affiche une page maintenance avec timer.
 *
 * Kill-switch (cf. `KILL_SWITCH_FLAGS`) → pas force-ON par
 * `FEATURE_FLAGS_FORCE_ENABLED` (CI).
 */
export const MAINTENANCE_MODE_FLAG = "maintenance_mode" as const;

/**
 * Sprint O (Lot O.B.1) — kill-switch optionnel pour exiger une validation
 * admin sur les nouveaux comptes. Par defaut OFF (auto-approve), pour ne
 * pas bloquer l'acquisition. Si activate :
 *
 *   - POST /auth/register cree le user avec `valid: false`.
 *   - Pas de token issued, l'API renvoie `{ user, message }` sans token.
 *   - L'UI montre la page "pending validation" (deja existante).
 *
 * Utilite : si un raid de signup spammy apparait en prod, on active ce
 * flag pour forcer la moderation manuelle le temps de corriger
 * (CAPTCHA, IP block, etc.).
 */
export const REGISTRATION_REQUIRES_VALIDATION_FLAG =
  "registration_requires_validation" as const;

/**
 * Registre des feature flags connus du code. Source de vérité pour garder
 * la table `FeatureFlag` synchronisée avec le code : le bouton
 * "Synchroniser depuis le code" du panneau admin (POST
 * /admin/feature-flags/sync) crée en base tout flag listé ici mais absent
 * de la table.
 *
 * Convention : la synchro ne fait que *créer* les flags manquants (avec
 * `enabled: false`). Elle ne touche jamais un flag déjà présent — ni son
 * état global, ni sa description — pour ne pas activer une feature en prod
 * par accident. L'activation reste un geste admin explicite (toggle ON).
 *
 * Quand tu ajoutes une nouvelle constante `XXX_FLAG`, ajoute-la aussi ici.
 */
export interface KnownFlagSpec {
  readonly key: string;
  readonly description: string;
}

export const KNOWN_FLAGS: ReadonlyArray<KnownFlagSpec> = [
  {
    key: ONLINE_PLAY_FLAG,
    description: "Jouer en ligne — matchmaking, ligues, leaderboard.",
  },
  {
    key: AI_TRAINING_FLAG,
    description: "Entraînement contre l'IA (practice + ai-next-move).",
  },
  {
    key: LEAGUES_V2_UI_FLAG,
    description:
      "Ligues v2 — nouveaux écrans de gestion de ligue / saison (UI).",
  },
  {
    key: NUFFLE_COACH_FLAG,
    description:
      "Nuffle Coach (fantasy NFL skinné BB) — UI publique : menu, sous-nav, pages user.",
  },
  {
    key: NUFFLE_COACH_TEST_FLAG,
    description:
      "Nuffle Coach (test) — bypass snap-to-next-window. STRICTEMENT OFF en prod.",
  },
  {
    key: MAINTENANCE_MODE_FLAG,
    description:
      "Kill-switch maintenance — 503 sur les routes non-essentielles.",
  },
  {
    key: REGISTRATION_REQUIRES_VALIDATION_FLAG,
    description:
      "Kill-switch — exige une validation admin des nouveaux comptes.",
  },
];

export interface FeatureFlagDTO {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagWithCountDTO extends FeatureFlagDTO {
  userOverrideCount: number;
}

export interface FeatureFlagUserDTO {
  id: string;
  userId: string;
  email: string;
  coachName: string;
  createdAt: Date;
}

export interface EvaluationContext {
  /**
   * Rôles du coach courant. Si l'un d'eux est "admin", le flag est
   * considéré comme actif quel que soit son état global.
   */
  roles?: string[];
}

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  value: FeatureFlagDTO[];
  expiresAt: number;
}

let flagsCache: CacheEntry | null = null;

export function invalidateFeatureFlagsCache(): void {
  flagsCache = null;
}

/**
 * Vrai si l'env var FEATURE_FLAGS_FORCE_ENABLED force tous les flags
 * (utilisé dans la CI et les tests automatisés).
 */
function isForceEnabled(): boolean {
  const raw = process.env.FEATURE_FLAGS_FORCE_ENABLED;
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true";
}

function isAdmin(context?: EvaluationContext): boolean {
  return !!context?.roles && hasRole(context.roles, "admin");
}

async function getAllFlagsCached(): Promise<FeatureFlagDTO[]> {
  const now = Date.now();
  if (flagsCache && flagsCache.expiresAt > now) {
    return flagsCache.value;
  }
  const flags = (await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
  })) as FeatureFlagDTO[];
  flagsCache = { value: flags, expiresAt: now + CACHE_TTL_MS };
  return flags;
}

/**
 * Lot O.B.1 — Flags qui sont des **kill-switches** (semantique opposee
 * d'un feature gate normal : "ON" BLOQUE quelque chose plutot que de
 * l'activer). Ces flags ne doivent JAMAIS etre force-ON par
 * `FEATURE_FLAGS_FORCE_ENABLED` (CI), sinon les tests E2E qui assument
 * le comportement par defaut (ex: signup auto-approve) cassent.
 */
const KILL_SWITCH_FLAGS = new Set<string>([
  REGISTRATION_REQUIRES_VALIDATION_FLAG,
  MAINTENANCE_MODE_FLAG,
]);

/**
 * Returns true if `key` is enabled for the given user (or globally).
 * L'env `FEATURE_FLAGS_FORCE_ENABLED` et le rôle `admin` court-circuitent
 * toute vérification : ils rendent n'importe quel flag actif. Exception :
 * les kill-switches (voir `KILL_SWITCH_FLAGS`) sont evalues normalement
 * meme en force-enabled.
 */
export async function isEnabled(
  key: string,
  userId?: string,
  context?: EvaluationContext,
): Promise<boolean> {
  const isKillSwitch = KILL_SWITCH_FLAGS.has(key);
  if (!isKillSwitch && isForceEnabled()) return true;
  if (!isKillSwitch && isAdmin(context)) return true;
  const flags = await getAllFlagsCached();
  const flag = flags.find((f) => f.key === key);
  if (!flag) return false;
  if (flag.enabled) return true;
  if (!userId) return false;
  const override = await prisma.featureFlagUser.findUnique({
    where: { flagId_userId: { flagId: flag.id, userId } },
  });
  return override !== null;
}

/**
 * Liste toutes les clés actives pour un utilisateur donné (ou un visiteur
 * anonyme si `userId` n'est pas fourni). Les admins (et le mode "force")
 * voient TOUTES les clés de flags existantes. Les visiteurs anonymes ne
 * voient que les flags globalement activés.
 */
export async function listEnabledKeysForUser(
  userId?: string,
  context?: EvaluationContext,
): Promise<string[]> {
  const flags = await getAllFlagsCached();
  if (isForceEnabled() || isAdmin(context)) {
    return flags.map((f) => f.key).sort();
  }
  const globallyEnabled = flags.filter((f) => f.enabled).map((f) => f.key);
  if (!userId) {
    return globallyEnabled.slice().sort();
  }
  const overrides = await prisma.featureFlagUser.findMany({
    where: { userId },
    include: { flag: { select: { key: true, enabled: true } } },
  });
  const overrideKeys = overrides
    .filter((o: any) => !o.flag.enabled)
    .map((o: any) => o.flag.key as string);
  return Array.from(new Set([...globallyEnabled, ...overrideKeys])).sort();
}

/**
 * Liste tous les flags (admin) avec le nombre d'overrides utilisateur.
 */
export async function listAll(): Promise<FeatureFlagWithCountDTO[]> {
  const flags = (await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
    include: { _count: { select: { userOverrides: true } } },
  })) as Array<FeatureFlagDTO & { _count: { userOverrides: number } }>;
  return flags.map((f) => ({
    id: f.id,
    key: f.key,
    description: f.description,
    enabled: f.enabled,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    userOverrideCount: f._count.userOverrides,
  }));
}

export async function findById(id: string): Promise<FeatureFlagDTO | null> {
  return (await prisma.featureFlag.findUnique({
    where: { id },
  })) as FeatureFlagDTO | null;
}

export interface CreateFlagInput {
  key: string;
  description?: string | null;
  enabled?: boolean;
}

export async function createFlag(
  input: CreateFlagInput,
): Promise<FeatureFlagDTO> {
  const created = (await prisma.featureFlag.create({
    data: {
      key: input.key,
      description: input.description ?? null,
      enabled: input.enabled ?? false,
    },
  })) as FeatureFlagDTO;
  invalidateFeatureFlagsCache();
  return created;
}

export interface SyncFlagsResult {
  /** Clés créées en base par cette synchro. */
  created: string[];
  /** Clés déjà présentes (laissées intactes). */
  skipped: string[];
  /** Nombre total de flags connus du code. */
  total: number;
}

/**
 * Crée en base tout flag déclaré dans `KNOWN_FLAGS` mais absent de la
 * table. Idempotent : les flags déjà présents ne sont ni activés ni
 * modifiés. Permet de garder la BDD à jour vis-à-vis du code sans rejouer
 * le seed complet.
 */
export async function syncFlagsFromCode(): Promise<SyncFlagsResult> {
  const existing = (await prisma.featureFlag.findMany({
    select: { key: true },
  })) as Array<{ key: string }>;
  const existingKeys = new Set(existing.map((f) => f.key));

  const created: string[] = [];
  const skipped: string[] = [];
  for (const spec of KNOWN_FLAGS) {
    if (existingKeys.has(spec.key)) {
      skipped.push(spec.key);
      continue;
    }
    await prisma.featureFlag.create({
      data: { key: spec.key, description: spec.description, enabled: false },
    });
    created.push(spec.key);
  }

  if (created.length > 0) {
    invalidateFeatureFlagsCache();
  }

  return {
    created: created.sort(),
    skipped: skipped.sort(),
    total: KNOWN_FLAGS.length,
  };
}

export interface UpdateFlagInput {
  description?: string | null;
  enabled?: boolean;
}

export async function updateFlag(
  id: string,
  input: UpdateFlagInput,
): Promise<FeatureFlagDTO> {
  const updated = (await prisma.featureFlag.update({
    where: { id },
    data: input,
  })) as FeatureFlagDTO;
  invalidateFeatureFlagsCache();
  return updated;
}

export async function deleteFlag(id: string): Promise<void> {
  await prisma.featureFlag.delete({ where: { id } });
  invalidateFeatureFlagsCache();
}

export async function listUsersForFlag(
  flagId: string,
): Promise<FeatureFlagUserDTO[]> {
  const overrides = (await prisma.featureFlagUser.findMany({
    where: { flagId },
    include: {
      user: { select: { id: true, email: true, coachName: true } },
    },
    orderBy: { createdAt: "desc" },
  })) as Array<{
    id: string;
    userId: string;
    createdAt: Date;
    user: { id: string; email: string; coachName: string };
  }>;
  return overrides.map((o) => ({
    id: o.id,
    userId: o.userId,
    email: o.user.email,
    coachName: o.user.coachName,
    createdAt: o.createdAt,
  }));
}

export async function addUserOverride(
  flagId: string,
  userId: string,
): Promise<void> {
  // Upsert pour rester idempotent.
  await prisma.featureFlagUser.upsert({
    where: { flagId_userId: { flagId, userId } },
    create: { flagId, userId },
    update: {},
  });
}

export async function removeUserOverride(
  flagId: string,
  userId: string,
): Promise<void> {
  await prisma.featureFlagUser
    .delete({
      where: { flagId_userId: { flagId, userId } },
    })
    .catch(() => {
      // Pas d'override : no-op.
    });
}
