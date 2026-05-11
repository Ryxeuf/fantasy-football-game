import { z } from "zod";

// ── Query schemas ──

const sortOrderEnum = z.enum(["asc", "desc"]).default("desc");

export const adminUsersQuerySchema = z.object({
  search: z.string().max(200).default(""),
  role: z.string().max(50).default(""),
  sortBy: z.enum(["createdAt", "email", "name", "role"]).default("createdAt"),
  sortOrder: sortOrderEnum,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const adminMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  status: z
    .enum(["pending", "prematch", "prematch-setup", "active", "ended", "cancelled"])
    .optional(),
  search: z.string().max(200).default(""),
  sortBy: z.enum(["createdAt", "lastMoveAt", "status"]).default("createdAt"),
  sortOrder: sortOrderEnum,
  page: z.coerce.number().int().min(1).default(1),
});

export const adminTeamsQuerySchema = z.object({
  search: z.string().max(200).default(""),
  roster: z.string().max(100).default(""),
  ownerId: z.string().max(100).default(""),
  ruleset: z.string().max(50).optional(),
  sortBy: z.enum(["createdAt", "name", "roster", "currentValue"]).default("createdAt"),
  sortOrder: sortOrderEnum,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ── Body schemas ──

const allowedRoles = ["user", "admin", "moderator"] as const;

export const updateUserRoleSchema = z.object({
  role: z.enum(allowedRoles).optional(),
  roles: z.array(z.enum(allowedRoles)).optional(),
}).refine(
  (data) => data.role !== undefined || (data.roles !== undefined && data.roles.length > 0),
  { message: "role ou roles requis" },
);

export const updateUserPatreonSchema = z.object({
  patreon: z.boolean({ message: "Valeur Patreon invalide" }),
});

export const updateUserValidSchema = z.object({
  valid: z.boolean({ message: "Valeur valid invalide" }),
});

export const updateMatchStatusSchema = z.object({
  status: z.enum(
    ["pending", "prematch", "prematch-setup", "active", "ended", "cancelled"],
    { message: "Statut invalide" },
  ),
});

// ── Lot P.B.4 — moderation matchs humains + ban users ──

/** Forfait admin force sur un match en cours. `winnerSide` indique la cote
 * declaree gagnante. `reason` est obligatoire pour tracabilite audit log. */
export const adminMatchForfeitSchema = z.object({
  winnerSide: z.enum(["A", "B"], { message: "winnerSide doit etre 'A' ou 'B'" }),
  reason: z
    .string()
    .min(3, "raison trop courte (3 chars min)")
    .max(500, "raison trop longue (500 chars max)"),
});

/** Annulation admin (match toxique, bug, etc.). Raison obligatoire. */
export const adminMatchCancelSchema = z.object({
  reason: z
    .string()
    .min(3, "raison trop courte (3 chars min)")
    .max(500, "raison trop longue (500 chars max)"),
});

/** Bannissement temporaire (durationDays > 0) ou permanent (omis ou 0).
 *  Raison obligatoire pour tracabilite (visible audit log uniquement). */
export const adminUserBanSchema = z.object({
  reason: z
    .string()
    .min(3, "raison trop courte (3 chars min)")
    .max(500, "raison trop longue (500 chars max)"),
  /** Duree en jours. Omis ou 0 = ban permanent (annee 9999). Max 3650 (~10 ans). */
  durationDays: z.number().int().min(0).max(3650).optional(),
});
