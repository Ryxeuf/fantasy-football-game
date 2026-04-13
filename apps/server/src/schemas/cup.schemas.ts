import { z } from "zod";

const scoringConfigSchema = z.object({
  winPoints: z.number().optional(),
  drawPoints: z.number().optional(),
  lossPoints: z.number().optional(),
  forfeitPoints: z.number().optional(),
  touchdownPoints: z.number().optional(),
  blockCasualtyPoints: z.number().optional(),
  foulCasualtyPoints: z.number().optional(),
  passPoints: z.number().optional(),
});

export const createCupSchema = z.object({
  name: z
    .string()
    .min(1, "Le nom de la coupe est requis")
    .max(100, "Le nom de la coupe ne peut pas depasser 100 caracteres"),
  isPublic: z.boolean().optional().default(true),
  ruleset: z.string().max(50).optional(),
  scoringConfig: scoringConfigSchema.optional(),
  // Flat-level scoring fields (backwards compat)
  winPoints: z.number().optional(),
  drawPoints: z.number().optional(),
  lossPoints: z.number().optional(),
  forfeitPoints: z.number().optional(),
  touchdownPoints: z.number().optional(),
  blockCasualtyPoints: z.number().optional(),
  foulCasualtyPoints: z.number().optional(),
  passPoints: z.number().optional(),
});

export const registerCupSchema = z.object({
  teamId: z.string().min(1, "teamId requis"),
});

export const unregisterCupSchema = z.object({
  teamId: z.string().min(1, "teamId requis"),
  force: z.boolean().optional(),
});

const validCupStatuses = ["ouverte", "en_cours", "terminee", "archivee"] as const;

export const updateCupStatusSchema = z.object({
  status: z.enum(validCupStatuses, {
    message: "Statut invalide",
  }),
});
