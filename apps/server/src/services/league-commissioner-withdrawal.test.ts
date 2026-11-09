import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: { findUnique: vi.fn() },
    leagueParticipant: { findUnique: vi.fn() },
    leaguePairing: { findMany: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("./league", () => ({ withdrawParticipant: vi.fn() }));
vi.mock("./league-forfeit", () => ({
  recordForfeit: vi.fn(),
  maybeCompleteRoundAndSeason: vi.fn(),
}));
vi.mock("./in-app-notifications", () => ({
  createInAppNotification: vi.fn(),
}));

import { prisma } from "../prisma";
import { withdrawParticipant } from "./league";
import { maybeCompleteRoundAndSeason, recordForfeit } from "./league-forfeit";
import { createInAppNotification } from "./in-app-notifications";
import { withdrawParticipantByCommissioner } from "./league-commissioner-withdrawal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;
type MockFn = ReturnType<typeof vi.fn>;
const withdrawMock = withdrawParticipant as unknown as MockFn;
const forfeitMock = recordForfeit as unknown as MockFn;
const completeMock = maybeCompleteRoundAndSeason as unknown as MockFn;
const notifyMock = createInAppNotification as unknown as MockFn;

const COMMISSIONER = { userId: "u-com", isAdmin: false };

function pairingRow(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    status: "scheduled",
    homeParticipantId: "x",
    awayParticipantId: "o1",
    match: null,
    matchSheet: null,
    roundId: "r1",
    round: { kind: "regular", bracketSlot: null },
    ...over,
  };
}

function setup(pairings: unknown[]) {
  db.leagueSeason.findUnique.mockResolvedValue({
    id: "s1",
    status: "in_progress",
    league: { id: "l1", name: "Ligue du Kraken", creatorId: "u-com" },
  });
  db.leagueParticipant.findUnique.mockResolvedValue({
    id: "x",
    seasonId: "s1",
    status: "active",
    teamId: "t-x",
    team: { name: "Les Gobs", ownerId: "u-coach" },
  });
  db.leaguePairing.findMany.mockResolvedValue(pairings);
}

describe("withdrawParticipantByCommissioner", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    forfeitMock.mockResolvedValue({ recorded: true });
  });

  it("404 sur une saison inconnue", async () => {
    db.leagueSeason.findUnique.mockResolvedValue(null);
    await expect(
      withdrawParticipantByCommissioner(
        { seasonId: "s1", participantId: "x", remaining: "forfeit" },
        COMMISSIONER,
      ),
    ).rejects.toMatchObject({ code: "season_not_found" });
  });

  it("lit les seules rencontres OUVERTES de l'équipe dans la saison", async () => {
    setup([]);
    await withdrawParticipantByCommissioner(
      { seasonId: "s1", participantId: "x", remaining: "forfeit" },
      COMMISSIONER,
    );
    expect(db.leaguePairing.findMany.mock.calls[0][0].where).toEqual({
      round: { seasonId: "s1" },
      status: { in: ["scheduled", "in_progress"] },
      OR: [{ homeParticipantId: "x" }, { awayParticipantId: "x" }],
    });
  });

  it("forfait : retire (Fan offert repris), PUIS déclare chaque forfait, notifie le coach", async () => {
    setup([
      pairingRow({ id: "p-home" }),
      pairingRow({
        id: "p-away",
        homeParticipantId: "o2",
        awayParticipantId: "x",
        roundId: "r2",
      }),
    ]);
    const order: string[] = [];
    withdrawMock.mockImplementation(async () => order.push("withdraw"));
    forfeitMock.mockImplementation(async ({ pairingId }) => {
      order.push(`forfeit:${pairingId}`);
      return { recorded: true };
    });

    const out = await withdrawParticipantByCommissioner(
      { seasonId: "s1", participantId: "x", remaining: "forfeit" },
      COMMISSIONER,
    );

    expect(withdrawMock).toHaveBeenCalledWith({
      seasonId: "s1",
      teamId: "t-x",
      force: true,
    });
    expect(order).toEqual(["withdraw", "forfeit:p-home", "forfeit:p-away"]);
    expect(forfeitMock).toHaveBeenCalledWith({ pairingId: "p-home", side: "home" });
    expect(forfeitMock).toHaveBeenCalledWith({ pairingId: "p-away", side: "away" });
    expect(db.leaguePairing.updateMany).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      forfeited: ["p-home", "p-away"],
      cancelled: [],
      skipped: [],
    });
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-coach",
        kind: "league.team_withdrawn",
        url: "/leagues/l1",
      }),
    );
  });

  it("annulation : annule la saison régulière, complète les journées, forfait au bracket", async () => {
    setup([
      pairingRow({ id: "reg1", roundId: "r3" }),
      pairingRow({ id: "reg2", roundId: "r3" }),
      pairingRow({
        id: "sf1",
        roundId: "r9",
        homeParticipantId: "o1",
        awayParticipantId: "x",
        round: { kind: "playoff", bracketSlot: "sf1" },
      }),
    ]);
    const out = await withdrawParticipantByCommissioner(
      { seasonId: "s1", participantId: "x", remaining: "cancel" },
      COMMISSIONER,
    );
    expect(db.leaguePairing.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["reg1", "reg2"] },
        status: { in: ["scheduled", "in_progress"] },
      },
      data: { status: "cancelled" },
    });
    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(completeMock).toHaveBeenCalledWith("r3", "s1");
    expect(forfeitMock).toHaveBeenCalledWith({ pairingId: "sf1", side: "away" });
    expect(out).toMatchObject({ cancelled: ["reg1", "reg2"], forfeited: ["sf1"] });
  });

  it("refuse — et ne retire rien — si une rencontre a une feuille soumise", async () => {
    setup([
      pairingRow({ matchSheet: { status: "both_submitted", _count: { events: 6 } } }),
    ]);
    await expect(
      withdrawParticipantByCommissioner(
        { seasonId: "s1", participantId: "x", remaining: "forfeit" },
        COMMISSIONER,
      ),
    ).rejects.toMatchObject({
      code: "pairing_engaged",
      engagedPairingIds: ["p1"],
    });
    expect(withdrawMock).not.toHaveBeenCalled();
    expect(forfeitMock).not.toHaveBeenCalled();
  });

  it("refuse un coach qui n'est pas commissaire", async () => {
    setup([]);
    await expect(
      withdrawParticipantByCommissioner(
        { seasonId: "s1", participantId: "x", remaining: "forfeit" },
        { userId: "u-coach", isAdmin: false },
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(withdrawMock).not.toHaveBeenCalled();
  });

  it("un forfait refusé par le service est rapporté, pas levé", async () => {
    setup([pairingRow({ id: "p-home" })]);
    forfeitMock.mockResolvedValue({ skipped: true, reason: "match-already-scored" });
    const out = await withdrawParticipantByCommissioner(
      { seasonId: "s1", participantId: "x", remaining: "forfeit" },
      COMMISSIONER,
    );
    expect(out).toMatchObject({ forfeited: [], skipped: ["p-home"] });
  });
});
