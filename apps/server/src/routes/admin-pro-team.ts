/**
 * Admin Pro League — branding teams.
 *
 * Endpoints :
 *  - GET   /admin/pro-league/teams           — liste teams (par leagueId)
 *  - GET   /admin/pro-league/teams/:id       — detail team avec branding
 *  - PATCH /admin/pro-league/teams/:id       — update branding (couleurs,
 *                                              motto, headline, nflFlavor,
 *                                              city, name)
 *
 * Toutes les mutations tracent un audit log strict (oldValue / newValue
 * limites aux champs branding).
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate } from "../middleware/validate";
import { adminProTeamBrandingSchema } from "../schemas/admin.schemas";
import { serverLog } from "../utils/server-log";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import type { AuthenticatedRequest } from "../middleware/authUser";
import {
  parseProTeamMeta,
  applyBrandingMeta,
} from "../services/pro-team-branding";

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

export default router;
