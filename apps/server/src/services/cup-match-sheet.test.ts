import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    localMatch: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    localMatchAction: { createMany: vi.fn(), deleteMany: vi.fn() },
    cup: { findUnique: vi.fn() },
  },
}));

vi.mock("./cup-rounds", () => ({
  settleCupPairingForLocalMatch: vi.fn(),
  detachLocalMatchFromCupPairing: vi.fn(),
}));

import { prisma } from "../prisma";
import {
  detachLocalMatchFromCupPairing,
  settleCupPairingForLocalMatch,
} from "./cup-rounds";
import {
  canInvalidateCupMatchSheet,
  revertCupMatchSheet,
  settleCupMatchSheet,
  sheetEventsToLocalMatchActions,
  type CupSheetEvent,
} from "./cup-match-sheet";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const NAMES: Record<string, string> = {
  p1: "Grimjaw",
  p2: "Snik",
  p3: "Elrond",
};
const resolveName = (id: string): string | null => NAMES[id] ?? null;

describe("sheetEventsToLocalMatchActions", () => {
  it("traduit un touchdown en action `td` sans adversaire", () => {
    const out = sheetEventsToLocalMatchActions(
      [{ kind: "touchdown", team: "home", actorPlayerId: "p1", meta: { half: 2, turn: 5 } }],
      resolveName,
    );
    expect(out).toEqual([
      {
        half: 2,
        turn: 5,
        actionType: "td",
        playerId: "p1",
        playerName: "Grimjaw",
        playerTeam: "A",
        opponentId: null,
        opponentName: null,
        armorBroken: false,
        opponentState: null,
      },
    ]);
  });

  it("compte une sortie au contact (blocage / blitz) avec sa cible", () => {
    const out = sheetEventsToLocalMatchActions(
      [
        {
          kind: "casualty",
          team: "away",
          actorPlayerId: "p2",
          targetPlayerId: "p3",
          causeDetail: "block",
          injurySeverity: "badly_hurt",
        },
        {
          kind: "casualty",
          team: "away",
          actorPlayerId: "p2",
          targetPlayerId: "p3",
          causeDetail: "blitz",
          injurySeverity: "dead",
        },
      ],
      resolveName,
    );
    expect(out.map((a) => a.actionType)).toEqual(["blocage", "blitz"]);
    for (const a of out) {
      expect(a.playerTeam).toBe("B");
      expect(a.armorBroken).toBe(true);
      expect(a.opponentState).toBe("elimine");
      expect(a.opponentId).toBe("p3");
      expect(a.opponentName).toBe("Elrond");
    }
  });

  it("ignore une sortie SANS auteur au contact (esquive ratée, foule)", () => {
    const out = sheetEventsToLocalMatchActions(
      [
        {
          kind: "casualty",
          team: "home",
          actorPlayerId: "p1",
          causeDetail: "failed_dodge",
          injurySeverity: "mng",
        },
        {
          kind: "casualty",
          team: "home",
          actorPlayerId: "p1",
          causeDetail: "crowd",
          injurySeverity: "mng",
        },
      ],
      resolveName,
    );
    expect(out).toEqual([]);
  });

  it("n'accorde les points d'agression que si elle SORT le joueur", () => {
    const out = sheetEventsToLocalMatchActions(
      [
        {
          kind: "aggression",
          team: "home",
          actorPlayerId: "p1",
          targetPlayerId: "p3",
          injurySeverity: "badly_hurt",
        },
        {
          kind: "aggression",
          team: "home",
          actorPlayerId: "p1",
          targetPlayerId: "p3",
        },
      ],
      resolveName,
    );
    expect(out).toHaveLength(2);
    expect(out[0].opponentState).toBe("elimine");
    expect(out[1].opponentState).toBeNull();
  });

  it("traduit passes et interceptions", () => {
    const out = sheetEventsToLocalMatchActions(
      [
        { kind: "pass_complete", team: "home", actorPlayerId: "p1", targetPlayerId: "p2" },
        { kind: "interception", team: "away", actorPlayerId: "p3" },
      ],
      resolveName,
    );
    expect(out.map((a) => a.actionType)).toEqual(["passe", "interception"]);
  });

  it("ignore les évènements sans auteur, sans équipe, ou hors barème", () => {
    const events: CupSheetEvent[] = [
      { kind: "touchdown", team: null, actorPlayerId: "p1" },
      { kind: "touchdown", team: "home", actorPlayerId: null },
      { kind: "kickoff", team: "home", actorPlayerId: "p1" },
      { kind: "expulsion", team: "home", actorPlayerId: "p1" },
      { kind: "stalling", team: "home", actorPlayerId: "p1" },
    ];
    expect(sheetEventsToLocalMatchActions(events, resolveName)).toEqual([]);
  });

  it("retombe sur « Joueur » quand le nom est inconnu (id synthétique)", () => {
    const out = sheetEventsToLocalMatchActions(
      [{ kind: "touchdown", team: "home", actorPlayerId: "journeyman-home-1" }],
      resolveName,
    );
    expect(out[0].playerName).toBe("Joueur");
  });

  it("retombe sur mi-temps 1 / tour 1 quand la méta est absente ou illisible", () => {
    const out = sheetEventsToLocalMatchActions(
      [
        { kind: "touchdown", team: "home", actorPlayerId: "p1" },
        { kind: "touchdown", team: "home", actorPlayerId: "p1", meta: "oops" },
      ],
      resolveName,
    );
    expect(out.every((a) => a.half === 1 && a.turn === 1)).toBe(true);
  });
});

describe("settleCupMatchSheet", () => {
  const input = {
    cupId: "cup-1",
    cupPairingId: "cp-1",
    homeTeamId: "t-home",
    awayTeamId: "t-away",
    creatorId: "commish",
    scoreHome: 3,
    scoreAway: 1,
    actions: [
      {
        half: 1,
        turn: 2,
        actionType: "td",
        playerId: "p1",
        playerName: "Grimjaw",
        playerTeam: "A" as const,
        opponentId: null,
        opponentName: null,
        armorBroken: false,
        opponentState: null,
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(settleCupPairingForLocalMatch).mockResolvedValue({
      settled: true,
      roundCompleted: false,
    } as never);
  });

  it("crée le match local synthétique, ses actions, puis clôt la rencontre", async () => {
    mockPrisma.localMatch.findUnique.mockResolvedValue(null);
    mockPrisma.localMatch.create.mockResolvedValue({ id: "lm-1" });

    const out = await settleCupMatchSheet(input);

    expect(out.localMatchId).toBe("lm-1");
    const data = mockPrisma.localMatch.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: "completed",
      scoreTeamA: 3,
      scoreTeamB: 1,
      cupId: "cup-1",
      cupPairingId: "cp-1",
      teamAId: "t-home",
      teamBId: "t-away",
    });
    expect(mockPrisma.localMatchAction.createMany).toHaveBeenCalledWith({
      data: [{ ...input.actions[0], matchId: "lm-1" }],
    });
    expect(settleCupPairingForLocalMatch).toHaveBeenCalledWith("lm-1");
  });

  it("est idempotent : une revalidation réécrit le match au lieu d'en créer un second", async () => {
    mockPrisma.localMatch.findUnique.mockResolvedValue({ id: "lm-old" });

    const out = await settleCupMatchSheet({ ...input, scoreHome: 2 });

    expect(out.localMatchId).toBe("lm-old");
    expect(mockPrisma.localMatch.create).not.toHaveBeenCalled();
    expect(mockPrisma.localMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lm-old" },
        data: expect.objectContaining({ scoreTeamA: 2, scoreTeamB: 1 }),
      }),
    );
    // Le journal est rejoué à neuf : sinon les actions s'empileraient.
    expect(mockPrisma.localMatchAction.deleteMany).toHaveBeenCalledWith({
      where: { matchId: "lm-old" },
    });
  });

  it("n'écrit aucune action quand le journal est vide (forfait)", async () => {
    mockPrisma.localMatch.findUnique.mockResolvedValue(null);
    mockPrisma.localMatch.create.mockResolvedValue({ id: "lm-2" });

    await settleCupMatchSheet({ ...input, actions: [] });

    expect(mockPrisma.localMatchAction.createMany).not.toHaveBeenCalled();
  });
});

describe("revertCupMatchSheet", () => {
  beforeEach(() => vi.resetAllMocks());

  it("détache, purge les actions et supprime le match synthétique", async () => {
    mockPrisma.localMatch.findUnique.mockResolvedValue({ id: "lm-1" });
    vi.mocked(detachLocalMatchFromCupPairing).mockResolvedValue(true as never);

    await expect(revertCupMatchSheet({ cupPairingId: "cp-1" })).resolves.toEqual(
      { removed: true },
    );
    expect(detachLocalMatchFromCupPairing).toHaveBeenCalledWith("lm-1");
    expect(mockPrisma.localMatchAction.deleteMany).toHaveBeenCalledWith({
      where: { matchId: "lm-1" },
    });
    expect(mockPrisma.localMatch.delete).toHaveBeenCalledWith({
      where: { id: "lm-1" },
    });
  });

  it("ne fait rien quand aucun match n'a été matérialisé", async () => {
    mockPrisma.localMatch.findUnique.mockResolvedValue(null);
    await expect(revertCupMatchSheet({ cupPairingId: "cp-1" })).resolves.toEqual(
      { removed: false },
    );
    expect(mockPrisma.localMatch.delete).not.toHaveBeenCalled();
  });

  it("supprime quand même le match si le détachement échoue", async () => {
    mockPrisma.localMatch.findUnique.mockResolvedValue({ id: "lm-1" });
    vi.mocked(detachLocalMatchFromCupPairing).mockRejectedValue(
      new Error("boom") as never,
    );
    await expect(revertCupMatchSheet({ cupPairingId: "cp-1" })).resolves.toEqual(
      { removed: true },
    );
    expect(mockPrisma.localMatch.delete).toHaveBeenCalled();
  });
});

describe("canInvalidateCupMatchSheet", () => {
  beforeEach(() => vi.resetAllMocks());

  it("autorise tant que la coupe est en cours", async () => {
    mockPrisma.cup.findUnique.mockResolvedValue({ status: "en_cours" });
    await expect(canInvalidateCupMatchSheet({ cupId: "c1" })).resolves.toEqual({
      ok: true,
    });
  });

  it("refuse sur une coupe terminée ou archivée (palmarès figé)", async () => {
    for (const status of ["terminee", "archivee"]) {
      mockPrisma.cup.findUnique.mockResolvedValue({ status });
      await expect(
        canInvalidateCupMatchSheet({ cupId: "c1" }),
      ).resolves.toEqual({ ok: false, reason: "cup-completed" });
    }
  });

  it("refuse quand la coupe est introuvable", async () => {
    mockPrisma.cup.findUnique.mockResolvedValue(null);
    await expect(canInvalidateCupMatchSheet({ cupId: "c1" })).resolves.toEqual({
      ok: false,
      reason: "cup_not_found",
    });
  });
});
