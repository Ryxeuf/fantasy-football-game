/**
 * Fan Dévoué OFFERT des équipes de ligue : octroi à l'inscription, reprise
 * au départ.
 *
 * Le premier Fan Dévoué gratuit est une règle de LIGUE : une équipe
 * construite hors compétition ou pour une coupe n'en a pas
 * (`Team.leagueFreeFan = false`). Son inscription à une saison de ligue le
 * lui accorde ; elle le perd si elle quitte la ligue (retrait, suppression
 * par le commissaire, suppression de la ligue).
 *
 * Trois règles qui ne se voient pas d'un seul appelant :
 *
 *   - **Ce qu'une inscription a accordé est mémorisé SUR ELLE**
 *     (`LeagueParticipant.freeFanGrant` / `freeFanRefund`). Quitter une
 *     seconde saison ne retire pas le fan accordé par la première, et une
 *     équipe au plafond rend exactement le montant qu'elle a reçu.
 *   - **L'octroi suit l'équipe tant qu'elle reste en ligue** : si
 *     l'inscription qui part portait l'octroi alors que l'équipe a une autre
 *     inscription (autre saison, autre ligue), l'octroi est TRANSFÉRÉ à
 *     celle-ci au lieu d'être repris.
 *   - **Atomique avec l'inscription / le départ**, en écriture conditionnelle
 *     sur le marqueur : deux inscriptions concurrentes n'accordent qu'une
 *     fois, une reprise n'a lieu qu'une fois. Le journal d'équipe est écrit
 *     APRÈS le commit (capture avant, publication après).
 *
 * Le calcul (quoi accorder, quoi reprendre) est la règle PURE du moteur
 * (`@bb/game-engine` `dedicated-fans`) ; ce module ne fait que lire,
 * écrire et journaliser.
 */

import { prisma } from "../prisma";
import {
  DEFAULT_RULESET,
  isGameFormat,
  parseLeagueFreeFanGrant,
  planLeagueFreeFanGrant,
  planLeagueFreeFanRevoke,
  type GameFormat,
  type LeagueFreeFanGrantKind,
  type LeagueFreeFanRevokePlan,
  type Ruleset,
} from "@bb/game-engine";
import { resolveStaffConfigBySlug } from "./roster-staff-config";
import {
  captureTeamState,
  safeRecordTeamAudit,
  type TeamAuditPrismaLike,
  type TeamStateSnapshot,
} from "./team-audit";

const auditDb = prisma as unknown as TeamAuditPrismaLike;

/** Colonnes d'octroi remises à zéro sur une inscription qui part. */
const GRANT_CLEARED = { freeFanGrant: null, freeFanRefund: null } as const;

/** Équipe telle que l'inscription la charge (toutes colonnes scalaires). */
export interface FreeFanTeam {
  readonly id: string;
  readonly roster: string;
  readonly ruleset?: string | null;
  readonly format?: string | null;
  readonly dedicatedFans: number;
  readonly leagueFreeFan?: boolean | null;
}

/** Inscription telle que la créent `addParticipant` et ses appelants. */
export interface NewLeagueParticipantData {
  readonly seasonId: string;
  readonly teamId: string;
  readonly seasonElo: number;
  readonly status: "active";
}

/**
 * Crée l'inscription d'une équipe à une saison de ligue et lui accorde son
 * fan offert si elle ne l'a pas (`leagueFreeFan = false`) : +1 fan, ou le
 * prix d'un fan en trésorerie si elle est déjà au plafond.
 *
 * Sans rien à accorder (équipe historique `null`, ou fan déjà accordé),
 * l'inscription est créée seule, exactement comme avant la règle.
 */
export async function createLeagueParticipant(
  data: NewLeagueParticipantData,
  team: FreeFanTeam,
) {
  if (team.leagueFreeFan !== false) {
    return prisma.leagueParticipant.create({ data });
  }

  const ruleset = (team.ruleset as Ruleset | null) ?? DEFAULT_RULESET;
  const format: GameFormat = isGameFormat(team.format) ? team.format : "bb11";
  const staff = await resolveStaffConfigBySlug(team.roster, ruleset, format);
  const plan = planLeagueFreeFanGrant({
    fans: team.dedicatedFans,
    marker: team.leagueFreeFan,
    maxFans: staff.maxDedicatedFans,
    unitCost: staff.dedicatedFanCost,
  });
  if (plan.kind === "none") {
    return prisma.leagueParticipant.create({ data });
  }

  const before = await captureTeamState(auditDb, team.id);
  const refund = plan.kind === "refund" ? plan.amount : null;
  const { participant, granted } = await prisma.$transaction(
    async (tx: typeof prisma) => {
      const res = await tx.team.updateMany({
        where:
          plan.kind === "fan"
            ? {
                id: team.id,
                leagueFreeFan: false,
                dedicatedFans: { lt: staff.maxDedicatedFans },
              }
            : { id: team.id, leagueFreeFan: false },
        data:
          plan.kind === "fan"
            ? { leagueFreeFan: true, dedicatedFans: { increment: 1 } }
            : { leagueFreeFan: true, treasury: { increment: plan.amount } },
      });
      // Course perdue (octroi concurrent, fans modifiés entre-temps) :
      // l'inscription se crée sans rien accorder.
      const ok = (res as { count: number }).count === 1;
      const created = await tx.leagueParticipant.create({
        data: ok
          ? { ...data, freeFanGrant: plan.kind, freeFanRefund: refund }
          : data,
      });
      return { participant: created, granted: ok };
    },
  );

  if (granted) {
    await safeRecordTeamAudit(auditDb, {
      teamId: team.id,
      action: "team.league_free_fan.granted",
      before,
      details: {
        seasonId: data.seasonId,
        participantId: (participant as { id?: string }).id ?? null,
        grant: plan.kind,
        refund,
      },
    });
  }
  return participant;
}

/** Inscription qui quitte la ligue (seules celles qui portent un octroi comptent). */
export interface DepartingParticipant {
  readonly id: string;
  readonly teamId: string;
  readonly freeFanGrant?: string | null;
  readonly freeFanRefund?: number | null;
}

export type LeagueDepartureReason =
  | "withdrawn"
  | "removed_by_commissioner"
  | "league_deleted";

export interface LeagueDeparture {
  /** Inscriptions qui partent (retirées, supprimées, emportées). */
  readonly participants: readonly DepartingParticipant[];
  readonly reason: LeagueDepartureReason;
  /**
   * Ligue supprimée : aucune de ses inscriptions ne peut recueillir un
   * octroi transféré (la cascade les emporte toutes).
   */
  readonly deletedLeagueId?: string;
}

interface RevokeOutcome {
  readonly participant: DepartingParticipant;
  readonly grant: LeagueFreeFanGrantKind;
  /** Inscription qui a recueilli l'octroi, ou `null` s'il a été repris. */
  readonly transferredTo: string | null;
  readonly applied: LeagueFreeFanRevokePlan;
  readonly before: TeamStateSnapshot | null;
}

/**
 * Exécute un départ de ligue (`op` : retrait, suppression d'inscription(s),
 * suppression de la ligue) en reprenant — ou transférant — le fan offert
 * que les inscriptions qui partent avaient accordé, dans la MÊME
 * transaction.
 *
 * Aucune inscription concernée ⇒ `op` s'exécute seul sur le client global,
 * comme avant la règle.
 */
export async function withLeagueFreeFanRevoked<T>(
  departure: LeagueDeparture,
  op: (db: typeof prisma) => Promise<T>,
): Promise<T> {
  const granted = departure.participants.filter(
    (p) => parseLeagueFreeFanGrant(p.freeFanGrant) !== null,
  );
  if (granted.length === 0) return op(prisma);

  const befores = new Map<string, TeamStateSnapshot | null>();
  for (const p of granted) {
    if (!befores.has(p.teamId)) {
      befores.set(p.teamId, await captureTeamState(auditDb, p.teamId));
    }
  }
  const departingIds = departure.participants.map((p) => p.id);

  const { result, outcomes } = await prisma.$transaction(
    async (tx: typeof prisma) => {
      const done: RevokeOutcome[] = [];
      for (const p of granted) {
        const grant = parseLeagueFreeFanGrant(p.freeFanGrant)!;
        // L'inscription qui part ne porte plus l'octroi (elle survit à un
        // retrait : statut `withdrawn`).
        await tx.leagueParticipant.updateMany({
          where: { id: p.id },
          data: GRANT_CLEARED,
        });

        const successor = await tx.leagueParticipant.findFirst({
          where: {
            teamId: p.teamId,
            status: "active",
            id: { notIn: departingIds },
            ...(departure.deletedLeagueId
              ? { season: { leagueId: { not: departure.deletedLeagueId } } }
              : {}),
          },
          orderBy: { joinedAt: "desc" },
          select: { id: true },
        });
        if (successor) {
          // L'équipe reste en ligue : l'octroi la suit, rien n'est repris.
          await tx.leagueParticipant.updateMany({
            where: { id: successor.id },
            data: { freeFanGrant: grant, freeFanRefund: p.freeFanRefund ?? null },
          });
          done.push({
            participant: p,
            grant,
            transferredTo: successor.id,
            applied: { kind: "none" },
            before: null,
          });
          continue;
        }

        const team = await tx.team.findUnique({
          where: { id: p.teamId },
          select: { dedicatedFans: true, treasury: true, leagueFreeFan: true },
        });
        // Marqueur déjà rendu ailleurs (ou équipe disparue) : rien à reprendre.
        if (!team || team.leagueFreeFan !== true) continue;

        const plan = planLeagueFreeFanRevoke({
          grant,
          refund: p.freeFanRefund ?? null,
          fans: team.dedicatedFans,
          treasury: team.treasury,
        });
        const res = await tx.team.updateMany({
          where: { id: p.teamId, leagueFreeFan: true, ...revokeGuard(plan) },
          data: { leagueFreeFan: false, ...revokeDelta(plan) },
        });
        let applied: LeagueFreeFanRevokePlan = plan;
        if ((res as { count: number }).count === 0) {
          // Course perdue sur les fans / la trésorerie : on rend au moins
          // le marqueur, jamais un compte négatif.
          await tx.team.updateMany({
            where: { id: p.teamId, leagueFreeFan: true },
            data: { leagueFreeFan: false },
          });
          applied = { kind: "none" };
        }
        done.push({
          participant: p,
          grant,
          transferredTo: null,
          applied,
          before: befores.get(p.teamId) ?? null,
        });
      }
      const opResult = await op(tx);
      return { result: opResult, outcomes: done };
    },
  );

  for (const o of outcomes) {
    if (o.transferredTo !== null) continue;
    await safeRecordTeamAudit(auditDb, {
      teamId: o.participant.teamId,
      action: "team.league_free_fan.revoked",
      before: o.before,
      details: {
        participantId: o.participant.id,
        reason: departure.reason,
        grant: o.grant,
        refund: o.participant.freeFanRefund ?? null,
        revoked: o.applied.kind,
        amount: o.applied.kind === "treasury" ? o.applied.amount : null,
      },
    });
  }
  return result;
}

/**
 * Suppression d'une ligue : reprend le fan offert accordé par chacune de ses
 * inscriptions avant que la cascade ne les emporte.
 */
export async function withLeagueFreeFansRevokedForLeague<T>(
  leagueId: string,
  op: (db: typeof prisma) => Promise<T>,
): Promise<T> {
  const participants = (await prisma.leagueParticipant.findMany({
    where: { season: { leagueId }, freeFanGrant: { not: null } },
    select: { id: true, teamId: true, freeFanGrant: true, freeFanRefund: true },
  })) as DepartingParticipant[] | undefined;
  return withLeagueFreeFanRevoked(
    {
      participants: participants ?? [],
      reason: "league_deleted",
      deletedLeagueId: leagueId,
    },
    op,
  );
}

function revokeGuard(plan: LeagueFreeFanRevokePlan): Record<string, unknown> {
  if (plan.kind === "fan") return { dedicatedFans: { gte: 1 } };
  if (plan.kind === "treasury") return { treasury: { gte: plan.amount } };
  return {};
}

function revokeDelta(plan: LeagueFreeFanRevokePlan): Record<string, unknown> {
  if (plan.kind === "fan") return { dedicatedFans: { decrement: 1 } };
  if (plan.kind === "treasury") return { treasury: { decrement: plan.amount } };
  return {};
}
