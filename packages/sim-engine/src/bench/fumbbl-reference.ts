/**
 * FUMBBL reference dataset — sprint Pro League 0.D.2.
 *
 * Static snapshot des stats publiques FUMBBL utilise comme baseline
 * par la tuning loop (lot 0.E.1) : tous les matchups raciaux du sim
 * engine doivent rester dans ±10% des winrates / casualty rates / TD
 * averages / drive durations de FUMBBL pour passer le gate Phase 0.
 *
 * Donnees
 * -------
 * Le snapshot est versionne dans `reference-fumbbl.json` aux cotes de
 * cette source. Il couvre 16 races correspondant aux 16 equipes Pro
 * League (lot 0.B.3) plus quelques races communes (High Elf, Chaos
 * Chosen) pour un cross-check statistique large.
 *
 * Les valeurs sont des **approximations** basees sur les archives
 * publiques FUMBBL et les agregats de tournois NAF (BB2020). Elles
 * seront raffinees via la boucle d'iteration 0.E.1 quand des donnees
 * scrapees plus precises seront disponibles. Le sprint ne requiert
 * pas un scrape live ici — seulement un baseline versionne reproductible.
 */

import { z } from 'zod';

import dataset from './reference-fumbbl.json';

const raceStatsSchema = z
  .object({
    /** Match-level winrate ∈ (0, 1). */
    winrate: z.number().min(0).max(1),
    /** Average casualties caused per match. */
    casualtyRate: z.number().min(0).max(10),
    /** Average TDs scored per match. */
    tdAverage: z.number().min(0).max(10),
    /** Average drive duration in turns. */
    driveDurationTurns: z.number().min(1).max(8),
  })
  .strict();

export type FumbblRaceStats = z.infer<typeof raceStatsSchema>;

const fumbblReferenceSchema = z
  .object({
    /** Snapshot identifier (e.g. `'fumbbl-2024-snapshot'`). */
    version: z.string().min(1),
    /** ISO date string of the snapshot. */
    snapshotAt: z.string().min(1),
    /** Free-form provenance description. */
    source: z.string().min(1),
    /** Number of matches the aggregates were drawn from. */
    sampleSize: z.number().int().positive(),
    /** Per-race stats keyed by race name. */
    races: z.record(z.string(), raceStatsSchema),
  })
  .strict();

export type FumbblReference = z.infer<typeof fumbblReferenceSchema>;

/** Strict parser. Throws `ZodError` if the input does not match. */
export function parseFumbblReference(input: unknown): FumbblReference {
  return fumbblReferenceSchema.parse(input);
}

/** Lazy-loaded reference snapshot — validated at module init. */
export const FUMBBL_REFERENCE: FumbblReference = parseFumbblReference(dataset);

/**
 * Tolerance band for matchup winrate / casualty rate / TD average etc.
 * Sprint table : "tous les matchups raciaux dans ±10% du winrate FUMBBL"
 * (lot 0.E.1 tuning loop target).
 */
export const FUMBBL_TOLERANCE = 0.1;

/**
 * Returns the stats for the given race, or `undefined` if the race is
 * not in the dataset. Race names match the BB roster identifier
 * (case-sensitive). Use `getFumbblRaceStatsOrThrow` when the caller
 * knows the race must exist (16 Pro League team profiles).
 */
export function getFumbblRaceStats(race: string): FumbblRaceStats | undefined {
  return FUMBBL_REFERENCE.races[race];
}

export function getFumbblRaceStatsOrThrow(race: string): FumbblRaceStats {
  const stats = getFumbblRaceStats(race);
  if (!stats) {
    throw new Error(`getFumbblRaceStatsOrThrow: unknown race '${race}'`);
  }
  return stats;
}

/**
 * Compares a single observed metric against the FUMBBL reference and
 * returns whether the deviation stays within `FUMBBL_TOLERANCE` (±10%
 * relative). Used by the bench harness CI gate (lot 0.D.4).
 */
export function isWithinFumbblTolerance(
  observed: number,
  reference: number,
  tolerance: number = FUMBBL_TOLERANCE
): boolean {
  if (reference === 0) {
    // Avoid div-by-zero ; require absolute deviation to stay below the tolerance band.
    return Math.abs(observed) <= tolerance;
  }
  return Math.abs(observed - reference) / Math.abs(reference) <= tolerance;
}
