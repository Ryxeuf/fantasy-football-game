import { z } from "zod";

export const createFromRosterSchema = z.object({
  name: z.string().min(1, "name et roster requis").max(100),
  roster: z.string().min(1, "name et roster requis"),
  teamValue: z.number().min(100, "La valeur d'équipe doit être entre 100 et 2000k po").max(2000, "La valeur d'équipe doit être entre 100 et 2000k po").optional(),
  starPlayers: z.array(z.string()).optional(),
  ruleset: z.string().optional(),
  format: z.enum(["bb11", "sevens"]).optional(),
  // Règlement de tournoi (slug du registre @bb/game-engine, ex :
  // "naf_world_cup_2027"). null/absent = aucun. Validé contre le registre
  // dans le handler (parseTournamentRuleset).
  tournamentRuleset: z.string().trim().max(64).optional().nullable(),
  // Ligue régionale choisie à la création (slug du catalogue @bb/game-engine
  // `REGIONAL_LEAGUES`, ex : "chaos_clash"). Elle conditionne les Star
  // Players recrutables et les Coups de Pouce accessibles. Validée contre les
  // options du roster dans le handler ; requise dès que le roster a le choix
  // entre plusieurs Ligues, sauf règlement de tournoi qui neutralise l'axe.
  regionalLeague: z.string().trim().max(64).optional().nullable(),
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
  // Règlement de tournoi (slug du registre @bb/game-engine, ex :
  // "naf_world_cup_2027"). null/absent = aucun. Validé contre le registre
  // dans le handler ; s'il est fourni, le serveur IMPOSE budget d'or et
  // pool de SPP du pack (valeurs client ignorées) et applique ses
  // restrictions de Star Players et de cumul de compétences.
  // Ligue régionale choisie à la création (slug du catalogue @bb/game-engine
  // `REGIONAL_LEAGUES`, ex : "chaos_clash"). Elle conditionne les Star
  // Players recrutables et les Coups de Pouce accessibles. Validée contre les
  // options du roster dans le handler ; requise dès que le roster a le choix
  // entre plusieurs Ligues, sauf règlement de tournoi qui neutralise l'axe.
  regionalLeague: z.string().trim().max(64).optional().nullable(),
  tournamentRuleset: z.string().trim().max(64).optional().nullable(),
  rerolls: z.number().int().min(0, "Le nombre de relances doit être entre 0 et 8").max(8, "Le nombre de relances doit être entre 0 et 8").optional(),
  cheerleaders: z.number().int().min(0, "Le nombre de cheerleaders doit être entre 0 et 12").max(12, "Le nombre de cheerleaders doit être entre 0 et 12").optional(),
  assistants: z.number().int().min(0, "Le nombre d'assistants doit être entre 0 et 6").max(6, "Le nombre d'assistants doit être entre 0 et 6").optional(),
  apothecary: z.boolean().optional(),
  dedicatedFans: z.number().int().min(1, "Le nombre de fans dévoués doit être entre 1 et 6").max(6, "Le nombre de fans dévoués doit être entre 1 et 6").optional(),
  // Case « Édition avancée » du builder : conditionne le recrutement de
  // Star Players (refusé hors mode avancé / hors coupe).
  advancedEdition: z.boolean().optional(),
  // Mode « édition avancée » : pool de PSP à dépenser en améliorations au
  // build. En jeu libre, fourni par le coach ; en construction pour une
  // coupe (`cupId`), IGNORÉ et re-résolu côté serveur (non modifiable).
  startingPspPool: z.number().int().min(0).max(200).optional(),
  // Améliorations achetées au build, ciblant le N-ième (`ordinal`, 0-based)
  // joueur d'un poste (`positionSlug`). Même vocabulaire que le flux de ligue.
  advancements: z
    .array(
      z.object({
        positionSlug: z.string().min(1),
        ordinal: z.number().int().min(0).max(31),
        type: z.enum(["primary", "secondary", "random-primary", "characteristic"]),
        skillSlug: z.string().max(60).optional(),
        category: z.string().max(2).optional(),
        stat: z.enum(["ma", "st", "ag", "pa", "av"]).optional(),
        d8: z.number().int().min(1).max(8).optional(),
      }),
    )
    .max(96)
    .optional(),
  // Construction « pour une coupe » (Flow B) : le serveur impose budget + pool
  // depuis la config de la coupe et auto-inscrit l'équipe.
  cupId: z.string().min(1).optional(),
});

export type BuildTeamInput = z.infer<typeof buildTeamSchema>;

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

/**
 * Staff/inducements d'une equipe.
 *
 * Les bornes hautes ne sont PAS ecrites ici : elles dependent du couple
 * roster x format (`RosterStaffConfig`, editable en admin — Sevens plafonne
 * par exemple a 6 relances / 6 cheerleaders / 3 assistants). Zod ne fait
 * qu'un garde-fou de sanite (entier, positif, majorant absolu) ; le handler
 * `handlePutTeamInfo` applique les vrais plafonds resolus en base et rend un
 * message d'erreur qui les cite.
 */
export const updateTeamInfoSchema = z.object({
  rerolls: z.number().int().min(0, "Le nombre de relances doit être positif").max(99).optional(),
  cheerleaders: z.number().int().min(0, "Le nombre de cheerleaders doit être positif").max(99).optional(),
  assistants: z.number().int().min(0, "Le nombre d'assistants doit être positif").max(99).optional(),
  apothecary: z.boolean().optional(),
  dedicatedFans: z.number().int().min(1, "Le nombre de fans dévoués doit être au moins de 1").max(99).optional(),
});
export type UpdateTeamInfoBody = z.infer<typeof updateTeamInfoSchema>;

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

/**
 * Règle spéciale "Capitaine" : désignation du capitaine de l'équipe
 * (création de la liste, ou successeur si le capitaine est mort/licencié).
 */
export const designateCaptainSchema = z.object({
  playerId: z.string().min(1, "playerId requis"),
});
export type DesignateCaptainBody = z.infer<typeof designateCaptainSchema>;

/**
 * E12 — édition cosmétique de l'identité d'un joueur (nom + numéro) par
 * son coach, AUTORISÉE même équipe engagée (pas d'impact anti-triche).
 */
export const updatePlayerIdentitySchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    number: z.number().int().min(1).max(99).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.number !== undefined,
    "Fournir un nom et/ou un numéro",
  );
export type UpdatePlayerIdentityBody = z.infer<
  typeof updatePlayerIdentitySchema
>;

/**
 * Renommage d'une équipe déjà créée (`PATCH /team/:id/name`).
 *
 * Mêmes bornes qu'à la création (`createFromRosterSchema.name`) : le nom
 * reste un champ cosmétique, aucune contrainte d'unicité n'existe en base.
 * Le `.trim()` normalise ici pour que le service n'ait jamais à arbitrer
 * entre « nom blanc » et « nom vide ».
 */
export const renameTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom de l'équipe ne peut pas être vide")
    .max(100, "Le nom de l'équipe ne peut pas dépasser 100 caractères"),
});
export type RenameTeamBody = z.infer<typeof renameTeamSchema>;

/**
 * Édition avancée : réglage du pool de PSP de construction d'une équipe
 * déjà créée. Même borne haute que le builder (`MAX_STARTING_PSP_POOL`).
 */
export const updateStartingPspPoolSchema = z.object({
  startingPspPool: z.number().int().min(0).max(200),
});
export type UpdateStartingPspPoolBody = z.infer<
  typeof updateStartingPspPoolSchema
>;
