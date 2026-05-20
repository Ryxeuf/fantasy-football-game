import { describe, it, expect, vi } from "vitest";

import { NflIngestError } from "../services/nfl-ingest";
import { NflFantasyLeagueError } from "../services/nfl-fantasy-league";
import { NflFantasyRosterError } from "../services/nfl-fantasy-roster";
import { NflFantasyLineupError } from "../services/nfl-fantasy-lineup";
import { NflFantasyScoringError } from "../services/nfl-fantasy-scoring";
import { NflFantasyMercatoError } from "../services/nfl-fantasy-mercato";
import { NflFantasyDraftError } from "../services/nfl-fantasy-draft";
import {
  buildErrorResponse,
  sendNflError,
  statusForCode,
} from "./nfl-error-mapper";

describe("statusForCode", () => {
  it("404 pour NOT_FOUND / *_NOT_FOUND / INVALID_INVITE", () => {
    expect(statusForCode("NOT_FOUND")).toBe(404);
    expect(statusForCode("SEASON_NOT_FOUND")).toBe(404);
    expect(statusForCode("WEEK_NOT_FOUND")).toBe(404);
    expect(statusForCode("ENTRY_NOT_FOUND")).toBe(404);
    expect(statusForCode("PLAYER_NOT_FOUND")).toBe(404);
    expect(statusForCode("REROLL_NOT_FOUND")).toBe(404);
    expect(statusForCode("LEAGUE_NOT_FOUND")).toBe(404);
    expect(statusForCode("INVALID_INVITE")).toBe(404);
  });

  it("403 pour NOT_OWNER / REROLL_NOT_OWNED", () => {
    expect(statusForCode("NOT_OWNER")).toBe(403);
    expect(statusForCode("REROLL_NOT_OWNED")).toBe(403);
  });

  it("409 pour conflits d'etat", () => {
    const conflicts = [
      "ALREADY_JOINED",
      "FULL",
      "INVALID_STATUS",
      "OWNER_CANNOT_LEAVE",
      "TEAM_NAME_TAKEN",
      "PLAYER_ALREADY_ON_ROSTER",
      "PLAYER_NOT_ON_ROSTER",
      "REROLL_ALREADY_USED",
      "INDUCEMENT_LIMIT_REACHED",
      "LINEUP_LOCKED",
    ];
    for (const c of conflicts) {
      expect(statusForCode(c)).toBe(409);
    }
  });

  it("422 pour validations metier", () => {
    const validations = [
      "INVALID_NAME",
      "INVALID_TEAM_NAME",
      "INVALID_SIZE",
      "INVALID_WEEK_NUMBER",
      "INVALID_LINEUP_SIZE",
      "INVALID_STARTERS",
      "DUPLICATE_PLAYER",
      "CAPTAIN_NOT_IN_STARTERS",
      "VICE_NOT_IN_STARTERS",
      "CAPTAIN_EQUALS_VICE",
      "INVALID_TYPE",
      "INVALID_SLOT",
      "ODD_ENTRIES",
      "NO_ENTRIES",
      "POOL_TOO_SMALL",
      "INVALID_PLAYERS_PER_ENTRY",
    ];
    for (const c of validations) {
      expect(statusForCode(c)).toBe(422);
    }
  });

  it("502 pour FETCH_FAILED / PARSE_FAILED", () => {
    expect(statusForCode("FETCH_FAILED")).toBe(502);
    expect(statusForCode("PARSE_FAILED")).toBe(502);
  });

  it("500 par defaut pour un code inconnu", () => {
    expect(statusForCode("UNKNOWN_CODE")).toBe(500);
  });
});

describe("buildErrorResponse", () => {
  it("map NflIngestError -> { status, body avec code+error }", () => {
    const err = new NflIngestError("FETCH_FAILED", "boom");
    const out = buildErrorResponse(err);
    expect(out).toEqual({
      status: 502,
      body: { error: "boom", code: "FETCH_FAILED" },
    });
  });

  it("map NflFantasyLeagueError -> 409", () => {
    const err = new NflFantasyLeagueError("ALREADY_JOINED", "dup");
    expect(buildErrorResponse(err)?.status).toBe(409);
  });

  it("map NflFantasyRosterError -> 404/409", () => {
    expect(
      buildErrorResponse(new NflFantasyRosterError("PLAYER_NOT_FOUND", "x"))?.status,
    ).toBe(404);
    expect(
      buildErrorResponse(
        new NflFantasyRosterError("PLAYER_ALREADY_ON_ROSTER", "x"),
      )?.status,
    ).toBe(409);
  });

  it("map NflFantasyLineupError -> 409/422", () => {
    expect(
      buildErrorResponse(new NflFantasyLineupError("LINEUP_LOCKED", "x"))?.status,
    ).toBe(409);
    expect(
      buildErrorResponse(
        new NflFantasyLineupError("INVALID_LINEUP_SIZE", "x"),
      )?.status,
    ).toBe(422);
  });

  it("map NflFantasyScoringError -> 404/422", () => {
    expect(
      buildErrorResponse(new NflFantasyScoringError("LEAGUE_NOT_FOUND", "x"))?.status,
    ).toBe(404);
    expect(
      buildErrorResponse(new NflFantasyScoringError("ODD_ENTRIES", "x"))?.status,
    ).toBe(422);
  });

  it("map NflFantasyMercatoError -> 404/409", () => {
    expect(
      buildErrorResponse(new NflFantasyMercatoError("REROLL_NOT_FOUND", "x"))?.status,
    ).toBe(404);
    expect(
      buildErrorResponse(
        new NflFantasyMercatoError("REROLL_ALREADY_USED", "x"),
      )?.status,
    ).toBe(409);
  });

  it("map NflFantasyDraftError -> 404/409/422", () => {
    expect(
      buildErrorResponse(new NflFantasyDraftError("LEAGUE_NOT_FOUND", "x"))?.status,
    ).toBe(404);
    expect(
      buildErrorResponse(new NflFantasyDraftError("INVALID_STATUS", "x"))?.status,
    ).toBe(409);
    expect(
      buildErrorResponse(new NflFantasyDraftError("POOL_TOO_SMALL", "x"))?.status,
    ).toBe(422);
    expect(
      buildErrorResponse(
        new NflFantasyDraftError("INVALID_PLAYERS_PER_ENTRY", "x"),
      )?.status,
    ).toBe(422);
  });

  it("retourne null pour une erreur non typee", () => {
    expect(buildErrorResponse(new Error("plain"))).toBeNull();
    expect(buildErrorResponse("string")).toBeNull();
    expect(buildErrorResponse(null)).toBeNull();
    expect(buildErrorResponse(undefined)).toBeNull();
  });
});

describe("sendNflError", () => {
  function mockRes() {
    const r = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return r as unknown as Parameters<typeof sendNflError>[0] & typeof r;
  }

  it("envoie status + body si erreur typee, retourne true", () => {
    const res = mockRes();
    const ok = sendNflError(
      res,
      new NflFantasyLeagueError("NOT_OWNER", "perms"),
    );
    expect(ok).toBe(true);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "perms", code: "NOT_OWNER" });
  });

  it("retourne false sur erreur non typee", () => {
    const res = mockRes();
    expect(sendNflError(res, new Error("plain"))).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });
});
