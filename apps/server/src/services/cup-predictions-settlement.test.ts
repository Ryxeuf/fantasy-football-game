import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    cupPairing: { updateMany: vi.fn(), findUnique: vi.fn() },
    cupRound: { findUnique: vi.fn(), updateMany: vi.fn() },
    competitionPrediction: { updateMany: vi.fn() },
  },
}));
vi.mock("./in-app-notifications", () => ({
  createInAppNotification: vi.fn(async () => ({ id: "n" })),
}));

import { prisma } from "../prisma";
import { createInAppNotification } from "./in-app-notifications";
import {
  markCupPairingPredictionsClosed,
  notifyCupRoundPredictionResults,
  settleCupPredictionsForResult,
  unsettleCupPredictions,
} from "./cup-predictions-settlement";
import { cupMembership } from "./cup-predictions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const m = prisma as any;
const mockNotify = createInAppNotification as ReturnType<typeof vi.fn>;
const NOW = new Date("2026-10-17T12:00:00.000Z");

describe("pronostics de coupe — règlement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.cupPairing.updateMany.mockResolvedValue({ count: 1 });
    m.competitionPrediction.updateMany.mockResolvedValue({ count: 2 });
    mockNotify.mockResolvedValue({ id: "n" });
  });

  it("pose la clôture une seule fois (write-once)", async () => {
    expect(await markCupPairingPredictionsClosed("cp1", NOW)).toBe(true);
    expect(m.cupPairing.updateMany).toHaveBeenCalledWith({
      where: { id: "cp1", predictionsClosedAt: null },
      data: { predictionsClosedAt: NOW },
    });
    m.cupPairing.updateMany.mockRejectedValue(new Error("down"));
    // Best-effort : jamais d'exception.
    expect(await markCupPairingPredictionsClosed("cp1", NOW)).toBe(false);
  });

  it("copie l'issue et le score réel, un forfait est réglé void", async () => {
    await settleCupPredictionsForResult({ cupPairingId: "cp1", scoreHome: 2, scoreAway: 1, now: NOW });
    expect(m.competitionPrediction.updateMany).toHaveBeenLastCalledWith({
      where: { cupPairingId: "cp1" },
      data: { result: "home", resultHomeScore: 2, resultAwayScore: 1, settledAt: NOW },
    });
    await settleCupPredictionsForResult({
      cupPairingId: "cp1",
      scoreHome: 0,
      scoreAway: 2,
      forfeit: true,
      now: NOW,
    });
    expect(m.competitionPrediction.updateMany).toHaveBeenLastCalledWith({
      where: { cupPairingId: "cp1" },
      data: { result: "void", resultHomeScore: null, resultAwayScore: null, settledAt: NOW },
    });
  });

  it("remet en attente à l'invalidation", async () => {
    expect(await unsettleCupPredictions("cp1")).toEqual({ unsettled: 2 });
    expect(m.competitionPrediction.updateMany).toHaveBeenCalledWith({
      where: { cupPairingId: "cp1" },
      data: { result: null, resultHomeScore: null, resultAwayScore: null, settledAt: null },
    });
  });
});

describe("pronostics de coupe — bilan de ronde", () => {
  const ROUND = {
    id: "r1",
    roundNumber: 2,
    name: null,
    status: "completed",
    predictionsNotifiedAt: null,
    cup: { id: "c1", name: "Coupe", predictionsScope: "members" },
    pairings: [
      {
        status: "played",
        predictions: [
          { userId: "u1", pick: "home", homeScore: 2, awayScore: 1, result: "home", resultHomeScore: 2, resultAwayScore: 1 },
          { userId: "u2", pick: "away", homeScore: null, awayScore: null, result: "home", resultHomeScore: 2, resultAwayScore: 1 },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockNotify.mockResolvedValue({ id: "n" });
  });

  it("notifie chaque pronostiqueur une fois, vers la page de la coupe", async () => {
    m.cupRound.findUnique.mockResolvedValue(ROUND);
    m.cupRound.updateMany.mockResolvedValue({ count: 1 });
    expect(await notifyCupRoundPredictionResults("r1", NOW)).toBe(2);
    const first = mockNotify.mock.calls[0][0];
    expect(first).toMatchObject({
      userId: "u1",
      kind: "cup.predictions_settled",
      title: "Ronde 2 : tes pronostics",
      url: "/cups/c1/predictions",
    });
    expect(first.body).toBe("Coupe — 5 pts, 1 bon résultat sur 1.");
  });

  it("ne renvoie rien si la ronde est déjà notifiée ou la portée off", async () => {
    m.cupRound.findUnique.mockResolvedValue({ ...ROUND, predictionsNotifiedAt: NOW });
    expect(await notifyCupRoundPredictionResults("r1", NOW)).toBe(0);
    m.cupRound.findUnique.mockResolvedValue({
      ...ROUND,
      cup: { ...ROUND.cup, predictionsScope: null },
    });
    expect(await notifyCupRoundPredictionResults("r1", NOW)).toBe(0);
    // Course : un autre passage a réclamé le bilan avant nous.
    m.cupRound.findUnique.mockResolvedValue(ROUND);
    m.cupRound.updateMany.mockResolvedValue({ count: 0 });
    expect(await notifyCupRoundPredictionResults("r1", NOW)).toBe(0);
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe("cupMembership", () => {
  it("compte le commissaire et chaque propriétaire d'équipe inscrite", () => {
    const m1 = cupMembership({
      creatorId: "commish",
      participants: [{ team: { ownerId: "u1" } }, { team: { ownerId: "u2" } }],
    });
    expect(m1.creatorId).toBe("commish");
    expect([...m1.activeCoachIds].sort()).toEqual(["u1", "u2"]);
    expect([...m1.anyCoachIds].sort()).toEqual(["u1", "u2"]);
  });
});
