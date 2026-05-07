import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/api-client", () => {
  class FakeApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    apiRequest: vi.fn(),
    ApiClientError: FakeApiError,
  };
});

import { ApiClientError, apiRequest } from "../../lib/api-client";
import { LanguageProvider } from "../../contexts/LanguageContext";
import ProLeagueFeedPage from "./page";

function renderPage(): ReturnType<typeof render> {
  return render(
    <LanguageProvider>
      <ProLeagueFeedPage />
    </LanguageProvider>,
  );
}

const FakeApiError = ApiClientError as unknown as new (
  msg: string,
  status?: number,
) => Error & { status?: number };

const mockedApi = vi.mocked(apiRequest);

function makeFeed(extras: Record<string, unknown>[] = []): unknown {
  return {
    entries: [
      {
        matchId: "m_done",
        status: "completed",
        scheduledAt: new Date("2026-09-08T21:00:00Z").toISOString(),
        roundNumber: 4,
        seasonYear: 2026,
        followedTeam: {
          slug: "buf-snow-ogres",
          name: "Snow Ogres",
          city: "Buffalo",
          primaryColor: "#00338D",
        },
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
        category: "recent",
      },
      {
        matchId: "m_up",
        status: "scheduled",
        scheduledAt: new Date("2026-09-15T21:00:00Z").toISOString(),
        roundNumber: 5,
        seasonYear: 2026,
        followedTeam: {
          slug: "buf-snow-ogres",
          name: "Snow Ogres",
          city: "Buffalo",
          primaryColor: "#00338D",
        },
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
        category: "upcoming",
      },
      ...extras,
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProLeagueFeedPage — sprint 1.C.4", () => {
  it("affiche 'Chargement…' pendant le fetch", () => {
    mockedApi.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText(/Chargement/)).toBeTruthy();
  });

  it("affiche la liste recent + upcoming", async () => {
    mockedApi.mockResolvedValue(makeFeed());
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("feed-recent")).toBeTruthy();
    });
    expect(screen.getByTestId("feed-upcoming")).toBeTruthy();
    const rows = screen.getAllByTestId("feed-row");
    expect(rows.length).toBe(2);
    expect(screen.getByText(/Soaring Hawks/)).toBeTruthy();
    expect(screen.getByText(/Cheese Halflings/)).toBeTruthy();
  });

  it("affiche un message si aucune équipe suivie", async () => {
    mockedApi.mockResolvedValue({ entries: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("empty-feed")).toBeTruthy();
    });
  });

  it("affiche le message auth-required si 401", async () => {
    mockedApi.mockRejectedValue(new FakeApiError("auth", 401));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("auth-required")).toBeTruthy();
    });
  });

  it("affiche message d'erreur générique si autre erreur", async () => {
    mockedApi.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toContain("boom");
  });
});
