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

  it("redirects when the league is locked (a match has been scored)", async () => {
    mockApi({ league: { ...baseLeague, hasScoredMatch: true }, meUserId: "u1" });
    renderPage();
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/leagues/lg-1");
    });
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
