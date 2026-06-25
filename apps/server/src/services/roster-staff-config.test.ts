import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    rosterStaffConfig: { findUnique: vi.fn() },
    roster: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  resolveStaffConfigByRosterId,
  resolveStaffConfigBySlug,
} from "./roster-staff-config";

type MockFn = ReturnType<typeof vi.fn>;
const m = {
  staffFind: prisma.rosterStaffConfig.findUnique as MockFn,
  rosterFind: prisma.roster.findUnique as MockFn,
};

const DB_ROW = {
  rerollCost: 123000,
  maxRerolls: 5,
  apothecaryAllowed: false,
  apothecaryCost: 90000,
  maxCheerleaders: 4,
  cheerleaderCost: 15000,
  maxAssistants: 2,
  assistantCost: 15000,
  maxDedicatedFans: 3,
  dedicatedFanCost: 15000,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("roster-staff-config — resolveStaffConfigByRosterId", () => {
  it("retourne la config DB quand une ligne existe", async () => {
    m.staffFind.mockResolvedValue(DB_ROW);
    const cfg = await resolveStaffConfigByRosterId("r1", "bb11");
    expect(cfg).toEqual(DB_ROW);
    expect(m.rosterFind).not.toHaveBeenCalled(); // pas de fallback
  });

  it("retombe sur le défaut dérivé du slug si aucune ligne", async () => {
    m.staffFind.mockResolvedValue(null);
    m.rosterFind.mockResolvedValue({ slug: "human" });
    const cfg = await resolveStaffConfigByRosterId("r1", "bb11");
    // défaut human/bb11 == historique
    expect(cfg.rerollCost).toBe(50000);
    expect(cfg.cheerleaderCost).toBe(10000);
    expect(cfg.apothecaryAllowed).toBe(true);
  });
});

describe("roster-staff-config — resolveStaffConfigBySlug", () => {
  it("retourne la config DB quand le roster + la ligne existent", async () => {
    m.rosterFind.mockResolvedValue({ id: "r1", slug: "skaven" });
    m.staffFind.mockResolvedValue(DB_ROW);
    const cfg = await resolveStaffConfigBySlug("skaven", "season_3", "sevens");
    expect(cfg).toEqual(DB_ROW);
  });

  it("retombe sur le défaut si le roster est introuvable", async () => {
    m.rosterFind.mockResolvedValue(null);
    const cfg = await resolveStaffConfigBySlug("lizardmen", "season_3", "bb11");
    expect(cfg.rerollCost).toBe(70000); // défaut lizardmen/bb11
    expect(m.staffFind).not.toHaveBeenCalled();
  });

  it("retombe sur le défaut format-aware si pas de ligne (sevens ×2)", async () => {
    m.rosterFind.mockResolvedValue({ id: "r1", slug: "human" });
    m.staffFind.mockResolvedValue(null);
    const cfg = await resolveStaffConfigBySlug("human", "season_3", "sevens");
    expect(cfg.rerollCost).toBe(100000); // 50k ×2
    expect(cfg.cheerleaderCost).toBe(20000);
    expect(cfg.apothecaryCost).toBe(80000);
  });
});
