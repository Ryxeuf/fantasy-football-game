/**
 * Clés API d'administration (change OpenSpec `admin-api-keys`, doc
 * `docs/admin-api-keys.md`).
 *
 * Endpoints (montés sur `/admin/api-keys`) :
 *  - GET  /                — toutes les clés, sans secret ni empreinte
 *  - POST /                — crée une clé pour l'admin courant ; le secret
 *                            n'est renvoyé qu'ICI
 *  - POST /:id/revoke      — révoque une clé (idempotent)
 *
 * Réservé à une session INTERACTIVE (`sessionOnly`) : une clé ne liste, ne
 * crée ni ne révoque de clé — une clé fuitée ne peut pas se perpétuer en
 * en fabriquant une autre.
 */
import { Router } from "express";

import { prisma } from "../prisma";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { sessionOnly } from "../middleware/sessionOnly";
import { validate, validateParams } from "../middleware/validate";
import {
  createApiKeySchema,
  type CreateApiKeyInput,
} from "../schemas/api-key.schemas";
import { idParamSchema } from "../schemas/common.schemas";
import {
  ApiKeyError,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "../services/api-keys";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { serverLog } from "../utils/server-log";

const router = Router();

router.use(authUser, adminOnly, sessionOnly);

router.get("/", async (_req, res) => {
  try {
    res.json({ keys: await listApiKeys() });
  } catch (err) {
    serverLog.error("[admin-api-keys] liste impossible", err);
    res.status(500).json({ error: "Erreur lors de la lecture des clés API" });
  }
});

router.post(
  "/",
  validate(createApiKeySchema),
  async (req: AuthenticatedRequest, res) => {
    const body: CreateApiKeyInput = req.body;
    try {
      const { key, secret } = await createApiKey({
        userId: req.user!.id,
        name: body.name,
        scope: body.scope,
        expiresInDays: body.expiresInDays,
      });
      // Jamais le secret dans le journal : le préfixe suffit à reconnaître
      // la clé.
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "api-key.create",
        entity: "ApiKey",
        entityId: key.id,
        newValue: {
          name: key.name,
          keyPrefix: key.keyPrefix,
          scope: key.scope,
          expiresAt: key.expiresAt,
        },
      });
      res.setHeader("Cache-Control", "no-store");
      res.status(201).json({ key, secret });
    } catch (err) {
      serverLog.error("[admin-api-keys] création impossible", err);
      res.status(500).json({ error: "Erreur lors de la création de la clé API" });
    }
  },
);

router.post(
  "/:id/revoke",
  validateParams(idParamSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { key, alreadyRevoked } = await revokeApiKey({
        id: req.params.id,
        revokedById: req.user!.id,
      });
      if (!alreadyRevoked) {
        await safeRecordAdminActionFromRequest(prisma, req, {
          action: "api-key.revoke",
          entity: "ApiKey",
          entityId: key.id,
          oldValue: { name: key.name, keyPrefix: key.keyPrefix, scope: key.scope },
        });
      }
      res.json({ key, alreadyRevoked });
    } catch (err) {
      if (err instanceof ApiKeyError) {
        return res.status(404).json({ error: err.message, code: err.code });
      }
      serverLog.error("[admin-api-keys] révocation impossible", err);
      res.status(500).json({ error: "Erreur lors de la révocation de la clé API" });
    }
  },
);

export default router;
