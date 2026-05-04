/**
 * S27.1b — Tests du service `listMonthlyCups`.
 *
 * Liste paginee des Nuffle Cup mensuelles (Cup avec
 * `monthlyYear NOT NULL AND monthlyMonth NOT NULL`). Filtres
 * optionnels par year/month pour la requete "cup d'avril 2026".
 *
 * Tri : `monthlyYear DESC, monthlyMonth DESC` (les editions les plus
 * recentes en premier).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    cup: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import { listMonthlyCups } from "./cup-monthly-listing";

const mockPrisma = prisma as unknown as {
  cup: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

describe("listMonthlyCups (S27.1b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtre sur monthlyYear NOT NULL AND monthlyMonth NOT NULL par defaut", async () => {
    mockPrisma.cup.findMany.mockResolvedValue([]);
    mockPrisma.cup.count.mockResolvedValue(0);

    await listMonthlyCups({});

    expect(mockPrisma.cup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          monthlyYear: { not: null },
          monthlyMonth: { not: null },
        },
        orderBy: [
          { monthlyYear: "desc" },
          { monthlyMonth: "desc" },
        ],
      }),
    );
  });

  it("ajoute year au filtre quand fourni", async () => {
    mockPrisma.cup.findMany.mockResolvedValue([]);
    mockPrisma.cup.count.mockResolvedValue(0);

    await listMonthlyCups({ year: 2026 });

    expect(mockPrisma.cup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          monthlyYear: 2026,
          monthlyMonth: { not: null },
        },
      }),
    );
  });

  it("ajoute year + month quand les deux sont fournis", async () => {
    mockPrisma.cup.findMany.mockResolvedValue([]);
    mockPrisma.cup.count.mockResolvedValue(0);

    await listMonthlyCups({ year: 2026, month: 4 });

    expect(mockPrisma.cup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { monthlyYear: 2026, monthlyMonth: 4 },
      }),
    );
  });

  it("plafonne limit a 100 et applique offset", async () => {
    mockPrisma.cup.findMany.mockResolvedValue([]);
    mockPrisma.cup.count.mockResolvedValue(150);

    const r = await listMonthlyCups({ limit: 9999, offset: 25 });

    expect(mockPrisma.cup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100, skip: 25 }),
    );
    expect(r.limit).toBe(100);
    expect(r.offset).toBe(25);
    expect(r.total).toBe(150);
  });

  it("rejette month hors [1,12]", async () => {
    await expect(
      listMonthlyCups({ year: 2026, month: 13 }),
    ).rejects.toThrow(/month/i);
    await expect(
      listMonthlyCups({ year: 2026, month: 0 }),
    ).rejects.toThrow(/month/i);
    expect(mockPrisma.cup.findMany).not.toHaveBeenCalled();
  });

  it("rejette year non entier ou <= 0", async () => {
    await expect(listMonthlyCups({ year: 0 })).rejects.toThrow(/year/i);
    await expect(listMonthlyCups({ year: -1 })).rejects.toThrow(/year/i);
    await expect(listMonthlyCups({ year: 2026.5 })).rejects.toThrow(
      /year/i,
    );
  });

  it("retourne items + total quand prisma resout", async () => {
    mockPrisma.cup.findMany.mockResolvedValue([
      {
        id: "c-1",
        name: "Nuffle Cup Avril 2026",
        monthlyYear: 2026,
        monthlyMonth: 4,
      },
    ]);
    mockPrisma.cup.count.mockResolvedValue(1);

    const r = await listMonthlyCups({ year: 2026, month: 4 });

    expect(r.items).toHaveLength(1);
    expect(r.total).toBe(1);
  });
});
