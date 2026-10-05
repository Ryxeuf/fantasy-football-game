/**
 * Console admin — feuilles de match : liste, liens croisés (éditeur,
 * équipes, compétition) et actions validation / invalidation / suppression.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import AdminMatchSheetsPage from "./page";
import {
  competitionAdminPath,
  roundLabel,
  sheetActions,
  sheetApiPath,
  sheetEditorPath,
  type AdminMatchSheet,
} from "./sheet-links";

const LEAGUE_SHEET: AdminMatchSheet = {
  id: "ms-l",
  kind: "league",
  pairingId: "lp1",
  status: "both_submitted",
  scoreHome: 2,
  scoreAway: 1,
  forfeitSide: null,
  submittedByHomeAt: null,
  submittedByAwayAt: null,
  validatedAt: null,
  invalidatedAt: null,
  invalidationReason: null,
  eventsCount: 7,
  competition: { id: "l1", name: "Ligue du Chaudron" },
  seasonName: "Saison 1",
  roundNumber: 3,
  roundName: null,
  home: { teamId: "t1", teamName: "Rats", coachName: "Ratman" },
  away: { teamId: "t2", teamName: "Nains", coachName: "Grim" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const CUP_SHEET: AdminMatchSheet = {
  ...LEAGUE_SHEET,
  id: "ms-c",
  kind: "cup",
  pairingId: "cp1",
  status: "validated",
  competition: { id: "c1", name: "Coupe du Chaos" },
  seasonName: null,
  roundNumber: 1,
  home: { teamId: "t3", teamName: "Elfes", coachName: null },
  away: null,
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

function routeFetch() {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/auth/me")) {
      return Promise.resolve(
        jsonOk({ user: { id: "admin-1", roles: ["admin"] } }),
      );
    }
    if (init?.method && init.method !== "GET") {
      return Promise.resolve(jsonOk({ success: true, data: {} }));
    }
    return Promise.resolve(
      jsonOk({
        success: true,
        data: {
          sheets: [LEAGUE_SHEET, CUP_SHEET],
          counts: { total: 2, status: { both_submitted: 1, validated: 1 } },
        },
      }),
    );
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

describe("sheet-links", () => {
  it("route ligue et coupe vers leurs préfixes respectifs", () => {
    expect(sheetEditorPath(LEAGUE_SHEET)).toBe("/leagues/pairings/lp1/sheet");
    expect(sheetEditorPath(CUP_SHEET)).toBe("/cups/pairings/cp1/sheet");
    expect(sheetApiPath(LEAGUE_SHEET)).toBe("/leagues/pairings/lp1/sheet");
    expect(sheetApiPath(CUP_SHEET)).toBe("/cup/pairings/cp1/sheet");
    expect(competitionAdminPath(LEAGUE_SHEET)).toBe("/admin/leagues/l1");
    expect(competitionAdminPath(CUP_SHEET)).toBe("/admin/cups/c1");
  });

  it("libelle la journée ou la ronde", () => {
    expect(roundLabel(LEAGUE_SHEET)).toBe("Saison 1 · Journée 3");
    expect(roundLabel(CUP_SHEET)).toBe("Ronde 1");
    expect(roundLabel({ ...CUP_SHEET, roundName: "Finale" })).toBe("Finale");
  });

  it("n'ouvre l'invalidation qu'aux feuilles validées", () => {
    expect(sheetActions("validated")).toEqual({
      canValidate: false,
      canInvalidate: true,
      canDelete: false,
    });
    expect(sheetActions("draft")).toEqual({
      canValidate: true,
      canInvalidate: false,
      canDelete: true,
    });
  });
});

describe("Console admin — feuilles de match", () => {
  it("lie l'éditeur, les équipes et la compétition", async () => {
    routeFetch();
    render(<AdminMatchSheetsPage />);
    const row = await screen.findByTestId("admin-sheet-row-ms-l");
    expect(
      row.querySelector('[data-testid="admin-sheet-open-ms-l"]')?.getAttribute("href"),
    ).toBe("/leagues/pairings/lp1/sheet");
    expect(
      row.querySelector('[data-testid="admin-sheet-team-t1"]')?.getAttribute("href"),
    ).toBe("/admin/teams/t1");
    expect(
      row
        .querySelector('[data-testid="admin-sheet-competition-ms-l"]')
        ?.getAttribute("href"),
    ).toBe("/admin/leagues/l1");
    // Coupe sans adversaire : exempt, pas de lien cassé.
    expect(screen.getByTestId("admin-sheet-card-ms-c").textContent).toContain(
      "Exempt",
    );
  });

  it("passe statut et famille au serveur", async () => {
    routeFetch();
    render(<AdminMatchSheetsPage />);
    fireEvent.change(await screen.findByTestId("admin-sheets-status-filter"), {
      target: { value: "validated" },
    });
    fireEvent.change(screen.getByTestId("admin-sheets-kind-filter"), {
      target: { value: "cup" },
    });
    await waitFor(() => {
      expect(
        mockFetch.mock.calls.some((c) => {
          const u = String(c[0]);
          return u.includes("status=validated") && u.includes("kind=cup");
        }),
      ).toBe(true);
    });
  });

  it("valide une feuille de ligue via la route commissaire", async () => {
    routeFetch();
    window.confirm = vi.fn(() => true);
    render(<AdminMatchSheetsPage />);
    fireEvent.click(
      (await screen.findAllByTestId("admin-sheet-validate-ms-l"))[0],
    );
    await waitFor(() => {
      const call = writes()[0];
      expect(String(call?.[0])).toMatch(/\/leagues\/pairings\/lp1\/sheet\/validate$/);
      expect(call?.[1]?.method).toBe("POST");
    });
  });

  it("invalide une feuille de coupe avec un motif", async () => {
    routeFetch();
    window.prompt = vi.fn(() => "Score inversé");
    render(<AdminMatchSheetsPage />);
    fireEvent.click(
      (await screen.findAllByTestId("admin-sheet-invalidate-ms-c"))[0],
    );
    await waitFor(() => {
      const call = writes()[0];
      expect(String(call?.[0])).toMatch(/\/cup\/pairings\/cp1\/sheet\/invalidate$/);
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        reason: "Score inversé",
      });
    });
  });

  it("supprime une feuille non validée, jamais une validée", async () => {
    routeFetch();
    window.confirm = vi.fn(() => true);
    render(<AdminMatchSheetsPage />);
    await screen.findByTestId("admin-sheet-row-ms-l");
    expect(screen.queryAllByTestId("admin-sheet-delete-ms-c")).toHaveLength(0);
    fireEvent.click(screen.getAllByTestId("admin-sheet-delete-ms-l")[0]);
    await waitFor(() => {
      const call = writes()[0];
      expect(String(call?.[0])).toMatch(/\/admin\/match-sheets\/ms-l$/);
      expect(call?.[1]?.method).toBe("DELETE");
    });
  });
});
