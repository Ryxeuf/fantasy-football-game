/**
 * Statut de présence (mort / licenciement) — application et reversion
 * vérifiée.
 *
 * Mocks : prisma (teamPlayer + teamPlayerStatusEvent + $transaction).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ACTIVE_PLAYER_WHERE,
  applyPlayerStatus,
  applyPlayerStatuses,
  getPlayerStatusHistory,
  isActivePlayer,
  revertPlayerStatus,
  revertPlayerStatusesBySource,
  statusOf,
} from "./player-status";
import { prisma } from "../prisma";

vi.mock("../prisma", () => ({
  prisma: {
    teamPlayer: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    teamPlayerStatusEvent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockFindUnique = vi.mocked(prisma.teamPlayer.findUnique);
const mockUpdateMany = vi.mocked(prisma.teamPlayer.updateMany);
const mockEventFindFirst = vi.mocked(prisma.teamPlayerStatusEvent.findFirst);
const mockEventFindMany = vi.mocked(prisma.teamPlayerStatusEvent.findMany);
const mockEventUpdate = vi.mocked(prisma.teamPlayerStatusEvent.update);
const mockTransaction = vi.mocked(prisma.$transaction);

const ACTIVE = {
  id: "p1",
  teamId: "t1",
  dead: false,
  firedAt: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockTransaction.mockResolvedValue([] as never);
});

describe("helpers purs", () => {
  it("ACTIVE_PLAYER_WHERE exclut morts ET licencies", () => {
    expect(ACTIVE_PLAYER_WHERE).toEqual({ dead: false, firedAt: null });
  });

  it("isActivePlayer", () => {
    expect(isActivePlayer({ dead: false, firedAt: null })).toBe(true);
    expect(isActivePlayer({ dead: true, firedAt: null })).toBe(false);
    expect(isActivePlayer({ dead: false, firedAt: new Date() })).toBe(false);
    expect(isActivePlayer({})).toBe(true);
  });

  it("statusOf derive le statut des deux colonnes", () => {
    expect(statusOf({ dead: false, firedAt: null })).toBe("active");
    expect(statusOf({ dead: true, firedAt: null })).toBe("dead");
    expect(statusOf({ dead: false, firedAt: new Date() })).toBe("fired");
    // La mort prime sur le licenciement si les deux sont poses (legacy).
    expect(statusOf({ dead: true, firedAt: new Date() })).toBe("dead");
  });
});

describe("applyPlayerStatus", () => {
  it("pose la mort + l'evenement de provenance dans une transaction", async () => {
    mockFindUnique.mockResolvedValue(ACTIVE as never);

    const out = await applyPlayerStatus({
      playerId: "p1",
      kind: "death",
      source: "match_sheet",
      sourceId: "m1",
    });

    expect(out).toEqual({ applied: true, playerId: "p1", teamId: "t1" });
    expect(mockTransaction).toHaveBeenCalledOnce();
    const updateArgs = vi.mocked(prisma.teamPlayer.update).mock.calls[0]![0];
    expect(updateArgs.data).toMatchObject({
      dead: true,
      status: "dead",
      statusSource: "match_sheet",
      statusSourceId: "m1",
    });
    const eventArgs = vi.mocked(prisma.teamPlayerStatusEvent.create).mock
      .calls[0]![0];
    expect(eventArgs.data).toMatchObject({
      playerId: "p1",
      teamId: "t1",
      kind: "death",
      sourceType: "match_sheet",
      sourceId: "m1",
    });
  });

  it("sort le mort du roster (firedAt) des la pose de la mort", async () => {
    // Sequence BB p.68 : un joueur mort est retire de l'equipe AVANT toute
    // autre action d'apres-match, sa place et son numero sont libres.
    mockFindUnique.mockResolvedValue(ACTIVE as never);

    await applyPlayerStatus({
      playerId: "p1",
      kind: "death",
      source: "match_sheet",
      sourceId: "m1",
    });

    const updateArgs = vi.mocked(prisma.teamPlayer.update).mock.calls[0]![0];
    expect(updateArgs.data.firedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.diedAt).toBeInstanceOf(Date);
    // `dead` reste la source de verite du statut : le retrait n'est PAS un
    // licenciement (statut "dead", pas "fired").
    expect(updateArgs.data).toMatchObject({ dead: true, status: "dead" });
  });

  it("pose le licenciement (firedAt) sans toucher a dead", async () => {
    mockFindUnique.mockResolvedValue(ACTIVE as never);

    await applyPlayerStatus({
      playerId: "p1",
      kind: "firing",
      source: "match_sheet",
      sourceId: "m1",
    });

    const updateArgs = vi.mocked(prisma.teamPlayer.update).mock.calls[0]![0];
    expect(updateArgs.data).toMatchObject({ status: "fired" });
    expect(updateArgs.data.firedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.dead).toBeUndefined();
  });

  it("skippe un joueur deja inactif (idempotence)", async () => {
    mockFindUnique.mockResolvedValue({ ...ACTIVE, dead: true } as never);

    const out = await applyPlayerStatus({
      playerId: "p1",
      kind: "firing",
      source: "match_sheet",
      sourceId: "m1",
    });

    expect(out).toEqual({ skipped: true, reason: "already-inactive" });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("refuse un joueur hors des equipes autorisees", async () => {
    mockFindUnique.mockResolvedValue(ACTIVE as never);

    const out = await applyPlayerStatus({
      playerId: "p1",
      kind: "death",
      source: "match_sheet",
      allowedTeamIds: ["other"],
    });

    expect(out).toEqual({ skipped: true, reason: "team-not-allowed" });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("skippe un joueur introuvable", async () => {
    mockFindUnique.mockResolvedValue(null as never);
    const out = await applyPlayerStatus({
      playerId: "nope",
      kind: "death",
      source: "admin",
    });
    expect(out).toEqual({ skipped: true, reason: "player-not-found" });
  });
});

describe("applyPlayerStatuses (batch)", () => {
  it("retourne les ids REELLEMENT appliques et les equipes touchees", async () => {
    mockFindUnique
      .mockResolvedValueOnce(ACTIVE as never)
      .mockResolvedValueOnce({ ...ACTIVE, id: "p2", dead: true } as never)
      .mockResolvedValueOnce({ ...ACTIVE, id: "p3", teamId: "t2" } as never);

    const out = await applyPlayerStatuses(["p1", "p2", "p3"], {
      kind: "firing",
      source: "match_sheet",
      sourceId: "m1",
    });

    expect(out.appliedIds).toEqual(["p1", "p3"]);
    expect(out.teamIds.sort()).toEqual(["t1", "t2"]);
  });
});

describe("revertPlayerStatus — verification de la source", () => {
  it("ressuscite un joueur tue par la source annulee", async () => {
    mockFindUnique.mockResolvedValue({ ...ACTIVE, dead: true } as never);
    mockEventFindFirst.mockResolvedValue({
      id: "e1",
      kind: "death",
      sourceType: "match_sheet",
      sourceId: "m1",
    } as never);
    mockUpdateMany.mockResolvedValue({ count: 1 } as never);

    const out = await revertPlayerStatus({
      playerId: "p1",
      kind: "death",
      source: "match_sheet",
      sourceId: "m1",
    });

    expect(out).toEqual({ reverted: true, playerId: "p1", teamId: "t1" });
    const args = mockUpdateMany.mock.calls[0]![0];
    // Update CONDITIONNEL sur l'etat courant.
    expect(args.where).toMatchObject({ id: "p1", dead: true });
    expect(args.data).toMatchObject({
      dead: false,
      status: "active",
      statusSource: null,
      missNextMatch: false,
      // Ressusciter, c'est REMETTRE au roster : la mort l'en avait sorti.
      diedAt: null,
      firedAt: null,
    });
    expect(mockEventUpdate).toHaveBeenCalledOnce();
  });

  it("REFUSE de ressusciter si le statut vient d'une autre source", async () => {
    mockFindUnique.mockResolvedValue({ ...ACTIVE, dead: true } as never);
    mockEventFindFirst.mockResolvedValue({
      id: "e2",
      kind: "death",
      sourceType: "commissioner",
      sourceId: "",
    } as never);

    const out = await revertPlayerStatus({
      playerId: "p1",
      kind: "death",
      source: "match_sheet",
      sourceId: "m1",
    });

    expect(out).toEqual({ skipped: true, reason: "status-superseded" });
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("REFUSE si le statut vient d'un AUTRE match de la meme source", async () => {
    mockFindUnique.mockResolvedValue({ ...ACTIVE, dead: true } as never);
    mockEventFindFirst.mockResolvedValue({
      id: "e3",
      kind: "death",
      sourceType: "match_sheet",
      sourceId: "m2",
    } as never);

    const out = await revertPlayerStatus({
      playerId: "p1",
      kind: "death",
      source: "match_sheet",
      sourceId: "m1",
    });

    expect(out).toEqual({ skipped: true, reason: "status-superseded" });
  });

  it("skippe un joueur deja actif (double invalidation)", async () => {
    mockFindUnique.mockResolvedValue(ACTIVE as never);

    const out = await revertPlayerStatus({
      playerId: "p1",
      kind: "death",
      source: "match_sheet",
      sourceId: "m1",
    });

    expect(out).toEqual({ skipped: true, reason: "no-status-to-revert" });
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("refuse d'annuler un licenciement sur un joueur mort", async () => {
    mockFindUnique.mockResolvedValue({ ...ACTIVE, dead: true } as never);

    const out = await revertPlayerStatus({
      playerId: "p1",
      kind: "firing",
      source: "match_sheet",
      sourceId: "m1",
    });

    expect(out).toEqual({ skipped: true, reason: "status-superseded" });
  });

  it("accepte un statut legacy par defaut (donnees d'avant le suivi)", async () => {
    mockFindUnique.mockResolvedValue({ ...ACTIVE, dead: true } as never);
    mockEventFindFirst.mockResolvedValue({
      id: "e4",
      kind: "death",
      sourceType: "legacy",
      sourceId: "",
    } as never);
    mockUpdateMany.mockResolvedValue({ count: 1 } as never);

    const out = await revertPlayerStatus({
      playerId: "p1",
      kind: "death",
      source: "match_sheet",
      sourceId: "m1",
    });

    expect("reverted" in out).toBe(true);
  });

  it("refuse le legacy quand la provenance stricte est exigee", async () => {
    mockFindUnique.mockResolvedValue({ ...ACTIVE, dead: true } as never);
    mockEventFindFirst.mockResolvedValue({
      id: "e5",
      kind: "death",
      sourceType: "legacy",
      sourceId: "",
    } as never);

    const out = await revertPlayerStatus({
      playerId: "p1",
      kind: "death",
      source: "online_match",
      sourceId: "m1",
      allowLegacy: false,
    });

    expect(out).toEqual({ skipped: true, reason: "status-superseded" });
  });

  it("refuse si l'update conditionnel ne touche aucune ligne (race)", async () => {
    mockFindUnique.mockResolvedValue({ ...ACTIVE, dead: true } as never);
    mockEventFindFirst.mockResolvedValue({
      id: "e6",
      kind: "death",
      sourceType: "match_sheet",
      sourceId: "m1",
    } as never);
    mockUpdateMany.mockResolvedValue({ count: 0 } as never);

    const out = await revertPlayerStatus({
      playerId: "p1",
      kind: "death",
      source: "match_sheet",
      sourceId: "m1",
    });

    expect(out).toEqual({ skipped: true, reason: "status-superseded" });
    expect(mockEventUpdate).not.toHaveBeenCalled();
  });
});

describe("revertPlayerStatusesBySource", () => {
  it("reverte tous les statuts poses par un match", async () => {
    mockEventFindMany.mockResolvedValue([
      { playerId: "p1", kind: "death" },
      { playerId: "p2", kind: "death" },
    ] as never);
    mockFindUnique.mockResolvedValue({ ...ACTIVE, dead: true } as never);
    mockEventFindFirst.mockResolvedValue({
      id: "e",
      kind: "death",
      sourceType: "online_match",
      sourceId: "m1",
    } as never);
    mockUpdateMany.mockResolvedValue({ count: 1 } as never);

    const out = await revertPlayerStatusesBySource({
      source: "online_match",
      sourceId: "m1",
    });

    expect(out.revertedIds).toEqual(["p1", "p1"]);
    expect(out.teamIds).toEqual(["t1"]);
  });

  it("ne fait rien si le match n'a rien pose", async () => {
    mockEventFindMany.mockResolvedValue([] as never);
    const out = await revertPlayerStatusesBySource({
      source: "online_match",
      sourceId: "m1",
    });
    expect(out).toEqual({ revertedIds: [], teamIds: [] });
  });
});

describe("getPlayerStatusHistory", () => {
  it("mappe les evenements (sourceId vide -> null)", async () => {
    const now = new Date();
    mockEventFindMany.mockResolvedValue([
      {
        id: "e1",
        kind: "death",
        sourceType: "commissioner",
        sourceId: "",
        reason: "erreur de saisie",
        createdAt: now,
        revertedAt: null,
      },
    ] as never);

    const out = await getPlayerStatusHistory("p1");

    expect(out).toEqual([
      {
        id: "e1",
        kind: "death",
        sourceType: "commissioner",
        sourceId: null,
        reason: "erreur de saisie",
        occurredAt: now,
        revertedAt: null,
      },
    ]);
  });
});
