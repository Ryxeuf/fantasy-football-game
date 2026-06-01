/**
 * L.3 — Zod schemas for league API routes.
 *
 * Sprint 17 — infrastructure competitive : ligues.
 * Garde les routes /leagues alignees avec le service `services/league.ts`.
 */

import { z } from "zod";
import { isLeagueThemeSlug } from "../services/league-themes";

const rosterSlug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/i, "slug de roster invalide");

/**
 * S26.6 — slug d'un theme saisonnier (canonique). La liste autoritative
 * vit dans `services/league-themes.ts` ; on refuse ici tout slug inconnu
 * pour eviter de creer des saisons avec un theme orphelin.
 */
const leagueThemeSlug = z
  .string()
  .refine((v) => isLeagueThemeSlug(v), {
    message:
      "theme inconnu (slugs valides : skaven_cup, nordic_challenge, underworld_open)",
  });

const leagueThemeYear = z
  .number()
  .int("themeYear doit etre un entier")
  .positive("themeYear doit etre strictement positif");

/**
 * L2.C.5 — Slugs autorises pour `tieBreakRules`. Doit rester aligne
 * avec `services/league.ts.TIE_BREAK_SLUGS`. Mirror manuel pour
 * eviter une dependance circulaire entre schemas/ et services/.
 */
const tieBreakSlug = z.enum([
  "points",
  "td_diff",
  "td_for",
  "td_against",
  "cas_diff",
  "cas_for",
  "season_elo",
  "wins",
  "name",
]);

export const createLeagueSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom de la ligue est requis")
    .max(100, "Le nom de la ligue ne peut pas depasser 100 caracteres"),
  description: z.string().max(500).optional().nullable(),
  ruleset: z.enum(["season_2", "season_3"]).optional(),
  isPublic: z.boolean().optional(),
  maxParticipants: z.number().int().min(2).max(128).optional(),
  allowedRosters: z.array(rosterSlug).max(64).optional().nullable(),
  winPoints: z.number().int().min(0).max(10).optional(),
  drawPoints: z.number().int().min(0).max(10).optional(),
  lossPoints: z.number().int().min(-10).max(10).optional(),
  forfeitPoints: z.number().int().min(-10).max(10).optional(),
  // L2.C.5 — ordre de departage personnalise. null/undefined =
  // ordre par defaut historique. Filtre les doublons cote service.
  tieBreakRules: z.array(tieBreakSlug).max(9).optional().nullable(),
});

export const createSeasonSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Le nom de la saison est requis")
      .max(100, "Le nom de la saison ne peut pas depasser 100 caracteres"),
    seasonNumber: z.number().int().min(1).optional(),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    // S26.6 — theme + themeYear : couple optionnel (les deux ou aucun).
    theme: leagueThemeSlug.optional(),
    themeYear: leagueThemeYear.optional(),
    // L2.C.3 — taille du bracket de playoffs (top N qualifies).
    // Valeurs supportees : 0 (default, mode classique), 2, 4, 8.
    playoffSize: z
      .union([z.literal(0), z.literal(2), z.literal(4), z.literal(8)])
      .optional()
      .default(0),
  })
  .refine(
    (data) =>
      (data.theme === undefined && data.themeYear === undefined) ||
      (data.theme !== undefined && data.themeYear !== undefined),
    {
      message: "theme et themeYear doivent etre fournis ensemble",
      path: ["themeYear"],
    },
  );

/**
 * S26.6b — Query schema pour `GET /leagues/seasons/themed`.
 * `theme` est obligatoire (sinon le client appellerait `GET /leagues`).
 * `themeYear` filtre une edition precise.
 */
export const listSeasonsByThemeQuerySchema = z.object({
  theme: leagueThemeSlug,
  themeYear: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const joinSeasonSchema = z.object({
  teamId: z.string().min(1, "teamId requis"),
});

export const createRoundSchema = z.object({
  roundNumber: z.number().int().min(1, "Numero de journee >= 1"),
  name: z.string().trim().min(1).max(100).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
});

export const attachMatchSchema = z.object({
  matchId: z.string().min(1, "matchId requis"),
});

export const listLeaguesQuerySchema = z.object({
  creatorId: z.string().optional(),
  status: z
    .enum(["draft", "open", "in_progress", "completed", "archived"])
    .optional(),
  publicOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  // S25.6 — pagination obligatoire pour limiter le coût mémoire serveur.
  // Plafond limit=100 pour éviter qu'un client demande l'intégralité de
  // la table en un seul appel quand la base scale.
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * L2.A.3 — Body schema pour `POST /league/seasons/:id/start` et
 * `POST /league/seasons/:id/regenerate`. Tous les champs sont
 * optionnels : par defaut on genere un single round-robin sans dates.
 */
export const startSeasonSchema = z.object({
  doubleRoundRobin: z.boolean().optional().default(false),
  firstRoundStartDate: z.coerce.date().optional().nullable(),
  roundDurationDays: z
    .number()
    .int("roundDurationDays doit etre un entier")
    .min(1, "roundDurationDays >= 1")
    .max(365, "roundDurationDays <= 365")
    .optional()
    .nullable(),
});

/**
 * L2.A.4 — Body schema pour `POST /league/pairings/:id/match`.
 * Pas de body obligatoire pour l'instant : la creation utilise les
 * deux participants du pairing. Un seed optionnel permet de
 * reproduire un match (utile pour replay/tests).
 */
export const createMatchFromPairingSchema = z.object({
  seed: z.string().min(1).max(64).optional(),
});

/**
 * L2.A.11c — Body schema pour `POST /league/pairings/:id/forfeit`.
 * Reservee au createur de la ligue. `side` indique quel cote forfait
 * (default `home` cote service). `winnerScore` permet d'override le
 * score symbolique attribue au gagnant (default 2).
 */
export const forfeitPairingSchema = z.object({
  side: z.enum(["home", "away"]).optional(),
  winnerScore: z
    .number()
    .int("winnerScore doit etre un entier")
    .min(0, "winnerScore >= 0")
    .max(20, "winnerScore <= 20")
    .optional(),
});

/**
 * Workstream ligue offline — body pour `POST /leagues/pairings/:id/result`.
 * Saisie manuelle d'un resultat de match joue hors-ligne. Score TD +
 * casualties par equipe (home/away). Reservee au createur de la ligue.
 */
export const recordOfflineResultSchema = z.object({
  scoreHome: z.number().int("scoreHome entier").min(0).max(30),
  scoreAway: z.number().int("scoreAway entier").min(0).max(30),
  casualtiesHome: z.number().int("casualtiesHome entier").min(0).max(30),
  casualtiesAway: z.number().int("casualtiesAway entier").min(0).max(30),
  // Phase 2 — stats par joueur (optionnel) -> SPP + level-up.
  playerStats: z
    .array(
      z.object({
        teamPlayerId: z.string().min(1).max(64),
        touchdowns: z.number().int().min(0).max(20).optional(),
        casualties: z.number().int().min(0).max(20).optional(),
        completions: z.number().int().min(0).max(30).optional(),
        interceptions: z.number().int().min(0).max(20).optional(),
        mvp: z.boolean().optional(),
      }),
    )
    .max(40)
    .optional(),
});

export type CreateLeagueBody = z.infer<typeof createLeagueSchema>;
export type CreateSeasonBody = z.infer<typeof createSeasonSchema>;
export type JoinSeasonBody = z.infer<typeof joinSeasonSchema>;
export type CreateRoundBody = z.infer<typeof createRoundSchema>;
export type ListLeaguesQuery = z.infer<typeof listLeaguesQuerySchema>;
export type AttachMatchBody = z.infer<typeof attachMatchSchema>;
export type ListSeasonsByThemeQuery = z.infer<
  typeof listSeasonsByThemeQuerySchema
>;
export type StartSeasonBody = z.infer<typeof startSeasonSchema>;
export type CreateMatchFromPairingBody = z.infer<
  typeof createMatchFromPairingSchema
>;
export type ForfeitPairingBody = z.infer<typeof forfeitPairingSchema>;
export type RecordOfflineResultBody = z.infer<typeof recordOfflineResultSchema>;
