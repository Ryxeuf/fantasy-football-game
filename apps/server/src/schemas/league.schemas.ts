/**
 * L.3 — Zod schemas for league API routes.
 *
 * Sprint 17 — infrastructure competitive : ligues.
 * Garde les routes /leagues alignees avec le service `services/league.ts`.
 */

import { z } from "zod";

const rosterSlug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/i, "slug de roster invalide");

export const createLeagueSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom de la ligue est requis")
    .max(100, "Le nom de la ligue ne peut pas depasser 100 caracteres"),
  description: z.string().max(500).optional().nullable(),
  ruleset: z.enum(["season_2", "season_3"]).optional(),
  isPublic: z.boolean().optional(),
  maxParticipants: z.number().int().min(2).max(128).optional(),
  allowedRosters: z.array(rosterSlug).max(64).optional().nullable(),
  winPoints: z.number().int().min(0).max(10).optional(),
  drawPoints: z.number().int().min(0).max(10).optional(),
  lossPoints: z.number().int().min(-10).max(10).optional(),
  forfeitPoints: z.number().int().min(-10).max(10).optional(),
});

export const createSeasonSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom de la saison est requis")
    .max(100, "Le nom de la saison ne peut pas depasser 100 caracteres"),
  seasonNumber: z.number().int().min(1).optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
});

export const joinSeasonSchema = z.object({
  teamId: z.string().min(1, "teamId requis"),
});

export const createRoundSchema = z.object({
  roundNumber: z.number().int().min(1, "Numero de journee >= 1"),
  name: z.string().trim().min(1).max(100).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
});

export const attachMatchSchema = z.object({
  matchId: z.string().min(1, "matchId requis"),
});

export const listLeaguesQuerySchema = z.object({
  creatorId: z.string().optional(),
  status: z
    .enum(["draft", "open", "in_progress", "completed", "archived"])
    .optional(),
  publicOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  // S25.6 — pagination obligatoire pour limiter le coût mémoire serveur.
  // Plafond limit=100 pour éviter qu'un client demande l'intégralité de
  // la table en un seul appel quand la base scale.
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type CreateLeagueBody = z.infer<typeof createLeagueSchema>;
export type CreateSeasonBody = z.infer<typeof createSeasonSchema>;
export type JoinSeasonBody = z.infer<typeof joinSeasonSchema>;
export type CreateRoundBody = z.infer<typeof createRoundSchema>;
export type ListLeaguesQuery = z.infer<typeof listLeaguesQuerySchema>;
export type AttachMatchBody = z.infer<typeof attachMatchSchema>;
