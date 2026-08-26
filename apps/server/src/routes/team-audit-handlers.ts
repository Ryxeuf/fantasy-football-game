/**
 * Journal d'équipe — endpoint de lecture.
 *
 *  - `GET /team/:id/journal` : la frise des mutations de l'équipe, la plus
 *    récente d'abord, avec l'état résultant à chaque étape.
 *
 * Accès : le coach propriétaire, un admin, ou le commissaire d'une ligue
 * où l'équipe est (ou a été) inscrite — les trois profils qui ont besoin
 * de reconstituer un écart de trésorerie ou de VE. Le journal expose des
 * données de l'équipe uniquement (aucune donnée d'un autre coach), mais il
 * porte l'IP de l'acteur : elle n'est servie qu'aux admins.
 *
 * Filtres (query) : `limit`, `offset`, `action` (préfixe), `actor`,
 * `economic=1` (n'afficher que les étapes qui ont bougé l'or ou la VE),
 * `since` / `until` (ISO).
 */

import type { Response } from "express";

import { prisma } from "../prisma";
import type { AuthenticatedRequest } from "../middleware/authUser";
import { sendError, sendSuccess } from "../utils/api-response";
import { hasRole, normalizeRoles } from "../utils/roles";
import { serverLog } from "../utils/server-log";
import {
  DEFAULT_AUDIT_PAGE_SIZE,
  MAX_AUDIT_PAGE_SIZE,
  listTeamAuditEvents,
  type ListTeamAuditInput,
  type TeamAuditEventView,
} from "../services/team-audit-read";

/** Query brute d'Express (`req.query`), réduite à ce qu'on lit. */
export type RawAuditQuery = Record<string, unknown>;

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value)) return firstString(value[0]);
  return null;
}

function parseDate(value: unknown): Date | null {
  const raw = firstString(value);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse les query params en entrée de service. Pur : testé sans Express ni
 * base (même posture que `parseAuditLogQuery` côté admin).
 */
export function parseTeamAuditQuery(
  teamId: string,
  query: RawAuditQuery,
): ListTeamAuditInput {
  const rawLimit = Number.parseInt(firstString(query.limit) ?? "", 10);
  const rawOffset = Number.parseInt(firstString(query.offset) ?? "", 10);
  const economic = firstString(query.economic);
  return {
    teamId,
    limit: Number.isFinite(rawLimit)
      ? Math.min(MAX_AUDIT_PAGE_SIZE, Math.max(1, rawLimit))
      : DEFAULT_AUDIT_PAGE_SIZE,
    offset: Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0,
    actionPrefix: firstString(query.action),
    actorUserId: firstString(query.actor),
    onlyEconomic: economic === "1" || economic === "true",
    since: parseDate(query.since),
    until: parseDate(query.until),
  };
}

/**
 * L'IP de l'acteur est une donnée personnelle : elle reste réservée aux
 * admins. Le coach voit qui a agi et ce qui a changé, pas d'où.
 */
export function redactForNonAdmin(
  entry: TeamAuditEventView,
): TeamAuditEventView {
  return { ...entry, ipAddress: null };
}

/** Droit de lecture du journal + niveau de détail servi. */
export async function resolveJournalAccess(
  db: typeof prisma,
  teamId: string,
  userId: string,
): Promise<{ allowed: boolean; isAdmin: boolean; teamName: string | null }> {
  const team = (await db.team.findUnique({
    where: { id: teamId },
    select: { id: true, ownerId: true, name: true },
  })) as { ownerId: string; name: string } | null;
  if (!team) return { allowed: false, isAdmin: false, teamName: null };

  const user = (await db.user.findUnique({
    where: { id: userId },
    select: { role: true, roles: true },
  })) as { role?: string | null; roles?: unknown } | null;
  const roles = normalizeRoles(
    (user?.roles as string[] | string | undefined) ?? user?.role,
  );
  const isAdmin = hasRole(roles, "admin");

  if (team.ownerId === userId || isAdmin) {
    return { allowed: true, isAdmin, teamName: team.name };
  }

  // Commissaire d'une ligue où l'équipe est (ou a été) inscrite : c'est
  // lui qui corrige les saisies, il doit pouvoir vérifier leur effet.
  const asCommissioner = await db.leagueParticipant.findFirst({
    where: {
      teamId,
      season: { league: { creatorId: userId } },
    },
    select: { id: true },
  });
  return {
    allowed: asCommissioner !== null,
    isAdmin: false,
    teamName: team.name,
  };
}

/** `GET /team/:id/journal` */
export async function handleGetTeamJournal(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  try {
    const access = await resolveJournalAccess(prisma, teamId, req.user!.id);
    if (!access.allowed) {
      sendError(res, "Equipe introuvable", 404);
      return;
    }

    const page = await listTeamAuditEvents(
      prisma as never,
      parseTeamAuditQuery(teamId, req.query as RawAuditQuery),
    );

    sendSuccess(res, {
      teamId,
      teamName: access.teamName,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      entries: access.isAdmin
        ? page.entries
        : page.entries.map(redactForNonAdmin),
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de la lecture du journal d'équipe:", e);
    sendError(res, "Erreur serveur", 500);
  }
}
