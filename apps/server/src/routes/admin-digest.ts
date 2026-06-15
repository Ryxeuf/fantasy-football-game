/**
 * Réengagement — Phase B : déclenchement manuel du digest e-mail
 * hebdomadaire (admin), pour tester/relancer sans attendre le cron.
 *
 *  - POST /admin/digest/run
 *      Body optionnel : { force?: boolean }
 *      `force=true` ignore la fenêtre d'idempotence (windowMs=0) pour
 *      ré-envoyer immédiatement (utile en QA prod).
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate } from "../middleware/validate";
import { runDigestSchema } from "../schemas/admin-digest.schemas";
import { serverLog } from "../utils/server-log";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { runWeeklyDigest } from "../services/weekly-digest-job";

const router = Router();

router.use(authUser, adminOnly);

router.post("/run", validate(runDigestSchema), async (req, res) => {
  const start = Date.now();
  const force = (req.body as { force?: boolean })?.force === true;
  try {
    const result = await runWeeklyDigest(force ? { windowMs: 0 } : {});
    const durationMs = Date.now() - start;

    await safeRecordAdminActionFromRequest(prisma, req, {
      action: "utility.digest.run",
      entity: "EmailDigestPreference",
      newValue: { ...result, force, durationMs },
    });

    res.json({
      ok: true,
      durationMs,
      ...result,
      message: `Digest exécuté : ${result.selected} destinataire(s), ${result.sent} envoyé(s), ${result.failed} échec(s).`,
    });
  } catch (e) {
    const durationMs = Date.now() - start;
    serverLog.error("[admin.digest.run] failed:", e);
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    res.status(500).json({ ok: false, error: message, durationMs });
  }
});

export default router;
