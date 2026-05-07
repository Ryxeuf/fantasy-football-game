/**
 * S27.6.3 — API client pour la lecture du journal d'audit admin.
 *
 * Le serveur expose `GET /admin/audit-log` (admin-only) qui retourne
 * les entrees `AuditLog` paginated + filtrables (userId, action,
 * entity). Voir `apps/server/src/routes/admin.ts` (`parseAuditLogQuery`
 * + handler).
 */
import { apiRequest } from "./api-client";

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entity?: string;
}

export async function fetchAuditLog(
  query: AuditLogQuery = {},
): Promise<AuditLogPage> {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.userId) params.set("userId", query.userId);
  if (query.action) params.set("action", query.action);
  if (query.entity) params.set("entity", query.entity);
  const qs = params.toString();
  const path = qs ? `/admin/audit-log?${qs}` : "/admin/audit-log";
  return apiRequest<AuditLogPage>(path);
}
