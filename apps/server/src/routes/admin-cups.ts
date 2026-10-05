/**
 * Routes admin pour la gestion globale des coupes.
 *
 * Reservees aux admins (authUser + adminOnly). Pendant de
 * `routes/admin-leagues` : la console listait jusqu'ici les coupes via
 * `GET /cup?publicOnly=false`, qui charge TOUS les participants de TOUTES
 * les coupes, sans filtre serveur ni pagination, et sans l'email du
 * createur (retire du select public).
 *
 *   - GET /admin/cups : liste paginee + filtres (statut, visibilite,
 *     recherche) + compteurs par statut et par visibilite
 *
 * L'edition (`PATCH /cup/:id`, visibilite comprise), le changement de statut
 * (`POST /cup/:id/status`), l'archivage et la suppression existent deja et
 * sont ouverts aux admins : la console les reutilise tels quels.
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validateQuery } from "../middleware/validate";
import { prisma } from "../prisma";
import {
  adminCupsQuerySchema,
  type AdminCupsQuery,
} from "../schemas/admin-cups.schemas";
import { sendError } from "../utils/api-response";
import { serverLog } from "../utils/server-log";

const router = Router();

interface AdminCupRow {
  id: string;
  name: string;
  description: string | null;
  ruleset: string;
  format: string;
  status: string;
  validated: boolean;
  isPublic: boolean;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  creator: { id: string; coachName: string | null; email: string };
  _count: { participants: number };
}

router.use(authUser, adminOnly);

/**
 * Construit le `where` Prisma de la liste admin. Pur, exporte pour test.
 * La recherche porte sur le nom de la coupe et sur le createur (nom de
 * coach ou email) — c'est ainsi qu'un admin retrouve « la coupe de X ».
 */
export function buildAdminCupsWhere(
  query: Pick<AdminCupsQuery, "status" | "visibility" | "search">,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.visibility === "public") where.isPublic = true;
  if (query.visibility === "private") where.isPublic = false;
  const search = query.search?.trim();
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { creator: { coachName: { contains: search, mode: "insensitive" } } },
      { creator: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  return where;
}

/**
 * GET /admin/cups
 *
 * Les compteurs (`counts`) ignorent les filtres : ils decrivent le parc
 * entier, pour que les onglets de la console restent stables quand on filtre.
 */
export async function handleListAdminCups(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const query = req.query as unknown as AdminCupsQuery;
  const where = buildAdminCupsWhere(query);
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  try {
    const [items, total, byStatus, byVisibility] = await Promise.all([
      prisma.cup.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          description: true,
          ruleset: true,
          format: true,
          status: true,
          validated: true,
          isPublic: true,
          creatorId: true,
          createdAt: true,
          updatedAt: true,
          creator: { select: { id: true, coachName: true, email: true } },
          _count: { select: { participants: true } },
        },
      }),
      prisma.cup.count({ where }),
      prisma.cup.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.cup.groupBy({ by: ["isPublic"], _count: { _all: true } }),
    ]);

    const status: Record<string, number> = {};
    for (const row of byStatus as Array<{ status: string; _count: { _all: number } }>) status[row.status] = row._count._all;
    let publicCount = 0;
    let privateCount = 0;
    for (const row of byVisibility as Array<{
      isPublic: boolean;
      _count: { _all: number };
    }>) {
      if (row.isPublic) publicCount = row._count._all;
      else privateCount = row._count._all;
    }

    res.status(200).json({
      success: true,
      data: {
        cups: (items as AdminCupRow[]).map(({ _count, ...c }) => ({
          ...c,
          participantCount: _count.participants,
        })),
        counts: {
          total: publicCount + privateCount,
          status,
          public: publicCount,
          private: privateCount,
        },
      },
      meta: { total, limit, page: Math.floor(offset / limit) },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    serverLog.error("[admin-cups] list failed:", msg);
    sendError(res, "Erreur serveur", 500);
  }
}

router.get("/", validateQuery(adminCupsQuerySchema), handleListAdminCups);

export default router;
