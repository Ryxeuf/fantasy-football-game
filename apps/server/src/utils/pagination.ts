/**
 * Helper de pagination pour les routes Express qui interrogent Prisma
 * (tâche O.7 — Sprint 22+).
 *
 * Parse `limit`, `offset` et `page` depuis `req.query` et renvoie
 * `{ limit, offset, page }` prêts à être passés à `findMany({ take, skip })`.
 *
 * Règles :
 *   - `limit` est borné entre 1 et `maxLimit` (défaut 100), défaut 50.
 *   - `offset` ≥ 0, défaut 0. Prioritaire sur `page` si les deux sont fournis.
 *   - `page` ≥ 1, converti en `offset = (page - 1) * limit`.
 *   - Toute valeur invalide retombe sur le défaut (parse-friendly).
 */

const DEFAULT_LIMIT = 50;
const DEFAULT_MAX_LIMIT = 100;

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

export interface PaginationParams {
  limit: number;
  offset: number;
  page: number;
}

function parsePositiveInt(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseNonNegativeInt(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Parse les paramètres de pagination depuis une query Express.
 *
 * @param query  `req.query` (record de strings, possiblement undefined)
 * @param opts   `defaultLimit` (def. 50) et `maxLimit` (def. 100)
 */
export function parsePagination(
  query: Record<string, unknown>,
  opts: PaginationOptions = {},
): PaginationParams {
  const defaultLimit = opts.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = opts.maxLimit ?? DEFAULT_MAX_LIMIT;

  const rawLimit = parsePositiveInt(query.limit);
  const limit = rawLimit === null ? defaultLimit : Math.min(rawLimit, maxLimit);

  const rawOffset = parseNonNegativeInt(query.offset);
  if (rawOffset !== null) {
    const offset = rawOffset;
    const page = Math.max(1, Math.floor(offset / limit) + 1);
    return { limit, offset, page };
  }

  const rawPage = parsePositiveInt(query.page);
  const page = rawPage ?? 1;
  const offset = (page - 1) * limit;
  return { limit, offset, page };
}

/**
 * Construit une `ApiMeta` (total + page + limit) à partir d'un total
 * connu et des paramètres de pagination.
 */
export function buildApiMeta({
  total,
  limit,
  offset,
}: {
  total: number;
  limit: number;
  offset: number;
}): { total: number; limit: number; page: number } {
  const page = Math.max(1, Math.floor(Math.max(0, offset) / Math.max(1, limit)) + 1);
  return { total, limit, page };
}
