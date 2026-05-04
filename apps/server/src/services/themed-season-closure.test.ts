/**
 * S26.6f — Tests du service `applyThemedSeasonClosure`.
 *
 * Hook idempotent appele a la cloture d'une saison thematique : calcule
 * le champion via `computeSeasonStandings`, retourne ses metadata et
 * journalise. Point d'extension pour de futures integrations
 * (push notification, achievement specifique, archivage).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./league", () => ({
  computeSeasonStandings: vi.fn(),
}));

import { prisma } from "../prisma";
import { computeSeasonStandings } from "./league";
import { applyThemedSeasonClosure } from "./themed-season-closure";

const mockPrisma = prisma as unknown as {
  leagueSeason: { findUnique: ReturnType<typeof vi.fn> };
};
const mockCompute = computeSeasonStandings as unknown as ReturnType<
  typeof vi.fn
>;

describe("applyThemedSeasonClosure (S26.6f)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no-op si la saison n'existe pas", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue(null);
    const r = await applyThemedSeasonClosure("missing");
    expect(r).toEqual({ skipped: true, reason: "season_not_found" });
    expect(mockCompute).not.toHaveBeenCalled();
  });

  it("no-op si la saison n'est pas thematique (pas de theme)", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s-1",
      status: "completed",
      theme: null,
      themeYear: null,
    });
    const r = await applyThemedSeasonClosure("s-1");
    expect(r).toEqual({ skipped: true, reason: "not_themed" });
    expect(mockCompute).not.toHaveBeenCalled();
  });

  it("no-op si la saison n'est pas encore completed", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s-1",
      status: "in_progress",
      theme: "skaven_cup",
      themeYear: 2026,
    });
    const r = await applyThemedSeasonClosure("s-1");
    expect(r).toEqual({ skipped: true, reason: "not_completed" });
    expect(mockCompute).not.toHaveBeenCalled();
  });

  it("no-op si le slug du theme n'est pas dans le catalogue (forward-compat)", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s-1",
      status: "completed",
      theme: "ghost_league",
      themeYear: 2026,
    });
    const r = await applyThemedSeasonClosure("s-1");
    expect(r).toEqual({ skipped: true, reason: "unknown_theme" });
  });

  it("no-op si le standings est vide (saison sans participant)", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s-1",
      status: "completed",
      theme: "skaven_cup",
      themeYear: 2026,
    });
    mockCompute.mockResolvedValue([]);
    const r = await applyThemedSeasonClosure("s-1");
    expect(r).toEqual({ skipped: true, reason: "no_standings" });
  });

  it("retourne le champion + label quand la saison est thematique completed", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s-skaven-2026",
      status: "completed",
      theme: "skaven_cup",
      themeYear: 2026,
    });
    mockCompute.mockResolvedValue([
      { ownerId: "user-1", teamId: "team-1", teamName: "Squeakers" },
      { ownerId: "user-2", teamId: "team-2", teamName: "Other" },
    ]);

    const r = await applyThemedSeasonClosure("s-skaven-2026");

    expect(r).toEqual({
      skipped: false,
      seasonId: "s-skaven-2026",
      championUserId: "user-1",
      championTeamId: "team-1",
      championTeamName: "Squeakers",
      theme: "skaven_cup",
      themeYear: 2026,
      label: "Champion Skaven Cup 2026",
    });
  });

  it("retourne `skipped` si formatLeagueThemeChampionLabel rejette la valeur (defense)", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s-1",
      status: "completed",
      theme: "skaven_cup",
      themeYear: -10,
    });
    mockCompute.mockResolvedValue([{ ownerId: "u-1", teamId: "t-1", teamName: "T" }]);
    const r = await applyThemedSeasonClosure("s-1");
    expect(r).toEqual({ skipped: true, reason: "invalid_label" });
  });
});
