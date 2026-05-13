import { z } from "zod";

// ── Query schemas ──

const sortOrderEnum = z.enum(["asc", "desc"]).default("desc");

export const adminUsersQuerySchema = z.object({
  search: z.string().max(200).default(""),
  role: z.string().max(50).default(""),
  sortBy: z.enum(["createdAt", "email", "name", "role"]).default("createdAt"),
  sortOrder: sortOrderEnum,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const adminMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  status: z
    .enum(["pending", "prematch", "prematch-setup", "active", "ended", "cancelled"])
    .optional(),
  search: z.string().max(200).default(""),
  sortBy: z.enum(["createdAt", "lastMoveAt", "status"]).default("createdAt"),
  sortOrder: sortOrderEnum,
  page: z.coerce.number().int().min(1).default(1),
});

export const adminTeamsQuerySchema = z.object({
  search: z.string().max(200).default(""),
  roster: z.string().max(100).default(""),
  ownerId: z.string().max(100).default(""),
  ruleset: z.string().max(50).optional(),
  sortBy: z.enum(["createdAt", "name", "roster", "currentValue"]).default("createdAt"),
  sortOrder: sortOrderEnum,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ── Body schemas ──

const allowedRoles = ["user", "admin", "moderator"] as const;

export const updateUserRoleSchema = z.object({
  role: z.enum(allowedRoles).optional(),
  roles: z.array(z.enum(allowedRoles)).optional(),
}).refine(
  (data) => data.role !== undefined || (data.roles !== undefined && data.roles.length > 0),
  { message: "role ou roles requis" },
);

export const updateUserPatreonSchema = z.object({
  patreon: z.boolean({ message: "Valeur Patreon invalide" }),
});

export const updateUserValidSchema = z.object({
  valid: z.boolean({ message: "Valeur valid invalide" }),
});

/**
 * Statut de visibilite du joueur dans le classement ELO public et sur la
 * section ELO de son profil coach. Reason optionnelle (cap 500 chars,
 * audit interne, jamais expose publiquement).
 */
export const updateUserLeaderboardStatusSchema = z.object({
  status: z.enum(["visible", "hidden_admin"], {
    message: "Statut invalide (visible | hidden_admin)",
  }),
  reason: z.string().max(500, "raison trop longue (500 chars max)").optional(),
});

export const updateMatchStatusSchema = z.object({
  status: z.enum(
    ["pending", "prematch", "prematch-setup", "active", "ended", "cancelled"],
    { message: "Statut invalide" },
  ),
});

// ── Lot P.B.4 — moderation matchs humains + ban users ──

/** Forfait admin force sur un match en cours. `winnerSide` indique la cote
 * declaree gagnante. `reason` est obligatoire pour tracabilite audit log. */
export const adminMatchForfeitSchema = z.object({
  winnerSide: z.enum(["A", "B"], { message: "winnerSide doit etre 'A' ou 'B'" }),
  reason: z
    .string()
    .min(3, "raison trop courte (3 chars min)")
    .max(500, "raison trop longue (500 chars max)"),
});

/** Annulation admin (match toxique, bug, etc.). Raison obligatoire. */
export const adminMatchCancelSchema = z.object({
  reason: z
    .string()
    .min(3, "raison trop courte (3 chars min)")
    .max(500, "raison trop longue (500 chars max)"),
});

/** Bannissement temporaire (durationDays > 0) ou permanent (omis ou 0).
 *  Raison obligatoire pour tracabilite (visible audit log uniquement). */
export const adminUserBanSchema = z.object({
  reason: z
    .string()
    .min(3, "raison trop courte (3 chars min)")
    .max(500, "raison trop longue (500 chars max)"),
  /** Duree en jours. Omis ou 0 = ban permanent (annee 9999). Max 3650 (~10 ans). */
  durationDays: z.number().int().min(0).max(3650).optional(),
});

// ── Lot P.B.1 — admin wallet (audit financier strict) ──

/** Ajustement manuel du solde d'un wallet par un admin.
 *  - `delta` entier signe (positif = credit, negatif = debit, non nul).
 *  - `reason` obligatoire (audit financier). Cap a 500 chars.
 *  Bornes : +/-10_000_000 Crowns par ajustement pour prevenir une
 *  catastrophe en cas de typo (10M = TV bulk d'une grosse equipe). */
export const adminWalletAdjustSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((n) => n !== 0, "delta ne peut pas etre 0")
    .refine((n) => Math.abs(n) <= 10_000_000, "delta hors bornes (max +/-10M Crowns)"),
  reason: z
    .string()
    .min(3, "raison trop courte (3 chars min)")
    .max(500, "raison trop longue (500 chars max)"),
});

/** Refund admin d'un pari : credite le wallet du stake + void le bet.
 *  Raison obligatoire (audit financier). Idempotence : refuse si le bet
 *  est deja `void`. Pour les bets `won`, le payout deja credite n'est
 *  pas re-debit (on assume que le settlement est legitime ; seul le
 *  stake initial est rembourse en mode best-effort). */
export const adminBetRefundSchema = z.object({
  reason: z
    .string()
    .min(3, "raison trop courte (3 chars min)")
    .max(500, "raison trop longue (500 chars max)"),
});

// ── Lot P.B.3 — Pro League season factory ──

/** Creation d'une saison Pro League from scratch.
 *  Initialise les standings a zero. Le schedule est genere si
 *  `autoSchedule: true` (par defaut false — l'admin appellera
 *  regenerate-schedule plus tard si besoin de personnaliser la date). */
export const adminCreateSeasonSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  driverKind: z.enum(["hybrid", "full"]).optional(),
  engineVer: z.string().min(1).max(50).optional(),
  autoSchedule: z.boolean().optional().default(false),
});

/** Clone d'une saison Pro League. La saison source doit exister. Le
 *  `year` cible doit etre unique dans la ligue (sinon DUPLICATE_YEAR
 *  cote service). `driverKind` optionnel = inherit la valeur source. */
export const adminCloneSeasonSchema = z.object({
  fromSeasonId: z.string().min(1, "fromSeasonId requis"),
  year: z.number().int().min(2020).max(2100),
  driverKind: z.enum(["hybrid", "full"]).optional(),
});

/** Force forfait d'un match Pro League. Le service refuse si match
 *  est deja `completed`. `winnerSide` obligatoire. */
export const adminForceForfeitSchema = z.object({
  winnerSide: z.enum(["home", "away"], {
    message: "winnerSide doit etre 'home' ou 'away'",
  }),
});

/** Replenish d'un roster Pro League : remplit jusqu'a `targetSize`
 *  (defaut 12) avec des rookies. Action non destructive — n'efface
 *  rien. */
export const adminRosterReplenishSchema = z.object({
  targetSize: z.number().int().min(1).max(30).optional(),
});

/** Regenerate complet d'un roster (DESTRUCTIF). Wipe puis re-seed
 *  `count` rookies. */
export const adminRosterRegenerateSchema = z.object({
  count: z.number().int().min(1).max(30).default(12),
});

// ── Sprint test-leagues — saisons Pro League de test ──

/** Creation d'une saison Pro League "test" : isolee de la production
 *  (invisible cote user), matchs simules immediatement (replays prets),
 *  supprimable d'un coup. Tous les champs sont optionnels — defaults
 *  raisonnables pour un usage rapide depuis l'admin UI. */
export const adminCreateTestSeasonSchema = z.object({
  /** Label libre (max 120 chars). */
  label: z.string().min(1).max(120).optional(),
  driverKind: z.enum(["hybrid", "full"]).optional(),
  engineVer: z.string().min(1).max(50).optional(),
  /** Sous-ensemble optionnel de slugs. Min 2 si fourni, max 16 (cap
   *  ligue). Limite max 16 matchs/round + 15 rounds = 120 matchs en
   *  hybrid (~6s) ou ~4min en full driver. */
  teamSlugs: z
    .array(z.string().min(1).max(80))
    .min(2, "Au moins 2 teamSlugs requis")
    .max(16, "Max 16 teamSlugs")
    .optional(),
});

/** Branding admin d'une ProTeam : couleurs, motto, headline, nflFlavor.
 *  Tous les champs sont optionnels — l'endpoint applique seulement ceux
 *  fournis, ne touche pas aux autres. `null` explicite = effacer le champ. */
const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

export const adminProTeamBrandingSchema = z
  .object({
    city: z.string().min(1).max(80).optional(),
    name: z.string().min(1).max(120).optional(),
    nflFlavor: z.string().max(120).nullable().optional(),
    primaryColor: z
      .string()
      .regex(hexColorRegex, "Format attendu : #RRGGBB")
      .nullable()
      .optional(),
    secondaryColor: z
      .string()
      .regex(hexColorRegex, "Format attendu : #RRGGBB")
      .nullable()
      .optional(),
    motto: z.string().max(200).nullable().optional(),
    headline: z.string().max(200).nullable().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "Au moins un champ doit etre fourni" },
  );
