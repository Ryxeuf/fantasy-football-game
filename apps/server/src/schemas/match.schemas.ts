import { z } from "zod";

export const joinMatchSchema = z.object({
  matchId: z.string().min(1, "matchId requis"),
});

export const acceptMatchSchema = z.object({
  matchId: z.string().min(1, "matchId requis"),
});

export const moveSchema = z.object({
  move: z
    .object({
      type: z.string().min(1, "move requis avec un type valide"),
    })
    .passthrough(),
});

export const chooseTeamSchema = z.object({
  matchId: z.string().min(1, "matchId requis"),
  teamId: z.string().min(1, "teamId requis"),
});

export const createMatchSchema = z.object({
  terrainSkin: z.string().max(50).optional(),
  turnTimerEnabled: z.boolean().optional(),
  // N.2 — Mode simplifie pour debutants : leverager SIMPLIFIED_RULES.
  rulesMode: z.enum(['full', 'simplified']).optional(),
});

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const playerPositionSchema = z.object({
  playerId: z.string(),
  x: z.number(),
  y: z.number(),
});

export const validateSetupSchema = z.object({
  placedPlayers: z.array(z.any()),
  playerPositions: z.array(playerPositionSchema),
});

export const placeKickoffBallSchema = z.object({
  position: positionSchema,
});

// Practice vs AI — online match variant.
const aiDifficultyValues = ["easy", "medium", "hard"] as const;

export const createPracticeOnlineMatchSchema = z.object({
  userTeamId: z.string().min(1, "userTeamId est requis"),
  difficulty: z.enum(aiDifficultyValues, {
    message: "difficulty doit etre easy, medium ou hard",
  }),
  aiRosterSlug: z.string().optional(),
  userSide: z.enum(["A", "B"]).optional(),
  seed: z.string().max(200).optional(),
});
