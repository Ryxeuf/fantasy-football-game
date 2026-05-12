/**
 * Routes admin pour les tournois Pro League — Sprint P (Lot P.B.2).
 *
 * Endpoints :
 *   POST  /admin/pro-league/tournaments       — cree un tournoi
 *   GET   /admin/pro-league/tournaments       — liste tous les tournois (tous statuts)
 *   PATCH /admin/pro-league/tournaments/:id   — modifie status / fee / cap / dates
 *
 * Auth : authUser + adminOnly. Audit log sur les mutations.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { adminOnly } from "../middleware/adminOnly";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { prisma } from "../prisma";
import {
  DEFAULT_ENTRY_FEE_CROWNS,
  createTournament,
} from "../services/pro-tournament-entry";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { serverLog } from "../utils/server-log";

const router = Router();

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const createTournamentSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(SLUG_REGEX, "slug : lowercase / chiffres / tirets uniquement"),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  entryFeeCrowns: z.number().int().min(0).max(100_000).optional(),
  maxEntries: z.number().int().min(1).max(10_000).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export const patchTournamentSchema = z
  .object({
    status: z.enum(["open", "closed", "in_progress", "completed"]).optional(),
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(2000).optional().nullable(),
    entryFeeCrowns: z.number().int().min(0).max(100_000).optional(),
    maxEntries: z.number().int().min(1).max(10_000).optional().nullable(),
    startsAt: z.string().datetime().optional().nullable(),
    endsAt: z.string().datetime().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ doit etre modifie.",
  });

router.post(
  "/tournaments",
  authUser,
  adminOnly,
  validate(createTournamentSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const body = req.body as z.infer<typeof createTournamentSchema>;
    try {
      const created = await createTournament({
        slug: body.slug,
        name: body.name,
        description: body.description ?? null,
        entryFeeCrowns: body.entryFeeCrowns ?? DEFAULT_ENTRY_FEE_CROWNS,
        maxEntries: body.maxEntries ?? null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      });
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "pro_tournament.create",
        entity: "ProTournament",
        entityId: created.id,
        newValue: { slug: created.slug, name: body.name },
      });
      res.status(201).json(created);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === "P2002") {
        res.status(409).json({ error: "slug-already-exists" });
        return;
      }
      const msg = err instanceof Error ? err.message : "unknown";
      serverLog.error("[admin/pro-league/tournaments] create failed:", msg);
      res.status(500).json({ error: "internal-error" });
    }
  },
);

router.get(
  "/tournaments",
  authUser,
  adminOnly,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const rows = await prisma.proTournament.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          entryFeeCrowns: true,
          maxEntries: true,
          status: true,
          startsAt: true,
          endsAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { entries: true } },
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tournaments = (rows as any[]).map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        entryFeeCrowns: r.entryFeeCrowns,
        maxEntries: r.maxEntries,
        status: r.status,
        startsAt: r.startsAt
          ? (r.startsAt as Date).toISOString()
          : null,
        endsAt: r.endsAt ? (r.endsAt as Date).toISOString() : null,
        createdAt: (r.createdAt as Date).toISOString(),
        updatedAt: (r.updatedAt as Date).toISOString(),
        entriesCount: r._count?.entries ?? 0,
      }));
      res.json({ tournaments });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      serverLog.error("[admin/pro-league/tournaments] list failed:", msg);
      res.status(500).json({ error: "internal-error" });
    }
  },
);

router.patch(
  "/tournaments/:id",
  authUser,
  adminOnly,
  validate(patchTournamentSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: "missing-id" });
      return;
    }
    const body = req.body as z.infer<typeof patchTournamentSchema>;
    try {
      const previous = await prisma.proTournament.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!previous) {
        res.status(404).json({ error: "tournament-not-found" });
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {};
      if (body.status !== undefined) data.status = body.status;
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.entryFeeCrowns !== undefined)
        data.entryFeeCrowns = body.entryFeeCrowns;
      if (body.maxEntries !== undefined) data.maxEntries = body.maxEntries;
      if (body.startsAt !== undefined)
        data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
      if (body.endsAt !== undefined)
        data.endsAt = body.endsAt ? new Date(body.endsAt) : null;

      const updated = await prisma.proTournament.update({
        where: { id },
        data,
        select: { id: true, slug: true, status: true },
      });

      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "pro_tournament.update",
        entity: "ProTournament",
        entityId: id,
        oldValue: { status: previous.status },
        newValue: body,
      });
      res.json(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      serverLog.error("[admin/pro-league/tournaments] patch failed:", msg);
      res.status(500).json({ error: "internal-error" });
    }
  },
);

export default router;
