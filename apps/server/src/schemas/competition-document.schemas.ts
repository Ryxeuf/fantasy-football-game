/**
 * Schemas Zod des routes « documents officiels de competition »
 * (cf. `routes/competition-documents.ts` et
 * `routes/admin-competition-documents.ts`).
 *
 * L'upload lui-meme n'a PAS de schema de corps : le corps est le binaire brut
 * (`express.raw`), pas du JSON. Les metadonnees facultatives passent alors par
 * la query string, validee ici (`uploadCompetitionDocumentQuerySchema`).
 */

import { z } from "zod";

/** Familles de competitions acceptees dans le segment `:kind` de l'URL. */
export const competitionKindSchema = z.enum(["leagues", "cups"]);

/** Params `/:kind/:competitionId/documents`. */
export const competitionDocumentParamsSchema = z
  .object({
    kind: competitionKindSchema,
    competitionId: z.string().min(1, "competitionId requis"),
  })
  .passthrough();

/** Params `/:kind/:competitionId/documents/:documentId`. */
export const competitionDocumentItemParamsSchema = z
  .object({
    kind: competitionKindSchema,
    competitionId: z.string().min(1, "competitionId requis"),
    documentId: z.string().min(1, "documentId requis"),
  })
  .passthrough();

/**
 * Query de l'upload. Tout est optionnel : sans titre, le serveur derive le
 * libelle du nom de fichier d'origine.
 */
export const uploadCompetitionDocumentQuerySchema = z
  .object({
    filename: z.string().trim().min(1).max(255).optional(),
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export type UploadCompetitionDocumentQuery = z.infer<
  typeof uploadCompetitionDocumentQuerySchema
>;

/**
 * Corps du PATCH (metadonnees editables). `description: null` efface la
 * description. Au moins un champ doit etre fourni, sinon la requete ne veut
 * rien dire et masquerait une erreur d'appelant.
 */
export const updateCompetitionDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.sortOrder !== undefined,
    { message: "Aucun champ a mettre a jour" },
  );

export type UpdateCompetitionDocumentInputBody = z.infer<
  typeof updateCompetitionDocumentSchema
>;

/** Query du listing admin. */
export const adminCompetitionDocumentListQuerySchema = z
  .object({
    kind: z.enum(["league", "cup"]).optional(),
    competitionId: z.string().trim().min(1).optional(),
    search: z.string().trim().max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type AdminCompetitionDocumentListQuery = z.infer<
  typeof adminCompetitionDocumentListQuerySchema
>;

/** Params `/:documentId` des routes admin. */
export const adminCompetitionDocumentParamsSchema = z
  .object({
    documentId: z.string().min(1, "documentId requis"),
  })
  .passthrough();
