/**
 * Console admin — fiche d'une ligue : édition, verrou du barème,
 * visibilité. Le patch ne porte que les champs modifiés.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, prefetch: vi.fn() }),
  useParams: () => ({ id: "l1" }),
}));

import AdminLeagueManagePage from "./page";
import { buildLeaguePatch, toForm, type AdminLeagueDetail } from "./league-form";

const LEAGUE: AdminLeagueDetail = {
  id: "l1",
  name: "Ligue du Chaudron",
  description: null,
  ruleset: "season_3",
  status: "in_progress",
  isPublic: true,
  maxParticipants: 8,
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  forfeitPoints: -1,
  creatorId: "commish",
  creator: { id: "commish", coachName: "Commish", email: "c@x.io" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  scoringLocked: false,
  seasons: [
    {
      id: "s1",
      seasonNumber: 1,
      name: "Saison 1",
      status: "in_progress",
      startDate: null,
      endDate: null,
      participantsCount: 6,
      participants: [
        {
          teamId: "t1",
          teamName: "Les Rats",
          roster: "skaven",
          coachName: "Ratman",
          status: "active",
          deleted: false,
        },
      ],
    },
  ],
};

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

Object.defineProperty(window, "localStorage", {
  value: {
    getItem: vi.fn(() => "token"),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  },
});

function jsonOk(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

function routeFetch(league: AdminLeagueDetail = LEAGUE) {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/auth/me")) {
      return Promise.resolve(
        jsonOk({ user: { id: "admin-1", roles: ["admin"] } }),
      );
    }
    if (init?.method && init.method !== "GET") {
      return Promise.resolve(jsonOk({ success: true, data: {} }));
    }
    return Promise.resolve(jsonOk({ success: true, data: league }));
  });
}

function writes() {
  return mockFetch.mock.calls.filter(
    (c) => c[1]?.method && c[1].method !== "GET",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildLeaguePatch", () => {
  it("ne renvoie que les champs modifiés", () => {
    const form = toForm(LEAGUE);
    expect(buildLeaguePatch(LEAGUE, form)).toEqual({ patch: {}, error: null });
    expect(
      buildLeaguePatch(LEAGUE, {
        ...form,
        name: " Nouveau ",
        scoring: { ...form.scoring, winPoints: "4" },
      }),
    ).toEqual({ patch: { name: "Nouveau", winPoints: 4 }, error: null });
  });

  it("une description vidée part en `null`", () => {
    const league = { ...LEAGUE, description: "Ancienne" };
    expect(
      buildLeaguePatch(league, { ...toForm(league), description: "  " }).patch,
    ).toEqual({ description: null });
  });

  it("refuse un nom vide et une capacité hors bornes", () => {
    const form = toForm(LEAGUE);
    expect(buildLeaguePatch(LEAGUE, { ...form, name: " " }).error).toBeTruthy();
    expect(
      buildLeaguePatch(LEAGUE, { ...form, maxParticipants: "1" }).error,
    ).toBeTruthy();
    expect(
      buildLeaguePatch(LEAGUE, {
        ...form,
        scoring: { ...form.scoring, winPoints: "11" },
      }).error,
    ).toBeTruthy();
  });
});

describe("Fiche admin d'une ligue", () => {
  it("affiche la fiche et les saisons", async () => {
    routeFetch();
    render(<AdminLeagueManagePage />);
    expect(await screen.findByTestId("admin-league-manage-page")).toBeTruthy();
    expect(screen.getByTestId("admin-league-season-s1").textContent).toContain(
      "6 équipes",
    );
  });

  it("lie chaque équipe inscrite à sa fiche admin", async () => {
    routeFetch();
    render(<AdminLeagueManagePage />);
    const link = await screen.findByTestId("admin-league-team-s1-t1");
    expect(link.getAttribute("href")).toBe("/admin/teams/t1");
    expect(link.textContent).toContain("Les Rats");
  });

  it("enregistre uniquement les champs modifiés", async () => {
    routeFetch();
    render(<AdminLeagueManagePage />);
    const name = await screen.findByTestId("admin-league-name");
    const save = screen.getByTestId("admin-league-save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(name, { target: { value: "Ligue renommée" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => {
      const call = writes().find((c) =>
        String(c[0]).endsWith("/admin/leagues/l1"),
      );
      expect(call?.[1]?.method).toBe("PATCH");
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        name: "Ligue renommée",
      });
    });
  });

  it("grise le barème quand la ligue est verrouillée", async () => {
    routeFetch({ ...LEAGUE, scoringLocked: true });
    render(<AdminLeagueManagePage />);
    const win = (await screen.findByTestId(
      "admin-league-scoring-winPoints",
    )) as HTMLInputElement;
    expect(win.disabled).toBe(true);
    expect(screen.getByText(/Verrouillé/)).toBeTruthy();
  });

  it("bascule la visibilité immédiatement", async () => {
    routeFetch();
    render(<AdminLeagueManagePage />);
    fireEvent.click(await screen.findByTestId("admin-league-visibility"));
    await waitFor(() => {
      const call = writes()[0];
      expect(String(call?.[0])).toContain("/admin/leagues/l1");
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ isPublic: false });
    });
  });

  it("supprime après confirmation par le nom, puis revient à la liste", async () => {
    routeFetch();
    window.prompt = vi.fn(() => "Ligue du Chaudron");
    render(<AdminLeagueManagePage />);
    fireEvent.click(await screen.findByTestId("admin-league-delete"));
    await waitFor(() => {
      const call = writes().find((c) => c[1]?.method === "DELETE");
      expect(String(call?.[0])).toContain("/leagues/l1");
      expect(push).toHaveBeenCalledWith("/admin/leagues");
    });
  });

  it("ne supprime pas si le nom saisi ne correspond pas", async () => {
    routeFetch();
    window.prompt = vi.fn(() => "autre");
    render(<AdminLeagueManagePage />);
    fireEvent.click(await screen.findByTestId("admin-league-delete"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(writes()).toHaveLength(0);
  });
});
