/**
 * Journal d'équipe — écriture.
 *
 * Objectif : pour CHAQUE mutation qui touche une équipe (création, roster,
 * staff, achats, trésorerie, VE/VEA, blessures, licenciements, économie
 * d'après-match), une ligne `TeamAuditEvent` qui répond à trois questions :
 *
 *   1. **Qui** — `actorUserId` + `actorRole` + `actorLabel` figé, plus
 *      l'admin à l'origine en cas d'impersonation.
 *   2. **Quoi** — `action` (slug métier), `details` (charge utile) et
 *      `changes` (diff champ par champ de l'état d'équipe).
 *   3. **Quel résultat** — `after`, le snapshot de l'équipe APRÈS l'étape,
 *      et ses colonnes dénormalisées `treasury` / `teamValue` /
 *      `currentValue` (+ les deltas).
 *
 * Les étapes d'une même opération sont corrélées par `correlationId`
 * (= requestId HTTP) et ordonnées par `step`, si bien qu'un achat de
 * joueur produit la séquence lisible :
 *
 *   step 1  team.purchase.player      trésorerie 400k -> 320k
 *   step 2  team.values.recompute     VE 1 000k -> 1 080k
 *
 * ## Règles d'usage
 *
 * - Le journal est **append-only** : jamais d'UPDATE ni de DELETE.
 * - L'écriture du journal ne doit JAMAIS faire échouer la mutation métier
 *   déjà committée : passer par `safeRecordTeamAudit` / `withTeamAudit`,
 *   qui avalent et loggent l'erreur (même posture que
 *   `safeRecordAdminActionFromRequest` pour l'audit admin).
 * - `withTeamAudit` est le point d'entrée standard : il capture l'état
 *   avant, exécute la mutation, recapture après et écrit l'étape.
 * - À l'intérieur d'une transaction interactive, capturer l'état APRÈS
 *   coup (donc après le commit) : une lecture faite depuis le client
 *   global ne verrait pas les écritures non committées. En pratique :
 *   envelopper l'appel à `prisma.$transaction(...)`, pas son intérieur.
 */

import { serverLog } from "../utils/server-log";
import {
  currentCorrelationId,
  getAuditContext,
  nextAuditStep,
  resolveActorRole,
  type AuditActorRole,
  type AuditSource,
} from "../utils/audit-context";

/** Coupe-circuit d'exploitation (`TEAM_AUDIT_DISABLED=1`). */
export function isTeamAuditEnabled(): boolean {
  return process.env.TEAM_AUDIT_DISABLED !== "1";
}

/** Ligne joueur retenue dans le snapshot (compacte mais suffisante). */
export interface TeamAuditPlayerSnapshot {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly number: number;
  readonly spp: number;
  readonly dead: boolean;
  readonly fired: boolean;
  readonly missNextMatch: boolean;
  readonly nigglingInjuries: number;
  /** Nombre d'avancements appliqués (le détail vit dans `details`). */
  readonly advancements: number;
}

/**
 * État d'équipe figé à un instant t. C'est LE « résultat » stocké à chaque
 * étape : tout ce qui pilote la trésorerie et la VE/VEA y est.
 */
export interface TeamStateSnapshot {
  readonly teamId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly roster: string;
  readonly ruleset: string | null;
  readonly format: string | null;
  readonly treasury: number;
  readonly teamValue: number;
  readonly currentValue: number;
  readonly initialBudget: number;
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
  readonly startingPspPool: number;
  readonly deleted: boolean;
  /** Joueurs actifs (ni morts ni licenciés) — ceux qui portent la VE. */
  readonly activePlayerCount: number;
  /** Toutes les lignes `TeamPlayer`, y compris morts et licenciés. */
  readonly totalPlayerCount: number;
  readonly starPlayerCount: number;
  readonly starPlayersCost: number;
  readonly players: readonly TeamAuditPlayerSnapshot[];
}

/** Champs scalaires du snapshot comparés par `diffTeamState`. */
const DIFFED_FIELDS = [
  "name",
  "roster",
  "ruleset",
  "format",
  "treasury",
  "teamValue",
  "currentValue",
  "initialBudget",
  "rerolls",
  "cheerleaders",
  "assistants",
  "apothecary",
  "dedicatedFans",
  "startingPspPool",
  "deleted",
  "activePlayerCount",
  "totalPlayerCount",
  "starPlayerCount",
  "starPlayersCost",
] as const;

export type TeamStateDiff = Record<string, { from: unknown; to: unknown }>;

/**
 * Diff champ par champ entre deux snapshots. Pur.
 *
 * `before` absent (création) => tous les champs de `after` sont rendus
 * comme `{ from: null, to: valeur }`, ce qui garde le journal lisible sans
 * cas particulier côté UI.
 */
export function diffTeamState(
  before: TeamStateSnapshot | null | undefined,
  after: TeamStateSnapshot | null | undefined,
): TeamStateDiff {
  const diff: TeamStateDiff = {};
  if (!after) {
    if (!before) return diff;
    for (const field of DIFFED_FIELDS) {
      diff[field] = { from: before[field], to: null };
    }
    return diff;
  }
  for (const field of DIFFED_FIELDS) {
    const to = after[field];
    const from = before ? before[field] : null;
    if (from !== to) diff[field] = { from, to };
  }
  return diff;
}

/** Sous-ensemble du client Prisma utilisé par le journal. */
export interface TeamAuditPrismaLike {
  team: {
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
  };
  teamAuditEvent: {
    create: (args: unknown) => Promise<unknown>;
  };
  user?: {
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
  };
}

function toBool(value: unknown): boolean {
  return value === true || value === 1;
}

function toInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Compte les avancements d'un joueur en tolérant les deux formes de la
 * colonne (`advancements` est un CSV JSON en base, mais un mock étroit
 * peut fournir un tableau).
 */
export function countAdvancements(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw !== "string") return 0;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Lit l'état complet d'une équipe. Retourne `null` si l'équipe n'existe
 * pas (ou plus) — cas normal après une suppression définitive.
 *
 * Tolérant : toute erreur de lecture (client mocké étroit dans un test
 * unitaire, équipe concurremment supprimée) rend `null` plutôt que de
 * faire échouer la mutation métier.
 */
export async function captureTeamState(
  db: TeamAuditPrismaLike,
  teamId: string,
): Promise<TeamStateSnapshot | null> {
  try {
    const team = (await db.team.findUnique({
      where: { id: teamId },
      include: {
        players: {
          select: {
            id: true,
            name: true,
            position: true,
            number: true,
            spp: true,
            dead: true,
            firedAt: true,
            missNextMatch: true,
            nigglingInjuries: true,
            advancements: true,
          },
        },
        starPlayers: { select: { id: true, cost: true } },
      },
    })) as Record<string, unknown> | null;
    if (!team) return null;

    const rawPlayers = Array.isArray(team.players)
      ? (team.players as Array<Record<string, unknown>>)
      : [];
    const rawStars = Array.isArray(team.starPlayers)
      ? (team.starPlayers as Array<Record<string, unknown>>)
      : [];

    const players: TeamAuditPlayerSnapshot[] = rawPlayers.map((p) => ({
      id: String(p.id ?? ""),
      name: String(p.name ?? ""),
      position: String(p.position ?? ""),
      number: toInt(p.number),
      spp: toInt(p.spp),
      dead: toBool(p.dead),
      fired: p.firedAt != null,
      missNextMatch: toBool(p.missNextMatch),
      nigglingInjuries: toInt(p.nigglingInjuries),
      advancements: countAdvancements(p.advancements),
    }));

    return {
      teamId,
      ownerId: String(team.ownerId ?? ""),
      name: String(team.name ?? ""),
      roster: String(team.roster ?? ""),
      ruleset: team.ruleset == null ? null : String(team.ruleset),
      format: team.format == null ? null : String(team.format),
      treasury: toInt(team.treasury),
      teamValue: toInt(team.teamValue),
      currentValue: toInt(team.currentValue),
      initialBudget: toInt(team.initialBudget),
      rerolls: toInt(team.rerolls),
      cheerleaders: toInt(team.cheerleaders),
      assistants: toInt(team.assistants),
      apothecary: toBool(team.apothecary),
      dedicatedFans: toInt(team.dedicatedFans),
      startingPspPool: toInt(team.startingPspPool),
      deleted: team.deletedAt != null,
      activePlayerCount: players.filter((p) => !p.dead && !p.fired).length,
      totalPlayerCount: players.length,
      starPlayerCount: rawStars.length,
      starPlayersCost: rawStars.reduce((sum, sp) => sum + toInt(sp.cost), 0),
      players,
    };
  } catch (err) {
    serverLog.error(
      `[team-audit] capture de l'état de l'équipe ${teamId} impossible`,
      err,
    );
    return null;
  }
}

export interface RecordTeamAuditInput {
  readonly teamId: string;
  /** Slug métier stable en dot-case ("team.purchase.player"). */
  readonly action: string;
  readonly before?: TeamStateSnapshot | null;
  /** Omis => recapturé depuis la base au moment de l'écriture. */
  readonly after?: TeamStateSnapshot | null;
  readonly entity?: "Team" | "TeamPlayer" | "TeamStarPlayer";
  readonly entityId?: string | null;
  /** Charge utile métier (coût, poste, motif, payload de saisie…). */
  readonly details?: unknown;
  readonly note?: string | null;
  /**
   * Acteur explicite, pour les chemins sans contexte ambiant (worker,
   * script one-shot). Par défaut : contexte ALS.
   */
  readonly actor?: {
    readonly userId?: string | null;
    readonly roles?: readonly string[];
    readonly role?: AuditActorRole;
    readonly label?: string | null;
    readonly impersonatorId?: string | null;
  };
  readonly source?: AuditSource;
  readonly route?: string | null;
}

/**
 * Sérialise une valeur JSON pour une colonne `Json?` (Postgres) qui est un
 * `String?` dans le miroir sqlite des tests. Le même pattern que
 * `services/audit-log.ts` : on écrit toujours une chaîne, les deux
 * providers l'acceptent, la relecture est tolérante aux deux formes.
 */
function serialize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Libellé lisible de l'acteur, figé au moment de l'action pour que le
 * journal reste interprétable si le compte est renommé ou supprimé.
 */
async function resolveActorLabel(
  db: TeamAuditPrismaLike,
  userId: string | null,
): Promise<string | null> {
  if (!userId || !db.user?.findUnique) return null;
  try {
    const row = (await db.user.findUnique({
      where: { id: userId },
      select: { coachName: true, email: true },
    })) as { coachName?: string | null; email?: string | null } | null;
    if (!row) return null;
    return row.coachName || row.email || null;
  } catch {
    return null;
  }
}

/**
 * Écrit UNE étape du journal. Peut lever : réservé aux appelants qui
 * veulent la remontée d'erreur (tests). Le code métier passe par
 * `safeRecordTeamAudit`.
 */
export async function recordTeamAudit(
  db: TeamAuditPrismaLike,
  input: RecordTeamAuditInput,
): Promise<void> {
  if (!isTeamAuditEnabled()) return;

  const ctx = getAuditContext();
  const actorUserId = input.actor?.userId ?? ctx?.actorUserId ?? null;
  const after =
    input.after !== undefined
      ? input.after
      : await captureTeamState(db, input.teamId);
  const before = input.before ?? null;

  const actorRole =
    input.actor?.role ??
    resolveActorRole({
      actorUserId,
      teamOwnerId: after?.ownerId ?? before?.ownerId ?? null,
      roles: input.actor?.roles ?? ctx?.actorRoles ?? [],
    });

  const actorLabel =
    input.actor?.label !== undefined
      ? input.actor.label
      : await resolveActorLabel(db, actorUserId);

  const changes = diffTeamState(before, after);
  const treasuryDelta =
    before && after ? after.treasury - before.treasury : null;
  const teamValueDelta =
    before && after ? after.teamValue - before.teamValue : null;

  await db.teamAuditEvent.create({
    data: {
      teamId: input.teamId,
      correlationId: currentCorrelationId(),
      step: nextAuditStep(),
      action: input.action,
      entity: input.entity ?? "Team",
      entityId: input.entityId ?? null,
      actorUserId,
      actorRole,
      actorLabel,
      impersonatorId: input.actor?.impersonatorId ?? ctx?.impersonatorId ?? null,
      source: input.source ?? ctx?.source ?? "job",
      route: input.route ?? ctx?.route ?? null,
      ipAddress: ctx?.ipAddress ?? null,
      userAgent: ctx?.userAgent ?? null,
      changes: serialize(Object.keys(changes).length > 0 ? changes : null),
      before: serialize(before),
      after: serialize(after),
      details: serialize(input.details),
      treasury: after?.treasury ?? null,
      teamValue: after?.teamValue ?? null,
      currentValue: after?.currentValue ?? null,
      treasuryDelta,
      teamValueDelta,
      note: input.note ?? null,
    },
  });
}

/**
 * Variante résiliente : une défaillance du journal ne doit jamais faire
 * échouer une mutation déjà committée.
 */
export async function safeRecordTeamAudit(
  db: TeamAuditPrismaLike,
  input: RecordTeamAuditInput,
): Promise<void> {
  try {
    await recordTeamAudit(db, input);
  } catch (err) {
    serverLog.error(
      `[team-audit] écriture du journal impossible (${input.action}, équipe ${input.teamId})`,
      err,
    );
  }
}

export interface WithTeamAuditOptions
  extends Omit<RecordTeamAuditInput, "before" | "after"> {
  /**
   * Snapshot d'avant déjà en main (évite une relecture quand l'appelant
   * vient de charger l'équipe). Sinon capturé au début du wrapper.
   */
  readonly before?: TeamStateSnapshot | null;
  /**
   * Charge utile calculée APRÈS coup à partir du résultat de la mutation
   * (coût réel débité, id du joueur créé…). Fusionnée dans `details`.
   */
  readonly detailsFrom?: (result: unknown) => unknown;
}

/**
 * Point d'entrée standard : capture l'état avant, exécute la mutation,
 * recapture l'état après, écrit l'étape, rend le résultat de `fn`.
 *
 * ```ts
 * const team = await withTeamAudit(prisma, {
 *   teamId,
 *   action: "team.purchase.player",
 *   details: { position, cost },
 * }, () => buyPlayer(teamId, position));
 * ```
 *
 * L'échec de `fn` est propagé tel quel APRÈS avoir journalisé une étape
 * `<action>.failed` : une mutation qui a planté au milieu est justement le
 * cas qu'on cherche à reconstituer.
 */
export async function withTeamAudit<T>(
  db: TeamAuditPrismaLike,
  options: WithTeamAuditOptions,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isTeamAuditEnabled()) return fn();

  const before =
    options.before !== undefined
      ? options.before
      : await captureTeamState(db, options.teamId);

  let result: T;
  try {
    result = await fn();
  } catch (err) {
    await safeRecordTeamAudit(db, {
      ...options,
      before,
      action: `${options.action}.failed`,
      note: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
    });
    throw err;
  }

  await safeRecordTeamAudit(db, {
    ...options,
    before,
    details: options.detailsFrom
      ? mergeDetails(options.details, options.detailsFrom(result))
      : options.details,
  });
  return result;
}

/** Fusionne deux charges utiles d'étape (objets fusionnés, sinon la 2e). */
function mergeDetails(base: unknown, extra: unknown): unknown {
  if (extra === undefined || extra === null) return base;
  if (base === undefined || base === null) return extra;
  if (
    typeof base === "object" &&
    typeof extra === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(extra)
  ) {
    return { ...(base as object), ...(extra as object) };
  }
  return extra;
}
