/**
 * Parser des règlements de tournoi stockés en base.
 *
 * `TournamentRuleset.definition` est un JSON libre côté base : c'est CE
 * schéma qui en fait une donnée sûre. Il est appliqué **aux deux bouts** —
 * à l'écriture (une saisie admin invalide est refusée avec le chemin du
 * champ fautif) et à la lecture (un JSON corrompu ne remonte jamais dans le
 * moteur de règles, on retombe sur le registre `@bb/game-engine`).
 *
 * Le schéma est le miroir exact de `TournamentRulesetDefinition` du moteur,
 * avec deux adaptations propres au stockage JSON :
 *  - `Infinity` n'existe pas en JSON : la dernière tranche de taxe Star
 *    Players porte `maxTotalCostK: null`, converti en `+Infinity` au parse
 *    (et l'inverse à la sérialisation, cf. `serializeDefinition`) ;
 *  - la colonne peut remonter en objet natif (PostgreSQL) ou en chaîne
 *    sérialisée (miroir SQLite) : `parseDefinition` accepte les deux.
 */

import { z } from "zod";
import {
  INDUCEMENT_CATALOGUE,
  type TournamentRulesetDefinition,
} from "@bb/game-engine";

/** Slug technique : minuscules, chiffres, tirets bas/haut. */
const slugSchema = z
  .string()
  .trim()
  .min(2, "Slug trop court")
  .max(64, "Slug trop long")
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "Slug invalide (minuscules, chiffres, _ ou -)");

const labelSchema = z.string().trim().min(1, "Libellé requis").max(200);

/** Coups de pouce connus du moteur : un slug inconnu ne serait jamais servi. */
const INDUCEMENT_SLUGS: readonly string[] = INDUCEMENT_CATALOGUE.map(
  (d) => d.slug,
);

export const tournamentSkillStackingSchema = z.enum([
  "none",
  "one_player",
  "two_players",
]);

export const tournamentRosterRulesSchema = z.object({
  /** Budget d'or de création imposé, en kpo. */
  goldBudget: z.number().int().min(0).max(5000),
  /** Pool de PSP à dépenser en compétences à la création. */
  sppBudget: z.number().int().min(0).max(500),
  skillStacking: tournamentSkillStackingSchema,
  starPlayersAllowed: z.boolean(),
});

export const tournamentSkillCostsSchema = z.object({
  firstPrimary: z.number().int().min(0).max(100),
  firstSecondary: z.number().int().min(0).max(100),
  secondPrimary: z.number().int().min(0).max(100),
  secondSecondary: z.number().int().min(0).max(100),
  /** Surcoût par compétence Élite (0 = le règlement ne facture pas l'Élite). */
  eliteSurcharge: z.number().int().min(0).max(100),
});

export const tournamentStarTaxBracketSchema = z.object({
  /**
   * Borne haute (incluse) du coût cumulé des Star Players, en kpo.
   * `null` = dernière tranche, sans borne (JSON n'a pas d'`Infinity`).
   */
  maxTotalCostK: z.number().min(0).max(100_000).nullable(),
  spp: z.number().int().min(0).max(500),
});

export const tournamentInducementRuleSchema = z.object({
  slug: z
    .string()
    .trim()
    .refine((value) => INDUCEMENT_SLUGS.includes(value), {
      error: "Coup de pouce inconnu du catalogue",
    }),
  /** Coût imposé par le règlement, en po. */
  cost: z.number().int().min(0).max(10_000_000),
  /** Quantité max (absent = limite du catalogue). */
  max: z.number().int().min(0).max(99).optional(),
  noteFr: z.string().trim().max(500).optional(),
});

export const tournamentScoringSchema = z.object({
  win: z.number().int().min(-100).max(100),
  draw: z.number().int().min(-100).max(100),
  loss: z.number().int().min(-100).max(100),
  concession: z.number().int().min(-100).max(100),
});

/**
 * Définition complète d'un règlement, telle que stockée dans
 * `TournamentRuleset.definition`.
 */
export const tournamentRulesetDefinitionSchema = z
  .object({
    slug: slugSchema,
    nameFr: labelSchema,
    nameEn: labelSchema,
    shortLabel: z.string().trim().min(1, "Libellé court requis").max(60),
    version: z.string().trim().min(1, "Version requise").max(40),
    edition: z.enum(["season_2", "season_3"]),
    format: z.enum(["bb11", "sevens"]),
    descriptionFr: z.string().trim().max(4000).default(""),
    resurrection: z.boolean(),
    minRegularPlayersBeforeStars: z.number().int().min(0).max(16),
    rosterRules: z.record(slugSchema, tournamentRosterRulesSchema),
    skillCosts: tournamentSkillCostsSchema,
    eliteSkills: z.array(slugSchema).max(200),
    bannedStarPlayers: z.array(slugSchema).max(500),
    starPlayerSppTax: z.array(tournamentStarTaxBracketSchema).max(20),
    allowedInducements: z.array(tournamentInducementRuleSchema).max(60),
    scoring: tournamentScoringSchema,
    regionalLeagueChoice: z.boolean().optional(),
  })
  .superRefine((def, ctx) => {
    // Une seule tranche sans borne, et elle doit fermer le barème.
    const unbounded = def.starPlayerSppTax
      .map((b, i) => (b.maxTotalCostK === null ? i : -1))
      .filter((i) => i >= 0);
    if (unbounded.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["starPlayerSppTax"],
        message: "Une seule tranche peut être sans borne haute",
      });
    }
    if (unbounded.length === 1 && unbounded[0] !== def.starPlayerSppTax.length - 1) {
      ctx.addIssue({
        code: "custom",
        path: ["starPlayerSppTax", unbounded[0], "maxTotalCostK"],
        message: "La tranche sans borne haute doit être la dernière",
      });
    }
    // Bornes strictement croissantes : sinon une tranche est inatteignable.
    for (let i = 1; i < def.starPlayerSppTax.length; i += 1) {
      const prev = def.starPlayerSppTax[i - 1].maxTotalCostK;
      const cur = def.starPlayerSppTax[i].maxTotalCostK;
      if (prev !== null && cur !== null && cur <= prev) {
        ctx.addIssue({
          code: "custom",
          path: ["starPlayerSppTax", i, "maxTotalCostK"],
          message: "Les tranches doivent être strictement croissantes",
        });
      }
    }
    // Un coup de pouce ne peut pas être tarifé deux fois.
    const seen = new Set<string>();
    def.allowedInducements.forEach((rule, i) => {
      if (seen.has(rule.slug)) {
        ctx.addIssue({
          code: "custom",
          path: ["allowedInducements", i, "slug"],
          message: `Coup de pouce en double : « ${rule.slug} »`,
        });
      }
      seen.add(rule.slug);
    });
  });

export type TournamentRulesetDefinitionInput = z.input<
  typeof tournamentRulesetDefinitionSchema
>;

/** Résultat de parse : la définition prête pour le moteur, ou les erreurs. */
export type ParsedDefinition =
  | { readonly ok: true; readonly definition: TournamentRulesetDefinition }
  | { readonly ok: false; readonly issues: readonly DefinitionIssue[] };

/** Une erreur de validation, avec le chemin du champ fautif. */
export interface DefinitionIssue {
  /** Chemin pointé, ex. `rosterRules.orc.goldBudget`. */
  readonly path: string;
  readonly message: string;
}

/** Convertit les issues Zod en chemins lisibles pour l'UI admin. */
function toIssues(error: z.ZodError): DefinitionIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/**
 * Parse une valeur de colonne `definition` en définition utilisable par le
 * moteur. Tolérant à la forme de stockage (objet natif PG / chaîne JSON du
 * miroir SQLite) ; `null` de tranche haute converti en `+Infinity`.
 */
export function parseDefinition(raw: unknown): ParsedDefinition {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {
        ok: false,
        issues: [{ path: "", message: "JSON illisible" }],
      };
    }
  }
  const parsed = tournamentRulesetDefinitionSchema.safeParse(value);
  if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };

  const def = parsed.data;
  return {
    ok: true,
    definition: {
      ...def,
      // `Infinity` est la convention du moteur pour « pas de borne haute ».
      starPlayerSppTax: def.starPlayerSppTax.map((b) => ({
        maxTotalCostK: b.maxTotalCostK ?? Number.POSITIVE_INFINITY,
        spp: b.spp,
      })),
    } as TournamentRulesetDefinition,
  };
}

/**
 * Inverse de `parseDefinition` : prépare une définition du moteur pour le
 * stockage JSON (`Infinity` → `null`). À utiliser avant toute écriture.
 */
export function serializeDefinition(
  def: TournamentRulesetDefinition,
): TournamentRulesetDefinitionInput {
  return {
    ...def,
    starPlayerSppTax: def.starPlayerSppTax.map((b) => ({
      maxTotalCostK: Number.isFinite(b.maxTotalCostK) ? b.maxTotalCostK : null,
      spp: b.spp,
    })),
    rosterRules: { ...def.rosterRules },
    eliteSkills: [...def.eliteSkills],
    bannedStarPlayers: [...def.bannedStarPlayers],
    allowedInducements: def.allowedInducements.map((r) => ({ ...r })),
  } as TournamentRulesetDefinitionInput;
}
