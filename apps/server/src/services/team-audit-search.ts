/**
 * Journal d'équipe — recherche TRANSVERSALE (admin).
 *
 * `team-audit-read.ts` sert la frise d'UNE équipe. Ici on cherche à travers
 * TOUTES les équipes : « montre-moi tous les mouvements de trésorerie de plus
 * de 100k po du mois dernier », « qu'a fait ce commissaire ? », « quelles
 * opérations ont échoué ? ». C'est l'outil d'enquête quand on ne sait pas
 * encore quelle équipe est en cause.
 *
 * Trois sorties, mêmes filtres :
 *  - `searchTeamAuditEvents` : page enrichie (nom d'équipe + coach) pour l'UI ;
 *  - `summarizeAuditActivity` : agrégats (par action, par rôle, top équipes)
 *    pour repérer une anomalie sans lire ligne à ligne ;
 *  - `toNdjson` / `toCsv` : export machine, pour analyse hors application.
 *
 * ## Deux pièges de portabilité traités ici
 *
 * 1. `mode: "insensitive"` n'existe QUE sur Postgres — sur le miroir sqlite
 *    des tests, le passer fait échouer la requête. Le mode est donc injecté
 *    (`caseInsensitive`) plutôt que déduit, pour que le builder reste pur et
 *    testable dans les deux configurations.
 * 2. Les colonnes `details` / `changes` sont `Json` en Postgres et `String`
 *    en sqlite. Comme `recordTeamAudit` y écrit toujours une CHAÎNE JSON
 *    (cf. `serialize`), la recherche plein texte dedans se fait avec
 *    `string_contains` côté PG et `contains` côté sqlite : même intention,
 *    deux opérateurs. D'où `jsonContains` injecté lui aussi.
 */

import {
  toAuditEventView,
  type TeamAuditEventRow,
  type TeamAuditEventView,
} from "./team-audit-read";

export const DEFAULT_SEARCH_PAGE_SIZE = 50;
export const MAX_SEARCH_PAGE_SIZE = 500;
/** Plafond d'un export : au-delà, il faut paginer ou resserrer les filtres. */
export const MAX_EXPORT_ROWS = 10_000;
/**
 * Nombre d'équipes retenues par une recherche sur le NOM d'équipe. Au-delà,
 * le filtre est trop large pour être utile et un `IN` géant coûte cher.
 */
export const MAX_TEAM_NAME_MATCHES = 500;

export type AuditSortOrder =
  | "recent"
  | "oldest"
  | "treasury-impact"
  | "team-value-impact";

export interface TeamAuditSearchFilters {
  /** Équipe précise (prioritaire sur `teamSearch`). */
  readonly teamId?: string | null;
  /** Recherche sur le NOM d'équipe (résolue en liste d'ids en amont). */
  readonly teamSearch?: string | null;
  /** Toutes les équipes de ce coach. */
  readonly ownerId?: string | null;
  readonly actorUserId?: string | null;
  /** Slug d'action exact ("team.purchase.player"). */
  readonly action?: string | null;
  /** Préfixe de slug ("team.purchase"). */
  readonly actionPrefix?: string | null;
  readonly actorRole?: string | null;
  readonly source?: string | null;
  readonly entity?: string | null;
  readonly entityId?: string | null;
  /** Toutes les étapes d'une opération donnée. */
  readonly correlationId?: string | null;
  readonly since?: Date | null;
  readonly until?: Date | null;
  /** Ne garder que les étapes qui ont bougé la trésorerie ou la VE. */
  readonly onlyEconomic?: boolean;
  /** Ne garder que les étapes en échec (`<action>.failed`). */
  readonly onlyFailed?: boolean;
  /** Ne garder que les mutations faites en impersonation admin. */
  readonly onlyImpersonated?: boolean;
  /** Seuil (po, valeur absolue) de variation de trésorerie. */
  readonly minAbsTreasuryDelta?: number | null;
  /** Seuil (po, valeur absolue) de variation de VE. */
  readonly minAbsTeamValueDelta?: number | null;
  /** Texte libre sur les colonnes scalaires (action, auteur, note, route). */
  readonly q?: string | null;
  /** Étendre `q` aux charges utiles `details` / `changes`. */
  readonly deep?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly order?: AuditSortOrder;
}

/** Capacités du provider, injectées pour garder le builder pur. */
export interface ProviderCapabilities {
  /** Postgres accepte `mode: "insensitive"` ; sqlite non. */
  readonly caseInsensitive: boolean;
  /**
   * Opérateur de recherche dans une colonne JSON : `string_contains` sur
   * Postgres (colonne `Json` portant une chaîne), `contains` sur sqlite
   * (colonne `String`).
   */
  readonly jsonContains: "string_contains" | "contains";
}

/** Capacités déduites de l'environnement (le miroir sqlite est le cas test). */
export function detectProviderCapabilities(): ProviderCapabilities {
  const isPostgres = process.env.TEST_SQLITE !== "1";
  return {
    caseInsensitive: isPostgres,
    jsonContains: isPostgres ? "string_contains" : "contains",
  };
}

/** Colonnes scalaires balayées par la recherche plein texte. */
const TEXT_SEARCH_FIELDS = [
  "action",
  "actorLabel",
  "note",
  "route",
  "entityId",
  "correlationId",
] as const;

/**
 * Construit le `where` Prisma d'une recherche transversale. **Pur** : aucune
 * I/O, ce qui permet de vérifier la forme exacte de la requête (y compris les
 * branches par provider) sans base.
 *
 * `teamIds` est fourni par l'appelant quand `teamSearch` ou `ownerId` a dû
 * être résolu en amont — le journal n'a délibérément pas de relation Prisma
 * vers `Team` (il doit survivre à la suppression de l'équipe), donc aucun
 * filtre imbriqué n'est possible.
 */
export function buildAdminAuditWhere(
  filters: TeamAuditSearchFilters,
  caps: ProviderCapabilities,
  teamIds?: readonly string[] | null,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const and: Array<Record<string, unknown>> = [];

  if (filters.teamId) where.teamId = filters.teamId;
  else if (teamIds) where.teamId = { in: [...teamIds] };

  if (filters.actorUserId) where.actorUserId = filters.actorUserId;
  if (filters.actorRole) where.actorRole = filters.actorRole;
  if (filters.source) where.source = filters.source;
  if (filters.entity) where.entity = filters.entity;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.correlationId) where.correlationId = filters.correlationId;

  // `action` exact prime sur le préfixe : demander les deux serait ambigu.
  if (filters.action) where.action = filters.action;
  else if (filters.actionPrefix) {
    where.action = { startsWith: filters.actionPrefix };
  }

  if (filters.since || filters.until) {
    where.createdAt = {
      ...(filters.since ? { gte: filters.since } : {}),
      ...(filters.until ? { lte: filters.until } : {}),
    };
  }

  // Une étape en échec est suffixée `.failed` — pas de colonne dédiée, pour
  // ne pas dupliquer une information déjà portée par le slug.
  if (filters.onlyFailed) {
    and.push({ action: { endsWith: ".failed" } });
  }

  if (filters.onlyImpersonated) {
    and.push({ impersonatorId: { not: null } });
  }

  if (filters.onlyEconomic) {
    and.push({
      OR: [{ treasuryDelta: { not: 0 } }, { teamValueDelta: { not: 0 } }],
    });
  }

  // Seuils en valeur absolue : un débit de 200k est aussi suspect qu'un
  // crédit de 200k, donc on teste les deux sens plutôt qu'un signe.
  if (filters.minAbsTreasuryDelta && filters.minAbsTreasuryDelta > 0) {
    and.push({
      OR: [
        { treasuryDelta: { gte: filters.minAbsTreasuryDelta } },
        { treasuryDelta: { lte: -filters.minAbsTreasuryDelta } },
      ],
    });
  }
  if (filters.minAbsTeamValueDelta && filters.minAbsTeamValueDelta > 0) {
    and.push({
      OR: [
        { teamValueDelta: { gte: filters.minAbsTeamValueDelta } },
        { teamValueDelta: { lte: -filters.minAbsTeamValueDelta } },
      ],
    });
  }

  const q = filters.q?.trim();
  if (q) {
    const mode = caps.caseInsensitive ? { mode: "insensitive" as const } : {};
    const clauses: Array<Record<string, unknown>> = TEXT_SEARCH_FIELDS.map(
      (field) => ({ [field]: { contains: q, ...mode } }),
    );
    if (filters.deep) {
      // Les colonnes JSON portent une CHAÎNE sérialisée : `string_contains`
      // (PG) / `contains` (sqlite) y cherchent une sous-chaîne brute. Pas de
      // `mode` : l'opérateur JSON de Prisma ne l'accepte pas.
      clauses.push({ details: { [caps.jsonContains]: q } });
      clauses.push({ changes: { [caps.jsonContains]: q } });
    }
    and.push({ OR: clauses });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/** Traduit l'ordre demandé en `orderBy` Prisma. */
export function buildAdminAuditOrderBy(
  order: AuditSortOrder = "recent",
): Array<Record<string, unknown>> {
  switch (order) {
    case "oldest":
      return [{ createdAt: "asc" }, { step: "asc" }];
    // Tri par impact : les plus gros mouvements d'abord, pour faire remonter
    // un saut aberrant sans le chercher à la main.
    case "treasury-impact":
      return [{ treasuryDelta: "desc" }, { createdAt: "desc" }];
    case "team-value-impact":
      return [{ teamValueDelta: "desc" }, { createdAt: "desc" }];
    case "recent":
    default:
      return [{ createdAt: "desc" }, { step: "desc" }];
  }
}

/** Contexte d'équipe joint après coup (pas de relation Prisma sur le journal). */
export interface AuditTeamContext {
  readonly teamId: string;
  readonly teamName: string | null;
  readonly ownerId: string | null;
  readonly ownerLabel: string | null;
  /** L'équipe a été supprimée (soft delete) depuis l'écriture de l'étape. */
  readonly teamDeleted: boolean;
}

export interface AdminAuditEventView extends TeamAuditEventView {
  readonly team: AuditTeamContext | null;
}

interface SearchPrismaLike {
  teamAuditEvent: {
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<TeamAuditEventRow[]>;
    groupBy: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  };
  team: {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  };
}

/**
 * Résout les filtres qui portent sur l'ÉQUIPE (nom, propriétaire) en liste
 * d'ids. Rend `null` quand aucun de ces filtres n'est demandé (pas de
 * restriction), et une liste vide quand ils ne matchent rien (résultat vide,
 * à distinguer du cas précédent).
 */
export async function resolveTeamIdFilter(
  db: SearchPrismaLike,
  filters: TeamAuditSearchFilters,
  caps: ProviderCapabilities,
): Promise<readonly string[] | null> {
  const teamSearch = filters.teamSearch?.trim();
  if (!teamSearch && !filters.ownerId) return null;

  const mode = caps.caseInsensitive ? { mode: "insensitive" as const } : {};
  const rows = await db.team.findMany({
    where: {
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(teamSearch ? { name: { contains: teamSearch, ...mode } } : {}),
    },
    select: { id: true },
    take: MAX_TEAM_NAME_MATCHES,
  });
  return rows.map((r) => String(r.id));
}

/**
 * Joint le contexte d'équipe à une page d'étapes, en UN aller-retour pour
 * toute la page (jamais un par ligne — cf. la règle groupBy/batch du repo).
 */
export async function attachTeamContext(
  db: SearchPrismaLike,
  entries: readonly TeamAuditEventView[],
): Promise<AdminAuditEventView[]> {
  const ids = [...new Set(entries.map((e) => e.teamId))];
  if (ids.length === 0) return [];

  const rows = await db.team.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      ownerId: true,
      deletedAt: true,
      owner: { select: { coachName: true, email: true } },
    },
  });

  const byId = new Map<string, AuditTeamContext>();
  for (const row of rows) {
    const owner = row.owner as
      | { coachName?: string | null; email?: string | null }
      | null
      | undefined;
    byId.set(String(row.id), {
      teamId: String(row.id),
      teamName: row.name == null ? null : String(row.name),
      ownerId: row.ownerId == null ? null : String(row.ownerId),
      ownerLabel: owner?.coachName || owner?.email || null,
      teamDeleted: row.deletedAt != null,
    });
  }

  // Une équipe purgée n'a plus de ligne : le journal lui survit (aucune FK),
  // et on le sert avec un contexte `null` plutôt que de masquer l'étape.
  return entries.map((entry) => ({
    ...entry,
    team: byId.get(entry.teamId) ?? null,
  }));
}

export interface AdminAuditPage {
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly entries: readonly AdminAuditEventView[];
}

/** Recherche transversale paginée, enrichie du contexte d'équipe. */
export async function searchTeamAuditEvents(
  db: SearchPrismaLike,
  filters: TeamAuditSearchFilters,
  caps: ProviderCapabilities = detectProviderCapabilities(),
): Promise<AdminAuditPage> {
  const limit = Math.min(
    MAX_SEARCH_PAGE_SIZE,
    Math.max(1, filters.limit ?? DEFAULT_SEARCH_PAGE_SIZE),
  );
  const offset = Math.max(0, filters.offset ?? 0);

  const teamIds = await resolveTeamIdFilter(db, filters, caps);
  if (teamIds !== null && teamIds.length === 0) {
    return { total: 0, limit, offset, entries: [] };
  }

  const where = buildAdminAuditWhere(filters, caps, teamIds);
  const [total, rows] = await Promise.all([
    db.teamAuditEvent.count({ where }),
    db.teamAuditEvent.findMany({
      where,
      orderBy: buildAdminAuditOrderBy(filters.order),
      skip: offset,
      take: limit,
    }),
  ]);

  const entries = await attachTeamContext(db, rows.map(toAuditEventView));
  return { total, limit, offset, entries };
}

export interface AuditActivityBucket {
  readonly key: string;
  readonly count: number;
  readonly treasuryDelta: number;
  readonly teamValueDelta: number;
}

export interface AuditActivitySummary {
  readonly totalEvents: number;
  /** Somme algébrique des variations sur le périmètre filtré. */
  readonly netTreasuryDelta: number;
  readonly netTeamValueDelta: number;
  readonly byAction: readonly AuditActivityBucket[];
  readonly byActorRole: readonly AuditActivityBucket[];
  readonly byTeam: readonly AuditActivityBucket[];
}

function readBucket(
  row: Record<string, unknown>,
  keyField: string,
): AuditActivityBucket {
  const sums = (row._sum ?? {}) as Record<string, number | null>;
  const counts = (row._count ?? {}) as Record<string, number> | number;
  return {
    key: String(row[keyField] ?? "—"),
    count: typeof counts === "number" ? counts : Number(counts._all ?? 0),
    treasuryDelta: sums.treasuryDelta ?? 0,
    teamValueDelta: sums.teamValueDelta ?? 0,
  };
}

/** Tri décroissant par volume, puis par impact absolu sur la trésorerie. */
function rankBuckets(
  buckets: AuditActivityBucket[],
  limit: number,
): AuditActivityBucket[] {
  return [...buckets]
    .sort(
      (a, b) =>
        b.count - a.count ||
        Math.abs(b.treasuryDelta) - Math.abs(a.treasuryDelta),
    )
    .slice(0, limit);
}

/**
 * Agrégats sur le périmètre filtré : c'est ce qui permet de voir « il y a eu
 * 42 crédits de mécène ce mois-ci » sans dérouler 42 pages.
 */
export async function summarizeAuditActivity(
  db: SearchPrismaLike,
  filters: TeamAuditSearchFilters,
  caps: ProviderCapabilities = detectProviderCapabilities(),
  topN = 15,
): Promise<AuditActivitySummary> {
  const teamIds = await resolveTeamIdFilter(db, filters, caps);
  if (teamIds !== null && teamIds.length === 0) {
    return {
      totalEvents: 0,
      netTreasuryDelta: 0,
      netTeamValueDelta: 0,
      byAction: [],
      byActorRole: [],
      byTeam: [],
    };
  }

  const where = buildAdminAuditWhere(filters, caps, teamIds);
  const aggregate = {
    _count: { _all: true },
    _sum: { treasuryDelta: true, teamValueDelta: true },
  };

  const [byAction, byActorRole, byTeam] = await Promise.all([
    db.teamAuditEvent.groupBy({ by: ["action"], where, ...aggregate }),
    db.teamAuditEvent.groupBy({ by: ["actorRole"], where, ...aggregate }),
    db.teamAuditEvent.groupBy({ by: ["teamId"], where, ...aggregate }),
  ]);

  const actionBuckets = byAction.map((r) => readBucket(r, "action"));
  return {
    totalEvents: actionBuckets.reduce((sum, b) => sum + b.count, 0),
    netTreasuryDelta: actionBuckets.reduce((s, b) => s + b.treasuryDelta, 0),
    netTeamValueDelta: actionBuckets.reduce((s, b) => s + b.teamValueDelta, 0),
    byAction: rankBuckets(actionBuckets, topN),
    byActorRole: rankBuckets(
      byActorRole.map((r) => readBucket(r, "actorRole")),
      topN,
    ),
    byTeam: rankBuckets(byTeam.map((r) => readBucket(r, "teamId")), topN),
  };
}

// ============================================================================
// EXPORT MACHINE — NDJSON et CSV
// ============================================================================

/**
 * Une ligne par étape, JSON complet (snapshots et charges utiles inclus).
 * Format de choix pour rejouer l'analyse ailleurs : chaque ligne se parse
 * indépendamment, un fichier de 10 000 lignes se lit en streaming.
 */
export function toNdjson(entries: readonly AdminAuditEventView[]): string {
  return entries.map((e) => JSON.stringify(e)).join("\n");
}

/** Colonnes de l'export CSV, dans l'ordre. */
export const CSV_COLUMNS = [
  "createdAt",
  "correlationId",
  "step",
  "teamId",
  "teamName",
  "ownerLabel",
  "action",
  "entity",
  "entityId",
  "actorUserId",
  "actorRole",
  "actorLabel",
  "impersonatorId",
  "source",
  "route",
  "treasury",
  "treasuryDelta",
  "teamValue",
  "teamValueDelta",
  "currentValue",
  "note",
  "summary",
  "changes",
  "details",
] as const;

/**
 * Échappement CSV (RFC 4180) : guillemets doublés, champ cité dès qu'il
 * contient un séparateur, un guillemet ou un saut de ligne.
 *
 * Le préfixe anti-injection sur `=`/`+`/`-`/`@` n'est PAS cosmétique : un
 * `actorLabel` ou une `note` viennent d'une saisie utilisateur, et un tableur
 * qui ouvre le fichier exécuterait la formule. Il ne s'applique qu'aux
 * CHAÎNES — cf. le commentaire sur les nombres ci-dessous.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";

  // Les nombres et booléens sortent tels quels : leur appliquer la garde
  // anti-formule préfixerait tout delta NÉGATIF d'une apostrophe, et le
  // tableur importerait la colonne en texte — l'export ne serait plus
  // calculable, ce qui est précisément sa raison d'être.
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  let text = typeof value === "string" ? value : JSON.stringify(value);
  // Garde anti-injection sur les seules CHAÎNES : un `actorLabel` ou une
  // `note` viennent d'une saisie utilisateur, et un tableur qui ouvre le
  // fichier exécuterait la formule.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/["\n\r,;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvValue(entry: AdminAuditEventView, column: string): unknown {
  switch (column) {
    case "teamName":
      return entry.team?.teamName ?? null;
    case "ownerLabel":
      return entry.team?.ownerLabel ?? null;
    case "changes":
      return entry.changes ? JSON.stringify(entry.changes) : null;
    case "details":
      return entry.details ? JSON.stringify(entry.details) : null;
    default:
      return (entry as unknown as Record<string, unknown>)[column] ?? null;
  }
}

/**
 * Export tableur. Les montants restent en **po bruts** (pas de division par
 * 1000) : un export sert à calculer, pas à lire — l'arrondi d'affichage n'a
 * rien à y faire.
 */
export function toCsv(entries: readonly AdminAuditEventView[]): string {
  const header = CSV_COLUMNS.join(",");
  const lines = entries.map((entry) =>
    CSV_COLUMNS.map((column) => escapeCsvField(csvValue(entry, column))).join(
      ",",
    ),
  );
  return [header, ...lines].join("\n");
}
