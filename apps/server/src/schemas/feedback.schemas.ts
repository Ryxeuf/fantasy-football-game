import { z } from "zod";

export const FEEDBACK_TYPES = ["bug", "remark", "comment"] as const;
export const FEEDBACK_STATUSES = ["new", "read", "resolved"] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const NAME_MAX = 100;
export const EMAIL_MAX = 255;
export const SUBJECT_MIN = 1;
export const SUBJECT_MAX = 200;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 5000;
export const USER_AGENT_MAX = 500;
export const PAGE_URL_MAX = 500;
export const CAPTCHA_TOKEN_MAX = 4096;

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional();

/**
 * URL optionnelle limitee aux schemes http(s) pour empecher de stocker
 * un `javascript:` ou `data:` dans pageUrl. Un champ vide est traite
 * comme undefined.
 */
const optionalHttpUrl = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional()
    .refine(
      (v) => v === undefined || /^https?:\/\//i.test(v),
      "URL invalide (http(s) attendu)",
    );

/**
 * Schema applique a `POST /feedback`. Tous les champs textuels sont
 * trimes et bornes pour eviter qu'un formulaire malveillant balance
 * des payloads geants. Le captchaToken est obligatoire — la route le
 * verifie avant toute insertion.
 */
export const createFeedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  name: optionalTrimmed(NAME_MAX),
  email: z
    .string()
    .trim()
    .max(EMAIL_MAX)
    .email("Adresse email invalide")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  subject: z.string().trim().min(SUBJECT_MIN).max(SUBJECT_MAX),
  message: z.string().trim().min(MESSAGE_MIN).max(MESSAGE_MAX),
  pageUrl: optionalHttpUrl(PAGE_URL_MAX),
  captchaToken: z.string().min(1).max(CAPTCHA_TOKEN_MAX),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

export const updateFeedbackStatusSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
});

export type UpdateFeedbackStatusInput = z.infer<
  typeof updateFeedbackStatusSchema
>;

export const listFeedbackQuerySchema = z.object({
  status: z.enum(FEEDBACK_STATUSES).optional(),
  type: z.enum(FEEDBACK_TYPES).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  // Pagination simple : page 1-indexee, limit borne pour ne pas
  // renvoyer 10000 feedbacks d'un coup.
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListFeedbackQuery = z.infer<typeof listFeedbackQuerySchema>;
