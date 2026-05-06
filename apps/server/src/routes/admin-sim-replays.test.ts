/**
 * Unit tests pour `/admin/sim/replays`. On teste les handlers
 * directement (pas Express) avec un dossier temporaire qui contient
 * un panel de fixtures replays — ça évite de dépendre du repo réel
 * (qui peut bouger/régénérer les fichiers panel) et garantit que les
 * tests sont déterministes.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Request, Response } from "express";

import { handleGetReplay, handleListReplays } from "./admin-sim-replays";

const FIXTURE_REPLAY = `=== MATCH #1 — Soaring Hawks (Wood Elf) vs Frostraiders (Norse) ===
engine 0.12.0

KICKOFF — kc-soaring-hawks hosts min-frostraiders.
Half 1 • Turn 1 — away in possession at yardline 4 (score 0-0)

--- END OF MATCH (score 2-1) ---


FINAL: 2 - 1 (home win)
Touchdowns: 3 | Casualties: 1 | Turnovers: 5 | Nuffle: 2
`;

const FIXTURE_REPLAY_2 = `=== MATCH #2 — Iron Bears (Dwarf) vs Vipers (Skaven) ===
engine 0.12.0

FINAL: 0 - 0 (draw)
Touchdowns: 0 | Casualties: 4 | Turnovers: 8 | Nuffle: 6
`;

function buildRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "replays-test-"));
  process.env.PRO_LEAGUE_REPLAYS_DIR = tmpDir;
});

afterEach(async () => {
  delete process.env.PRO_LEAGUE_REPLAYS_DIR;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("handleListReplays", () => {
  it("returns parsed summaries for all replay-*.txt files", async () => {
    await writeFile(
      path.join(
        tmpDir,
        "replay-001-kc-soaring-hawks-vs-min-frostraiders-seed2026.txt",
      ),
      FIXTURE_REPLAY,
    );
    await writeFile(
      path.join(tmpDir, "replay-002-iron-bears-vs-vipers-seed2027.txt"),
      FIXTURE_REPLAY_2,
    );
    // Bruit qui doit être ignoré (filtre isValidReplayFilename).
    await writeFile(path.join(tmpDir, "README.md"), "ignore me");

    const res = buildRes();
    await handleListReplays({} as Request, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as {
      replays: Array<{
        filename: string;
        index: string;
        seed: number;
        parsed: { homeName: string; outcome: string };
      }>;
      missing: boolean;
    };
    expect(body.missing).toBe(false);
    expect(body.replays).toHaveLength(2);
    // Ordre alphabétique = ordre des index padded.
    expect(body.replays[0].filename).toContain("replay-001");
    expect(body.replays[0].seed).toBe(2026);
    expect(body.replays[0].parsed.homeName).toBe("Soaring Hawks");
    expect(body.replays[0].parsed.outcome).toBe("home");
    expect(body.replays[1].parsed.outcome).toBe("draw");
  });

  it("returns missing=true when the directory does not exist", async () => {
    process.env.PRO_LEAGUE_REPLAYS_DIR = path.join(tmpDir, "does-not-exist");
    const res = buildRes();
    await handleListReplays({} as Request, res);
    expect(res.statusCode).toBe(200);
    const body = res.body as { replays: unknown[]; missing: boolean };
    expect(body.missing).toBe(true);
    expect(body.replays).toEqual([]);
  });
});

describe("handleGetReplay", () => {
  it("returns content + parsed metadata for a valid file", async () => {
    const filename =
      "replay-001-kc-soaring-hawks-vs-min-frostraiders-seed2026.txt";
    await writeFile(path.join(tmpDir, filename), FIXTURE_REPLAY);

    const res = buildRes();
    await handleGetReplay(
      { params: { filename } } as unknown as Request,
      res,
    );

    expect(res.statusCode).toBe(200);
    const body = res.body as {
      content: string;
      parsed: { homeScore: number; awayScore: number };
      file: { seed: number };
    };
    expect(body.content).toContain("=== MATCH #1");
    expect(body.parsed.homeScore).toBe(2);
    expect(body.parsed.awayScore).toBe(1);
    expect(body.file.seed).toBe(2026);
  });

  it("returns 400 for filenames that fail validation", async () => {
    const res = buildRes();
    await handleGetReplay(
      { params: { filename: "../etc/passwd" } } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for filenames missing the canonical pattern", async () => {
    const res = buildRes();
    await handleGetReplay(
      { params: { filename: "README.md" } } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when the file is not on disk", async () => {
    const res = buildRes();
    await handleGetReplay(
      {
        params: {
          filename:
            "replay-999-foo-vs-bar-seed1.txt",
        },
      } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(404);
  });
});
