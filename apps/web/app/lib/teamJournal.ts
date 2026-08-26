/**
 * Client API de la recherche transversale du journal d'équipe
 * (`GET /admin/team-journal*`, admin-only).
 *
 * La construction de la query est isolée dans `buildJournalQuery` (pure) :
 * les trois endpoints — liste, agrégats, export — partagent exactement les
 * mêmes filtres, et c'est cette fonction qui garantit qu'on exporte bien ce
 * qu'on voit à l'écran.
 */

import { API_BASE } from "../auth-client";
import { apiRequest } from "./api-client";

export type AuditSortOrder =
  | "recent"
  | "oldest"
  | "treasury-impact"
  | "team-value-impact";

export interface JournalFilters {
  teamId?: string;
  teamSearch?: string;
  ownerId?: string;
  actorUserId?: string;
  action?: string;
  actionPrefix?: string;
  actorRole?: string;
  source?: string;
  entity?: string;
  entityId?: string;
  correlationId?: string;
  since?: string;
  until?: string;
  onlyEconomic?: boolean;
  onlyFailed?: boolean;
  onlyImpersonated?: boolean;
  /** Seuils saisis en **kpo** dans l'UI, convertis en po ici. */
  minTreasuryDeltaK?: number;
  minTeamValueDeltaK?: number;
  q?: string;
  deep?: boolean;
  limit?: number;
  offset?: number;
  order?: AuditSortOrder;
}

export interface JournalTeamContext {
  teamId: string;
  teamName: string | null;
  ownerId: string | null;
  ownerLabel: string | null;
  teamDeleted: boolean;
}

export interface JournalEvent {
  id: string;
  teamId: string;
  createdAt: string;
  correlationId: string;
  step: number;
  action: string;
  entity: string;
  entityId: string | null;
  actorUserId: string | null;
  actorRole: string;
  actorLabel: string | null;
  impersonatorId: string | null;
  source: string;
  route: string | null;
  ipAddress: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  before: unknown;
  after: unknown;
  details: unknown;
  treasury: number | null;
  teamValue: number | null;
  currentValue: number | null;
  treasuryDelta: number | null;
  teamValueDelta: number | null;
  note: string | null;
  summary: string;
  team: JournalTeamContext | null;
}

export interface JournalPage {
  total: number;
  limit: number;
  offset: number;
  entries: JournalEvent[];
}

export interface JournalBucket {
  key: string;
  count: number;
  treasuryDelta: number;
  teamValueDelta: number;
}

export interface JournalStats {
  totalEvents: number;
  netTreasuryDelta: number;
  netTeamValueDelta: number;
  byAction: JournalBucket[];
  byActorRole: JournalBucket[];
  byTeam: JournalBucket[];
}

export interface JournalFacet {
  value: string;
  count: number;
}

export interface JournalFacets {
  actions: JournalFacet[];
  actorRoles: JournalFacet[];
  sources: JournalFacet[];
}

/** Champs texte repris tels quels dans la query. */
const TEXT_KEYS = [
  "teamId",
  "teamSearch",
  "ownerId",
  "actorUserId",
  "action",
  "actionPrefix",
  "actorRole",
  "source",
  "entity",
  "entityId",
  "correlationId",
  "q",
] as const;

/** Cases à cocher : n'apparaissent dans la query que si elles sont vraies. */
const FLAG_KEYS = [
  "onlyEconomic",
  "onlyFailed",
  "onlyImpersonated",
  "deep",
] as const;

/**
 * Sérialise des filtres en query string. **Pure** — testée sans réseau.
 *
 * Deux règles qui évitent des faux résultats :
 *  - un filtre vide ou blanc est OMIS (envoyer `q=` ferait chercher la chaîne
 *    vide et le serveur devrait la neutraliser à son tour) ;
 *  - les seuils sont saisis en **kpo** côté UI (c'est l'unité dans laquelle
 *    un coach raisonne) mais l'API travaille en **po** : la conversion se
 *    fait ici, une seule fois.
 */
export function buildJournalQuery(filters: JournalFilters): string {
  const params = new URLSearchParams();

  for (const key of TEXT_KEYS) {
    const value = filters[key];
    if (typeof value === "string" && value.trim().length > 0) {
      params.set(key, value.trim());
    }
  }
  for (const key of FLAG_KEYS) {
    if (filters[key]) params.set(key, "1");
  }

  // Les bornes de date arrivent d'un <input type="date"> (« 2026-08-01 ») :
  // on étend la borne de fin à la fin de journée, sinon un filtre « jusqu'au
  // 1er août » exclurait tout ce qui s'est passé ce jour-là.
  if (filters.since) params.set("since", `${filters.since}T00:00:00.000Z`);
  if (filters.until) params.set("until", `${filters.until}T23:59:59.999Z`);

  if (filters.minTreasuryDeltaK && filters.minTreasuryDeltaK > 0) {
    params.set("minAbsTreasuryDelta", String(filters.minTreasuryDeltaK * 1000));
  }
  if (filters.minTeamValueDeltaK && filters.minTeamValueDeltaK > 0) {
    params.set("minAbsTeamValueDelta", String(filters.minTeamValueDeltaK * 1000));
  }

  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  if (filters.order && filters.order !== "recent") {
    params.set("order", filters.order);
  }

  return params.toString();
}

function withQuery(path: string, filters: JournalFilters): string {
  const qs = buildJournalQuery(filters);
  return qs ? `${path}?${qs}` : path;
}

export async function fetchTeamJournal(
  filters: JournalFilters,
): Promise<JournalPage> {
  return apiRequest<JournalPage>(withQuery("/admin/team-journal", filters));
}

export async function fetchTeamJournalStats(
  filters: JournalFilters,
): Promise<JournalStats> {
  return apiRequest<JournalStats>(
    withQuery("/admin/team-journal/stats", { ...filters, limit: undefined }),
  );
}

export async function fetchTeamJournalFacets(): Promise<JournalFacets> {
  return apiRequest<JournalFacets>("/admin/team-journal/facets");
}

/**
 * Télécharge l'export dans le format demandé.
 *
 * Passe par `fetch` + Blob plutôt que par un `<a href>` : l'endpoint exige un
 * `Authorization: Bearer`, qu'une navigation classique n'enverrait pas.
 */
export async function downloadTeamJournalExport(
  filters: JournalFilters,
  format: "csv" | "ndjson",
): Promise<{ filename: string; returned: number; total: number }> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  // `limit` omis => le serveur applique son plafond d'export ; `offset` à 0
  // car un export part toujours du début du périmètre filtré, pas de la page
  // affichée à l'écran.
  const params = new URLSearchParams(
    buildJournalQuery({ ...filters, offset: 0, limit: undefined }),
  );
  params.set("format", format);
  const res = await fetch(
    `${API_BASE}/admin/team-journal/export?${params.toString()}`,
    { headers: { Authorization: token ? `Bearer ${token}` : "" } },
  );
  if (!res.ok) {
    throw new Error(`Export impossible (HTTP ${res.status})`);
  }

  const filename =
    parseFilename(res.headers.get("content-disposition")) ??
    `journal-equipes.${format}`;
  const total = Number(res.headers.get("x-total-count") ?? "0");
  const returned = Number(res.headers.get("x-returned-count") ?? "0");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { filename, returned, total };
}

/** Extrait le nom de fichier d'un en-tête `Content-Disposition`. */
export function parseFilename(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match ? match[1] : null;
}
