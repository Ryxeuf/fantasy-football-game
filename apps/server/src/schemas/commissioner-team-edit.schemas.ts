/**
 * Lot I — Zod schemas pour les routes commissaire d'edition d'equipe.
 */

import { z } from "zod";

export const adjustSppSchema = z.object({
  delta: z.number().int().min(-1000).max(1000),
  reason: z.string().max(500).optional(),
});
export type AdjustSppBody = z.infer<typeof adjustSppSchema>;

export const addSkillSchema = z.object({
  skill: z.string().trim().min(1).max(64),
  pickKind: z.enum(["random", "chosen"]).optional(),
  reason: z.string().max(500).optional(),
});
export type AddSkillBody = z.infer<typeof addSkillSchema>;

export const removeSkillSchema = z.object({
  skill: z.string().trim().min(1).max(64),
  reason: z.string().max(500).optional(),
});
export type RemoveSkillBody = z.infer<typeof removeSkillSchema>;

export const adjustCharacteristicSchema = z
  .object({
    characteristic: z.enum(["MA", "ST", "AG", "PA", "AV"]),
    delta: z.number().int().min(-10).max(10).optional(),
    /** E14 — valeur cible absolue (plus intuitive qu'un delta). */
    value: z.number().int().min(1).max(10).optional(),
    reason: z.string().max(500).optional(),
  })
  .refine(
    (v) => (v.delta !== undefined) !== (v.value !== undefined),
    "Fournir soit delta, soit value (exclusif)",
  );
export type AdjustCharacteristicBody = z.infer<
  typeof adjustCharacteristicSchema
>;

/** A64 — édition de l'identité d'un joueur (nom complet + numéro). */
export const updatePlayerIdentitySchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    number: z.number().int().min(1).max(99).optional(),
    reason: z.string().max(500).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.number !== undefined,
    "Fournir un nom et/ou un numéro",
  );
export type UpdatePlayerIdentityBody = z.infer<
  typeof updatePlayerIdentitySchema
>;

export const adjustTreasurySchema = z.object({
  delta: z.number().int().min(-10_000_000).max(10_000_000),
  reason: z.string().max(500).optional(),
});
export type AdjustTreasuryBody = z.infer<typeof adjustTreasurySchema>;

/**
 * Suppression d'equipe / de joueur par le commissaire. Seul un motif
 * optionnel est accepte dans le corps (la cible est dans l'URL).
 *
 * `.default({})` : une requete DELETE sans corps laisse `req.body`
 * `undefined`. Sans default, `z.object` rejette ("expected object,
 * received undefined") et la suppression echoue cote UI. Le default
 * normalise l'absence de corps en objet vide.
 */
export const commissionerRemovalSchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .default({});
export type CommissionerRemovalBody = z.infer<typeof commissionerRemovalSchema>;
