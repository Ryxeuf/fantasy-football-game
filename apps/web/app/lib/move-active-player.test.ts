import { describe, expect, it } from "vitest";

import type { Move } from "@bb/game-engine";

import { getMoveActivePlayerId } from "./move-active-player";

describe("getMoveActivePlayerId — Lot 3.E.1", () => {
  it("retourne null pour null/undefined", () => {
    expect(getMoveActivePlayerId(null)).toBeNull();
    expect(getMoveActivePlayerId(undefined)).toBeNull();
  });

  it("retourne null pour les moves sans joueur (END_TURN, REROLL_CHOOSE, ...)", () => {
    expect(getMoveActivePlayerId({ type: "END_TURN" } as Move)).toBeNull();
    expect(
      getMoveActivePlayerId({
        type: "REROLL_CHOOSE",
        useReroll: true,
      } as Move),
    ).toBeNull();
    expect(
      getMoveActivePlayerId({
        type: "APOTHECARY_CHOOSE",
        useApothecary: false,
      } as Move),
    ).toBeNull();
    expect(
      getMoveActivePlayerId({ type: "KICKOFF_BLITZ_RESOLVE" } as Move),
    ).toBeNull();
    expect(getMoveActivePlayerId({ type: "ON_THE_BALL_DECLINE" } as Move)).toBeNull();
  });

  it("retourne playerId pour les moves standards", () => {
    expect(
      getMoveActivePlayerId({
        type: "MOVE",
        playerId: "p1",
        to: { x: 5, y: 7 },
      } as Move),
    ).toBe("p1");
    expect(
      getMoveActivePlayerId({
        type: "BLOCK",
        playerId: "p2",
        targetId: "p3",
      } as Move),
    ).toBe("p2");
    expect(
      getMoveActivePlayerId({
        type: "BLITZ",
        playerId: "p4",
        to: { x: 1, y: 1 },
        targetId: "p5",
      } as Move),
    ).toBe("p4");
    expect(
      getMoveActivePlayerId({
        type: "PASS",
        playerId: "p6",
        targetId: "p7",
      } as Move),
    ).toBe("p6");
  });

  it("DUMP_OFF_CHOOSE → utilise passerId (pas playerId)", () => {
    expect(
      getMoveActivePlayerId({
        type: "DUMP_OFF_CHOOSE",
        passerId: "p8",
        receiverId: "p9",
      } as Move),
    ).toBe("p8");
  });

  it("KICKOFF_HIGH_KICK avec playerId null → null", () => {
    expect(
      getMoveActivePlayerId({
        type: "KICKOFF_HIGH_KICK",
        playerId: null,
      } as Move),
    ).toBeNull();
    expect(
      getMoveActivePlayerId({
        type: "KICKOFF_HIGH_KICK",
        playerId: "p10",
      } as Move),
    ).toBe("p10");
  });
});
