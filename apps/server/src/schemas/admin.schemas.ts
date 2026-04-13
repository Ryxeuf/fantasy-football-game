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
