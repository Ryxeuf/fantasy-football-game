import { Router } from "express";
import {
  authUser,
  optionalAuthUser,
  AuthenticatedRequest,
} from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate } from "../middleware/validate";
import {
  createFeatureFlagSchema,
  updateFeatureFlagSchema,
  addFeatureFlagUserSchema,
} from "../schemas/featureFlag.schemas";
import { prisma } from "../prisma";
import {
  listAll,
  listEnabledKeysForUser,
  findById,
  createFlag,
  updateFlag,
  deleteFlag,
  listUsersForFlag,
  addUserOverride,
  removeUserOverride,
  syncFlagsFromCode,
} from "../services/featureFlags";
import { sendSuccess, sendError } from "../utils/api-response";
import { serverLog } from "../utils/server-log";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur serveur";
}

// ---------------------------------------------------------------------------
// Routeur utilisateur : /api/feature-flags
// ---------------------------------------------------------------------------

export const userFeatureFlagsRouter = Router();

// Note: /me accepte les visiteurs anonymes (auth optionnelle partagée :
// token de session OU clé API d'administration). Les pages publiques (ex.
// /leaderboard) sont gatées par <OnlinePlayGate> et doivent pouvoir
// récupérer les flags globalement activés sans token. Avec un token
// valide, on retourne en plus les overrides utilisateur.
userFeatureFlagsRouter.get(
  "/me",
  optionalAuthUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const keys = await listEnabledKeysForUser(req.user?.id, {
        roles: req.user?.roles,
      });
      return sendSuccess(res, keys);
    } catch (error: unknown) {
      serverLog.error("[featureFlags] /me error:", error);
      return sendError(res, errorMessage(error));
    }
  },
);

// ---------------------------------------------------------------------------
// Routeur admin : /api/admin/feature-flags
// ---------------------------------------------------------------------------

export const adminFeatureFlagsRouter = Router();

adminFeatureFlagsRouter.use(authUser, adminOnly);

adminFeatureFlagsRouter.get("/", async (_req, res) => {
  try {
    const flags = await listAll();
    return sendSuccess(res, flags);
  } catch (error: unknown) {
    serverLog.error("[featureFlags] GET / error:", error);
    return sendError(res, errorMessage(error));
  }
});

// Synchronise la BDD avec les flags déclarés dans le code (KNOWN_FLAGS) :
// crée les flags manquants (enabled: false), laisse les existants intacts.
// Doit être déclaré avant les routes paramétrées pour éviter toute
// ambiguïté de matching.
adminFeatureFlagsRouter.post("/sync", async (_req, res) => {
  try {
    const result = await syncFlagsFromCode();
    return sendSuccess(res, result);
  } catch (error: unknown) {
    serverLog.error("[featureFlags] POST /sync error:", error);
    return sendError(res, errorMessage(error));
  }
});

adminFeatureFlagsRouter.post(
  "/",
  validate(createFeatureFlagSchema),
  async (req, res) => {
    try {
      const { key, description, enabled }: {
        key: string;
        description?: string | null;
        enabled?: boolean;
      } = req.body;
      const existing = await prisma.featureFlag.findUnique({ where: { key } });
      if (existing) {
        return sendError(res, "Une flag avec cette clé existe déjà", 409);
      }
      const flag = await createFlag({ key, description, enabled });
      return sendSuccess(res, flag, 201);
    } catch (error: unknown) {
      serverLog.error("[featureFlags] POST / error:", error);
      return sendError(res, errorMessage(error));
    }
  },
);

adminFeatureFlagsRouter.patch(
  "/:id",
  validate(updateFeatureFlagSchema),
  async (req, res) => {
    try {
      const existing = await findById(req.params.id);
      if (!existing) {
        return sendError(res, "Feature flag introuvable", 404);
      }
      const flag = await updateFlag(req.params.id, req.body);
      return sendSuccess(res, flag);
    } catch (error: unknown) {
      serverLog.error("[featureFlags] PATCH /:id error:", error);
      return sendError(res, errorMessage(error));
    }
  },
);

adminFeatureFlagsRouter.delete("/:id", async (req, res) => {
  try {
    const existing = await findById(req.params.id);
    if (!existing) {
      return sendError(res, "Feature flag introuvable", 404);
    }
    await deleteFlag(req.params.id);
    return sendSuccess(res, { id: req.params.id });
  } catch (error: unknown) {
    serverLog.error("[featureFlags] DELETE /:id error:", error);
    return sendError(res, errorMessage(error));
  }
});

adminFeatureFlagsRouter.get("/:id/users", async (req, res) => {
  try {
    const existing = await findById(req.params.id);
    if (!existing) {
      return sendError(res, "Feature flag introuvable", 404);
    }
    const users = await listUsersForFlag(req.params.id);
    return sendSuccess(res, users);
  } catch (error: unknown) {
    serverLog.error("[featureFlags] GET /:id/users error:", error);
    return sendError(res, errorMessage(error));
  }
});

adminFeatureFlagsRouter.post(
  "/:id/users",
  validate(addFeatureFlagUserSchema),
  async (req, res) => {
    try {
      const flag = await findById(req.params.id);
      if (!flag) {
        return sendError(res, "Feature flag introuvable", 404);
      }
      const { userId }: { userId: string } = req.body;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return sendError(res, "Utilisateur introuvable", 404);
      }
      await addUserOverride(req.params.id, userId);
      return sendSuccess(res, { userId }, 201);
    } catch (error: unknown) {
      serverLog.error("[featureFlags] POST /:id/users error:", error);
      return sendError(res, errorMessage(error));
    }
  },
);

adminFeatureFlagsRouter.delete("/:id/users/:userId", async (req, res) => {
  try {
    const flag = await findById(req.params.id);
    if (!flag) {
      return sendError(res, "Feature flag introuvable", 404);
    }
    await removeUserOverride(req.params.id, req.params.userId);
    return sendSuccess(res, { userId: req.params.userId });
  } catch (error: unknown) {
    serverLog.error("[featureFlags] DELETE /:id/users/:userId error:", error);
    return sendError(res, errorMessage(error));
  }
});
