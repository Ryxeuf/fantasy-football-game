import { describe, it, expect } from "vitest";
import type { Player } from "@bb/game-engine";
import { ROSTER_COLORS } from "@bb/game-engine";
import {
  LEGACY_TEAM_A_COLOR,
  LEGACY_TEAM_B_COLOR,
  STUNNED_COLOR,
  resolveTeamFillColor,
} from "./team-color-resolver";

/** Minimal Player-shaped fixture. The resolver only reads team + stunned. */
function makePlayer(
  team: "A" | "B",
  stunned = false,
): Pick<Player, "team" | "stunned"> {
  return { team, stunned };
}

describe("Regle: team-color-resolver (H.6 sprite sheets - sub-task 1)", () => {
  describe("legacy fallback (no teamRosters, no overrides)", () => {
    it("team A → legacy red", () => {
      expect(resolveTeamFillColor(makePlayer("A"))).toBe(LEGACY_TEAM_A_COLOR);
    });

    it("team B → legacy blue", () => {
      expect(resolveTeamFillColor(makePlayer("B"))).toBe(LEGACY_TEAM_B_COLOR);
    });

    it("stunned team A → grey", () => {
      expect(resolveTeamFillColor(makePlayer("A", true))).toBe(STUNNED_COLOR);
    });

    it("stunned team B → grey", () => {
      expect(resolveTeamFillColor(makePlayer("B", true))).toBe(STUNNED_COLOR);
    });
  });

  describe("roster-based lookup", () => {
    it("uses ROSTER_COLORS primary for a known team A roster", () => {
      const color = resolveTeamFillColor(makePlayer("A"), {
        teamA: "skaven",
      });
      expect(color).toBe(ROSTER_COLORS.skaven.primary);
    });

    it("uses ROSTER_COLORS primary for a known team B roster", () => {
      const color = resolveTeamFillColor(makePlayer("B"), {
        teamA: "skaven",
        teamB: "dwarf",
      });
      expect(color).toBe(ROSTER_COLORS.dwarf.primary);
    });

    it("different rosters produce different colors", () => {
      const a = resolveTeamFillColor(makePlayer("A"), { teamA: "wood_elf" });
      const b = resolveTeamFillColor(makePlayer("B"), { teamB: "dark_elf" });
      expect(a).not.toBe(b);
    });

    it("stunned players stay grey even when roster is provided", () => {
      const color = resolveTeamFillColor(makePlayer("A", true), {
        teamA: "skaven",
      });
      expect(color).toBe(STUNNED_COLOR);
    });

    it("unknown roster falls back to default (not legacy red/blue)", () => {
      const color = resolveTeamFillColor(makePlayer("A"), {
        teamA: "not_a_real_roster",
      });
      // `getTeamColors` returns DEFAULT_TEAM_COLORS for unknown slugs,
      // so the result should NOT be the legacy red.
      expect(color).not.toBe(LEGACY_TEAM_A_COLOR);
    });
  });

  describe("explicit color overrides", () => {
    it("override takes precedence over roster lookup", () => {
      const override = { primary: 0x123456, secondary: 0x654321 };
      const color = resolveTeamFillColor(
        makePlayer("A"),
        { teamA: "skaven" }, // would otherwise return ROSTER_COLORS.skaven.primary
        { teamA: override },
      );
      expect(color).toBe(0x123456);
    });

    it("override on team A does not affect team B", () => {
      const overrideA = { primary: 0x123456, secondary: 0x654321 };
      const color = resolveTeamFillColor(
        makePlayer("B"),
        undefined,
        { teamA: overrideA },
      );
      expect(color).toBe(LEGACY_TEAM_B_COLOR);
    });

    it("stunned players ignore overrides", () => {
      const override = { primary: 0x123456, secondary: 0x654321 };
      const color = resolveTeamFillColor(
        makePlayer("A", true),
        undefined,
        { teamA: override },
      );
      expect(color).toBe(STUNNED_COLOR);
    });
  });

  describe("backwards compatibility", () => {
    it("passing undefined teamRosters is equivalent to legacy behaviour", () => {
      expect(resolveTeamFillColor(makePlayer("A"), undefined)).toBe(
        LEGACY_TEAM_A_COLOR,
      );
      expect(resolveTeamFillColor(makePlayer("B"), undefined)).toBe(
        LEGACY_TEAM_B_COLOR,
      );
    });

    it("empty teamRosters object is equivalent to legacy behaviour", () => {
      expect(resolveTeamFillColor(makePlayer("A"), {})).toBe(
        LEGACY_TEAM_A_COLOR,
      );
      expect(resolveTeamFillColor(makePlayer("B"), {})).toBe(
        LEGACY_TEAM_B_COLOR,
      );
    });
  });
});
