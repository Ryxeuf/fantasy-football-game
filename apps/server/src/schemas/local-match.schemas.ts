import { z } from "zod";

// ── Query schemas ──

export const localMatchListQuerySchema = z.object({
  status: z.string().max(50).optional(),
  cupId: z.string().optional(),
  all: z.enum(["true", "false"]).optional(),
  scope: z.enum(["mine", "mine_and_public"]).optional(),
});

// ── Body schemas ──

export const createLocalMatchSchema = z.object({
  name: z.string().max(200).optional(),
  teamAId: z.string().min(1, "teamAId est requis"),
  teamBId: z.string().optional().nullable(),
  cupId: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
});

export const updateLocalMatchStateSchema = z.object({
  gameState: z.any().refine(
    (val) => val !== undefined && val !== null,
    { message: "gameState est requis" },
  ),
  scoreTeamA: z.number().int().optional(),
  scoreTeamB: z.number().int().optional(),
});

export const completeLocalMatchSchema = z.object({
  scoreTeamA: z.number({ message: "scoreTeamA est requis" }).int(),
  scoreTeamB: z.number({ message: "scoreTeamB est requis" }).int(),
});

const validLocalMatchStatuses = [
  "pending",
  "waiting_for_player",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const updateLocalMatchStatusSchema = z.object({
  status: z.enum(validLocalMatchStatuses, {
    message: "Le statut est requis",
  }),
});

const validActionTypes = [
  "passe",
  "reception",
  "td",
  "blocage",
  "blitz",
  "transmission",
  "aggression",
  "sprint",
  "esquive",
  "apothicaire",
  "interception",
] as const;

const validTeamSides = ["A", "B"] as const;
const validOpponentStates = ["sonne", "ko", "elimine"] as const;
const validPassTypes = ["rapide", "courte", "longue", "longue_bombe"] as const;

export const createLocalMatchActionSchema = z.object({
  half: z.number().int().min(1, "La mi-temps doit etre 1 ou 2").max(2, "La mi-temps doit etre 1 ou 2"),
  turn: z.number().int().min(1, "Le tour doit etre entre 1 et 8").max(8, "Le tour doit etre entre 1 et 8"),
  actionType: z.enum(validActionTypes, { message: "actionType requis" }),
  playerId: z.string().min(1, "playerId requis"),
  playerName: z.string().min(1, "playerName requis"),
  playerTeam: z.enum(validTeamSides, { message: "playerTeam doit etre A ou B" }),
  opponentId: z.string().optional().nullable(),
  opponentName: z.string().optional().nullable(),
  diceResult: z.number().int().min(1).optional().nullable(),
  fumble: z.boolean().optional(),
  armorBroken: z.boolean().optional(),
  opponentState: z.enum(validOpponentStates).optional().nullable(),
  passType: z.enum(validPassTypes).optional().nullable(),
  playerState: z.enum(validOpponentStates).optional().nullable(),
});

export const validateShareTokenSchema = z.object({
  teamBId: z.string().optional().nullable(),
});

export const localMatchInducementsSchema = z.object({
  selectionA: z
    .object({ items: z.array(z.any()) })
    .optional()
    .nullable(),
  selectionB: z
    .object({ items: z.array(z.any()) })
    .optional()
    .nullable(),
});

// N.4 — Mode pratique contre IA.
const aiDifficultyValues = ["easy", "medium", "hard"] as const;

export const createPracticeMatchSchema = z.object({
  userTeamId: z.string().min(1, "userTeamId est requis"),
  difficulty: z.enum(aiDifficultyValues, {
    message: "difficulty doit etre easy, medium ou hard",
  }),
  aiRosterSlug: z.string().optional(),
  userSide: z.enum(["A", "B"]).optional(),
  seed: z.string().max(200).optional(),
});

export const aiNextMoveSchema = z.object({
  // gameState optionnel : par defaut on lit celui stocke en base.
  gameState: z.any().optional(),
  // Seed optionnelle pour la reproductibilite (tests).
  seed: z.string().max(200).optional(),
});
