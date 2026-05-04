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
    },
  },
}));

import { prisma } from "../prisma";
import { getCurrentMatchOfTheWeek } from "./match-of-the-week";

const mockPrisma = prisma as unknown as {
  localMatch: { findFirst: ReturnType<typeof vi.fn> };
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
