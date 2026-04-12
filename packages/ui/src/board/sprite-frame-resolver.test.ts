import { describe, it, expect } from "vitest";
import type { Player, TeamSpriteManifest } from "@bb/game-engine";
import { resolvePlayerSpriteFrame } from "./sprite-frame-resolver";

/** Minimal Player-shaped fixture. */
function makePlayer(
  overrides: Partial<Pick<Player, "hasBall" | "state" | "stunned">> = {},
): Pick<Player, "hasBall" | "state" | "stunned"> {
  return {
    hasBall: false,
    state: "active",
    stunned: false,
    ...overrides,
  };
}

/** Full manifest with all optional frames. */
const fullManifest: TeamSpriteManifest = {
  atlasUrl: "/images/team-sprites/test.png",
  frames: {
    idle: { x: 0, y: 0, w: 32, h: 32 },
    down: { x: 32, y: 0, w: 32, h: 32 },
    carrying: { x: 64, y: 0, w: 32, h: 32 },
  },
};

/** Minimal manifest with only the mandatory idle frame. */
const minimalManifest: TeamSpriteManifest = {
  atlasUrl: "/images/team-sprites/minimal.png",
  frames: {
    idle: { x: 0, y: 0, w: 32, h: 32 },
  },
};

describe("Regle: resolvePlayerSpriteFrame (H.6 sprite sheets - sub-task 5)", () => {
  describe("default state", () => {
    it('returns "idle" for a standing active player', () => {
      expect(resolvePlayerSpriteFrame(makePlayer(), fullManifest)).toBe("idle");
    });

    it('returns "idle" when manifest only has the idle frame', () => {
      expect(resolvePlayerSpriteFrame(makePlayer(), minimalManifest)).toBe(
        "idle",
      );
    });
  });

  describe("ball carrier", () => {
    it('returns "carrying" when player has the ball and frame exists', () => {
      expect(
        resolvePlayerSpriteFrame(makePlayer({ hasBall: true }), fullManifest),
      ).toBe("carrying");
    });

    it('falls back to "idle" when player has the ball but no carrying frame', () => {
      expect(
        resolvePlayerSpriteFrame(
          makePlayer({ hasBall: true }),
          minimalManifest,
        ),
      ).toBe("idle");
    });
  });

  describe("knocked down player", () => {
    it('returns "down" when player is knocked down and frame exists', () => {
      expect(
        resolvePlayerSpriteFrame(
          makePlayer({ state: "knocked_out" }),
          fullManifest,
        ),
      ).toBe("down");
    });

    it('falls back to "idle" when player is knocked down but no down frame', () => {
      expect(
        resolvePlayerSpriteFrame(
          makePlayer({ state: "knocked_out" }),
          minimalManifest,
        ),
      ).toBe("idle");
    });
  });

  describe("priority order", () => {
    it('prefers "carrying" over "down" when player has ball and is knocked down', () => {
      expect(
        resolvePlayerSpriteFrame(
          makePlayer({ hasBall: true, state: "knocked_out" }),
          fullManifest,
        ),
      ).toBe("carrying");
    });
  });

  describe("always returns a valid frame name", () => {
    it("always falls back to idle for any unknown player state", () => {
      const unknownState = makePlayer({
        state: "some_unknown_state" as Player["state"],
      });
      expect(resolvePlayerSpriteFrame(unknownState, fullManifest)).toBe("idle");
    });

    it("never returns undefined or empty string", () => {
      const result = resolvePlayerSpriteFrame(makePlayer(), minimalManifest);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });
  });
});
