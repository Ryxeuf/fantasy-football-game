import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueRound: { findUnique: vi.fn(), updateMany: vi.fn() },
    leaguePairing: { findUnique: vi.fn(), updateMany: vi.fn() },
    competitionPrediction: { updateMany: vi.fn() },
  },
}));
vi.mock("./in-app-notifications", () => ({
  createInAppNotification: vi.fn(),
}));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { prisma } from "../prisma";
import { createInAppNotification } from "./in-app-notifications";
import {
  markPairingPredictionsClosed,
  notifyRoundPredictionResults,
  settleLeaguePredictionsForResult,
  summarizeRoundPredictions,
  unsettleLeaguePredictions,
} from "./league-predictions-settlement";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  leagueRound: { findUnique: MockFn; updateMany: MockFn };
  leaguePairing: { findUnique: MockFn; updateMany: MockFn };
  competitionPrediction: { updateMany: MockFn };
};
const notify = createInAppNotification as unknown as MockFn;

const NOW = new Date("2026-10-01T12:00:00Z");
const PAST = new Date("2026-09-30T12:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("markPairingPredictionsClosed", () => {
  it("ne pose la clôture qu'une fois, et n'échoue jamais", async () => {
    db.leaguePairing.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(markPairingPredictionsClosed("pairing-1", NOW)).resolves.toBe(true);
    expect(db.leaguePairing.updateMany).toHaveBeenCalledWith({
      where: { id: "pairing-1", predictionsClosedAt: null },
      data: { predictionsClosedAt: NOW },
    });

    db.leaguePairing.updateMany.mockRejectedValueOnce(new Error("db down"));
    await expect(markPairingPredictionsClosed("pairing-1", NOW)).resolves.toBe(false);
  });
});

describe("settleLeaguePredictionsForResult", () => {
  it("place les scores par participant, pas par ordre d'arrivée", async () => {
    db.leaguePairing.updateMany.mockResolvedValueOnce({ count: 0 });
    db.leaguePairing.findUnique.mockResolvedValueOnce({
      homeParticipantId: "p-home",
      awayParticipantId: "p-away",
    });
    db.competitionPrediction.updateMany.mockResolvedValueOnce({ count: 4 });
    const out = await settleLeaguePredictionsForResult({
      pairingId: "pairing-1",
      // L'entonnoir parle de A et B : ici A est l'EXTÉRIEUR.
      scores: [
        { participantId: "p-away", score: 3 },
        { participantId: "p-home", score: 1 },
      ],
      now: NOW,
    });
    expect(out).toEqual({ settled: 4 });
    expect(db.competitionPrediction.updateMany).toHaveBeenCalledWith({
      where: { pairingId: "pairing-1" },
      data: {
        result: "away",
        resultHomeScore: 1,
        resultAwayScore: 3,
        settledAt: NOW,
      },
    });
    // Un résultat vu ferme la rencontre pour de bon.
    expect(db.leaguePairing.updateMany).toHaveBeenCalledWith({
      where: { id: "pairing-1", predictionsClosedAt: null },
      data: { predictionsClosedAt: NOW },
    });
  });

  it("règle un forfait en ligne `void`", async () => {
    db.leaguePairing.updateMany.mockResolvedValueOnce({ count: 0 });
    db.competitionPrediction.updateMany.mockResolvedValueOnce({ count: 2 });
    await settleLeaguePredictionsForResult({
      pairingId: "pairing-1",
      scores: [],
      forfeit: true,
      now: NOW,
    });
    expect(db.competitionPrediction.updateMany).toHaveBeenCalledWith({
      where: { pairingId: "pairing-1" },
      data: {
        result: "void",
        resultHomeScore: null,
        resultAwayScore: null,
        settledAt: NOW,
      },
    });
  });

  it("n'écrit rien sans les deux côtés, et n'échoue jamais", async () => {
    db.leaguePairing.updateMany.mockResolvedValue({ count: 0 });
    db.leaguePairing.findUnique.mockResolvedValueOnce({
      homeParticipantId: "p-home",
      awayParticipantId: "p-away",
    });
    await expect(
      settleLeaguePredictionsForResult({
        pairingId: "pairing-1",
        scores: [{ participantId: "p-home", score: 1 }],
        now: NOW,
      }),
    ).resolves.toEqual({ settled: 0 });
    expect(db.competitionPrediction.updateMany).not.toHaveBeenCalled();

    db.leaguePairing.findUnique.mockRejectedValueOnce(new Error("db down"));
    await expect(
      settleLeaguePredictionsForResult({ pairingId: "pairing-1", scores: [], now: NOW }),
    ).resolves.toEqual({ settled: 0 });
  });
});

describe("unsettleLeaguePredictions", () => {
  it("remet les pronostics en attente", async () => {
    db.competitionPrediction.updateMany.mockResolvedValueOnce({ count: 3 });
    await expect(unsettleLeaguePredictions("pairing-1")).resolves.toEqual({
      unsettled: 3,
    });
    expect(db.competitionPrediction.updateMany).toHaveBeenCalledWith({
      where: { pairingId: "pairing-1" },
      data: {
        result: null,
        resultHomeScore: null,
        resultAwayScore: null,
        settledAt: null,
      },
    });
    db.competitionPrediction.updateMany.mockRejectedValueOnce(new Error("x"));
    await expect(unsettleLeaguePredictions("pairing-1")).resolves.toEqual({
      unsettled: 0,
    });
  });
});

// ---------------------------------------------------------------------------

function settled(userId: string, pick: string, result: string, home = 2, away = 0) {
  return {
    userId,
    pick,
    homeScore: null,
    awayScore: null,
    result,
    resultHomeScore: home,
    resultAwayScore: away,
  };
}

function completedRound(overrides: Record<string, unknown> = {}) {
  return {
    id: "round-1",
    roundNumber: 3,
    name: null,
    status: "completed",
    predictionsNotifiedAt: null,
    season: {
      id: "season-1",
      league: { id: "league-1", name: "Ligue du Vieux Monde", predictionsScope: "members" },
    },
    pairings: [
      {
        status: "played",
        predictions: [settled("a", "home", "home"), settled("b", "away", "home")],
      },
      {
        status: "played",
        predictions: [settled("a", "home", "home", 1, 0)],
      },
      { status: "forfeit_home", predictions: [settled("c", "home", "home")] },
    ],
    ...overrides,
  };
}

describe("summarizeRoundPredictions", () => {
  it("fait le bilan de chacun sur les seuls pronostics réglés", () => {
    const summary = summarizeRoundPredictions(completedRound().pairings);
    expect(summary).toEqual([
      { userId: "a", points: 6, settled: 2, correct: 2 },
      { userId: "b", points: 0, settled: 1, correct: 0 },
    ]);
  });
});

describe("notifyRoundPredictionResults", () => {
  it("notifie chaque pronostiqueur une fois, avec son bilan de la journée", async () => {
    db.leagueRound.findUnique.mockResolvedValueOnce(completedRound());
    db.leagueRound.updateMany.mockResolvedValueOnce({ count: 1 });
    notify.mockResolvedValue({ id: "n" });
    await expect(notifyRoundPredictionResults("round-1", NOW)).resolves.toBe(2);
    expect(db.leagueRound.updateMany).toHaveBeenCalledWith({
      where: { id: "round-1", predictionsNotifiedAt: null },
      data: { predictionsNotifiedAt: NOW },
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "a",
        kind: "league.predictions_settled",
        title: "Journée 3 : tes pronostics",
        url: "/leagues/league-1/seasons/season-1/predictions",
      }),
    );
    expect(notify.mock.calls[0][0].body).toContain("6 pts, 2 bons résultats sur 2");
  });

  it("ne renvoie rien pour une journée déjà notifiée ou pas encore complète", async () => {
    db.leagueRound.findUnique.mockResolvedValueOnce(
      completedRound({ predictionsNotifiedAt: PAST }),
    );
    await expect(notifyRoundPredictionResults("round-1", NOW)).resolves.toBe(0);

    db.leagueRound.findUnique.mockResolvedValueOnce(
      completedRound({ status: "in_progress" }),
    );
    await expect(notifyRoundPredictionResults("round-1", NOW)).resolves.toBe(0);

    // Réclamée entre-temps par un autre appel : on s'abstient.
    db.leagueRound.findUnique.mockResolvedValueOnce(completedRound());
    db.leagueRound.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(notifyRoundPredictionResults("round-1", NOW)).resolves.toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("se tait quand les pronostics sont coupés, et n'échoue jamais", async () => {
    db.leagueRound.findUnique.mockResolvedValueOnce(
      completedRound({
        season: {
          id: "season-1",
          league: { id: "league-1", name: "L", predictionsScope: "off" },
        },
      }),
    );
    await expect(notifyRoundPredictionResults("round-1", NOW)).resolves.toBe(0);

    db.leagueRound.findUnique.mockRejectedValueOnce(new Error("db down"));
    await expect(notifyRoundPredictionResults("round-1", NOW)).resolves.toBe(0);
  });
});
