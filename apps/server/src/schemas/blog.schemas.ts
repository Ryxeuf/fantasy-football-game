import { z } from "zod";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const blogStatusEnum = z.enum(["draft", "published"]);

export const createBlogPostSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(SLUG_REGEX, "slug doit être en kebab-case (a-z, 0-9, tirets)"),
  title: z.string().min(3).max(200),
  excerpt: z.string().max(280).optional().nullable(),
  contentHtml: z.string().min(1).max(200_000),
  coverImageUrl: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .refine(
      (v) => !v || v.startsWith("/") || /^https?:\/\//i.test(v),
      "coverImageUrl doit être un path /images/... ou une URL http(s)",
    ),
  status: blogStatusEnum.default("draft"),
});

export const updateBlogPostSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(SLUG_REGEX, "slug doit être en kebab-case (a-z, 0-9, tirets)")
    .optional(),
  title: z.string().min(3).max(200).optional(),
  excerpt: z.string().max(280).optional().nullable(),
  contentHtml: z.string().min(1).max(200_000).optional(),
  coverImageUrl: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .refine(
      (v) => v === undefined || v === null || v === "" || v.startsWith("/") || /^https?:\/\//i.test(v),
      "coverImageUrl doit être un path /images/... ou une URL http(s)",
    ),
  status: blogStatusEnum.optional(),
});

export const adminBlogListQuerySchema = z.object({
  status: blogStatusEnum.optional(),
  search: z.string().max(200).optional(),
});

export const publicBlogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;
