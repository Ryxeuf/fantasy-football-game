/**
 * Admin Pro League — gestion rosters.
 *
 * Endpoints :
 *  - GET  /admin/pro-league/teams/:id/roster                — liste joueurs
 *  - POST /admin/pro-league/teams/:id/roster/replenish      — combler manques
 *  - POST /admin/pro-league/teams/:id/roster/regenerate     — DESTRUCTIF
 *  - POST /admin/pro-league/rosters/:playerId/retire        — set retired
 *
 * Toute mutation est tracee dans l'audit log strict.
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate } from "../middleware/validate";
import {
  adminRosterReplenishSchema,
  adminRosterRegenerateSchema,
} from "../schemas/admin.schemas";
import { serverLog } from "../utils/server-log";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import type { AuthenticatedRequest } from "../middleware/authUser";
import { replenishTeamRoster } from "../services/pro-roster-generator";
import {
  regenerateRoster,
  retirePlayer,
  RosterAdminError,
} from "../services/pro-roster-admin";

const router = Router();

router.use(authUser, adminOnly);

function errorStatus(code: RosterAdminError["code"]): number {
  switch (code) {
    case "TEAM_NOT_FOUND":
    case "ROSTER_NOT_FOUND":
      return 404;
    case "INVALID_INPUT":
      return 400;
    case "ROSTER_HAS_HISTORY":
      return 409;
    default:
      return 500;
  }
}

interface RosterRow {
  id: string;
  teamId: string;
  name: string;
  position: string;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: unknown;
  niggling: number;
  maReduction: number;
  stReduction: number;
  agReduction: number;
  avReduction: number;
  status: string;
  form: number;
  spp: number;
  level: number;
  tvCached: number;
  tdCount: number;
  casCount: number;
  compCount: number;
  mvpCount: number;
  createdAt: Date;
  updatedAt: Date;
}

function parseSkills(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function serializePlayer(p: RosterRow): {
  id: string;
  name: string;
  position: string;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string[];
  status: string;
  form: number;
  spp: number;
  level: number;
  tvCached: number;
  niggling: number;
  tdCount: number;
  casCount: number;
  compCount: number;
  mvpCount: number;
} {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    ma: p.ma,
    st: p.st,
    ag: p.ag,
    pa: p.pa,
    av: p.av,
    skills: parseSkills(p.skills),
    status: p.status,
    form: p.form,
    spp: p.spp,
    level: p.level,
    tvCached: p.tvCached,
    niggling: p.niggling,
    tdCount: p.tdCount,
    casCount: p.casCount,
    compCount: p.compCount,
    mvpCount: p.mvpCount,
  };
}

/** GET /admin/pro-league/teams/:id/roster — liste des joueurs (tous statuts). */
router.get("/teams/:id/roster", async (req, res) => {
  try {
    const team = await prisma.proTeam.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true, city: true, name: true, race: true },
    });
    if (!team) {
      return res.status(404).json({ error: "Team introuvable" });
    }

    const players = (await prisma.proTeamRoster.findMany({
      where: { teamId: req.params.id },
      orderBy: [{ status: "asc" }, { level: "desc" }, { spp: "desc" }],
    })) as RosterRow[];

    const counts = {
      total: players.length,
      active: players.filter((p) => p.status === "active").length,
      injured: players.filter((p) => p.status === "injured").length,
      dead: players.filter((p) => p.status === "dead").length,
      retired: players.filter((p) => p.status === "retired").length,
    };

    res.json({
      team,
      counts,
      players: players.map(serializePlayer),
    });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la lecture du roster" });
  }
});

/**
 * POST /admin/pro-league/teams/:id/roster/replenish — combler les manques.
 *
 * Non destructif : ajoute uniquement le nombre necessaire pour
 * atteindre `targetSize` joueurs `active` (defaut 12).
 */
router.post(
  "/teams/:id/roster/replenish",
  validate(adminRosterReplenishSchema),
  async (req, res) => {
    try {
      const { targetSize }: { targetSize?: number } = req.body;
      const result = await replenishTeamRoster(req.params.id, targetSize);

      await safeRecordAdminActionFromRequest(
        prisma,
        req as AuthenticatedRequest,
        {
          action: "pro-roster.replenish",
          entity: "ProTeam",
          entityId: req.params.id,
          newValue: {
            targetSize: result.targetSize,
            activeBefore: result.activeBefore,
            created: result.created,
          },
        },
      );

      res.json(result);
    } catch (e) {
      serverLog.error(e);
      const message = e instanceof Error ? e.message : "Erreur";
      const status = message.includes("introuvable") ? 404 : 500;
      res.status(status).json({ error: message });
    }
  },
);

/**
 * POST /admin/pro-league/teams/:id/roster/regenerate — DESTRUCTIF.
 *
 * Wipe complet du roster + re-seed `count` rookies. A utiliser pour
 * reset une team en debut de saison ou apres un bug majeur. Audit
 * log avec count + deleted.
 */
router.post(
  "/teams/:id/roster/regenerate",
  validate(adminRosterRegenerateSchema),
  async (req, res) => {
    try {
      const { count }: { count: number } = req.body;
      const result = await regenerateRoster({
        teamId: req.params.id,
        count,
      });

      await safeRecordAdminActionFromRequest(
        prisma,
        req as AuthenticatedRequest,
        {
          action: "pro-roster.regenerate",
          entity: "ProTeam",
          entityId: req.params.id,
          oldValue: { deleted: result.deleted },
          newValue: { created: result.created, count },
        },
      );

      res.json(result);
    } catch (e) {
      if (e instanceof RosterAdminError) {
        return res.status(errorStatus(e.code)).json({ error: e.message });
      }
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors de la regeneration" });
    }
  },
);

/** POST /admin/pro-league/rosters/:playerId/retire — set status=retired. */
router.post("/rosters/:playerId/retire", async (req, res) => {
  try {
    const result = await retirePlayer(req.params.playerId);

    await safeRecordAdminActionFromRequest(
      prisma,
      req as AuthenticatedRequest,
      {
        action: "pro-roster.retire",
        entity: "ProTeamRoster",
        entityId: req.params.playerId,
        oldValue: { status: result.previousStatus },
        newValue: { status: "retired" },
      },
    );

    res.json(result);
  } catch (e) {
    if (e instanceof RosterAdminError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors du retire" });
  }
});

export default router;
