import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../../contexts/LanguageContext";

const replaceMock = vi.fn();
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "lg-1" }),
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

import EditLeaguePage from "./page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const localStorageMock = {
  getItem: vi.fn<(key: string) => string | null>(() => "test-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

const baseLeague = {
  id: "lg-1",
  name: "Open 5 Teams",
  description: "desc",
  creatorId: "u1",
  creator: { id: "u1", coachName: "Coach Bob", email: "bob@example.com" },
  ruleset: "season_3",
  status: "draft",
  isPublic: true,
  maxParticipants: 16,
  allowedRosters: null,
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  forfeitPoints: -1,
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
  seasons: [],
  hasScoredMatch: false,
};

function mockApi(opts: {
  league?: Record<string, unknown>;
  meUserId?: string | null;
  onPatch?: (body: unknown) => void;
  /** Corps reçu par `PATCH /leagues/:id/standings-order` (mode verrouillé). */
  onOrderPatch?: (body: unknown) => void;
  orderFails?: boolean;
}) {
  mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (/\/auth\/me$/.test(url)) {
      return {
        ok: true,
        json: () =>
          Promise.resolve({
            user: opts.meUserId ? { id: opts.meUserId } : null,
          }),
      };
    }
    if (/\/api\/rosters/.test(url)) {
      return { ok: true, json: () => Promise.resolve({ rosters: [] }) };
    }
    if (/\/leagues\/lg-1\/standings-order$/.test(url)) {
      opts.onOrderPatch?.(init?.body ? JSON.parse(String(init.body)) : null);
      if (opts.orderFails) {
        return {
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: "Interdit" }),
        };
      }
      return {
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      };
    }
    if (/\/leagues\/lg-1(?:$|\?)/.test(url)) {
      if (method === "PATCH") {
        opts.onPatch?.(init?.body ? JSON.parse(String(init.body)) : null);
        return { ok: true, json: () => Promise.resolve({ success: true, data: {} }) };
      }
      return {
        ok: true,
        json: () => Promise.resolve({ league: opts.league ?? baseLeague }),
      };
    }
    return { ok: false, status: 404, json: () => Promise.resolve({ error: "nf" }) };
  });
}

function renderPage() {
  return render(
    <LanguageProvider>
      <EditLeaguePage />
    </LanguageProvider>,
  );
}

describe("EditLeaguePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("test-token");
  });

  it("renders the prefilled form for the creator when not locked", async () => {
    mockApi({ league: baseLeague, meUserId: "u1" });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("edit-league-page")).toBeTruthy();
    });
    const nameInput = screen.getByTestId("league-form-name") as HTMLInputElement;
    expect(nameInput.value).toBe("Open 5 Teams");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects to the detail page when the user is not the creator", async () => {
    mockApi({ league: baseLeague, meUserId: "u-other" });
    renderPage();
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/leagues/lg-1");
    });
    expect(screen.queryByTestId("edit-league-page")).toBeNull();
  });

  it("ligue verrouillée : panneau réduit au lieu d'une redirection", async () => {
    // Avant, la page redirigeait : le commissaire n'avait plus AUCUN accès
    // à ses réglages, alors que l'ordre du classement reste modifiable.
    mockApi({ league: { ...baseLeague, hasScoredMatch: true }, meUserId: "u1" });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("locked-league-settings")).toBeTruthy();
    });
    expect(replaceMock).not.toHaveBeenCalled();
    // Le formulaire complet est gelé…
    expect(screen.queryByTestId("league-form-name")).toBeNull();
    expect(screen.queryByTestId("league-form-win-points")).toBeNull();
    // …et la raison est dite.
    expect(screen.getByTestId("league-locked-notice").textContent).toMatch(
      /match a déjà été joué/i,
    );
    // Seul l'ordre du classement est éditable.
    expect(screen.getByTestId("league-form-tiebreak")).toBeTruthy();
  });

  it("ligue verrouillée : l'ordre part sur la route hors verrou", async () => {
    const bodies: unknown[] = [];
    mockApi({
      league: {
        ...baseLeague,
        hasScoredMatch: true,
        tieBreakRules: ["points"],
      },
      meUserId: "u1",
      onOrderPatch: (b) => bodies.push(b),
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("locked-settings-submit")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("league-tiebreak-add-cas_for"));
    fireEvent.click(screen.getByTestId("locked-settings-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("locked-settings-saved")).toBeTruthy();
    });
    expect(bodies).toEqual([{ tieBreakRules: ["points", "cas_for"] }]);
    // Aucun PATCH sur la ligue entière : elle est verrouillée.
    const fullPatch = mockFetch.mock.calls.find(
      (c) =>
        /\/leagues\/lg-1(?:$|\?)/.test(String(c[0])) &&
        String((c[1] as RequestInit | undefined)?.method).toUpperCase() ===
          "PATCH",
    );
    expect(fullPatch).toBeUndefined();
  });

  it("ligue verrouillée : une liste vidée repart sur `null` (défaut)", async () => {
    const bodies: unknown[] = [];
    mockApi({
      league: {
        ...baseLeague,
        hasScoredMatch: true,
        tieBreakRules: ["cas_for"],
      },
      meUserId: "u1",
      onOrderPatch: (b) => bodies.push(b),
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("locked-settings-submit")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("league-tiebreak-remove-cas_for"));
    fireEvent.click(screen.getByTestId("locked-settings-submit"));

    await waitFor(() => {
      expect(bodies).toEqual([{ tieBreakRules: null }]);
    });
  });

  it("ligue verrouillée : un refus serveur est affiché, pas avalé", async () => {
    mockApi({
      league: { ...baseLeague, hasScoredMatch: true },
      meUserId: "u1",
      orderFails: true,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("locked-settings-submit")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("league-tiebreak-add-points"));
    fireEvent.click(screen.getByTestId("locked-settings-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("locked-settings-error")).toBeTruthy();
    });
    expect(screen.queryByTestId("locked-settings-saved")).toBeNull();
  });

  it("PATCHes the league and navigates to the detail on submit", async () => {
    const patched: unknown[] = [];
    mockApi({
      league: baseLeague,
      meUserId: "u1",
      onPatch: (body) => patched.push(body),
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("league-form-submit")).toBeTruthy();
    });

    const winPoints = screen.getByTestId(
      "league-form-win-points",
    ) as HTMLInputElement;
    fireEvent.change(winPoints, { target: { value: "4" } });
    fireEvent.click(screen.getByTestId("league-form-submit"));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/leagues/lg-1");
    });
    expect(patched).toHaveLength(1);
    expect(patched[0]).toMatchObject({ winPoints: 4, name: "Open 5 Teams" });
  });
});
