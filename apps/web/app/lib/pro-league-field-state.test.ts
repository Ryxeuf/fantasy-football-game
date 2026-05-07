import { describe, expect, it } from "vitest";

import type { MatchEvent } from "@bb/shared-types";

import {
  INITIAL_FIELD_STATE,
  deriveProLeagueFieldState,
} from "./pro-league-field-state";

function ev(
  type: MatchEvent["type"],
  displayAtMs: number,
  meta: Record<string, unknown> = {},
): MatchEvent {
  return {
    type,
    displayAtMs,
    engineVer: "0.13.0",
    meta,
  } as MatchEvent;
}

describe("deriveProLeagueFieldState — sprint 1.B.3", () => {
  it("retourne l'état initial pour un array vide", () => {
    const out = deriveProLeagueFieldState([]);
    expect(out.score).toEqual({ home: 0, away: 0 });
    expect(out.ballYardline).toBeNull();
    expect(out.drivingTeam).toBeNull();
    expect(out.half).toBe(1);
    expect(out.lastFlash).toBeNull();
    expect(out.cursor).toBe(-1);
  });

  it("INITIAL_FIELD_STATE matche la sortie pour [] ", () => {
    expect(deriveProLeagueFieldState([])).toEqual(INITIAL_FIELD_STATE);
  });

  it("met à jour ballYardline + drivingTeam depuis TURN_START", () => {
    const out = deriveProLeagueFieldState([
      ev("TURN_START", 0, {
        half: 1,
        turn: 1,
        drivingTeam: "home",
        ballYardline: 12,
      }),
    ]);
    expect(out.ballYardline).toBe(12);
    expect(out.drivingTeam).toBe("home");
  });

  it("incrémente le score sur TD home/away", () => {
    const out = deriveProLeagueFieldState([
      ev("TD", 30_000, { team: "home" }),
      ev("TD", 60_000, { team: "home" }),
      ev("TD", 90_000, { team: "away" }),
    ]);
    expect(out.score).toEqual({ home: 2, away: 1 });
    // lastFlash doit être le dernier TD vu
    expect(out.lastFlash?.type).toBe("TD");
    expect(out.lastFlash?.team).toBe("away");
    expect(out.lastFlash?.eventIndex).toBe(2);
  });

  it("garde le dernier flash CASUALTY", () => {
    const out = deriveProLeagueFieldState([
      ev("TD", 0, { team: "home" }),
      ev("CASUALTY", 5_000, { causedBy: "block" }),
    ]);
    expect(out.lastFlash?.type).toBe("CASUALTY");
    expect(out.lastFlash?.eventIndex).toBe(1);
  });

  it("garde le dernier flash NUFFLE", () => {
    const out = deriveProLeagueFieldState([
      ev("CASUALTY", 0),
      ev("NUFFLE", 1000, { id: "banana_skin" }),
    ]);
    expect(out.lastFlash?.type).toBe("NUFFLE");
  });

  it("HALFTIME passe half à 2 ; END le passe à 'final'", () => {
    expect(
      deriveProLeagueFieldState([ev("HALFTIME", 240_000)]).half,
    ).toBe(2);
    expect(deriveProLeagueFieldState([ev("END", 480_000)]).half).toBe("final");
  });

  it("cursor = events.length - 1", () => {
    const out = deriveProLeagueFieldState([
      ev("KICKOFF", 0),
      ev("TURN_START", 0, {
        half: 1,
        turn: 1,
        drivingTeam: "home",
        ballYardline: 4,
      }),
      ev("TD", 30_000, { team: "home" }),
    ]);
    expect(out.cursor).toBe(2);
  });

  it("scénario complet : kickoff → drive home → TD home → TURN_START away", () => {
    const events: MatchEvent[] = [
      ev("KICKOFF", 0, { home: "h", away: "a" }),
      ev("TURN_START", 0, {
        half: 1,
        turn: 1,
        drivingTeam: "home",
        ballYardline: 4,
      }),
      ev("TURN_START", 30_000, {
        half: 1,
        turn: 2,
        drivingTeam: "home",
        ballYardline: 18,
      }),
      ev("TD", 60_000, { team: "home" }),
      ev("TURN_START", 90_000, {
        half: 1,
        turn: 3,
        drivingTeam: "away",
        ballYardline: 4,
      }),
    ];
    const out = deriveProLeagueFieldState(events);
    expect(out.score).toEqual({ home: 1, away: 0 });
    expect(out.ballYardline).toBe(4);
    expect(out.drivingTeam).toBe("away");
    // lastFlash est le TD (event index 3) car le TURN_START suivant
    // n'efface pas le flash.
    expect(out.lastFlash?.type).toBe("TD");
    expect(out.lastFlash?.eventIndex).toBe(3);
  });

  it("idempotent : 2 appels avec le même array → même résultat", () => {
    const events: MatchEvent[] = [
      ev("TD", 0, { team: "home" }),
      ev("TURN_START", 30_000, {
        half: 1,
        turn: 1,
        drivingTeam: "away",
        ballYardline: 12,
      }),
    ];
    expect(deriveProLeagueFieldState(events)).toEqual(
      deriveProLeagueFieldState(events),
    );
  });
});
