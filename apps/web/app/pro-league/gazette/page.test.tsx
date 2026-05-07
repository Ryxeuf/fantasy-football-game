import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class ApiClientError extends Error {},
}));

import { apiRequest } from "../../lib/api-client";
import { LanguageProvider } from "../../contexts/LanguageContext";
import GazetteHomePage from "./page";

const mockedApi = vi.mocked(apiRequest);

function renderPage(): ReturnType<typeof render> {
  return render(
    <LanguageProvider>
      <GazetteHomePage />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GazetteHomePage — sprint 1.E.2", () => {
  it("affiche 'Chargement' pendant le fetch", () => {
    mockedApi.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText(/Chargement/)).toBeTruthy();
  });

  it("affiche le placeholder si edition=null", async () => {
    mockedApi
      .mockResolvedValueOnce({ edition: null })
      .mockResolvedValueOnce({ dates: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("gazette-no-edition")).toBeTruthy();
    });
  });

  it("affiche l'édition avec les articles", async () => {
    mockedApi
      .mockResolvedValueOnce({
        edition: {
          date: "2026-09-15",
          articles: [
            {
              id: "a1",
              date: "2026-09-15",
              type: "MAIN",
              persona: "statistician",
              title: "Stats du jour",
              body: "Buffalo écrase tout le monde.",
              relatedTeamIds: ["buf-snow-ogres"],
              relatedPlayerIds: [],
              createdAt: "2026-09-15T08:00:00Z",
            },
            {
              id: "a2",
              date: "2026-09-15",
              type: "EDITO",
              persona: "cynic",
              title: "Pas de surprise",
              body: "Encore une journée banale.",
              relatedTeamIds: [],
              relatedPlayerIds: [],
              createdAt: "2026-09-15T08:01:00Z",
            },
          ],
        },
      })
      .mockResolvedValueOnce({ dates: ["2026-09-15", "2026-09-14"] });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("gazette-edition")).toBeTruthy();
    });
    expect(screen.getByText("Stats du jour")).toBeTruthy();
    expect(screen.getByText(/Buffalo/)).toBeTruthy();
    expect(screen.getByText("Pas de surprise")).toBeTruthy();
    expect(screen.getByText(/Le Statisticien/)).toBeTruthy();
    expect(screen.getByText(/Le Cynique/)).toBeTruthy();
  });

  it("affiche l'archive quand >1 dates", async () => {
    mockedApi
      .mockResolvedValueOnce({
        edition: {
          date: "2026-09-15",
          articles: [
            {
              id: "a1",
              date: "2026-09-15",
              type: "MAIN",
              persona: null,
              title: "T",
              body: "B",
              relatedTeamIds: [],
              relatedPlayerIds: [],
              createdAt: "2026-09-15T08:00:00Z",
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        dates: ["2026-09-15", "2026-09-14", "2026-09-13"],
      });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("gazette-archive")).toBeTruthy();
    });
    // Archive ne montre que les dates antérieures (pas la latest)
    expect(screen.getByText("2026-09-14")).toBeTruthy();
    expect(screen.getByText("2026-09-13")).toBeTruthy();
  });

  it("affiche message d'erreur sur API throw", async () => {
    mockedApi.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
  });
});
