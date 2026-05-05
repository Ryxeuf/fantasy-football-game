/**
 * `TacticalProfile` — sprint Pro League 0.B.2.
 *
 * 15-parameter tactical fingerprint used by the hybrid driver (0.A.2)
 * and the behavior tree library (0.B.1) to drive coherent, race-aware
 * decisions during a match. Stored as JSON on `ProTeam.tactics` (lot 1.A.1)
 * and validated server-side via the exported Zod schema before reaching
 * the sim-engine.
 *
 * Parameter conventions
 * ---------------------
 * - All values are integers in the closed range [0, 100], so the same
 *   schema is reusable for storage (Prisma JSON), API responses, and
 *   admin tunables (lot 0.E iteration loop).
 * - `0` = "never / minimum", `100` = "always / maximum". `50` is the
 *   neutral fallback for a generic team. Every default is `50` ; the 16
 *   race profiles (lot 0.B.3) tune from there.
 * - Adding a new parameter MUST :
 *   1. extend `TACTICAL_PROFILE_PARAMETERS`,
 *   2. add a default in `DEFAULT_TACTICAL_PROFILE`,
 *   3. extend the Zod schema below.
 *   The test suite enforces (1) and (2).
 */

import { z } from 'zod';

/** Catalogue of the parameters the schema validates. Order is purely
 *  documentary (not used as a tuple). */
export const TACTICAL_PROFILE_PARAMETERS = [
  'bashIndex',
  'passingFrequency',
  'riskAppetite',
  'cageAffinity',
  'blitzPriority',
  'rerollUsage',
  'pace',
  'foulFrequency',
  'stallTendency',
  'kickReturn',
  'screenAffinity',
  'breakawayInstinct',
  'pressingDefense',
  'patience',
  'gfiTolerance',
] as const;

export type TacticalParameter = (typeof TACTICAL_PROFILE_PARAMETERS)[number];

const param = () => z.number().int().min(0).max(100);

/**
 * Strict Zod schema. Unknown keys are rejected (`.strict()`) so a typo on
 * an admin form fails loudly instead of silently falling back to the
 * default value.
 */
export const tacticalProfileSchema = z
  .object({
    /** Probability of choosing a block over a movement when both options
     *  exist (0 = always move, 100 = always block). Identity stat for bash
     *  rosters (Orcs, Chaos, Khorne). */
    bashIndex: param(),
    /** Frequency of pass actions on a drive (0 = ground only, 100 = pass
     *  every turn possible). High for Wood Elves, Skaven, Humans. */
    passingFrequency: param(),
    /** Tolerance for low-probability actions. Drives the IA temperature
     *  (lot 0.B.5) — high = sample low-EV but high-upside actions. */
    riskAppetite: param(),
    /** Tendency to build a cage formation (lot 0.B.1 cage-build pattern). */
    cageAffinity: param(),
    /** Eagerness to spend the team's once-per-turn blitz on the ball
     *  carrier vs reserving it for protection. */
    blitzPriority: param(),
    /** How aggressively the IA burns team rerolls (0 = save them all, 100
     *  = reroll the first failed roll). */
    rerollUsage: param(),
    /** Drive tempo — number of yards/turn the IA aims for (0 = stall, 100
     *  = breakneck advance, accept turnovers). */
    pace: param(),
    /** Probability of fouling a prone opponent when the chance arises.
     *  Aligns with Goblins, Underworld, Chaos Renegade rosters. */
    foulFrequency: param(),
    /** Tendency to stall on a winning drive late in the half. */
    stallTendency: param(),
    /** Aggressiveness on kickoff return (0 = safe catch, 100 = breakaway). */
    kickReturn: param(),
    /** Affinity for defensive screen patterns (lot 0.B.1 screen pattern). */
    screenAffinity: param(),
    /** Reads the field for breakaway opportunities (Wood Elves, Skaven). */
    breakawayInstinct: param(),
    /** Tendency to press the opposing carrier vs holding a defensive line. */
    pressingDefense: param(),
    /** Patience to set up plays vs forcing them (low = constant blitz). */
    patience: param(),
    /** Tolerance for risky GFI chains (0 = stop at MA, 100 = chain GFIs). */
    gfiTolerance: param(),
  })
  .strict();

export type TacticalProfile = z.infer<typeof tacticalProfileSchema>;

/**
 * Neutral team profile — every parameter at 50. Used when a team has not
 * configured a profile yet (smoke tests, fallback during data migrations).
 */
export const DEFAULT_TACTICAL_PROFILE: TacticalProfile = Object.freeze({
  bashIndex: 50,
  passingFrequency: 50,
  riskAppetite: 50,
  cageAffinity: 50,
  blitzPriority: 50,
  rerollUsage: 50,
  pace: 50,
  foulFrequency: 50,
  stallTendency: 50,
  kickReturn: 50,
  screenAffinity: 50,
  breakawayInstinct: 50,
  pressingDefense: 50,
  patience: 50,
  gfiTolerance: 50,
}) as TacticalProfile;

/**
 * Strict parser. Accepts a partial input — any missing parameter falls
 * back to the default. Useful for admin tunables that only override a
 * couple of dimensions (e.g. `{ bashIndex: 85 }` for a bash roster).
 *
 * Throws a `ZodError` if the input is malformed (out-of-range, non-integer,
 * unknown key, non-object).
 */
export function parseTacticalProfile(input: unknown): TacticalProfile {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    // Surface a friendly error before Zod's structural one (better DX).
    throw new Error('parseTacticalProfile: expected a plain object');
  }
  const merged = { ...DEFAULT_TACTICAL_PROFILE, ...(input as Record<string, unknown>) };
  return tacticalProfileSchema.parse(merged);
}

/**
 * Non-throwing variant — returns Zod's `success/data` envelope. Useful at
 * API boundaries (admin endpoint, scheduler ingestion). The return type
 * is inferred to stay version-tolerant across Zod major bumps (the named
 * type was renamed between Zod 3 and 4).
 */
export function safeParseTacticalProfile(
  input: unknown
): ReturnType<typeof tacticalProfileSchema.safeParse> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return tacticalProfileSchema.safeParse(input);
  }
  const merged = { ...DEFAULT_TACTICAL_PROFILE, ...(input as Record<string, unknown>) };
  return tacticalProfileSchema.safeParse(merged);
}
