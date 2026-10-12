/**
 * Clés API d'administration — lecture / écriture (change OpenSpec
 * `admin-api-keys`, doc `docs/admin-api-keys.md`).
 *
 * Les DÉCISIONS (format, éligibilité, portée, expiration) vivent dans
 * `api-key-rules` (pur) ; ce module ne fait que les I/O. Le secret ne sort
 * d'ici qu'une fois, dans le retour de `createApiKey`, et n'est jamais
 * journalisé — seul `keyPrefix` l'est.
 */
import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import {
  apiKeyStatus,
  computeApiKeyExpiry,
  evaluateApiKey,
  generateApiKey,
  hashApiKey,
  isApiKeyFormat,
  parseApiKeyScope,
  shouldTouchLastUsed,
  API_KEY_LAST_USED_WINDOW_MS,
  type ApiKeyEvaluation,
  type ApiKeyRow,
  type ApiKeyScope,
  type ApiKeyStatus,
} from "./api-key-rules";

export class ApiKeyError extends Error {
  constructor(
    public readonly code: "not_found",
    message: string,
  ) {
    super(message);
    this.name = "ApiKeyError";
  }
}

/** Vue servie à l'admin : jamais le secret, jamais l'empreinte. */
export interface ApiKeyView {
  readonly id: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly scope: ApiKeyScope;
  readonly status: ApiKeyStatus;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly lastUsedAt: string | null;
  readonly lastUsedIp: string | null;
  readonly revokedAt: string | null;
  readonly revokedById: string | null;
  readonly owner: { readonly id: string; readonly coachName: string; readonly email: string } | null;
}

const VIEW_SELECT = {
  id: true,
  name: true,
  keyPrefix: true,
  scope: true,
  createdAt: true,
  expiresAt: true,
  lastUsedAt: true,
  lastUsedIp: true,
  revokedAt: true,
  revokedById: true,
  user: { select: { id: true, coachName: true, email: true } },
} as const;

interface ViewRow {
  id: string;
  name: string;
  keyPrefix: string;
  scope: string;
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  revokedAt: Date | null;
  revokedById: string | null;
  user: { id: string; coachName: string; email: string } | null;
}

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function toView(row: ViewRow, now: Date): ApiKeyView {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scope: parseApiKeyScope(row.scope),
    status: apiKeyStatus(row, now),
    createdAt: row.createdAt.toISOString(),
    expiresAt: iso(row.expiresAt),
    lastUsedAt: iso(row.lastUsedAt),
    lastUsedIp: row.lastUsedIp,
    revokedAt: iso(row.revokedAt),
    revokedById: row.revokedById,
    owner: row.user,
  };
}

export interface CreateApiKeyInput {
  /** Propriétaire : l'admin qui crée la clé. */
  readonly userId: string;
  readonly name: string;
  readonly scope: ApiKeyScope;
  /** `null` = sans expiration. */
  readonly expiresInDays: number | null;
}

/** Crée une clé et rend son secret — la SEULE fois où il existe en clair. */
export async function createApiKey(
  input: CreateApiKeyInput,
  now: Date = new Date(),
): Promise<{ key: ApiKeyView; secret: string }> {
  const generated = generateApiKey();
  const row: ViewRow = await prisma.apiKey.create({
    data: {
      name: input.name,
      keyPrefix: generated.keyPrefix,
      keyHash: generated.keyHash,
      scope: input.scope,
      userId: input.userId,
      expiresAt: computeApiKeyExpiry(now, input.expiresInDays),
    },
    select: VIEW_SELECT,
  });
  return { key: toView(row, now), secret: generated.secret };
}

/** Toutes les clés, plus récentes d'abord. */
export async function listApiKeys(now: Date = new Date()): Promise<ApiKeyView[]> {
  const rows: ViewRow[] = await prisma.apiKey.findMany({
    select: VIEW_SELECT,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows.map((row) => toView(row, now));
}

/**
 * Révoque une clé. Idempotent : une clé déjà révoquée garde sa date et son
 * auteur d'origine (`alreadyRevoked: true`).
 */
export async function revokeApiKey(
  input: { readonly id: string; readonly revokedById: string },
  now: Date = new Date(),
): Promise<{ key: ApiKeyView; alreadyRevoked: boolean }> {
  // Écriture CONDITIONNELLE : deux révocations simultanées n'écrasent pas
  // l'auteur de la première.
  const { count } = await prisma.apiKey.updateMany({
    where: { id: input.id, revokedAt: null },
    data: { revokedAt: now, revokedById: input.revokedById },
  });
  const row: ViewRow | null = await prisma.apiKey.findUnique({
    where: { id: input.id },
    select: VIEW_SELECT,
  });
  if (!row) throw new ApiKeyError("not_found", "Clé API introuvable");
  return { key: toView(row, now), alreadyRevoked: count === 0 };
}

/**
 * Authentifie un secret présenté par un client. Une seule requête (clé +
 * propriétaire) ; un secret mal formé est refusé sans toucher la base.
 * En cas de succès, le dernier usage est réécrit au plus une fois par
 * minute, HORS du chemin critique.
 */
export async function authenticateApiKey(
  secret: string,
  context: { readonly ip: string | null; readonly now?: Date },
): Promise<ApiKeyEvaluation> {
  const now = context.now ?? new Date();
  if (!isApiKeyFormat(secret)) return { ok: false, reason: "unknown" };

  const row: ApiKeyRow | null = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(secret) },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scope: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      user: {
        select: {
          id: true,
          role: true,
          roles: true,
          valid: true,
          deletedAt: true,
          bannedUntil: true,
        },
      },
    },
  });

  const evaluation = evaluateApiKey(row, now);
  if (!evaluation.ok) {
    if (row) {
      serverLog.warn(
        `[api-keys] clé ${row.keyPrefix} refusée : ${evaluation.reason}`,
      );
    }
    return evaluation;
  }

  if (row && shouldTouchLastUsed(row.lastUsedAt, now)) {
    void touchLastUsed(row.id, context.ip, now);
  }
  return evaluation;
}

async function touchLastUsed(
  id: string,
  ip: string | null,
  now: Date,
): Promise<void> {
  try {
    // Conditionnel : parmi des requêtes simultanées, une seule écrit.
    await prisma.apiKey.updateMany({
      where: {
        id,
        OR: [
          { lastUsedAt: null },
          { lastUsedAt: { lt: new Date(now.getTime() - API_KEY_LAST_USED_WINDOW_MS) } },
        ],
      },
      data: { lastUsedAt: now, lastUsedIp: ip ? ip.slice(0, 64) : null },
    });
  } catch (err) {
    serverLog.error("[api-keys] dernier usage non enregistré", err);
  }
}
