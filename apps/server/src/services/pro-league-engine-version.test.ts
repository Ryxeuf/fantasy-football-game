/**
 * Sprint Pro League lot 1.A.5 — Tests engine version policy.
 *
 * Couvre :
 *  - assertSimulationAllowed : OK quand current = season = match,
 *    refus quand season ≠ current, refus quand match ≠ current.
 *  - isReplayReadOnly : true si version replay ≠ current.
 *  - describeVersionStatus : descripteur lisible avec flags.
 *  - EngineVersionMismatchError : attributes (code, pinnedVersion,
 *    currentVersion, context).
 */

import { describe, it, expect } from "vitest";

import {
  CURRENT_ENGINE_VER,
  EngineVersionMismatchError,
  assertSimulationAllowed,
  describeVersionStatus,
  isReplayReadOnly,
} from "./pro-league-engine-version";

const OTHER_VER = "9.99.99-test";

describe("assertSimulationAllowed — sprint 1.A.5", () => {
  it("OK quand season pinned = current et match jamais simulé", () => {
    expect(() =>
      assertSimulationAllowed({
        engineVer: null,
        season: { id: "s1", engineVer: CURRENT_ENGINE_VER },
      }),
    ).not.toThrow();
  });

  it("OK quand season + match = current", () => {
    expect(() =>
      assertSimulationAllowed({
        engineVer: CURRENT_ENGINE_VER,
        season: { id: "s1", engineVer: CURRENT_ENGINE_VER },
      }),
    ).not.toThrow();
  });

  it("refuse si season pinned à une autre version", () => {
    expect(() =>
      assertSimulationAllowed({
        engineVer: null,
        season: { id: "s1", engineVer: OTHER_VER },
      }),
    ).toThrow(EngineVersionMismatchError);
  });

  it("refuse si match déjà simulé avec une autre version", () => {
    expect(() =>
      assertSimulationAllowed({
        engineVer: OTHER_VER,
        season: { id: "s1", engineVer: CURRENT_ENGINE_VER },
      }),
    ).toThrow(EngineVersionMismatchError);
  });

  it("erreur expose pinnedVersion / currentVersion / context", () => {
    try {
      assertSimulationAllowed({
        engineVer: null,
        season: { id: "s42", engineVer: OTHER_VER },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EngineVersionMismatchError);
      const e = err as EngineVersionMismatchError;
      expect(e.code).toBe("ENGINE_VERSION_MISMATCH");
      expect(e.pinnedVersion).toBe(OTHER_VER);
      expect(e.currentVersion).toBe(CURRENT_ENGINE_VER);
      expect(e.context).toContain("season s42");
    }
  });
});

describe("isReplayReadOnly — sprint 1.A.5", () => {
  it("false quand engineVer match current", () => {
    expect(isReplayReadOnly({ engineVer: CURRENT_ENGINE_VER })).toBe(false);
  });

  it("true quand engineVer ≠ current", () => {
    expect(isReplayReadOnly({ engineVer: OTHER_VER })).toBe(true);
  });
});

describe("describeVersionStatus — sprint 1.A.5", () => {
  it("canSimulate=true + readOnly=false sur match aligned", () => {
    const out = describeVersionStatus({
      engineVer: null,
      season: { id: "s1", engineVer: CURRENT_ENGINE_VER },
    });
    expect(out.canSimulate).toBe(true);
    expect(out.isReplayReadOnly).toBe(false);
    expect(out.currentEngine).toBe(CURRENT_ENGINE_VER);
    expect(out.pinnedSeasonEngine).toBe(CURRENT_ENGINE_VER);
    expect(out.matchEngine).toBeNull();
  });

  it("canSimulate=false + readOnly=true sur match avec ancien engineVer", () => {
    const out = describeVersionStatus({
      engineVer: OTHER_VER,
      season: { id: "s1", engineVer: CURRENT_ENGINE_VER },
    });
    expect(out.canSimulate).toBe(false);
    expect(out.isReplayReadOnly).toBe(true);
    expect(out.matchEngine).toBe(OTHER_VER);
  });

  it("canSimulate=false sur saison pinnée à une autre version", () => {
    const out = describeVersionStatus({
      engineVer: null,
      season: { id: "s1", engineVer: OTHER_VER },
    });
    expect(out.canSimulate).toBe(false);
    // Match pas encore simulé → pas read-only
    expect(out.isReplayReadOnly).toBe(false);
  });
});
