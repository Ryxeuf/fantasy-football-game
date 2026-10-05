/**
 * Le PUT lineup transmet `...body` a `setLineup` : le schema doit retirer
 * les options reservees aux ecritures systeme, sinon un client pourrait
 * contourner le verrouillage au coup d'envoi.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

import { setLineupSchema } from "./nfl-fantasy-entries";

describe("setLineupSchema", () => {
  it("retire skipKickoffLock et now envoyes par un client", () => {
    const parsed = setLineupSchema.parse({
      weekId: "2026:W5",
      starters: [{ playerId: "p1", bbPosition: "Thrower" }],
      captainId: "p1",
      skipKickoffLock: true,
      now: "2026-10-01T00:00:00Z",
    });
    expect(parsed).not.toHaveProperty("skipKickoffLock");
    expect(parsed).not.toHaveProperty("now");
  });
});
