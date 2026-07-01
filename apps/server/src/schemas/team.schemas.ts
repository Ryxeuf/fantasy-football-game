import { z } from "zod";

export const createFromRosterSchema = z.object({
  name: z.string().min(1, "name et roster requis").max(100),
  roster: z.string().min(1, "name et roster requis"),
  teamValue: z.number().min(100, "La valeur d'équipe doit être entre 100 et 2000k po").max(2000, "La valeur d'équipe doit être entre 100 et 2000k po").optional(),
  starPlayers: z.array(z.string()).optional(),
  ruleset: z.string().optional(),
  format: z.enum(["bb11", "sevens"]).optional(),
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
  // Format de jeu. Les bornes ci-dessous restent celles du BB11 (superset) ;
  // les contraintes spécifiques au format (Sevens : ≤6 relances, etc.) sont
  // appliquées au runtime via validateFormatSelection (@bb/game-engine).
  format: z.enum(["bb11", "sevens"]).optional(),
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

// Sauvegarde batch du roster (page d'edition d'une equipe NON engagee).
// A la difference de `updateTeamSchema` (renommage seul), on accepte des
// joueurs SANS `id` (ajouts) et une liste qui differe du roster courant
// (suppressions implicites : tout joueur existant absent est retire). Le
// `position` est requis pour materialiser un nouveau joueur ; il est ignore
// pour les joueurs existants (leurs stats/position ne changent pas). La
// validation "comme a la creation" (bornes de format, min/max par poste,
// budget) est faite dans le handler.
const rosterSavePlayerItem = z.object({
  id: z.string().min(1).optional(),
  position: z.string().min(1, "position requise"),
  name: z.string().min(1, "Tous les joueurs doivent avoir un nom").max(100),
  number: z
    .number()
    .int()
    .min(1, "Les numéros doivent être des entiers entre 1 et 99")
    .max(99, "Les numéros doivent être des entiers entre 1 et 99"),
});

export const saveRosterSchema = z.object({
  name: z
    .string()
    .min(1, "Le nom de l'équipe ne peut pas être vide")
    .max(100, "Le nom de l'équipe ne peut pas dépasser 100 caractères")
    .optional(),
  // Borne haute = 16 (cap BB). La borne basse par format (11 / 7) est
  // verifiee dans le handler pour renvoyer un message clair.
  players: z
    .array(rosterSavePlayerItem)
    .min(1, "players requis (array)")
    .max(16, "Une équipe ne peut pas avoir plus de 16 joueurs"),
});
export type SaveRosterBody = z.infer<typeof saveRosterSchema>;

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

// BB2025 (Saison 3) : la « secondaire au hasard » disparait, la
// caracteristique devient un type d'avancement achetable.
const validAdvancementTypes = ["primary", "secondary", "random-primary", "characteristic"] as const;
const validCharacteristicStats = ["ma", "st", "ag", "pa", "av"] as const;

export const updatePlayerSkillsSchema = z.object({
  skillSlug: z.string().optional(),
  advancementType: z.enum(validAdvancementTypes, { message: "advancementType est requis" }),
  skillCategory: z.string().optional(),
  // Obligatoires uniquement pour advancementType="characteristic" (le
  // handler les verifie ; on les autorise ici pour ne pas les faire
  // stripper par le middleware validate()). `d8` = jet BB2025 qui
  // restreint les caracteristiques ameliorables.
  stat: z.enum(validCharacteristicStats).optional(),
  d8: z.number().int().min(1).max(8).optional(),
});

export const addStarPlayerToTeamSchema = z.object({
  starPlayerSlug: z.string().min(1, "starPlayerSlug requis"),
});
