/**
 * S26 DoD — Routes de telemetrie tutoriel.
 *
 * - `POST /tutorial/lessons/:slug/complete` (auth) : enregistre la fin
 *   d'une lecon (idempotent, upsert via `recordTutorialCompletion`).
 * - `GET /admin/tutorial/completion-rate` (auth + admin) : KPI sprint
 *   26 ("80% des nouveaux comptes finissent au moins une lecon").
 */

import { Router } from "express";
import { z } from "zod";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validateQuery } from "../middleware/validate";
import {
  recordTutorialCompletion,
  getTutorialCompletionRate,
} from "../services/tutorial-completion";
import { serverLog } from "../utils/server-log";

const completionRateQuerySchema = z.object({
  /** Optionnel : nombre de jours pour cibler une cohorte recente. */
  days: z
    .string()
    .regex(/^\d+$/, "days doit etre un entier positif")
    .transform((v) => parseInt(v, 10))
    .refine((n) => n >= 1 && n <= 3650, "days hors bornes [1, 3650]")
    .optional(),
});

const lessonSlugSchema = z
  .string()
  .min(1, "lessonSlug requis")
  .max(64, "lessonSlug trop long")
  .regex(
    /^[a-z0-9][a-z0-9-]{0,63}$/i,
    "lessonSlug doit etre alphanumerique (et tirets)",
  );

export const tutorialRouter = Router();

tutorialRouter.post(
  "/lessons/:slug/complete",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    const parsed = lessonSlugSchema.safeParse(req.params.slug);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", "),
      });
    }
    try {
      const r = await recordTutorialCompletion(req.user!.id, parsed.data);
      return res.status(200).json({
        success: true,
        data: {
          lessonSlug: r.lessonSlug,
          completedAt: r.completedAt,
        },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur serveur";
      serverLog.error(
        `[POST /tutorial/lessons/${parsed.data}/complete] error:`,
        message,
      );
      return res.status(500).json({ success: false, error: message });
    }
  },
);

export const adminTutorialRouter = Router();

adminTutorialRouter.use(authUser, adminOnly);

adminTutorialRouter.get(
  "/completion-rate",
  validateQuery(completionRateQuerySchema),
  async (req, res) => {
    try {
      const { days } = req.query as { days?: number };
      const since = days
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        : undefined;
      const rate = await getTutorialCompletionRate(
        since ? { since } : undefined,
      );
      return res.status(200).json({
        success: true,
        data: {
          eligibleUsers: rate.eligibleUsers,
          usersCompletedAtLeastOne: rate.usersCompletedAtLeastOne,
          ratio: rate.ratio,
          ratioPercent: Math.round(rate.ratio * 1000) / 10,
          since: since ? since.toISOString() : null,
        },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur serveur";
      serverLog.error("[GET /admin/tutorial/completion-rate] error:", message);
      return res.status(500).json({ success: false, error: message });
    }
  },
);
