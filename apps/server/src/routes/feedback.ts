import { Router, Request, Response } from "express";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate, validateQuery } from "../middleware/validate";
import { feedbackRateLimiter } from "../middleware/rateLimiter";
import {
  createFeedbackSchema,
  updateFeedbackStatusSchema,
  listFeedbackQuerySchema,
  USER_AGENT_MAX,
  type CreateFeedbackInput,
  type ListFeedbackQuery,
  type UpdateFeedbackStatusInput,
} from "../schemas/feedback.schemas";
import { verifyTurnstileToken } from "../services/turnstile";
import { serverLog } from "../utils/server-log";

/**
 * Tronque proprement une valeur header avant insertion en DB. Les
 * navigateurs envoient des UA <300 caracteres ; au-dela d'une limite
 * raisonnable on coupe pour eviter qu'un client malveillant pollue la
 * table.
 */
function truncate(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

export async function handleCreateFeedback(req: Request, res: Response) {
  const data: CreateFeedbackInput = req.body;

  const captchaResult = await verifyTurnstileToken(
    data.captchaToken,
    req.ip,
  );
  if (!captchaResult.ok) {
    serverLog.warn(
      `[feedback] captcha rejected: ${captchaResult.errorCode}`,
    );
    return res.status(400).json({
      error: "Echec de la verification captcha. Veuillez reessayer.",
    });
  }

  const userAgent = truncate(req.get("user-agent") ?? undefined, USER_AGENT_MAX);

  try {
    const created = await prisma.feedback.create({
      data: {
        type: data.type,
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
        pageUrl: data.pageUrl,
        userAgent,
      },
      select: { id: true },
    });
    return res.status(201).json({ ok: true, id: created.id });
  } catch (err) {
    serverLog.error(
      "[feedback] create failed:",
      err instanceof Error ? err.message : String(err),
    );
    return res
      .status(500)
      .json({ error: "Erreur serveur lors de l'enregistrement du retour." });
  }
}

export async function handleListFeedback(req: Request, res: Response) {
  const query = req.query as unknown as ListFeedbackQuery;
  const { status, type, search, page, limit } = query;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) {
    // `mode: "insensitive"` est specifique a Postgres et fait planter le
    // mirror SQLite utilise en tests. On reste sur un `contains` basique :
    // Postgres applique sa collation par defaut, SQLite matche brut.
    where.OR = [
      { subject: { contains: search } },
      { message: { contains: search } },
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  try {
    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.feedback.count({ where }),
    ]);

    return res.status(200).json({
      feedbacks,
      total,
      page,
      limit,
    });
  } catch (err) {
    serverLog.error(
      "[feedback] list failed:",
      err instanceof Error ? err.message : String(err),
    );
    return res
      .status(500)
      .json({ error: "Erreur serveur lors du chargement des retours." });
  }
}

export async function handleGetFeedback(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const feedback = await prisma.feedback.findUnique({ where: { id } });
    if (!feedback) {
      return res.status(404).json({ error: "Feedback introuvable." });
    }
    return res.status(200).json({ feedback });
  } catch (err) {
    serverLog.error(
      "[feedback] get failed:",
      err instanceof Error ? err.message : String(err),
    );
    return res
      .status(500)
      .json({ error: "Erreur serveur lors du chargement du retour." });
  }
}

export async function handleUpdateFeedbackStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status }: UpdateFeedbackStatusInput = req.body;

  try {
    const feedback = await prisma.feedback.update({
      where: { id },
      data: { status },
    });
    return res.status(200).json({ feedback });
  } catch (err) {
    // Prisma renvoie P2025 quand l'enregistrement n'existe pas.
    const code = (err as { code?: string }).code;
    if (code === "P2025") {
      return res.status(404).json({ error: "Feedback introuvable." });
    }
    serverLog.error(
      "[feedback] update failed:",
      err instanceof Error ? err.message : String(err),
    );
    return res
      .status(500)
      .json({ error: "Erreur serveur lors de la mise a jour." });
  }
}

// Router public : la route est exposee sans auth, donc elle DOIT cumuler
// captcha + rate-limit. On expose un router complet pour que `index.ts`
// reste cohirent avec les autres modules.
export const feedbackPublicRouter = Router();
feedbackPublicRouter.post(
  "/",
  feedbackRateLimiter,
  validate(createFeedbackSchema),
  handleCreateFeedback,
);

// Router admin : monter sous /admin/feedback. authUser + adminOnly garantit
// qu'aucune fuite des feedbacks ne soit accessible publiquement.
export const feedbackAdminRouter = Router();
feedbackAdminRouter.use(authUser, adminOnly);
feedbackAdminRouter.get(
  "/",
  validateQuery(listFeedbackQuerySchema),
  handleListFeedback,
);
feedbackAdminRouter.get("/:id", handleGetFeedback);
feedbackAdminRouter.patch(
  "/:id",
  validate(updateFeedbackStatusSchema),
  handleUpdateFeedbackStatus,
);
