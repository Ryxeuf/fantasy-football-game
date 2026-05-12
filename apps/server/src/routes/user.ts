import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { parsePagination, buildApiMeta } from "../utils/pagination";
import { isValidNafName } from "../services/naf-sync";

const router = Router();

// Sprint R lot R.D.3 — opt-in NAF (Naffinity Federation).
//
// PATCH /me/naf { nafName: string | null }
//   - Set/update le NAF identifier visible sur le profil public.
//   - null pour disable l'opt-in.
//   - Validation : 2-64 chars, ASCII printable.
router.patch(
  "/naf",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    const body = req.body as { nafName?: string | null };
    let next: string | null = null;
    if (body.nafName === null || body.nafName === undefined) {
      next = null;
    } else if (typeof body.nafName !== "string") {
      res.status(400).json({ error: "INVALID_NAF_NAME" });
      return;
    } else {
      const trimmed = body.nafName.trim();
      if (trimmed.length === 0) {
        next = null;
      } else if (!isValidNafName(trimmed)) {
        res
          .status(400)
          .json({ error: "INVALID_NAF_NAME", message: "2-64 chars ASCII." });
        return;
      } else {
        next = trimmed;
      }
    }
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { nafName: next },
    });
    res.json({ nafName: next });
  },
);

router.get("/matches", authUser, async (req: AuthenticatedRequest, res) => {
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  const where = { players: { some: { id: req.user!.id } } };
  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      select: { id: true, status: true, seed: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.match.count({ where }),
  ]);
  res.json({ matches, meta: buildApiMeta({ total, limit, offset }) });
});

export default router;
