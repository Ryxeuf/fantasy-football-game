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
 * Returns true if `key` is enabled for the given user (or globally).
 * L'env `FEATURE_FLAGS_FORCE_ENABLED` et le rôle `admin` court-circuitent
 * toute vérification : ils rendent n'importe quel flag actif.
 */
export async function isEnabled(
  key: string,
  userId?: string,
  context?: EvaluationContext,
): Promise<boolean> {
  if (isForceEnabled()) return true;
  if (isAdmin(context)) return true;
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
 * Liste toutes les clés actives pour un utilisateur donné.
 * Les admins (et le mode "force") voient TOUTES les clés de flags existantes.
 */
export async function listEnabledKeysForUser(
  userId: string,
  context?: EvaluationContext,
): Promise<string[]> {
  const flags = await getAllFlagsCached();
  if (isForceEnabled() || isAdmin(context)) {
    return flags.map((f) => f.key).sort();
  }
  const globallyEnabled = flags.filter((f) => f.enabled).map((f) => f.key);
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
