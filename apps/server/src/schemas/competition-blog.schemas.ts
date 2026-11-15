/**
 * Schémas Zod du blog des compétitions (`routes/competition-blog.ts`).
 *
 * Le contenu d'un article est du HTML : le schéma n'en borne que la forme
 * (longueur brute) ; son assainissement et ses limites effectives vivent dans
 * le service (`sanitize-competition-post-html`, `BLOG_LIMITS`).
 * L'upload d'image n'a pas de schéma de corps (binaire brut).
 */

import { z } from "zod";
import { BLOG_LIMITS, REACTION_KINDS } from "../services/competition-blog-rules";

const id = z.string().min(1).max(64);

/** Params communs `/:kind/:competitionId/blog/...` (routeur `mergeParams`). */
export const blogParamsSchema = z
  .object({ kind: z.enum(["leagues", "cups"]), competitionId: id })
  .passthrough();

export const blogPostParamsSchema = blogParamsSchema.extend({ postId: id }).passthrough();

export const blogCommentParamsSchema = blogParamsSchema
  .extend({ commentId: id })
  .passthrough();

export const blogReactionParamsSchema = blogPostParamsSchema
  .extend({ reaction: z.enum(REACTION_KINDS) })
  .passthrough();

const page = z.coerce.number().int().min(1).max(10_000).default(1);
const limit = z.coerce.number().int().min(1).max(BLOG_LIMITS.pageSizeMax);

export const listPostsQuerySchema = z
  .object({
    page,
    limit: limit.default(10),
    drafts: z.literal("mine").optional(),
  })
  .strict();
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

export const listCommentsQuerySchema = z
  .object({ page, limit: limit.default(50) })
  .strict();
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;

/** Le HTML brut peut être plus long que le HTML assaini (attributs retirés). */
const RAW_HTML_MAX = BLOG_LIMITS.contentHtmlMax * 2;

const coverImageUrl = z.string().max(500).nullable();

export const createPostSchema = z
  .object({
    title: z.string().min(1).max(BLOG_LIMITS.titleMax),
    contentHtml: z.string().min(1).max(RAW_HTML_MAX),
    coverImageUrl: coverImageUrl.optional(),
    publish: z.boolean().optional(),
  })
  .strict();
export type CreatePostBody = z.infer<typeof createPostSchema>;

export const updatePostSchema = z
  .object({
    title: z.string().min(1).max(BLOG_LIMITS.titleMax).optional(),
    contentHtml: z.string().min(1).max(RAW_HTML_MAX).optional(),
    coverImageUrl: coverImageUrl.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Aucun champ a modifier");
export type UpdatePostBody = z.infer<typeof updatePostSchema>;

export const commentBodySchema = z
  .object({ body: z.string().min(1).max(BLOG_LIMITS.commentMax) })
  .strict();
export type CommentBody = z.infer<typeof commentBodySchema>;

export const moderationSchema = z
  .object({
    reason: z.string().trim().max(BLOG_LIMITS.moderationReasonMax).nullable().optional(),
  })
  .strict();
export type ModerationBody = z.infer<typeof moderationSchema>;
