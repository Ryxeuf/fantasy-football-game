import { describe, expect, it } from "vitest";

import {
  isValidReplayFilename,
  parseReplayContent,
  parseReplayFilename,
} from "./replay-parser";

const SAMPLE_REPLAY = `=== MATCH #1 — Soaring Hawks (Wood Elf) vs Frostraiders (Norse) ===
engine 0.12.0

KICKOFF — kc-soaring-hawks hosts min-frostraiders (weather: nice, away receives).
Half 1 • Turn 1 — away in possession at yardline 4 (score 0-0)
Half 1 • Turn 2 — away in possession at yardline 15 (score 0-0)
  PASS — away-LOS attempts a short pass: needs 5+, rolled 1 (fumble!) → failed.

--- HALFTIME (score 0-0) ---

Half 2 • Turn 1 — home in possession at yardline 4 (score 0-0)

--- END OF MATCH (score 2-1) ---


FINAL: 2 - 1 (home win)
Touchdowns: 3 | Casualties: 2 | Turnovers: 6 | Nuffle: 4
`;

describe("parseReplayContent", () => {
  it("extracts header (match index, names, races)", () => {
    const parsed = parseReplayContent(SAMPLE_REPLAY);
    expect(parsed.matchIndex).toBe(1);
    expect(parsed.homeName).toBe("Soaring Hawks");
    expect(parsed.homeRace).toBe("Wood Elf");
    expect(parsed.awayName).toBe("Frostraiders");
    expect(parsed.awayRace).toBe("Norse");
  });

  it("extracts engine version line", () => {
    const parsed = parseReplayContent(SAMPLE_REPLAY);
    expect(parsed.engineVer).toBe("0.12.0");
  });

  it("extracts FINAL score and explicit outcome annotation", () => {
    const parsed = parseReplayContent(SAMPLE_REPLAY);
    expect(parsed.homeScore).toBe(2);
    expect(parsed.awayScore).toBe(1);
    expect(parsed.outcome).toBe("home");
  });

  it("derives outcome from score when annotation missing (legacy file)", () => {
    const legacy = SAMPLE_REPLAY.replace("FINAL: 2 - 1 (home win)", "FINAL: 1 - 3");
    const parsed = parseReplayContent(legacy);
    expect(parsed.outcome).toBe("away");
  });

  it("returns 'draw' when scores are tied", () => {
    const tied = SAMPLE_REPLAY.replace("FINAL: 2 - 1 (home win)", "FINAL: 0 - 0 (draw)");
    const parsed = parseReplayContent(tied);
    expect(parsed.outcome).toBe("draw");
  });

  it("extracts the totals footer (TD / cas / TO / Nuffle)", () => {
    const parsed = parseReplayContent(SAMPLE_REPLAY);
    expect(parsed.totals).toEqual({
      touchdowns: 3,
      casualties: 2,
      turnovers: 6,
      nuffle: 4,
    });
  });

  it("counts total lines for UI hints", () => {
    const parsed = parseReplayContent(SAMPLE_REPLAY);
    expect(parsed.totalLines).toBeGreaterThan(10);
  });

  it("returns nulls gracefully when replay is empty / malformed", () => {
    const parsed = parseReplayContent("");
    expect(parsed.matchIndex).toBeNull();
    expect(parsed.homeScore).toBeNull();
    expect(parsed.totals.touchdowns).toBeNull();
    expect(parsed.outcome).toBeNull();
  });

  it("does not throw on a single-line garbage input", () => {
    expect(() => parseReplayContent("garbage line")).not.toThrow();
  });
});

describe("parseReplayFilename", () => {
  it("decomposes a canonical replay filename", () => {
    const meta = parseReplayFilename(
      "replay-001-kc-soaring-hawks-vs-min-frostraiders-seed2026.txt",
    );
    expect(meta.index).toBe("001");
    expect(meta.homeId).toBe("kc-soaring-hawks");
    expect(meta.awayId).toBe("min-frostraiders");
    expect(meta.seed).toBe(2026);
  });

  it("returns nulls for non-matching files (not a panel replay)", () => {
    const meta = parseReplayFilename("some-other-file.txt");
    expect(meta.index).toBeNull();
    expect(meta.homeId).toBeNull();
    expect(meta.awayId).toBeNull();
    expect(meta.seed).toBeNull();
  });
});

describe("isValidReplayFilename (path-traversal guard)", () => {
  it("accepts canonical filenames", () => {
    expect(
      isValidReplayFilename(
        "replay-050-pit-smashers-vs-kc-soaring-hawks-seed2075.txt",
      ),
    ).toBe(true);
  });

  it("rejects path-traversal attempts", () => {
    expect(isValidReplayFilename("../etc/passwd")).toBe(false);
    expect(isValidReplayFilename("replay-001-../../../etc-vs-passwd-seed1.txt")).toBe(false);
    expect(isValidReplayFilename("/etc/passwd")).toBe(false);
  });

  it("rejects files outside the replay naming convention", () => {
    expect(isValidReplayFilename("README.md")).toBe(false);
    expect(isValidReplayFilename("replay-1-foo-vs-bar-seed1.txt")).toBe(false); // index pas padded
    expect(isValidReplayFilename("replay-001-foo-vs-bar.txt")).toBe(false); // pas de seed
  });
});
