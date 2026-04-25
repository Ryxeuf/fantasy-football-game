import { Router } from "express";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
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
} from "../services/featureFlags";
import { sendSuccess, sendError } from "../utils/api-response";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur serveur";
}

// ---------------------------------------------------------------------------
// Routeur utilisateur : /api/feature-flags
// ---------------------------------------------------------------------------

export const userFeatureFlagsRouter = Router();

userFeatureFlagsRouter.use(authUser);

userFeatureFlagsRouter.get("/me", async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) {
    return sendError(res, "Non authentifié", 401);
  }
  try {
    const keys = await listEnabledKeysForUser(req.user.id, {
      roles: req.user.roles,
    });
    return sendSuccess(res, keys);
  } catch (error: unknown) {
    console.error("[featureFlags] /me error:", error);
    return sendError(res, errorMessage(error));
  }
});

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
    console.error("[featureFlags] GET / error:", error);
    return sendError(res, errorMessage(error));
  }
});

adminFeatureFlagsRouter.post(
  "/",
  validate(createFeatureFlagSchema),
  async (req, res) => {
    try {
      const { key, description, enabled } = req.body as {
        key: string;
        description?: string | null;
        enabled?: boolean;
      };
      const existing = await prisma.featureFlag.findUnique({ where: { key } });
      if (existing) {
        return sendError(res, "Une flag avec cette clé existe déjà", 409);
      }
      const flag = await createFlag({ key, description, enabled });
      return sendSuccess(res, flag, 201);
    } catch (error: unknown) {
      console.error("[featureFlags] POST / error:", error);
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
      console.error("[featureFlags] PATCH /:id error:", error);
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
    console.error("[featureFlags] DELETE /:id error:", error);
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
    console.error("[featureFlags] GET /:id/users error:", error);
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
      const { userId } = req.body as { userId: string };
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return sendError(res, "Utilisateur introuvable", 404);
      }
      await addUserOverride(req.params.id, userId);
      return sendSuccess(res, { userId }, 201);
    } catch (error: unknown) {
      console.error("[featureFlags] POST /:id/users error:", error);
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
    console.error("[featureFlags] DELETE /:id/users/:userId error:", error);
    return sendError(res, errorMessage(error));
  }
});
