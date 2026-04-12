import { describe, it, expect } from "vitest";
import type { GameState, Player, TeamSpriteManifest } from "@bb/game-engine";
import { ROSTER_COLORS, TEAM_SPRITE_MANIFESTS } from "@bb/game-engine";
import {
  LEGACY_TEAM_A_COLOR,
  LEGACY_TEAM_B_COLOR,
  LEGACY_TEAM_A_OUTLINE,
  LEGACY_TEAM_B_OUTLINE,
  STUNNED_COLOR,
  STUNNED_OUTLINE_COLOR,
  resolveTeamFillColor,
  resolveTeamOutlineColor,
  resolveTeamRostersFromState,
  resolveTeamSpriteManifest,
  shouldUseTeamSprite,
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

describe("Regle: resolveTeamRostersFromState (H.6 foundation)", () => {
  /** Builds a partial GameState exposing only the teamRosters field. */
  function stateWith(teamRosters?: GameState["teamRosters"]): Pick<
    GameState,
    "teamRosters"
  > {
    return { teamRosters };
  }

  it("returns the prop override verbatim when provided", () => {
    const prop = { teamA: "wood_elf", teamB: "dark_elf" };
    expect(
      resolveTeamRostersFromState(stateWith({ teamA: "orc", teamB: "dwarf" }), prop),
    ).toEqual(prop);
  });

  it("falls back to state.teamRosters when no prop override", () => {
    const state = stateWith({ teamA: "skaven", teamB: "lizardmen" });
    expect(resolveTeamRostersFromState(state)).toEqual({
      teamA: "skaven",
      teamB: "lizardmen",
    });
  });

  it("returns undefined when neither prop nor state provide slugs", () => {
    expect(resolveTeamRostersFromState(stateWith(undefined))).toBeUndefined();
    expect(resolveTeamRostersFromState(stateWith({}))).toBeUndefined();
  });

  it("returns undefined when state is null/undefined (e.g. loading state)", () => {
    expect(resolveTeamRostersFromState(undefined)).toBeUndefined();
    expect(resolveTeamRostersFromState(null)).toBeUndefined();
  });

  it("merges partial prop override with state fallback (prop wins per side)", () => {
    const state = stateWith({ teamA: "skaven", teamB: "lizardmen" });
    const prop = { teamA: "wood_elf" }; // no teamB
    expect(resolveTeamRostersFromState(state, prop)).toEqual({
      teamA: "wood_elf",
      teamB: "lizardmen",
    });
  });

  it("end-to-end: state-driven roster slug produces correct fill color", () => {
    const state = stateWith({ teamA: "orc", teamB: "dwarf" });
    const resolved = resolveTeamRostersFromState(state);
    const colorA = resolveTeamFillColor(
      { team: "A", stunned: false },
      resolved,
    );
    const colorB = resolveTeamFillColor(
      { team: "B", stunned: false },
      resolved,
    );
    expect(colorA).toBe(ROSTER_COLORS.orc.primary);
    expect(colorB).toBe(ROSTER_COLORS.dwarf.primary);
  });
});

describe("Regle: resolveTeamOutlineColor (H.6 sprite sheets - sub-task 3)", () => {
  function makePlayer(
    team: "A" | "B",
    stunned = false,
  ): Pick<Player, "team" | "stunned"> {
    return { team, stunned };
  }

  describe("legacy fallback (no teamRosters, no overrides)", () => {
    it("team A → legacy A outline", () => {
      expect(resolveTeamOutlineColor(makePlayer("A"))).toBe(
        LEGACY_TEAM_A_OUTLINE,
      );
    });

    it("team B → legacy B outline", () => {
      expect(resolveTeamOutlineColor(makePlayer("B"))).toBe(
        LEGACY_TEAM_B_OUTLINE,
      );
    });

    it("stunned players → stunned outline regardless of team", () => {
      expect(resolveTeamOutlineColor(makePlayer("A", true))).toBe(
        STUNNED_OUTLINE_COLOR,
      );
      expect(resolveTeamOutlineColor(makePlayer("B", true))).toBe(
        STUNNED_OUTLINE_COLOR,
      );
    });
  });

  describe("roster-based lookup (uses secondary color)", () => {
    it("uses ROSTER_COLORS.secondary for a known team A roster", () => {
      const color = resolveTeamOutlineColor(makePlayer("A"), {
        teamA: "skaven",
      });
      expect(color).toBe(ROSTER_COLORS.skaven.secondary);
    });

    it("uses ROSTER_COLORS.secondary for a known team B roster", () => {
      const color = resolveTeamOutlineColor(makePlayer("B"), {
        teamA: "skaven",
        teamB: "dwarf",
      });
      expect(color).toBe(ROSTER_COLORS.dwarf.secondary);
    });

    it("primary and outline must differ for a known roster", () => {
      const fill = resolveTeamFillColor(makePlayer("A"), { teamA: "orc" });
      const outline = resolveTeamOutlineColor(makePlayer("A"), {
        teamA: "orc",
      });
      expect(fill).not.toBe(outline);
    });

    it("stunned players stay on stunned outline even when roster is provided", () => {
      const color = resolveTeamOutlineColor(makePlayer("A", true), {
        teamA: "skaven",
      });
      expect(color).toBe(STUNNED_OUTLINE_COLOR);
    });
  });

  describe("explicit color overrides", () => {
    it("override takes precedence over roster lookup", () => {
      const override = { primary: 0x123456, secondary: 0x654321 };
      const color = resolveTeamOutlineColor(
        makePlayer("A"),
        { teamA: "skaven" },
        { teamA: override },
      );
      expect(color).toBe(0x654321);
    });

    it("override on team A does not affect team B", () => {
      const overrideA = { primary: 0x123456, secondary: 0x654321 };
      const color = resolveTeamOutlineColor(
        makePlayer("B"),
        undefined,
        { teamA: overrideA },
      );
      expect(color).toBe(LEGACY_TEAM_B_OUTLINE);
    });

    it("stunned players ignore overrides", () => {
      const override = { primary: 0x123456, secondary: 0x654321 };
      const color = resolveTeamOutlineColor(
        makePlayer("A", true),
        undefined,
        { teamA: override },
      );
      expect(color).toBe(STUNNED_OUTLINE_COLOR);
    });
  });

  describe("backwards compatibility", () => {
    it("undefined teamRosters returns the legacy outlines", () => {
      expect(resolveTeamOutlineColor(makePlayer("A"), undefined)).toBe(
        LEGACY_TEAM_A_OUTLINE,
      );
      expect(resolveTeamOutlineColor(makePlayer("B"), undefined)).toBe(
        LEGACY_TEAM_B_OUTLINE,
      );
    });

    it("empty teamRosters object returns the legacy outlines", () => {
      expect(resolveTeamOutlineColor(makePlayer("A"), {})).toBe(
        LEGACY_TEAM_A_OUTLINE,
      );
      expect(resolveTeamOutlineColor(makePlayer("B"), {})).toBe(
        LEGACY_TEAM_B_OUTLINE,
      );
    });

    it("unknown roster still yields a numeric color (default palette)", () => {
      const color = resolveTeamOutlineColor(makePlayer("A"), {
        teamA: "not_a_real_roster",
      });
      expect(typeof color).toBe("number");
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0xffffff);
    });
  });

  describe("integration with fill color", () => {
    it("fill + outline are both exposed by the same resolver family", () => {
      const rosters = { teamA: "wood_elf", teamB: "dark_elf" };
      const playerA = makePlayer("A");
      const playerB = makePlayer("B");

      expect(resolveTeamFillColor(playerA, rosters)).toBe(
        ROSTER_COLORS.wood_elf.primary,
      );
      expect(resolveTeamOutlineColor(playerA, rosters)).toBe(
        ROSTER_COLORS.wood_elf.secondary,
      );
      expect(resolveTeamFillColor(playerB, rosters)).toBe(
        ROSTER_COLORS.dark_elf.primary,
      );
      expect(resolveTeamOutlineColor(playerB, rosters)).toBe(
        ROSTER_COLORS.dark_elf.secondary,
      );
    });
  });
});

describe("Regle: resolveTeamSpriteManifest (H.6 sprite sheets - sub-task 4)", () => {
  function makePlayer(
    team: "A" | "B",
    stunned = false,
  ): Pick<Player, "team" | "stunned"> {
    return { team, stunned };
  }

  /** Registers a fake sprite for the duration of a single test. */
  function withFakeSprite<T>(slug: string, fn: (m: TeamSpriteManifest) => T): T {
    const fakeManifest: TeamSpriteManifest = {
      atlasUrl: `/images/team-sprites/${slug}.png`,
      frames: { idle: { x: 0, y: 0, w: 32, h: 32 } },
    };
    (TEAM_SPRITE_MANIFESTS as Record<string, TeamSpriteManifest>)[slug] =
      fakeManifest;
    try {
      return fn(fakeManifest);
    } finally {
      delete (TEAM_SPRITE_MANIFESTS as Record<string, TeamSpriteManifest>)[
        slug
      ];
    }
  }

  describe("renderer fallback invariant", () => {
    it("returns null when no roster slug is provided (legacy fallback)", () => {
      expect(resolveTeamSpriteManifest(makePlayer("A"))).toBeNull();
      expect(resolveTeamSpriteManifest(makePlayer("B"))).toBeNull();
    });

    it("returns null when the roster slug has no registered sprite", () => {
      expect(
        resolveTeamSpriteManifest(makePlayer("A"), { teamA: "skaven" }),
      ).toBeNull();
    });

    it("returns null for unknown roster slugs", () => {
      expect(
        resolveTeamSpriteManifest(makePlayer("B"), {
          teamB: "not_a_real_roster",
        }),
      ).toBeNull();
    });

    it("stunned players never return a sprite (greyed-out circle fallback)", () => {
      const testSlug = "__test_sprite_stunned__";
      withFakeSprite(testSlug, () => {
        expect(
          resolveTeamSpriteManifest(makePlayer("A", true), { teamA: testSlug }),
        ).toBeNull();
      });
    });
  });

  describe("sprite resolution", () => {
    it("returns the registered manifest for team A when available", () => {
      const testSlug = "__test_sprite_a__";
      withFakeSprite(testSlug, (expectedManifest) => {
        const resolved = resolveTeamSpriteManifest(makePlayer("A"), {
          teamA: testSlug,
        });
        expect(resolved).toEqual(expectedManifest);
      });
    });

    it("returns the registered manifest for team B when available", () => {
      const testSlug = "__test_sprite_b__";
      withFakeSprite(testSlug, (expectedManifest) => {
        const resolved = resolveTeamSpriteManifest(makePlayer("B"), {
          teamA: "skaven",
          teamB: testSlug,
        });
        expect(resolved).toEqual(expectedManifest);
      });
    });

    it("resolves independently for each team", () => {
      const slugA = "__test_sprite_split_a__";
      withFakeSprite(slugA, () => {
        // Team A has a sprite, team B does not
        expect(
          resolveTeamSpriteManifest(makePlayer("A"), {
            teamA: slugA,
            teamB: "dwarf",
          }),
        ).not.toBeNull();
        expect(
          resolveTeamSpriteManifest(makePlayer("B"), {
            teamA: slugA,
            teamB: "dwarf",
          }),
        ).toBeNull();
      });
    });
  });
});

describe("Regle: shouldUseTeamSprite (H.6 sprite sheets - sub-task 4)", () => {
  function makePlayer(
    team: "A" | "B",
    stunned = false,
  ): Pick<Player, "team" | "stunned"> {
    return { team, stunned };
  }

  it("returns false when no roster slug is provided", () => {
    expect(shouldUseTeamSprite(makePlayer("A"))).toBe(false);
  });

  it("returns false when the roster slug has no registered sprite", () => {
    expect(shouldUseTeamSprite(makePlayer("A"), { teamA: "skaven" })).toBe(
      false,
    );
  });

  it("returns true when a sprite is registered for the player's team", () => {
    const testSlug = "__test_should_use__";
    (TEAM_SPRITE_MANIFESTS as Record<string, TeamSpriteManifest>)[testSlug] = {
      atlasUrl: "/a.png",
      frames: { idle: { x: 0, y: 0, w: 1, h: 1 } },
    };
    try {
      expect(shouldUseTeamSprite(makePlayer("A"), { teamA: testSlug })).toBe(
        true,
      );
    } finally {
      delete (TEAM_SPRITE_MANIFESTS as Record<string, TeamSpriteManifest>)[
        testSlug
      ];
    }
  });

  it("stunned players never use a sprite", () => {
    const testSlug = "__test_should_stunned__";
    (TEAM_SPRITE_MANIFESTS as Record<string, TeamSpriteManifest>)[testSlug] = {
      atlasUrl: "/a.png",
      frames: { idle: { x: 0, y: 0, w: 1, h: 1 } },
    };
    try {
      expect(
        shouldUseTeamSprite(makePlayer("A", true), { teamA: testSlug }),
      ).toBe(false);
    } finally {
      delete (TEAM_SPRITE_MANIFESTS as Record<string, TeamSpriteManifest>)[
        testSlug
      ];
    }
  });

  it("as a global invariant, returns false for every real roster today", () => {
    // Until sub-task 5/5 ships atlases, the renderer must always fall back to
    // the circle path for every real roster. This is the contract that lets
    // sub-task 4/5 merge safely without visual regressions.
    for (const slug of Object.keys(ROSTER_COLORS)) {
      expect(
        shouldUseTeamSprite(makePlayer("A"), { teamA: slug }),
        `unexpected sprite path for "${slug}"`,
      ).toBe(false);
    }
  });
});
