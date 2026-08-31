/**
 * Journal d'équipe — lecture.
 *
 * Sépare la relecture (parsing tolérant + pagination + libellés) de
 * l'écriture (`services/team-audit.ts`), pour que l'UI et l'admin
 * partagent exactement la même vue.
 *
 * Piège de stockage traité ici : les colonnes `changes` / `before` /
 * `after` / `details` sont `Json?` en Postgres et `String?` dans le miroir
 * sqlite des tests. `parseJsonColumn` accepte les deux formes (cf. pattern
 * « parser tolérant PG + sqlite » du CLAUDE.md).
 */

import type { TeamStateDiff, TeamStateSnapshot } from "./team-audit";

/** Parse une colonne JSON tolérante PG (objet natif) / sqlite (chaîne). */
export function parseJsonColumn<T = unknown>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    if (raw.length === 0) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as T;
  return null;
}

export interface TeamAuditEventView {
  readonly id: string;
  readonly teamId: string;
  readonly createdAt: string;
  readonly correlationId: string;
  readonly step: number;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string | null;
  readonly actorUserId: string | null;
  readonly actorRole: string;
  readonly actorLabel: string | null;
  readonly impersonatorId: string | null;
  readonly source: string;
  readonly route: string | null;
  readonly ipAddress: string | null;
  readonly changes: TeamStateDiff | null;
  readonly before: TeamStateSnapshot | null;
  readonly after: TeamStateSnapshot | null;
  readonly details: unknown;
  readonly treasury: number | null;
  readonly teamValue: number | null;
  readonly currentValue: number | null;
  readonly treasuryDelta: number | null;
  readonly teamValueDelta: number | null;
  readonly note: string | null;
  /** Résumé français prêt à afficher (dérivé, non stocké). */
  readonly summary: string;
}

/**
 * Libellés des actions connues. Une action inconnue retombe sur son slug :
 * le journal reste lisible même quand un nouveau flux n'a pas encore son
 * libellé.
 */
const ACTION_LABELS: Readonly<Record<string, string>> = {
  "team.create": "Création de l'équipe",
  "team.create.from-roster": "Création de l'équipe depuis un roster",
  "team.delete": "Suppression de l'équipe",
  "team.update": "Modification de l'équipe",
  "team.rename": "Renommage de l'équipe",
  "team.description.update": "Description de l'équipe",
  "team.info.update": "Modification des informations d'équipe",
  "team.roster.save": "Sauvegarde du roster",
  "team.values.recompute": "Recalcul de la VE / VEA",
  "team.treasury.credit-initial": "Crédit du reliquat de budget initial",
  "team.treasury.sync-draft":
    "Trésorerie resynchronisée sur le budget de construction (brouillon)",
  "team.treasury.match": "Trésorerie après match",
  "team.purchase.player": "Achat d'un joueur",
  "team.purchase.reroll": "Achat d'une relance",
  "team.purchase.cheerleader": "Recrutement d'une pom-pom girl",
  "team.purchase.assistant": "Recrutement d'un assistant",
  "team.purchase.apothecary": "Recrutement d'un apothicaire",
  "team.purchase.dedicated_fan": "Achat d'un fan dévoué",
  "team.player.add": "Ajout d'un joueur",
  "team.player.delete": "Suppression d'un joueur",
  "team.player.skills.update": "Modification des compétences d'un joueur",
  "team.player.identity.update": "Modification de l'identité d'un joueur",
  "team.player.advancement.add": "Amélioration d'un joueur",
  "team.player.advancement.remove": "Annulation d'une amélioration",
  "team.player.status.apply": "Mise hors roster d'un joueur (mort / licenciement)",
  "team.player.status.revert": "Réintégration d'un joueur",
  "team.star-player.hire": "Engagement d'un Star Player",
  "team.star-player.release": "Renvoi d'un Star Player",
  "team.psp-pool.update": "Modification du pool de PSP de construction",
  "team.captain.designate": "Désignation du capitaine",
  "team.share.update": "Partage public de l'équipe",
  "team.logo.update": "Logo d'équipe",
  "league.postmatch.economy": "Économie d'après-match (ligue)",
  "league.postmatch.edit": "Correction d'un résultat de ligue",
  "league.postmatch.purchases": "Achats d'après-match (ligue)",
  "league.patron.bonus": "Bonus de mécène",
  "commissioner.team.edit": "Édition de l'équipe par le commissaire",
  "commissioner.team.settings": "Réglages d'équipe par le commissaire",
  "commissioner.team.player.remove": "Retrait d'un joueur par le commissaire",
};

const ROLE_LABELS: Readonly<Record<string, string>> = {
  owner: "coach",
  admin: "admin",
  commissioner: "commissaire",
  system: "système",
  anonymous: "inconnu",
};

/** Formate un montant en or « 1 250 000 po » -> « 1 250k po ». */
function formatGold(amount: number): string {
  const sign = amount < 0 ? "-" : "+";
  const abs = Math.abs(amount);
  return `${sign}${Math.round(abs / 1000).toLocaleString("fr-FR")}k po`;
}

/**
 * Résumé d'une ligne de journal, en une phrase. Pur : c'est la fonction
 * testée, l'UI ne recompose rien.
 */
export function summarizeAuditEvent(event: {
  action: string;
  actorRole: string;
  actorLabel: string | null;
  treasuryDelta: number | null;
  teamValueDelta: number | null;
  treasury: number | null;
  teamValue: number | null;
}): string {
  const base = ACTION_LABELS[event.action] ?? event.action;
  const failed = event.action.endsWith(".failed");
  const label =
    event.actorLabel ?? ROLE_LABELS[event.actorRole] ?? event.actorRole;
  const parts: string[] = [
    failed ? `${ACTION_LABELS[event.action.slice(0, -7)] ?? base} (échec)` : base,
  ];
  parts.push(`par ${label}`);
  const deltas: string[] = [];
  if (event.treasuryDelta) {
    deltas.push(
      `trésorerie ${formatGold(event.treasuryDelta)} → ${Math.round((event.treasury ?? 0) / 1000).toLocaleString("fr-FR")}k`,
    );
  }
  if (event.teamValueDelta) {
    deltas.push(
      `VE ${formatGold(event.teamValueDelta)} → ${Math.round((event.teamValue ?? 0) / 1000).toLocaleString("fr-FR")}k`,
    );
  }
  if (deltas.length > 0) parts.push(`(${deltas.join(", ")})`);
  return parts.join(" ");
}

/** Ligne brute telle que remontée par Prisma. */
export interface TeamAuditEventRow {
  id: string;
  teamId: string;
  createdAt: Date | string;
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
  changes: unknown;
  before: unknown;
  after: unknown;
  details: unknown;
  treasury: number | null;
  teamValue: number | null;
  currentValue: number | null;
  treasuryDelta: number | null;
  teamValueDelta: number | null;
  note: string | null;
}

/** Projette une ligne brute en vue API (JSON parsé + résumé). */
export function toAuditEventView(row: TeamAuditEventRow): TeamAuditEventView {
  return {
    id: row.id,
    teamId: row.teamId,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    correlationId: row.correlationId,
    step: row.step,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    actorLabel: row.actorLabel,
    impersonatorId: row.impersonatorId,
    source: row.source,
    route: row.route,
    ipAddress: row.ipAddress,
    changes: parseJsonColumn<TeamStateDiff>(row.changes),
    before: parseJsonColumn<TeamStateSnapshot>(row.before),
    after: parseJsonColumn<TeamStateSnapshot>(row.after),
    details: parseJsonColumn(row.details),
    treasury: row.treasury,
    teamValue: row.teamValue,
    currentValue: row.currentValue,
    treasuryDelta: row.treasuryDelta,
    teamValueDelta: row.teamValueDelta,
    note: row.note,
    summary: summarizeAuditEvent(row),
  };
}

export interface ListTeamAuditInput {
  readonly teamId: string;
  readonly limit?: number;
  readonly offset?: number;
  /** Filtre par préfixe d'action ("team.purchase"). */
  readonly actionPrefix?: string | null;
  readonly actorUserId?: string | null;
  /** Ne garder que les étapes qui ont bougé la trésorerie ou la VE. */
  readonly onlyEconomic?: boolean;
  readonly since?: Date | null;
  readonly until?: Date | null;
}

export const DEFAULT_AUDIT_PAGE_SIZE = 50;
export const MAX_AUDIT_PAGE_SIZE = 200;

/**
 * Construit le `where` Prisma d'une requête de journal. Extrait pour être
 * testé sans base (même posture que `parseAuditLogQuery` côté admin).
 */
export function buildTeamAuditWhere(
  input: ListTeamAuditInput,
): Record<string, unknown> {
  const where: Record<string, unknown> = { teamId: input.teamId };
  if (input.actionPrefix) where.action = { startsWith: input.actionPrefix };
  if (input.actorUserId) where.actorUserId = input.actorUserId;
  if (input.since || input.until) {
    where.createdAt = {
      ...(input.since ? { gte: input.since } : {}),
      ...(input.until ? { lte: input.until } : {}),
    };
  }
  if (input.onlyEconomic) {
    where.OR = [
      { treasuryDelta: { not: 0 } },
      { teamValueDelta: { not: 0 } },
    ];
  }
  return where;
}

export interface TeamAuditPage {
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly entries: readonly TeamAuditEventView[];
}

interface AuditReadPrismaLike {
  teamAuditEvent: {
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<TeamAuditEventRow[]>;
  };
}

/** Page de journal d'une équipe, la plus récente d'abord. */
export async function listTeamAuditEvents(
  db: AuditReadPrismaLike,
  input: ListTeamAuditInput,
): Promise<TeamAuditPage> {
  const limit = Math.min(
    MAX_AUDIT_PAGE_SIZE,
    Math.max(1, input.limit ?? DEFAULT_AUDIT_PAGE_SIZE),
  );
  const offset = Math.max(0, input.offset ?? 0);
  const where = buildTeamAuditWhere(input);
  const [total, rows] = await Promise.all([
    db.teamAuditEvent.count({ where }),
    db.teamAuditEvent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { step: "desc" }],
      skip: offset,
      take: limit,
    }),
  ]);
  return { total, limit, offset, entries: rows.map(toAuditEventView) };
}
