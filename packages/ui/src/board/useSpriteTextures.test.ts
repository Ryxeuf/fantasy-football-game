import { describe, it, expect, afterEach } from "vitest";
import type { TeamSpriteManifest } from "@bb/game-engine";
import { TEAM_SPRITE_MANIFESTS } from "@bb/game-engine";
import { buildSpriteLoadPlan } from "./useSpriteTextures";

/** Registers fake sprites for the duration of a test. */
function registerFakeSprite(slug: string): TeamSpriteManifest {
  const manifest: TeamSpriteManifest = {
    atlasUrl: `/images/team-sprites/${slug}.png`,
    frames: {
      idle: { x: 0, y: 0, w: 32, h: 32 },
      down: { x: 32, y: 0, w: 32, h: 32 },
      carrying: { x: 64, y: 0, w: 32, h: 32 },
    },
  };
  (TEAM_SPRITE_MANIFESTS as Record<string, TeamSpriteManifest>)[slug] =
    manifest;
  return manifest;
}

function unregisterFakeSprite(slug: string): void {
  delete (TEAM_SPRITE_MANIFESTS as Record<string, TeamSpriteManifest>)[slug];
}

describe("Regle: buildSpriteLoadPlan (H.6 sprite sheets - sub-task 5)", () => {
  const TEST_SLUGS = ["__test_load_a__", "__test_load_b__"];

  afterEach(() => {
    for (const slug of TEST_SLUGS) {
      unregisterFakeSprite(slug);
    }
  });

  it("returns empty plan when no teamRosters provided", () => {
    expect(buildSpriteLoadPlan(undefined)).toEqual([]);
    expect(buildSpriteLoadPlan({})).toEqual([]);
  });

  it("returns empty plan when rosters have no registered sprites", () => {
    expect(
      buildSpriteLoadPlan({ teamA: "skaven", teamB: "dwarf" }),
    ).toEqual([]);
  });

  it("includes only rosters that have registered sprite manifests", () => {
    const slugA = TEST_SLUGS[0];
    const manifest = registerFakeSprite(slugA);

    const plan = buildSpriteLoadPlan({ teamA: slugA, teamB: "dwarf" });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toEqual({ slug: slugA, manifest });
  });

  it("includes both teams when both have registered sprites", () => {
    const [slugA, slugB] = TEST_SLUGS;
    registerFakeSprite(slugA);
    registerFakeSprite(slugB);

    const plan = buildSpriteLoadPlan({ teamA: slugA, teamB: slugB });
    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.slug).sort()).toEqual(
      [slugA, slugB].sort(),
    );
  });

  it("deduplicates when both teams use the same roster slug", () => {
    const slug = TEST_SLUGS[0];
    registerFakeSprite(slug);

    const plan = buildSpriteLoadPlan({ teamA: slug, teamB: slug });
    expect(plan).toHaveLength(1);
    expect(plan[0].slug).toBe(slug);
  });

  it("ignores undefined roster slugs", () => {
    const slug = TEST_SLUGS[0];
    registerFakeSprite(slug);

    const plan = buildSpriteLoadPlan({ teamA: slug });
    expect(plan).toHaveLength(1);
    expect(plan[0].slug).toBe(slug);
  });
});
