/**
 * S27.1f — Tests des helpers Match-of-the-week.
 *
 * Service simple : lecture du LocalMatch le plus recemment "featured"
 * par un admin (`featuredAt NOT NULL ORDER BY featuredAt DESC LIMIT 1`).
 * L'endpoint admin pick (POST) sera couvert dans une slice ulterieure ;
 * cette PR livre la foundation lecture utilisable des aujourd'hui par
 * la home / la page cups landing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    localMatch: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  getCurrentMatchOfTheWeek,
  setMatchOfTheWeek,
} from "./match-of-the-week";

const mockPrisma = prisma as unknown as {
  localMatch: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe("getCurrentMatchOfTheWeek (S27.1f)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne null quand aucun match n'est featured", async () => {
    mockPrisma.localMatch.findFirst.mockResolvedValue(null);
    const r = await getCurrentMatchOfTheWeek();
    expect(r).toBeNull();
  });

  it("retourne le match le plus recemment featured", async () => {
    mockPrisma.localMatch.findFirst.mockResolvedValue({
      id: "match-1",
      name: "Skaven vs Nordic",
      featuredAt: new Date("2026-04-15T12:00:00.000Z"),
      featuredNote: "Le match du mois !",
      teamA: { id: "team-A", name: "Skaven Stars" },
      teamB: { id: "team-B", name: "Nordic Wolves" },
      cupId: "cup-1",
      scoreTeamA: 3,
      scoreTeamB: 2,
    });

    const r = await getCurrentMatchOfTheWeek();

    expect(r).not.toBeNull();
    expect(r?.id).toBe("match-1");
    expect(r?.featuredNote).toBe("Le match du mois !");
  });

  it("filtre Prisma sur featuredAt NOT NULL et ordonne DESC", async () => {
    mockPrisma.localMatch.findFirst.mockResolvedValue(null);
    await getCurrentMatchOfTheWeek();
    expect(mockPrisma.localMatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { featuredAt: { not: null }, isPublic: true },
        orderBy: { featuredAt: "desc" },
      }),
    );
  });

  it("inclut les noms d'equipes pour eviter un round-trip cote client", async () => {
    mockPrisma.localMatch.findFirst.mockResolvedValue(null);
    await getCurrentMatchOfTheWeek();
    expect(mockPrisma.localMatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          teamA: expect.any(Object),
          teamB: expect.any(Object),
        }),
      }),
    );
  });

  it("ne retourne que les matchs publics (cup admin n'est pas une raison de fuiter un private)", async () => {
    mockPrisma.localMatch.findFirst.mockResolvedValue(null);
    await getCurrentMatchOfTheWeek();
    const call = mockPrisma.localMatch.findFirst.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where.isPublic).toBe(true);
  });
});

describe("setMatchOfTheWeek (S27.1g admin pick)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejette quand le match n'existe pas", async () => {
    mockPrisma.localMatch.findUnique.mockResolvedValue(null);
    await expect(
      setMatchOfTheWeek({ matchId: "missing", note: null }),
    ).rejects.toThrow(/introuvable|not found/i);
    expect(mockPrisma.localMatch.update).not.toHaveBeenCalled();
  });

  it("rejette quand le match n'est pas public (anti-fuite)", async () => {
    mockPrisma.localMatch.findUnique.mockResolvedValue({
      id: "m-1",
      isPublic: false,
      status: "completed",
    });
    await expect(
      setMatchOfTheWeek({ matchId: "m-1", note: null }),
    ).rejects.toThrow(/public/i);
    expect(mockPrisma.localMatch.update).not.toHaveBeenCalled();
  });

  it("rejette quand le match n'est pas completed (pas de teaser pour un match en cours)", async () => {
    mockPrisma.localMatch.findUnique.mockResolvedValue({
      id: "m-1",
      isPublic: true,
      status: "in_progress",
    });
    await expect(
      setMatchOfTheWeek({ matchId: "m-1", note: null }),
    ).rejects.toThrow(/completed|terminé|status/i);
    expect(mockPrisma.localMatch.update).not.toHaveBeenCalled();
  });

  it("met a jour featuredAt + featuredNote quand le match est valide", async () => {
    mockPrisma.localMatch.findUnique.mockResolvedValue({
      id: "m-1",
      isPublic: true,
      status: "completed",
    });
    mockPrisma.localMatch.update.mockResolvedValue({
      id: "m-1",
      featuredAt: new Date(),
      featuredNote: "Le match du moment !",
    });

    const r = await setMatchOfTheWeek({
      matchId: "m-1",
      note: "Le match du moment !",
    });

    expect(mockPrisma.localMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m-1" },
        data: expect.objectContaining({
          featuredAt: expect.any(Date),
          featuredNote: "Le match du moment !",
        }),
      }),
    );
    expect(r.id).toBe("m-1");
  });

  it("accepte note=null (set sans commentaire)", async () => {
    mockPrisma.localMatch.findUnique.mockResolvedValue({
      id: "m-1",
      isPublic: true,
      status: "completed",
    });
    mockPrisma.localMatch.update.mockResolvedValue({ id: "m-1" });

    await setMatchOfTheWeek({ matchId: "m-1", note: null });

    expect(mockPrisma.localMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          featuredAt: expect.any(Date),
          featuredNote: null,
        }),
      }),
    );
  });
});
