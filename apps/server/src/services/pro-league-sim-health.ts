/**
 * Pro League sim health snapshot — Lot 2.B.3 (extension Lot 4.A.3).
 *
 * Ce service fournit une vue agrégée pour le dashboard admin
 * `/admin/sim/health`, en combinant :
 *
 *   - les `DriftSample` (pareil que `GET /admin/sim/drift`),
 *   - les `DriftAlert` issues de `detectDriftAlerts` (Lot 4.A.3),
 *   - les `RaceBoundAlert` issues de `detectRaceBoundAlerts` (Lot 4.A.3),
 *   - le timestamp `lastSimAt` du dernier match Pro League completé.
 *
 * Pourquoi un service séparé plutôt qu'un fan-out côté UI ?
 *   - 1 round-trip réseau au lieu de 3 (drift + alerts + last-sim).
 *   - Cohérence temporelle : tous les chiffres affichés sont calculés
 *     sur le même `samples` et le même `now()`.
 *   - Le client ne connaît rien des seuils 10/25% et des bornes BB —
 *     seul le serveur les applique.
 */

import { prisma } from "../prisma";
import {
  computeEngineDrift,
  countAlertsBySeverity,
  detectDriftAlerts,
  type ComputeDriftOptions,
  type DriftAlert,
  type DriftSample,
} from "./pro-league-engine-drift-watcher";
import {
  detectRaceBoundAlerts,
  type RaceBoundAlert,
} from "./pro-league-race-bounds";

export interface SimHealthSnapshot {
  readonly samples: readonly DriftSample[];
  readonly driftAlerts: readonly DriftAlert[];
  readonly boundAlerts: readonly RaceBoundAlert[];
  readonly counts: {
    readonly warn: number;
    readonly critical: number;
  };
  /** ISO datetime du dernier match Pro League non-test completé. `null` si aucun. */
  readonly lastSimAt: string | null;
  readonly computedAt: string;
}

async function fetchLastSimAt(seasonId?: string): Promise<string | null> {
  const last = await prisma.proLeagueMatch.findFirst({
    where: {
      status: "completed",
      isTest: false,
      ...(seasonId ? { seasonId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  return last ? last.updatedAt.toISOString() : null;
}

export async function computeSimHealthSnapshot(
  options: ComputeDriftOptions = {},
): Promise<SimHealthSnapshot> {
  const samples = await computeEngineDrift(options);
  const driftAlerts = detectDriftAlerts(samples);
  const boundAlerts = detectRaceBoundAlerts(samples);
  const driftCounts = countAlertsBySeverity(driftAlerts);
  const lastSimAt = await fetchLastSimAt(options.seasonId);
  return {
    samples,
    driftAlerts,
    boundAlerts,
    counts: {
      warn: driftCounts.warn,
      critical: driftCounts.critical + boundAlerts.length,
    },
    lastSimAt,
    computedAt: (options.now ?? new Date()).toISOString(),
  };
}
