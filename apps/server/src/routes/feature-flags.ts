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
    return res.status(401).json({ success: false, error: "Non authentifié" });
  }
  try {
    const keys = await listEnabledKeysForUser(req.user.id);
    return res.json({ success: true, data: keys });
  } catch (error: unknown) {
    console.error("[featureFlags] /me error:", error);
    return res
      .status(500)
      .json({ success: false, error: errorMessage(error) });
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
    return res.json({ success: true, data: flags });
  } catch (error: unknown) {
    console.error("[featureFlags] GET / error:", error);
    return res
      .status(500)
      .json({ success: false, error: errorMessage(error) });
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
        return res
          .status(409)
          .json({ success: false, error: "Une flag avec cette clé existe déjà" });
      }
      const flag = await createFlag({ key, description, enabled });
      return res.status(201).json({ success: true, data: flag });
    } catch (error: unknown) {
      console.error("[featureFlags] POST / error:", error);
      return res
        .status(500)
        .json({ success: false, error: errorMessage(error) });
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
        return res
          .status(404)
          .json({ success: false, error: "Feature flag introuvable" });
      }
      const flag = await updateFlag(req.params.id, req.body);
      return res.json({ success: true, data: flag });
    } catch (error: unknown) {
      console.error("[featureFlags] PATCH /:id error:", error);
      return res
        .status(500)
        .json({ success: false, error: errorMessage(error) });
    }
  },
);

adminFeatureFlagsRouter.delete("/:id", async (req, res) => {
  try {
    const existing = await findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Feature flag introuvable" });
    }
    await deleteFlag(req.params.id);
    return res.json({ success: true, data: { id: req.params.id } });
  } catch (error: unknown) {
    console.error("[featureFlags] DELETE /:id error:", error);
    return res
      .status(500)
      .json({ success: false, error: errorMessage(error) });
  }
});

adminFeatureFlagsRouter.get("/:id/users", async (req, res) => {
  try {
    const existing = await findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Feature flag introuvable" });
    }
    const users = await listUsersForFlag(req.params.id);
    return res.json({ success: true, data: users });
  } catch (error: unknown) {
    console.error("[featureFlags] GET /:id/users error:", error);
    return res
      .status(500)
      .json({ success: false, error: errorMessage(error) });
  }
});

adminFeatureFlagsRouter.post(
  "/:id/users",
  validate(addFeatureFlagUserSchema),
  async (req, res) => {
    try {
      const flag = await findById(req.params.id);
      if (!flag) {
        return res
          .status(404)
          .json({ success: false, error: "Feature flag introuvable" });
      }
      const { userId } = req.body as { userId: string };
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "Utilisateur introuvable" });
      }
      await addUserOverride(req.params.id, userId);
      return res.status(201).json({ success: true, data: { userId } });
    } catch (error: unknown) {
      console.error("[featureFlags] POST /:id/users error:", error);
      return res
        .status(500)
        .json({ success: false, error: errorMessage(error) });
    }
  },
);

adminFeatureFlagsRouter.delete("/:id/users/:userId", async (req, res) => {
  try {
    const flag = await findById(req.params.id);
    if (!flag) {
      return res
        .status(404)
        .json({ success: false, error: "Feature flag introuvable" });
    }
    await removeUserOverride(req.params.id, req.params.userId);
    return res.json({ success: true, data: { userId: req.params.userId } });
  } catch (error: unknown) {
    console.error("[featureFlags] DELETE /:id/users/:userId error:", error);
    return res
      .status(500)
      .json({ success: false, error: errorMessage(error) });
  }
});
