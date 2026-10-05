/**
 * Smoke test perf baseline (Lot 3.B.3).
 *
 * Exécute des vrais matchs (hybrid + full) sur un pairing canonique et
 * vérifie les SLO de performance. Sert de garde-fou de régression :
 * si une refacto rend le sim 10x plus lent, ce test casse en CI.
 *
 * SLO retenus (mesurés sur 5 runs) :
 *   - hybrid.p95 < 500 ms  (typique 30-60 ms en local, headroom CI)
 *   - full.p95   < 15 s    (typique ~1 s en local, 4-6 s sur le runner CI chargé)
 *   (le ratio full/hybride n'est plus borné : avec de vrais rosters le full
 *   driver joue 22 joueurs et ~500 coups, l'hybride reste une abstraction)
 *
 * Les seuils sont volontairement larges pour absorber la variance d'un
 * runner CI partagé. L'objectif est de catcher une regression x5/x10,
 * pas un slowdown subtil — pour ça, voir `compare-drivers` et la
 * Prometheus gauge `nuffle_engine_compare_*`.
 *
 * Test marqué SLOW (timeout 60s) — exclu du --testNamePattern par défaut
 * via une heuristique de durée; reste run en CI standard.
 */

import { describe, expect, it } from "vitest";

import { PRO_LEAGUE_TEAM_BY_ID } from "../tactics/race-profiles";
import { measureSimulationPerf } from "./perf-baseline";
import { buildEngineRoster } from "../driver/engine-roster-fixture";
import type { SimInput } from "../types";

const RUNS = 5;
const HYBRID_P95_BUDGET_MS = 500;
// Lot 1 : vrais matchs à 22 joueurs, ~1 s en local — mais 5,8 s mesurés sur
// le runner CI partagé (turbo lance les suites de tous les workspaces en
// parallèle). Le budget garde l'ordre de grandeur « régression x5/x10 »,
// pas la variance du runner.
const FULL_P95_BUDGET_MS = 15_000;

// Lot 1 « match complet » : rosters de 13 joueurs tirés du catalogue du
// moteur. Sans roster, le full driver jouait à 2 contre 2 (`setup()`) et ce
// smoke ne mesurait pas un match.
function buildSimInput(seed: number): SimInput {
  const home = PRO_LEAGUE_TEAM_BY_ID["pit-smashers"];
  const away = PRO_LEAGUE_TEAM_BY_ID["kc-soaring-hawks"];
  if (!home || !away) {
    throw new Error("Profil pit-smashers / kc-soaring-hawks introuvable");
  }
  return {
    seed,
    home: {
      id: home.id,
      name: home.name,
      side: "home",
      tactics: home.tactics,
      tv: home.tv,
      roster: buildEngineRoster("home", "orc"),
    },
    away: {
      id: away.id,
      name: away.name,
      side: "away",
      tactics: away.tactics,
      tv: away.tv,
      roster: buildEngineRoster("away", "wood_elf"),
    },
  };
}

describe("perf baseline — smoke @slow (Lot 3.B.3)", () => {
  it(
    "hybrid.p95 reste sous le budget",
    () => {
      const out = measureSimulationPerf({
        input: buildSimInput(1),
        driverKind: "hybrid",
        runs: RUNS,
      });
      // eslint-disable-next-line no-console
      console.log(
        `[perf-baseline] hybrid mean=${out.mean.toFixed(1)}ms p95=${out.p95.toFixed(1)}ms max=${out.max.toFixed(1)}ms`,
      );
      expect(out.p95).toBeLessThan(HYBRID_P95_BUDGET_MS);
    },
    { timeout: 30_000 },
  );

  it(
    "full.p95 reste sous le budget",
    () => {
      const out = measureSimulationPerf({
        input: buildSimInput(1),
        driverKind: "full",
        runs: RUNS,
      });
      // eslint-disable-next-line no-console
      console.log(
        `[perf-baseline] full   mean=${out.mean.toFixed(1)}ms p95=${out.p95.toFixed(1)}ms max=${out.max.toFixed(1)}ms`,
      );
      expect(out.p95).toBeLessThan(FULL_P95_BUDGET_MS);
    },
    { timeout: 60_000 },
  );

});
