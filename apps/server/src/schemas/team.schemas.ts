import { z } from "zod";

export const createFromRosterSchema = z.object({
  name: z.string().min(1, "name et roster requis").max(100),
  roster: z.string().min(1, "name et roster requis"),
  teamValue: z.number().min(100, "La valeur d'équipe doit être entre 100 et 2000k po").max(2000, "La valeur d'équipe doit être entre 100 et 2000k po").optional(),
  starPlayers: z.array(z.string()).optional(),
  ruleset: z.string().optional(),
});

export const buildTeamSchema = z.object({
  name: z.string().min(1, "name, roster, choices requis").max(100),
  roster: z.string().min(1, "name, roster, choices requis"),
  teamValue: z.number().min(100, "La valeur d'équipe doit être entre 100 et 2000k po").max(2000, "La valeur d'équipe doit être entre 100 et 2000k po").optional(),
  choices: z.array(
    z.object({
      key: z.string(),
      count: z.number(),
    }),
  ),
  starPlayers: z.array(z.string()).optional(),
  ruleset: z.string().optional(),
  rerolls: z.number().int().min(0, "Le nombre de relances doit être entre 0 et 8").max(8, "Le nombre de relances doit être entre 0 et 8").optional(),
  cheerleaders: z.number().int().min(0, "Le nombre de cheerleaders doit être entre 0 et 12").max(12, "Le nombre de cheerleaders doit être entre 0 et 12").optional(),
  assistants: z.number().int().min(0, "Le nombre d'assistants doit être entre 0 et 6").max(6, "Le nombre d'assistants doit être entre 0 et 6").optional(),
  apothecary: z.boolean().optional(),
  dedicatedFans: z.number().int().min(1, "Le nombre de fans dévoués doit être entre 1 et 6").max(6, "Le nombre de fans dévoués doit être entre 1 et 6").optional(),
});

const playerUpdateItem = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Tous les joueurs doivent avoir un nom"),
  number: z.number().int().min(1, "Les numéros doivent être des entiers entre 1 et 99").max(99, "Les numéros doivent être des entiers entre 1 et 99"),
});

export const updateTeamSchema = z.object({
  players: z.array(playerUpdateItem).min(1, "players requis (array)"),
  name: z.string().min(1, "Le nom de l'équipe ne peut pas être vide").max(100, "Le nom de l'équipe ne peut pas dépasser 100 caractères").optional(),
});

export const updateTeamInfoSchema = z.object({
  rerolls: z.number().int().min(0, "Le nombre de relances doit être entre 0 et 8").max(8, "Le nombre de relances doit être entre 0 et 8").optional(),
  cheerleaders: z.number().int().min(0, "Le nombre de cheerleaders doit être entre 0 et 12").max(12, "Le nombre de cheerleaders doit être entre 0 et 12").optional(),
  assistants: z.number().int().min(0, "Le nombre d'assistants doit être entre 0 et 6").max(6, "Le nombre d'assistants doit être entre 0 et 6").optional(),
  apothecary: z.boolean().optional(),
  dedicatedFans: z.number().int().min(1, "Le nombre de fans dévoués doit être entre 1 et 6").max(6, "Le nombre de fans dévoués doit être entre 1 et 6").optional(),
});

export const purchaseSchema = z.object({
  type: z.enum([
    "player",
    "reroll",
    "cheerleader",
    "assistant",
    "apothecary",
    "dedicated_fan",
  ]),
  // Required when type is "player"
  position: z.string().optional(),
  name: z.string().max(100).optional(),
  number: z.number().int().min(1).max(99).optional(),
});

export const addPlayerSchema = z.object({
  position: z.string().min(1, "position requis"),
  name: z.string().min(1, "name requis").max(100),
  number: z.number().int().min(1, "Le numero doit etre entre 1 et 99").max(99, "Le numero doit etre entre 1 et 99"),
});

const validAdvancementTypes = ["primary", "secondary", "random-primary", "random-secondary"] as const;

export const updatePlayerSkillsSchema = z.object({
  skillSlug: z.string().optional(),
  advancementType: z.enum(validAdvancementTypes, { message: "advancementType est requis" }),
  skillCategory: z.string().optional(),
});

export const addStarPlayerToTeamSchema = z.object({
  starPlayerSlug: z.string().min(1, "starPlayerSlug requis"),
});
