/**
 * Service Nuffle Coach — cycles de saison.
 *
 * Une saison NFL (18 semaines reg + 4 playoffs) est decoupee en 4
 * cycles :
 *   - Cycle 1 (regular) : W1-W6
 *   - Cycle 2 (regular) : W7-W12
 *   - Cycle 3 (regular) : W13-W18
 *   - Cycle 4 (playoffs) : W19-W22
 *
 * Chaque championnat Nuffle Coach est rattache a un cycle pour
 * limiter l'engagement a ~6 semaines, permettre 3 occasions de
 * gagner par saison, et gerer la creation tardive via le pattern
 * "snap-to-next-window" : on refuse de creer un championnat sur un
 * cycle deja demarre et on redirige vers le cycle suivant.
 *
 * Patterns repris :
 *   - Erreurs typees `XxxError extends Error` avec `code` enum string
 *     (cf. CLAUDE.md).
 *   - Helpers purs (`pickCycleForCreation`, `findWeekNumberAt`) pour
 *     pouvoir tester sans Prisma.
 */

import { prisma } from "../prisma";

// ────────────────────────────────────────────────────────────────────
// Erreur typee
// ────────────────────────────────────────────────────────────────────

export type NflFantasyCycleErrorCode =
  | "CYCLE_NOT_FOUND"
  | "CYCLE_ALREADY_STARTED"
  | "NO_JOINABLE_CYCLE"
  | "INVALID_CYCLE_SHAPE";

export class NflFantasyCycleError extends Error {
  constructor(
    public readonly code: NflFantasyCycleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyCycleError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Types publics
// ────────────────────────────────────────────────────────────────────

export interface CycleDTO {
  readonly id: string;
  readonly seasonId: string;
  readonly cycleNumber: number;
  readonly cycleType: "regular" | "playoffs";
  readonly label: string;
  readonly startWeek: number;
  readonly endWeek: number;
}

export interface CycleStatus extends CycleDTO {
  /**
   * "upcoming" : pas encore demarre, on peut creer un championnat
   * dedie. "active" : en cours, plus joignable (snap-to-next).
   * "closed" : termine.
   */
  readonly status: "upcoming" | "active" | "closed";
  /** Date debut du cycle (startDate de la 1ere NflWeek du cycle). */
  readonly startsAt: Date | null;
  /** Date fin du cycle (endDate de la derniere NflWeek du cycle). */
  readonly endsAt: Date | null;
}

// ────────────────────────────────────────────────────────────────────
// Helpers purs (testables sans Prisma)
// ────────────────────────────────────────────────────────────────────

export interface WeekRow {
  readonly weekNumber: number;
  readonly startDate: Date;
  readonly endDate: Date;
}

/**
 * Retourne le `weekNumber` actif a la date `now`. Trois plages :
 *   - now < premier startDate  => 0 (saison pas commencee, tout cycle est upcoming)
 *   - dans une semaine          => son weekNumber
 *   - now >= dernier endDate    => last.weekNumber + 1 (saison terminee,
 *     tout cycle doit etre closed — y compris le cycle playoffs qui
 *     contient la derniere semaine)
 */
export function findWeekNumberAt(
  weeks: readonly WeekRow[],
  now: Date,
): number {
  if (weeks.length === 0) return 0;
  const sorted = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (now < first.startDate) return 0;
  if (now >= last.endDate) return last.weekNumber + 1;
  for (const w of sorted) {
    if (now >= w.startDate && now < w.endDate) {
      return w.weekNumber;
    }
  }
  // Faute de match strict (gap entre semaines), retourne le plus
  // recent commence.
  let candidate = first.weekNumber;
  for (const w of sorted) {
    if (w.startDate <= now) candidate = w.weekNumber;
  }
  return candidate;
}

/**
 * Determine le status d'un cycle en fonction du `currentWeek` :
 *   - currentWeek === 0       => "upcoming" (saison pas commencee)
 *   - currentWeek < startWeek => "upcoming"
 *   - currentWeek > endWeek   => "closed"
 *   - sinon                   => "active"
 */
export function statusOf(
  cycle: CycleDTO,
  currentWeek: number,
): "upcoming" | "active" | "closed" {
  if (currentWeek < cycle.startWeek) return "upcoming";
  if (currentWeek > cycle.endWeek) return "closed";
  return "active";
}

/**
 * Snap-to-next : retourne le premier cycle "upcoming" pour la saison.
 * Si aucun cycle upcoming n'existe (tous demarres ou termines),
 * retourne `null` — l'appelant doit alors throw NO_JOINABLE_CYCLE.
 */
export function pickCycleForCreation(
  cycles: readonly CycleDTO[],
  currentWeek: number,
): CycleDTO | null {
  const sorted = [...cycles].sort((a, b) => a.cycleNumber - b.cycleNumber);
  for (const c of sorted) {
    if (statusOf(c, currentWeek) === "upcoming") return c;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────
// Defaults pour le seed
// ────────────────────────────────────────────────────────────────────

export interface CycleSeedSpec {
  readonly cycleNumber: number;
  readonly cycleType: "regular" | "playoffs";
  readonly label: string;
  readonly startWeek: number;
  readonly endWeek: number;
}

/**
 * Decoupage par defaut d'une saison NFL : 3 cycles reguliers de 6
 * semaines + 1 cycle playoffs de 4 semaines.
 */
export const DEFAULT_CYCLE_SPECS: ReadonlyArray<CycleSeedSpec> = [
  { cycleNumber: 1, cycleType: "regular", label: "Conférence 1", startWeek: 1, endWeek: 6 },
  { cycleNumber: 2, cycleType: "regular", label: "Conférence 2", startWeek: 7, endWeek: 12 },
  { cycleNumber: 3, cycleType: "regular", label: "Conférence 3", startWeek: 13, endWeek: 18 },
  { cycleNumber: 4, cycleType: "playoffs", label: "Playoffs", startWeek: 19, endWeek: 22 },
];

// ────────────────────────────────────────────────────────────────────
// API publique (avec Prisma)
// ────────────────────────────────────────────────────────────────────

interface CycleRow {
  id: string;
  seasonId: string;
  cycleNumber: number;
  cycleType: string;
  label: string;
  startWeek: number;
  endWeek: number;
}

function toDTO(row: CycleRow): CycleDTO {
  return {
    id: row.id,
    seasonId: row.seasonId,
    cycleNumber: row.cycleNumber,
    cycleType: row.cycleType === "playoffs" ? "playoffs" : "regular",
    label: row.label,
    startWeek: row.startWeek,
    endWeek: row.endWeek,
  };
}

/**
 * Retourne le `weekNumber` actif pour la saison `seasonId` a la date
 * `now`. Voir `findWeekNumberAt` pour la semantique.
 */
export async function getCurrentWeekNumber(
  seasonId: string,
  now: Date = new Date(),
): Promise<number> {
  const weeks = await prisma.nflWeek.findMany({
    where: { seasonId },
    select: { weekNumber: true, startDate: true, endDate: true },
    orderBy: { weekNumber: "asc" },
  });
  return findWeekNumberAt(weeks, now);
}

/**
 * Liste tous les cycles d'une saison, enrichis avec leur status et
 * leurs bornes dates (derivees de NflWeek).
 */
export async function listCyclesWithStatus(
  seasonId: string,
  now: Date = new Date(),
): Promise<CycleStatus[]> {
  const cycles: CycleRow[] = await prisma.nflFantasySeasonCycle.findMany({
    where: { seasonId },
    orderBy: { cycleNumber: "asc" },
  });
  const weeks: WeekRow[] = await prisma.nflWeek.findMany({
    where: { seasonId },
    select: { weekNumber: true, startDate: true, endDate: true },
  });
  const currentWeek = findWeekNumberAt(weeks, now);
  const weekByNumber = new Map<number, WeekRow>(
    weeks.map((w) => [w.weekNumber, w] as const),
  );
  return cycles.map((c) => {
    const dto = toDTO(c);
    return {
      ...dto,
      status: statusOf(dto, currentWeek),
      startsAt: weekByNumber.get(dto.startWeek)?.startDate ?? null,
      endsAt: weekByNumber.get(dto.endWeek)?.endDate ?? null,
    };
  });
}

/**
 * Retourne le cycle a utiliser pour creer un nouveau championnat
 * sur la saison `seasonId` (snap-to-next-window).
 *
 * @throws NflFantasyCycleError NO_JOINABLE_CYCLE si tous les cycles
 *   sont demarres ou termines.
 */
export async function getNextJoinableCycle(
  seasonId: string,
  now: Date = new Date(),
): Promise<CycleDTO> {
  const cycles: CycleRow[] = await prisma.nflFantasySeasonCycle.findMany({
    where: { seasonId },
    orderBy: { cycleNumber: "asc" },
  });
  const weeks: WeekRow[] = await prisma.nflWeek.findMany({
    where: { seasonId },
    select: { weekNumber: true, startDate: true, endDate: true },
  });
  const currentWeek = findWeekNumberAt(weeks, now);
  const picked = pickCycleForCreation(cycles.map(toDTO), currentWeek);
  if (!picked) {
    throw new NflFantasyCycleError(
      "NO_JOINABLE_CYCLE",
      `Aucun cycle joignable pour la saison ${seasonId} : tous demarres ou termines`,
    );
  }
  return picked;
}

/**
 * Fetch un cycle par id. Throws CYCLE_NOT_FOUND si absent.
 */
export async function getCycleById(cycleId: string): Promise<CycleDTO> {
  const row = await prisma.nflFantasySeasonCycle.findUnique({
    where: { id: cycleId },
  });
  if (!row) {
    throw new NflFantasyCycleError(
      "CYCLE_NOT_FOUND",
      `Cycle ${cycleId} introuvable`,
    );
  }
  return toDTO(row);
}

/**
 * Assure qu'un cycle `cycleId` est joignable a la date `now`. Throws
 * CYCLE_ALREADY_STARTED sinon. Utilise par createLeague pour valider
 * le choix manuel d'un cycle (cas avance ; le defaut est snap-to-next).
 */
export async function assertCycleJoinable(
  cycleId: string,
  now: Date = new Date(),
): Promise<CycleDTO> {
  const cycle = await getCycleById(cycleId);
  const weeks = await prisma.nflWeek.findMany({
    where: { seasonId: cycle.seasonId },
    select: { weekNumber: true, startDate: true, endDate: true },
  });
  const currentWeek = findWeekNumberAt(weeks, now);
  const status = statusOf(cycle, currentWeek);
  if (status !== "upcoming") {
    throw new NflFantasyCycleError(
      "CYCLE_ALREADY_STARTED",
      `Cycle ${cycle.label} a deja demarre (status: ${status}). Choisis le cycle suivant.`,
    );
  }
  return cycle;
}

/**
 * Idempotent : seed les 4 cycles par defaut pour une saison. Utilise
 * par seed.ts et par bootstrap-nfl-prod.
 */
export async function seedDefaultCyclesForSeason(
  seasonId: string,
): Promise<void> {
  for (const spec of DEFAULT_CYCLE_SPECS) {
    await prisma.nflFantasySeasonCycle.upsert({
      where: {
        seasonId_cycleNumber: { seasonId, cycleNumber: spec.cycleNumber },
      },
      update: {
        cycleType: spec.cycleType,
        label: spec.label,
        startWeek: spec.startWeek,
        endWeek: spec.endWeek,
      },
      create: {
        seasonId,
        cycleNumber: spec.cycleNumber,
        cycleType: spec.cycleType,
        label: spec.label,
        startWeek: spec.startWeek,
        endWeek: spec.endWeek,
      },
    });
  }
}
