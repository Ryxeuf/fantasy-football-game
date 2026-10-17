/**
 * Page carrière : le bilan toutes compétitions (ligue + coupe) et la
 * carrière des joueurs coupe comprise. Auparavant, seul le palmarès en
 * ligne s'affichait — une équipe de ligue ou de coupe y était à 0.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TeamCareerPage from "./page";

const originalFetch = global.fetch;

function careerPayload(overrides: Record<string, unknown> = {}) {
  return {
    team: { id: "team-1", name: "Paladins de la Dame", roster: "bretonnian", ruleset: "season_3" },
    record: {
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      touchdownsFor: 0,
      touchdownsAgainst: 0,
      casualtiesInflicted: 0,
      casualtiesSuffered: 0,
      completions: 0,
      interceptions: 0,
      winRate: 0,
    },
    history: [],
    players: [
      {
        id: "p-1",
        name: "Sire Bohémond",
        number: 1,
        position: "grail_knight",
        spp: 0,
        matchesPlayed: 4,
        totalTouchdowns: 3,
        totalCasualties: 2,
        totalCompletions: 0,
        totalInterceptions: 0,
        totalMvpAwards: 1,
        nigglingInjuries: 0,
        advancementsCount: 0,
        dead: false,
      },
    ],
    ...overrides,
  };
}

function mockCareer(payload: unknown) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => payload,
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  window.history.pushState({}, "", "/me/teams/team-1/career");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "token", setItem: vi.fn(), removeItem: vi.fn() },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("page carrière d'équipe", () => {
  it("affiche le bilan toutes compétitions avec le détail par compétition", async () => {
    mockCareer(
      careerPayload({
        matchStats: {
          played: 6,
          wins: 4,
          draws: 1,
          losses: 1,
          touchdownsFor: 9,
          touchdownsAgainst: 4,
          touchdownDiff: 5,
          bySource: {
            league: { played: 2 },
            cup: { played: 4 },
            friendly: { played: 0 },
          },
        },
      }),
    );
    render(<TeamCareerPage />);

    const block = await screen.findByTestId("career-all-competitions");
    expect(block.textContent).toContain("Matchs joues6");
    expect(block.textContent).toContain("4 - 1 - 1");
    expect(block.textContent).toContain("9 / 4 (+5)");
    expect(block.textContent).toContain("Ligue 2 · Coupe 4");
  });

  it("affiche la carrière servie pour chaque joueur", async () => {
    mockCareer(careerPayload());
    render(<TeamCareerPage />);

    const row = await screen.findByTestId("career-player-p-1");
    const cells = Array.from(row.querySelectorAll("td")).map((td) => td.textContent);
    // # | Joueur | Poste | Matchs | SPP | TD | Sorties | …
    expect(cells[3]).toBe("4");
    expect(cells[5]).toBe("3");
    expect(cells[6]).toBe("2");
  });

  it("n'affiche pas le bilan face à une API antérieure", async () => {
    mockCareer(careerPayload());
    render(<TeamCareerPage />);

    await screen.findByTestId("career-player-p-1");
    expect(screen.queryByTestId("career-all-competitions")).toBeNull();
  });
});
