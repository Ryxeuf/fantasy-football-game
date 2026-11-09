import { Router, type Response } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { sessionOnly } from "../middleware/sessionOnly";
import {
  updateNafNumberSchema,
  updateNafSchema,
  type UpdateNafInput,
  type UpdateNafNumberInput,
} from "../schemas/user.schemas";
import {
  NafNumberError,
  retryUserNafVerification,
  setUserNafNumber,
  type UserNafView,
} from "../services/user-naf-number";
import { serverLog } from "../utils/server-log";
import { parsePagination, buildApiMeta } from "../utils/pagination";
import { isValidNafName } from "../services/naf-sync";
import { getSupporterStatus } from "../services/supporter-status";
import { OFFLINE_MATCH_MODE } from "../services/match-modes";

const router = Router();

// Sprint R lot R.B.3 — statut supporter (ad-free + early access).
router.get("/supporter", authUser, async (req: AuthenticatedRequest, res) => {
  const status = await getSupporterStatus(req.user!.id);
  res.json(status);
});

// Sprint R lot R.D.3 — opt-in NAF (Naffinity Federation).
//
// PATCH /me/naf { nafName: string | null }
//   - Set/update le NAF identifier visible sur le profil public.
//   - null pour disable l'opt-in.
//   - Validation : 2-64 chars, ASCII printable.
router.patch(
  "/naf",
  authUser,
  validate(updateNafSchema),
  async (req: AuthenticatedRequest, res) => {
    const body: UpdateNafInput = req.body;
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

// Numéro NAF vérifié automatiquement auprès de l'annuaire thenaf.net.
//
// PUT /user/naf-number { nafNumber: string | number | null }
//   - trouvé : numéro + date de vérification + nom NAF officiel ;
//   - introuvable : 422 `naf_not_found`, rien d'enregistré ;
//   - annuaire injoignable : numéro enregistré, `verified: false` (en attente) ;
//   - déjà pris : 409 `naf_number_taken`.
// POST /user/naf-number/verify : retente la vérification.
// `sessionOnly` : modification du profil (cf. clés API d'administration).
function sendNafView(res: Response, view: UserNafView) {
  res.json({
    nafNumber: view.nafNumber,
    nafName: view.nafName,
    nafVerifiedAt: view.nafVerifiedAt,
    verified: view.verified,
    nafCoachUrl: view.nafCoachUrl,
  });
}

function sendNafError(res: Response, e: unknown) {
  if (e instanceof NafNumberError) {
    const status =
      e.code === "naf_number_taken" ? 409 : e.code === "naf_not_found" ? 422 : 400;
    res.status(status).json({ error: e.message, code: e.code });
    return;
  }
  serverLog.error("[user/naf-number] failed:", e);
  res.status(500).json({ error: "Erreur serveur" });
}

router.put(
  "/naf-number",
  authUser,
  sessionOnly,
  validate(updateNafNumberSchema),
  async (req: AuthenticatedRequest, res) => {
    const body: UpdateNafNumberInput = req.body;
    try {
      sendNafView(res, await setUserNafNumber(req.user!.id, body.nafNumber));
    } catch (e: unknown) {
      sendNafError(res, e);
    }
  },
);

router.post(
  "/naf-number/verify",
  authUser,
  sessionOnly,
  async (req: AuthenticatedRequest, res) => {
    try {
      sendNafView(res, await retryUserNafVerification(req.user!.id));
    } catch (e: unknown) {
      sendNafError(res, e);
    }
  },
);

router.get("/matches", authUser, async (req: AuthenticatedRequest, res) => {
  const { limit, offset } = parsePagination(
    req.query as Record<string, unknown>,
  );
  // Sprint R.E.2 — filtre optionnel `?mode=async` pour la page
  // /me/matches/async qui liste les matches en attente d'un coup.
  const modeFilter = typeof req.query.mode === "string" ? req.query.mode : null;
  const where: {
    players: { some: { id: string } };
    mode?: string | { not: string };
    status?: string;
  } = { players: { some: { id: req.user!.id } } };
  if (modeFilter === "async" || modeFilter === "realtime") {
    where.mode = modeFilter;
  } else {
    // Les matchs "offline" (saisie manuelle de ligue) ne sont pas des matchs
    // joues : on les exclut de l'historique perso sauf filtre mode explicite.
    where.mode = { not: OFFLINE_MATCH_MODE };
  }
  if (typeof req.query.status === "string" && req.query.status.length > 0) {
    where.status = req.query.status;
  }
  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      select: {
        id: true,
        status: true,
        seed: true,
        createdAt: true,
        mode: true,
        currentTurnUserId: true,
        currentTurnDeadline: true,
        turnDeadlineHours: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.match.count({ where }),
  ]);
  res.json({ matches, meta: buildApiMeta({ total, limit, offset }) });
});

export default router;
