import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

vi.mock("../../../lib/api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class ApiClientError extends Error {},
}));

import { apiRequest } from "../../../lib/api-client";
import ProLeagueTeamPage from "./page";

const mockedApi = vi.mocked(apiRequest);

function makeTeam(overrides: Record<string, unknown> = {}): unknown {
  return {
    slug: "buf-snow-ogres",
    city: "Buffalo",
    name: "Snow Ogres",
    race: "Ogre",
    nflFlavor: "Buffalo snow brutality",
    primaryColor: "#00338D",
    secondaryColor: "#C60C30",
    baseTv: 1100,
    motto: "Snow over Steel",
    seasonId: "s1",
    seasonYear: 2026,
    record: {
      played: 4,
      wins: 3,
      draws: 0,
      losses: 1,
      points: 9,
      tdFor: 12,
      tdAgainst: 5,
      form: ["W", "W", "L", "W"],
    },
    roster: [
      {
        id: "p1",
        name: "Grim",
        position: "Lineman",
        ma: 5,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: ["block"],
        status: "active",
        form: 60,
        niggling: 0,
        progression: { level: 2, spp: 10, nextLevelSpp: 16, tv: 70000 },
        statBonuses: { ma: 0, st: 0, ag: 0, pa: 0, av: 0 },
        career: { tdCount: 1, casCount: 0, compCount: 0, mvpCount: 0 },
      },
    ],
    upcomingMatches: [
      {
        id: "m_up",
        roundNumber: 5,
        status: "scheduled",
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        homeTeamSlug: "buf-snow-ogres",
        awayTeamSlug: "gb-cheese-halflings",
        opponent: {
          slug: "gb-cheese-halflings",
          name: "Cheese Halflings",
          city: "Green Bay",
          primaryColor: "#203731",
        },
        isHome: true,
        scoreHome: null,
        scoreAway: null,
        outcome: null,
      },
    ],
    recentMatches: [
      {
        id: "m_done",
        roundNumber: 4,
        status: "completed",
        scheduledAt: new Date(Date.now() - 86_400_000).toISOString(),
        homeTeamSlug: "kc-soaring-hawks",
        awayTeamSlug: "buf-snow-ogres",
        opponent: {
          slug: "kc-soaring-hawks",
          name: "Soaring Hawks",
          city: "Kansas City",
          primaryColor: "#E31837",
        },
        isHome: false,
        scoreHome: 1,
        scoreAway: 3,
        outcome: "away",
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProLeagueTeamPage — sprint 1.C.2", () => {
  it("affiche 'Chargement…' pendant le fetch", () => {
    mockedApi.mockReturnValue(new Promise(() => undefined));
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    expect(screen.getByText(/Chargement/)).toBeTruthy();
  });

  it("affiche le banner avec city, race, motto, NFL flavor", async () => {
    mockedApi.mockResolvedValue(makeTeam());
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("team-banner")).toBeTruthy();
    });
    expect(screen.getByText("Snow Ogres")).toBeTruthy();
    expect(screen.getByText("Buffalo")).toBeTruthy();
    expect(screen.getAllByText(/Ogre/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Snow over Steel/)).toBeTruthy();
    expect(screen.getByText(/Buffalo snow brutality/)).toBeTruthy();
  });

  it("affiche le record + points + form", async () => {
    mockedApi.mockResolvedValue(makeTeam());
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("team-record")).toBeTruthy();
    });
    const record = screen.getByTestId("team-record");
    // Scope les queries au bloc team-record pour eviter de matcher des
    // numeros equivalents ailleurs (ex: TV joueur "1100", spp "16",
    // etc.) qui rendaient ces assertions flaky sous coverage CI.
    // `12–5` utilise un en-dash unicode (cf. page.tsx l.840), pas un
    // hyphen-minus.
    expect(within(record).getByText(/3V 0N 1D/)).toBeTruthy();
    expect(within(record).getByText("12–5")).toBeTruthy();
    const formBadges = screen.getByTestId("form-badges");
    expect(formBadges.children.length).toBe(4);
  });

  it("affiche le roster", async () => {
    mockedApi.mockResolvedValue(makeTeam());
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("roster-table")).toBeTruthy();
    });
    expect(screen.getByText("Grim")).toBeTruthy();
    expect(screen.getByText("Lineman")).toBeTruthy();
    expect(screen.getByText("block")).toBeTruthy();
  });

  it("Lot E — affiche level / SPP progress / TV / career counters", async () => {
    mockedApi.mockResolvedValue(makeTeam());
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("roster-table")).toBeTruthy();
    });
    expect(screen.getByTestId("roster-level").textContent).toBe("2");
    expect(screen.getByTestId("roster-tv").textContent).toBe("70k");
    // Progress badge contient "10/16"
    expect(screen.getByText("10/16")).toBeTruthy();
    // Career counters tdCount/casCount/compCount/mvpCount
    expect(screen.getByText("1/0/0/0")).toBeTruthy();
  });

  it("Lot E — affiche les stat bonuses quand non-zero", async () => {
    mockedApi.mockResolvedValue(
      makeTeam({
        roster: [
          {
            id: "p1",
            name: "Star",
            position: "Catcher",
            ma: 8,
            st: 2,
            ag: 4,
            pa: null,
            av: 8,
            skills: ["dodge"],
            status: "active",
            form: 70,
            niggling: 0,
            progression: { level: 5, spp: 80, nextLevelSpp: 176, tv: 130000 },
            statBonuses: { ma: 1, st: 0, ag: 1, pa: 0, av: 0 },
            career: { tdCount: 12, casCount: 1, compCount: 3, mvpCount: 2 },
          },
        ],
      }),
    );
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("roster-table")).toBeTruthy();
    });
    expect(screen.getByTestId("roster-bonuses").textContent).toBe("+1MA +1AG");
  });

  it("Lot E — legend (nextLevelSpp=null) affiche ⭐ + total SPP", async () => {
    mockedApi.mockResolvedValue(
      makeTeam({
        roster: [
          {
            id: "p1",
            name: "Legend",
            position: "Blitzer",
            ma: 7,
            st: 4,
            ag: 4,
            pa: 4,
            av: 10,
            skills: ["block", "dodge", "tackle"],
            status: "active",
            form: 80,
            niggling: 0,
            progression: { level: 7, spp: 200, nextLevelSpp: null, tv: 180000 },
            statBonuses: { ma: 0, st: 1, ag: 0, pa: 0, av: 0 },
            career: { tdCount: 30, casCount: 10, compCount: 0, mvpCount: 5 },
          },
        ],
      }),
    );
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("roster-table")).toBeTruthy();
    });
    expect(screen.getByText(/⭐ 200 SPP/)).toBeTruthy();
  });

  it("affiche placeholder roster si vide", async () => {
    mockedApi.mockResolvedValue(makeTeam({ roster: [] }));
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByText(/Roster non encore peuplé/i)).toBeTruthy();
    });
  });

  it("affiche les prochains et derniers matchs", async () => {
    mockedApi.mockResolvedValue(makeTeam());
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      const rows = screen.getAllByTestId("match-row");
      expect(rows.length).toBe(2);
    });
    expect(screen.getByText("Cheese Halflings")).toBeTruthy();
    expect(screen.getByText("Soaring Hawks")).toBeTruthy();
  });

  it("affiche message d'erreur si API throw", async () => {
    mockedApi.mockRejectedValue(new Error("not-found"));
    render(<ProLeagueTeamPage params={{ slug: "unknown" }} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toContain("not-found");
  });

  describe("Lot H — filters / sort / ready badge", () => {
    function makeRosterTeam() {
      return makeTeam({
        roster: [
          {
            id: "p1",
            name: "Charlie",
            position: "Lineman",
            ma: 5,
            st: 3,
            ag: 3,
            pa: 4,
            av: 9,
            skills: [],
            status: "active",
            form: 50,
            niggling: 0,
            progression: { level: 1, spp: 2, nextLevelSpp: 6, tv: 50000 },
            statBonuses: { ma: 0, st: 0, ag: 0, pa: 0, av: 0 },
            career: { tdCount: 0, casCount: 0, compCount: 0, mvpCount: 0 },
          },
          {
            id: "p2",
            name: "Alice",
            position: "Blitzer",
            ma: 7,
            st: 3,
            ag: 4,
            pa: 4,
            av: 10,
            skills: ["block"],
            status: "active",
            form: 70,
            niggling: 0,
            // Lot K — ready : applier en retard (DB level 1, computed 2)
            progression: {
              level: 2,
              spp: 18,
              nextLevelSpp: 31,
              readyToLevelUp: true,
              tv: 110000,
            },
            statBonuses: { ma: 0, st: 0, ag: 0, pa: 0, av: 0 },
            career: { tdCount: 3, casCount: 0, compCount: 0, mvpCount: 1 },
          },
          {
            id: "p3",
            name: "Bob",
            position: "Catcher",
            ma: 8,
            st: 2,
            ag: 4,
            pa: null,
            av: 8,
            skills: ["dodge", "catch"],
            status: "active",
            form: 50,
            niggling: 1, // niggling > 0 → blessé
            progression: { level: 3, spp: 25, nextLevelSpp: 31, tv: 90000 },
            statBonuses: { ma: 0, st: 0, ag: 0, pa: 0, av: 0 },
            career: { tdCount: 8, casCount: 0, compCount: 1, mvpCount: 0 },
          },
        ],
      });
    }

    it("affiche le summary 'X joueurs · Y prêts à level-up · Z blessés'", async () => {
      mockedApi.mockResolvedValue(makeRosterTeam());
      render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("roster-toolbar")).toBeTruthy();
      });
      const summary = screen.getByTestId("roster-ready-summary");
      expect(summary.textContent).toContain("1 prêt");
      // 1 niggled = 1 blessé
      expect(screen.getByText(/1 blessé/i)).toBeTruthy();
    });

    it("affiche le badge ⬆ ready sur le joueur ayant atteint le palier", async () => {
      mockedApi.mockResolvedValue(makeRosterTeam());
      render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("roster-table")).toBeTruthy();
      });
      const badges = screen.getAllByTestId("ready-badge");
      expect(badges.length).toBe(1);
      expect(badges[0].textContent).toContain("ready");
    });

    it("filtre 'Actifs' exclut les blessés / nigglés", async () => {
      mockedApi.mockResolvedValue(makeRosterTeam());
      render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("roster-filter")).toBeTruthy();
      });
      const select = screen.getByTestId("roster-filter") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "active" } });
      // Bob a niggling=1 → exclu
      await waitFor(() => {
        expect(screen.queryByText("Bob")).toBeNull();
      });
      expect(screen.getByText("Alice")).toBeTruthy();
      expect(screen.getByText("Charlie")).toBeTruthy();
    });

    it("filtre 'Blessés' ne montre que les nigglés / non-actifs", async () => {
      mockedApi.mockResolvedValue(makeRosterTeam());
      render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("roster-filter")).toBeTruthy();
      });
      const select = screen.getByTestId("roster-filter") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "injured" } });
      await waitFor(() => {
        expect(screen.queryByText("Alice")).toBeNull();
      });
      expect(screen.getByText("Bob")).toBeTruthy();
    });

    it("tri par level ascendant puis descendant", async () => {
      mockedApi.mockResolvedValue(makeRosterTeam());
      render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("roster-sort-key")).toBeTruthy();
      });
      const sortKey = screen.getByTestId(
        "roster-sort-key",
      ) as HTMLSelectElement;
      fireEvent.change(sortKey, { target: { value: "level" } });
      // Default asc → Charlie (level 1) avant Bob (level 3)
      // Test ordre via compareDocumentPosition (DOCUMENT_POSITION_FOLLOWING=4)
      const charlieIdx = screen.getByText("Charlie").compareDocumentPosition(
        screen.getByText("Bob"),
      );
      expect(charlieIdx & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      // Click "↑ asc" toggle → desc
      const dirBtn = screen.getByTestId("roster-sort-direction");
      fireEvent.click(dirBtn);
      // Maintenant Bob (level 3) avant Charlie (level 1)
      const bobToCharlie = screen.getByText("Bob").compareDocumentPosition(
        screen.getByText("Charlie"),
      );
      expect(bobToCharlie & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("filtre vide → message 'Aucun joueur'", async () => {
      mockedApi.mockResolvedValue(
        makeTeam({
          roster: [
            {
              id: "p1",
              name: "Solo",
              position: "Lineman",
              ma: 5,
              st: 3,
              ag: 3,
              pa: 4,
              av: 9,
              skills: [],
              status: "active",
              form: 50,
              niggling: 0,
              progression: { level: 1, spp: 0, nextLevelSpp: 6, tv: 50000 },
              statBonuses: { ma: 0, st: 0, ag: 0, pa: 0, av: 0 },
              career: { tdCount: 0, casCount: 0, compCount: 0, mvpCount: 0 },
            },
          ],
        }),
      );
      render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("roster-filter")).toBeTruthy();
      });
      const select = screen.getByTestId("roster-filter") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "injured" } });
      await waitFor(() => {
        expect(screen.getByTestId("roster-empty-filter")).toBeTruthy();
      });
    });
  });

  describe("Lot M — Top earners widget", () => {
    it("affiche 5 cards (top earners) ordonnées par TV desc", async () => {
      mockedApi.mockResolvedValue(
        makeTeam({
          topEarners: [
            { id: "p3", name: "Star", position: "Blitzer", level: 5, tv: 150_000, status: "active" },
            { id: "p5", name: "Mid3", position: "Catcher", level: 3, tv: 110_000, status: "active" },
            { id: "p4", name: "Mid2", position: "Lineman", level: 2, tv: 95_000, status: "active" },
            { id: "p2", name: "Mid", position: "Lineman", level: 2, tv: 90_000, status: "active" },
            { id: "p7", name: "Bench", position: "Lineman", level: 1, tv: 60_000, status: "active" },
          ],
          totalRosterTv: 555_000,
        }),
      );
      render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("top-earners")).toBeTruthy();
      });
      // Compteurs sur les 5 cards
      expect(screen.getByTestId("top-earner-1").textContent).toContain("Star");
      expect(screen.getByTestId("top-earner-1").textContent).toContain("150k");
      expect(screen.getByTestId("top-earner-5").textContent).toContain("Bench");
      // Roster total visible
      expect(screen.getByText(/555k/)).toBeTruthy();
    });

    it("masque la section si topEarners est absent", async () => {
      mockedApi.mockResolvedValue(makeTeam({ topEarners: undefined }));
      render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
      await waitFor(() => {
        expect(screen.getByTestId("roster-table")).toBeTruthy();
      });
      expect(screen.queryByTestId("top-earners")).toBeNull();
    });

    it("masque la section si topEarners est vide (no active roster)", async () => {
      mockedApi.mockResolvedValue(
        makeTeam({ topEarners: [], totalRosterTv: 0 }),
      );
      render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
      await waitFor(() => {
        expect(screen.queryByTestId("top-earners")).toBeNull();
      });
    });
  });
});
