/**
 * Admin Pro League — branding teams.
 *
 * Endpoints :
 *  - GET   /admin/pro-league/teams           — liste teams (par leagueId)
 *  - GET   /admin/pro-league/teams/:id       — detail team avec branding
 *  - PATCH /admin/pro-league/teams/:id       — update branding (couleurs,
 *                                              motto, headline, nflFlavor,
 *                                              city, name)
 *  Lot 4 « évolution persistée » — le coach IA de l'équipe :
 *  - GET   /admin/pro-league/teams/:id/coach         — profil vivant + ancre
 *  - PATCH /admin/pro-league/teams/:id/coach         — pose l'ancre (nom,
 *                                                      philosophie, profil)
 *  - POST  /admin/pro-league/teams/:id/coach/reset   — retour au profil de race
 *  - GET   /admin/pro-league/teams/:id/coach/memory  — journal des évolutions
 *
 * Toutes les mutations tracent un audit log strict (oldValue / newValue
 * limites aux champs branding).
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate, validateQuery } from "../middleware/validate";
import {
  adminProCoachMemoryQuerySchema,
  adminProCoachPatchSchema,
  adminProTeamBrandingSchema,
  type AdminProCoachPatchInput,
} from "../schemas/admin.schemas";
import { serverLog } from "../utils/server-log";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import type { AuthenticatedRequest } from "../middleware/authUser";
import {
  parseProTeamMeta,
  applyBrandingMeta,
} from "../services/pro-team-branding";
import {
  ProCoachError,
  ensureProCoach,
  listCoachMemory,
  resetCoach,
  updateCoachByAdmin,
  type ProCoachView,
} from "../services/pro-coach";

const router = Router();

router.use(authUser, adminOnly);

interface ProTeamRow {
  id: string;
  leagueId: string;
  slug: string;
  city: string;
  name: string;
  race: string;
  nflFlavor: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  baseTv: number;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
}

function serializeTeam(team: ProTeamRow): {
  id: string;
  leagueId: string;
  slug: string;
  city: string;
  name: string;
  race: string;
  nflFlavor: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  baseTv: number;
  motto: string | null;
  headline: string | null;
  createdAt: Date;
  updatedAt: Date;
} {
  const meta = parseProTeamMeta(team.meta);
  return {
    id: team.id,
    leagueId: team.leagueId,
    slug: team.slug,
    city: team.city,
    name: team.name,
    race: team.race,
    nflFlavor: team.nflFlavor,
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
    baseTv: team.baseTv,
    motto: typeof meta.motto === "string" ? meta.motto : null,
    headline: typeof meta.headline === "string" ? meta.headline : null,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

/**
 * GET /admin/pro-league/teams — liste des teams.
 *
 * Filtre optionnel `?leagueId=...`. Ordre alphabetique par city puis name.
 */
router.get("/teams", async (req, res) => {
  try {
    const leagueId = req.query.leagueId as string | undefined;
    const where = leagueId ? { leagueId } : {};
    const teams = (await prisma.proTeam.findMany({
      where,
      orderBy: [{ city: "asc" }, { name: "asc" }],
    })) as ProTeamRow[];
    res.json({ teams: teams.map(serializeTeam) });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la lecture des teams" });
  }
});

/** GET /admin/pro-league/teams/:id — detail team avec branding. */
router.get("/teams/:id", async (req, res) => {
  try {
    const team = (await prisma.proTeam.findUnique({
      where: { id: req.params.id },
    })) as ProTeamRow | null;
    if (!team) {
      return res.status(404).json({ error: "Team introuvable" });
    }
    res.json({ team: serializeTeam(team) });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la lecture de la team" });
  }
});

/**
 * PATCH /admin/pro-league/teams/:id — update branding.
 *
 * Champs supportes : city, name, nflFlavor, primaryColor, secondaryColor,
 * motto, headline. Tous optionnels. `null` explicite efface le champ
 * (sauf city/name qui sont required dans le schema). meta (motto/headline)
 * est merge — les autres entrees meta ne sont pas touchees.
 */
router.patch(
  "/teams/:id",
  validate(adminProTeamBrandingSchema),
  async (req, res) => {
    try {
      const existing = (await prisma.proTeam.findUnique({
        where: { id: req.params.id },
      })) as ProTeamRow | null;
      if (!existing) {
        return res.status(404).json({ error: "Team introuvable" });
      }

      const body: {
        city?: string;
        name?: string;
        nflFlavor?: string | null;
        primaryColor?: string | null;
        secondaryColor?: string | null;
        motto?: string | null;
        headline?: string | null;
      } = req.body;

      const data: Record<string, unknown> = {};
      if (body.city !== undefined) data.city = body.city;
      if (body.name !== undefined) data.name = body.name;
      if (body.nflFlavor !== undefined) data.nflFlavor = body.nflFlavor;
      if (body.primaryColor !== undefined) data.primaryColor = body.primaryColor;
      if (body.secondaryColor !== undefined) {
        data.secondaryColor = body.secondaryColor;
      }

      const metaTouched = "motto" in body || "headline" in body;
      if (metaTouched) {
        data.meta = applyBrandingMeta(existing.meta, {
          motto: body.motto,
          headline: body.headline,
        });
      }

      const updated = (await prisma.proTeam.update({
        where: { id: req.params.id },
        data,
      })) as ProTeamRow;

      const previous = serializeTeam(existing);
      const next = serializeTeam(updated);

      await safeRecordAdminActionFromRequest(
        prisma,
        req as AuthenticatedRequest,
        {
          action: "pro-team.branding.update",
          entity: "ProTeam",
          entityId: req.params.id,
          oldValue: {
            city: previous.city,
            name: previous.name,
            nflFlavor: previous.nflFlavor,
            primaryColor: previous.primaryColor,
            secondaryColor: previous.secondaryColor,
            motto: previous.motto,
            headline: previous.headline,
          },
          newValue: {
            city: next.city,
            name: next.name,
            nflFlavor: next.nflFlavor,
            primaryColor: next.primaryColor,
            secondaryColor: next.secondaryColor,
            motto: next.motto,
            headline: next.headline,
          },
        },
      );

      res.json({ team: next });
    } catch (e) {
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors de la mise a jour" });
    }
  },
);

function serializeCoach(coach: ProCoachView) {
  return {
    id: coach.id,
    teamId: coach.teamId,
    name: coach.name,
    philosophy: coach.philosophy,
    profile: coach.profile,
    anchorProfile: coach.anchorProfile,
    memory: coach.memory,
    experience: coach.experience,
    updatedAt: coach.updatedAt,
  };
}

function handleCoachError(res: import("express").Response, e: unknown, fallback: string): void {
  if (e instanceof ProCoachError && e.code === "team-not-found") {
    res.status(404).json({ error: "Team introuvable" });
    return;
  }
  serverLog.error(e);
  res.status(500).json({ error: fallback });
}

/** GET /admin/pro-league/teams/:id/coach — le coach IA (créé à la demande). */
router.get("/teams/:id/coach", async (req, res) => {
  try {
    const coach = await ensureProCoach(req.params.id);
    res.json({ coach: serializeCoach(coach) });
  } catch (e) {
    handleCoachError(res, e, "Erreur lors de la lecture du coach");
  }
});

/**
 * PATCH /admin/pro-league/teams/:id/coach — réglage admin.
 *
 * Un `profile` partiel redéfinit l'ANCRE (et y ramène le profil vivant) :
 * c'est la base autour de laquelle le coach évolue ensuite, bornée.
 */
router.patch(
  "/teams/:id/coach",
  validate(adminProCoachPatchSchema),
  async (req, res) => {
    try {
      const body: AdminProCoachPatchInput = req.body;
      const before = await ensureProCoach(req.params.id);
      const coach = await updateCoachByAdmin(req.params.id, body);
      await safeRecordAdminActionFromRequest(prisma, req as AuthenticatedRequest, {
        action: "pro-team.coach.update",
        entity: "ProCoach",
        entityId: coach.id,
        oldValue: { name: before.name, philosophy: before.philosophy, anchorProfile: before.anchorProfile },
        newValue: { name: coach.name, philosophy: coach.philosophy, anchorProfile: coach.anchorProfile },
      });
      res.json({ coach: serializeCoach(coach) });
    } catch (e) {
      handleCoachError(res, e, "Erreur lors de la mise a jour du coach");
    }
  },
);

/** POST /admin/pro-league/teams/:id/coach/reset — retour au profil de race. */
router.post("/teams/:id/coach/reset", async (req, res) => {
  try {
    const before = await ensureProCoach(req.params.id);
    const coach = await resetCoach(req.params.id);
    await safeRecordAdminActionFromRequest(prisma, req as AuthenticatedRequest, {
      action: "pro-team.coach.reset",
      entity: "ProCoach",
      entityId: coach.id,
      oldValue: { profile: before.profile, anchorProfile: before.anchorProfile, experience: before.experience },
      newValue: { profile: coach.profile, anchorProfile: coach.anchorProfile, experience: coach.experience },
    });
    res.json({ coach: serializeCoach(coach) });
  } catch (e) {
    handleCoachError(res, e, "Erreur lors de la reinitialisation du coach");
  }
});

/** GET /admin/pro-league/teams/:id/coach/memory?limit=20 — journal des évolutions. */
router.get(
  "/teams/:id/coach/memory",
  validateQuery(adminProCoachMemoryQuerySchema),
  async (req, res) => {
    try {
      const coach = await ensureProCoach(req.params.id);
      const limit = (req.query as { limit?: number }).limit ?? 20;
      const memory = await listCoachMemory(coach.id, limit);
      res.json({ memory });
    } catch (e) {
      handleCoachError(res, e, "Erreur lors de la lecture de la memoire du coach");
    }
  },
);

export default router;
