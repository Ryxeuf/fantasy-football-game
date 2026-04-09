import { Router } from "express";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import {
  pushSubscribeSchema,
  pushUnsubscribeSchema,
} from "../schemas/push.schemas";
import {
  addSubscription,
  removeSubscription,
  getVapidPublicKey,
} from "../services/push-notifications";

const router = Router();

/**
 * GET /push/vapid-public-key
 * Returns the VAPID public key for client-side subscription.
 * No auth required — the key is public by design.
 */
router.get("/vapid-public-key", (_req, res) => {
  return res.json({ key: getVapidPublicKey() });
});

/**
 * POST /push/subscribe
 * Register a push subscription for the authenticated user.
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 */
router.post(
  "/subscribe",
  authUser,
  validate(pushSubscribeSchema),
  (req: AuthenticatedRequest, res) => {
    const { endpoint, keys } = req.body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    addSubscription(req.user!.id, { endpoint, keys });
    return res.json({ ok: true });
  },
);

/**
 * POST /push/unsubscribe
 * Remove a push subscription for the authenticated user.
 * Body: { endpoint: string }
 */
router.post(
  "/unsubscribe",
  authUser,
  validate(pushUnsubscribeSchema),
  (req: AuthenticatedRequest, res) => {
    const { endpoint } = req.body as { endpoint: string };
    const removed = removeSubscription(req.user!.id, endpoint);
    if (!removed) {
      return res.status(404).json({ error: "Abonnement non trouve" });
    }
    return res.json({ ok: true });
  },
);

export default router;
