import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  coachName: z.string().min(1, "Nom de coach requis").max(50),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date de naissance invalide (format YYYY-MM-DD)")
    .optional()
    .nullable(),
});

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

/**
 * Snowflake Discord : 17 à 20 chiffres (cf. https://discord.com/developers/docs/reference#snowflakes).
 * Chaîne vide acceptée et traitée comme un effacement (null) côté route.
 */
const discordUserIdSchema = z
  .string()
  .regex(/^\d{17,20}$/, "Discord ID invalide (17 à 20 chiffres)")
  .or(z.literal(""))
  .optional()
  .nullable();

export const updateProfileSchema = z.object({
  email: z.string().email("Email invalide").optional(),
  coachName: z.string().min(1, "Nom de coach requis").max(50).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional().nullable(),
  discordUserId: discordUserIdSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères"),
});
