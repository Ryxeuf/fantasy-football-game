/**
 * Verbose mode pour le full driver (Lot 3.B.3).
 *
 * `runFullDriver` retourne déjà la liste des `MatchEvent` du match, mais
 * leur granularité (par action) n'est pas optimale pour répondre à des
 * questions de debug type :
 *   - "le driver a-t-il joué exactement 16 tours en half 1 ?"
 *   - "à quel tour est tombé le premier turnover ?"
 *   - "le match s'est-il terminé proprement ou via timeout ?"
 *
 * `extractFullDriverTrace` post-process le `SimResult.events` pour
 * regrouper les events par tour (`TURN_START` → `TURN_START` suivant
 * ou `END`) et compter les agrégats utiles. C'est purement déclaratif :
 * pas d'instrumentation invasive du driver, pas de re-run du sim.
 *
 * Exposition publique via `runFullDriverWithTrace` qui renvoie
 * `{ result, trace }` — utile pour `/admin/sim/replay/:id?verbose=1`
 * et pour des assertions précises dans les tests d'intégration.
 */

import { runFullDriver } from "./full-driver";
import type { MatchEvent, SimInput, SimResult } from "../types";

export type DrivingTeamSide = "home" | "away";

/** Snapshot d'un tour reconstruit depuis les events. */
export interface FullDriverTraceTurn {
  /** 1 ou 2 (mi-temps). */
  readonly half: number;
  /** Numéro du tour dans la mi-temps (1..16 typiquement). */
  readonly turn: number;
  /** Équipe qui drive ce tour. */
  readonly drivingTeam: DrivingTeamSide;
  /**
   * displayAtMs du `TURN_START` correspondant — permet de retrouver
   * le tour dans le timeline du replay.
   */
  readonly startedAtMs: number;
  /** Nombre total d'events dans ce tour (hors le TURN_START lui-même). */
  readonly eventCount: number;
  readonly touchdownCount: number;
  readonly casualtyCount: number;
  readonly koCount: number;
  /** True si un TURNOVER a fini le tour. */
  readonly hasTurnover: boolean;
}

/** Stats globales sur un match tracé. */
export interface FullDriverTraceSummary {
  readonly totalTurns: number;
  readonly totalTouchdowns: number;
  readonly totalCasualties: number;
  readonly totalKos: number;
  readonly turnsWithTurnover: number;
  /** True ssi un event END est présent (terminaison normale). */
  readonly endedNormally: boolean;
}

export interface FullDriverTrace {
  readonly turns: readonly FullDriverTraceTurn[];
  readonly summary: FullDriverTraceSummary;
}

interface MutableTurn {
  half: number;
  turn: number;
  drivingTeam: DrivingTeamSide;
  startedAtMs: number;
  eventCount: number;
  touchdownCount: number;
  casualtyCount: number;
  koCount: number;
  hasTurnover: boolean;
}

function toTurn(t: MutableTurn): FullDriverTraceTurn {
  return {
    half: t.half,
    turn: t.turn,
    drivingTeam: t.drivingTeam,
    startedAtMs: t.startedAtMs,
    eventCount: t.eventCount,
    touchdownCount: t.touchdownCount,
    casualtyCount: t.casualtyCount,
    koCount: t.koCount,
    hasTurnover: t.hasTurnover,
  };
}

function readDrivingTeam(meta: Readonly<Record<string, unknown>> | undefined): DrivingTeamSide {
  const v = meta?.drivingTeam;
  return v === "away" ? "away" : "home";
}

function readNumber(
  meta: Readonly<Record<string, unknown>> | undefined,
  key: string,
  dflt: number,
): number {
  const v = meta?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : dflt;
}

export function extractFullDriverTrace(result: SimResult): FullDriverTrace {
  const turns: MutableTurn[] = [];
  let current: MutableTurn | null = null;

  for (const event of result.events as readonly MatchEvent[]) {
    if (event.type === "TURN_START") {
      const meta = event.meta as Readonly<Record<string, unknown>> | undefined;
      current = {
        half: readNumber(meta, "half", 1),
        turn: readNumber(meta, "turn", 1),
        drivingTeam: readDrivingTeam(meta),
        startedAtMs: event.displayAtMs,
        eventCount: 0,
        touchdownCount: 0,
        casualtyCount: 0,
        koCount: 0,
        hasTurnover: false,
      };
      turns.push(current);
      continue;
    }
    if (!current) continue;
    if (event.type === "END") continue; // borne externe, pas dans le tour
    current.eventCount += 1;
    if (event.type === "TD") current.touchdownCount += 1;
    else if (event.type === "CASUALTY") current.casualtyCount += 1;
    else if (event.type === "KO") current.koCount += 1;
    else if (event.type === "TURNOVER") current.hasTurnover = true;
  }

  const endedNormally = result.events.some((e) => e.type === "END");
  const totalTouchdowns = turns.reduce((acc, t) => acc + t.touchdownCount, 0);
  const totalCasualties = turns.reduce((acc, t) => acc + t.casualtyCount, 0);
  const totalKos = turns.reduce((acc, t) => acc + t.koCount, 0);
  const turnsWithTurnover = turns.filter((t) => t.hasTurnover).length;

  return {
    turns: turns.map(toTurn),
    summary: {
      totalTurns: turns.length,
      totalTouchdowns,
      totalCasualties,
      totalKos,
      turnsWithTurnover,
      endedNormally,
    },
  };
}

/**
 * Wrapper opt-in : exécute `runFullDriver` puis post-process la trace.
 * Coût additionnel négligeable (~O(events) sur ~200 events typiques).
 */
export function runFullDriverWithTrace(
  input: SimInput,
): { readonly result: SimResult; readonly trace: FullDriverTrace } {
  const result = runFullDriver(input);
  return { result, trace: extractFullDriverTrace(result) };
}
