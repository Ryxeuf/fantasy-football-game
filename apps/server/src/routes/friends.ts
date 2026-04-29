import { Router } from "express";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { validate, validateQuery } from "../middleware/validate";
import {
  sendFriendRequestSchema,
  respondFriendRequestSchema,
  listFriendshipsQuerySchema,
} from "../schemas/friendship.schemas";
import {
  sendFriendRequest,
  respondToFriendRequest,
  listFriendships,
  removeFriendship,
  FriendshipStatus,
} from "../services/friendship";
import { findUserByCoachName } from "../services/user-lookup";

const router = Router();

function errorToStatus(message: string): number {
  if (/introuvable|not found/i.test(message)) return 404;
  if (/autorise|unauthorized/i.test(message)) return 403;
  if (/existe|soi-meme|pending|attente/i.test(message)) return 409;
  return 400;
}

/**
 * S26.4b — Resout `username` (pseudo coach, eventuellement prefixe @)
 * en userId via `findUserByCoachName`. Throw une Error "introuvable"
 * (mappee 404 par `errorToStatus`) si le pseudo n'existe pas ou si le
 * coach est en mode prive (S26.3i).
 */
export async function resolveReceiverIdFromBody(body: {
  receiverId?: string;
  username?: string;
}): Promise<string> {
  if (body.receiverId) return body.receiverId;
  const username = body.username ?? "";
  const lookup = await findUserByCoachName(username);
  if (!lookup) {
    throw new Error("Coach introuvable");
  }
  return lookup.id;
}

/**
 * GET /friends
 * Liste les relations (demandes recues/envoyees/acceptees/refusees) de l'utilisateur.
 * Query optional: ?status=pending|accepted|declined|blocked
 */
router.get(
  "/",
  authUser,
  validateQuery(listFriendshipsQuerySchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const status = (req.query as { status?: string }).status;
      const rows = await listFriendships(req.user!.id, status as FriendshipStatus | undefined);
      return res.json({ success: true, data: rows });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur serveur";
      return res.status(500).json({ success: false, error: message });
    }
  },
);

/**
 * POST /friends
 * Envoie une demande d'ami.
 * Body: { receiverId: string }
 */
router.post(
  "/",
  authUser,
  validate(sendFriendRequestSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body as { receiverId?: string; username?: string };
      const receiverId = await resolveReceiverIdFromBody(body);
      const friendship = await sendFriendRequest(req.user!.id, receiverId);
      return res.status(201).json({ success: true, data: friendship });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur serveur";
      return res
        .status(errorToStatus(message))
        .json({ success: false, error: message });
    }
  },
);

/**
 * POST /friends/:id/respond
 * Accepte ou refuse une demande d'ami adressee a l'utilisateur courant.
 * Body: { action: "accept" | "decline" }
 */
router.post(
  "/:id/respond",
  authUser,
  validate(respondFriendRequestSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { action } = req.body as { action: "accept" | "decline" };
      const friendship = await respondToFriendRequest(
        req.params.id,
        req.user!.id,
        action,
      );
      return res.json({ success: true, data: friendship });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur serveur";
      return res
        .status(errorToStatus(message))
        .json({ success: false, error: message });
    }
  },
);

/**
 * DELETE /friends/:id
 * Supprime une relation d'amitie (dans n'importe quel status).
 * L'appelant doit etre requester ou receiver.
 */
router.delete("/:id", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    await removeFriendship(req.params.id, req.user!.id);
    return res.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return res
      .status(errorToStatus(message))
      .json({ success: false, error: message });
  }
});

export default router;
