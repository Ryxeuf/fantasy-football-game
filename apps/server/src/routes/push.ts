import { Router } from "express";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import {
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  pushPreferencesSchema,
} from "../schemas/push.schemas";
import {
  addSubscription,
  removeSubscription,
  getVapidPublicKey,
} from "../services/push-notifications";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notification-preferences";

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

/**
 * GET /push/preferences
 * Returns notification preferences for the authenticated user.
 */
router.get(
  "/preferences",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const prefs = await getNotificationPreferences(req.user!.id);
      return res.json(prefs);
    } catch {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

/**
 * PUT /push/preferences
 * Update notification preferences for the authenticated user.
 * Body: { pushEnabled?: boolean, turnNotification?: boolean, matchFoundNotification?: boolean }
 */
router.put(
  "/preferences",
  authUser,
  validate(pushPreferencesSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const prefs = await updateNotificationPreferences(req.user!.id, req.body);
      return res.json(prefs);
    } catch {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

export default router;
