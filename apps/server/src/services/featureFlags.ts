import { prisma } from "../prisma";

/**
 * Feature Flag service.
 *
 * Règle d'évaluation : un flag est actif pour un utilisateur si
 *  - le flag est globalement activé (enabled === true), OU
 *  - une entrée d'override existe pour (flagId, userId).
 */

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

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  value: FeatureFlagDTO[];
  expiresAt: number;
}

let flagsCache: CacheEntry | null = null;

export function invalidateFeatureFlagsCache(): void {
  flagsCache = null;
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
 */
export async function isEnabled(
  key: string,
  userId?: string,
): Promise<boolean> {
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
 */
export async function listEnabledKeysForUser(
  userId: string,
): Promise<string[]> {
  const flags = await getAllFlagsCached();
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
