/**
 * Service engine-comparison (Lot 3.B.2).
 *
 * Orchestre une comparaison hybrid vs full driver :
 *  1. Valide les inputs (teams existantes, matches > 0, seedOffset finite).
 *  2. Construit `SimInput` à partir des profils PRO_LEAGUE_TEAM_BY_ID.
 *  3. Appelle `compareDriversOnce` N fois avec des seeds incrémentés.
 *  4. Aggrège via `aggregateComparisons`.
 *  5. Persiste un row `EngineComparison` (snapshot audit).
 *  6. Met à jour les Prometheus gauges (`nuffle_engine_compare_*`).
 *
 * Pure → I/O sépare : la validation et la construction du SimInput
 * sont déterministes. Seules les étapes 5 et 6 ont des side-effects.
 *
 * Si le sim throw (cas runtime du full driver, lot 3.A.2 toujours en
 * stabilisation), on propage l'erreur SANS écrire dans la DB ni
 * toucher les gauges — éviter les snapshots partiellement-aggregés.
 */

import {
  ENGINE_VER,
  PRO_LEAGUE_TEAM_BY_ID,
  aggregateComparisons,
  compareDriversOnce,
  type ComparisonAggregate,
  type ComparisonRun,
  type ProTeamProfile,
} from "@bb/sim-engine";
import type { SimInput } from "@bb/sim-engine";

import { prisma } from "../prisma";
import { appMetrics, type MetricsRegistry } from "../utils/metrics";

export interface RunEngineComparisonInput {
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly matches: number;
  readonly seedOffset: number;
  /** 'cli' | 'admin' (default 'admin'). */
  readonly source?: "cli" | "admin";
}

export interface RunEngineComparisonOptions {
  /** Permet d'injecter un mock metrics dans les tests. */
  readonly metrics?: MetricsRegistry;
}

export interface RunEngineComparisonResult {
  readonly id: string;
  readonly aggregate: ComparisonAggregate;
  readonly engineVer: string;
}

function buildSimInput(
  home: ProTeamProfile,
  away: ProTeamProfile,
  seed: number,
): SimInput {
  return {
    seed,
    home: {
      id: home.id,
      name: home.name,
      side: "home",
    },
    away: {
      id: away.id,
      name: away.name,
      side: "away",
    },
  };
}

/**
 * Concatène `<homeId>__<awayId>` pour le label Prometheus `pairing`.
 * Choisi pour rester human-readable dans Grafana et limiter la
 * cardinalité (240 max sur 16 équipes Pro League).
 */
function pairingLabel(homeTeamId: string, awayTeamId: string): string {
  return `${homeTeamId}__${awayTeamId}`;
}

export async function runEngineComparison(
  input: RunEngineComparisonInput,
  options: RunEngineComparisonOptions = {},
): Promise<RunEngineComparisonResult> {
  if (input.homeTeamId === input.awayTeamId) {
    throw new Error("homeTeamId et awayTeamId doivent être distincts");
  }
  if (
    !Number.isInteger(input.matches) ||
    input.matches <= 0 ||
    input.matches > 1000
  ) {
    throw new Error(
      "matches doit être un entier positif (1..1000) — au-delà, faire plusieurs runs",
    );
  }
  if (!Number.isFinite(input.seedOffset)) {
    throw new Error("seedOffset doit être un nombre fini");
  }

  const home = PRO_LEAGUE_TEAM_BY_ID[input.homeTeamId];
  const away = PRO_LEAGUE_TEAM_BY_ID[input.awayTeamId];
  if (!home) {
    throw new Error(`Team home inconnue : ${input.homeTeamId}`);
  }
  if (!away) {
    throw new Error(`Team away inconnue : ${input.awayTeamId}`);
  }

  // Étape 3 — exécute le comparator. Si le sim throw on propage SANS
  // toucher la DB / gauges (snapshots cohérents only).
  const runs: ComparisonRun[] = [];
  for (let i = 0; i < input.matches; i++) {
    runs.push(
      compareDriversOnce(buildSimInput(home, away, input.seedOffset + i)),
    );
  }
  const aggregate = aggregateComparisons(runs);

  // Étape 5 — persistence.
  const source = input.source ?? "admin";
  const outcomeFlippedPct =
    aggregate.matches > 0
      ? aggregate.outcomeFlippedCount / aggregate.matches
      : 0;
  const created = (await prisma.engineComparison.create({
    data: {
      engineVer: ENGINE_VER,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      matches: aggregate.matches,
      seedOffset: input.seedOffset,
      meanScoreDelta: aggregate.scoreTotal.mean,
      p95ScoreDelta: aggregate.scoreTotal.p95,
      maxScoreDelta: aggregate.scoreTotal.max,
      meanTurnoverDelta: aggregate.turnoverCount.mean,
      meanTouchdownDelta: aggregate.touchdownCount.mean,
      meanCasualtyDelta: aggregate.casualtyCount.mean,
      outcomeFlippedCount: aggregate.outcomeFlippedCount,
      divergedPct: aggregate.divergedPct,
      source,
    },
    select: { id: true },
  })) as { id: string };

  // Étape 6 — gauges.
  const metrics = options.metrics ?? appMetrics;
  metrics.setEngineCompareStats(
    {
      engineVer: ENGINE_VER,
      pairing: pairingLabel(input.homeTeamId, input.awayTeamId),
    },
    {
      meanScoreDelta: aggregate.scoreTotal.mean,
      p95ScoreDelta: aggregate.scoreTotal.p95,
      divergedPct: aggregate.divergedPct,
      outcomeFlippedPct,
    },
  );

  return { id: created.id, aggregate, engineVer: ENGINE_VER };
}
