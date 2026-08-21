/**
 * Gating « Édition avancée » du recrutement de Star Players dans le builder :
 * la section Star Players n'apparaît que si la case est cochée (la coupe
 * force ce mode) ; décochée, un hint explique comment la débloquer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../lib/api-client", () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
}));

import NewTeamPage from "./page";
import { LanguageProvider } from "../../../contexts/LanguageContext";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes("builder-rosters")
        ? { rosters: [] }
        : url.includes("star-players")
          ? { starPlayers: [] }
          : {};
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(payload),
      } as Response);
    }),
  );
});

function renderPage() {
  return render(
    <LanguageProvider>
      <NewTeamPage />
    </LanguageProvider>,
  );
}

describe("Builder — Star Players réservés à l'Édition avancée", () => {
  it("masque la section Star Players tant que la case n'est pas cochée", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("builder-advanced-toggle")).toBeTruthy(),
    );
    expect(
      screen.getByTestId("star-players-requires-advanced"),
    ).toBeTruthy();
    expect(screen.queryByText(/Star Players Blood Bowl/)).toBeNull();
  });

  it("affiche la section Star Players quand la case est cochée, la re-masque décochée", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("builder-advanced-toggle")).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId("builder-advanced-toggle"));
    await waitFor(() =>
      expect(screen.getByText(/Star Players Blood Bowl/)).toBeTruthy(),
    );
    expect(screen.queryByTestId("star-players-requires-advanced")).toBeNull();

    fireEvent.click(screen.getByTestId("builder-advanced-toggle"));
    await waitFor(() =>
      expect(screen.queryByText(/Star Players Blood Bowl/)).toBeNull(),
    );
    expect(
      screen.getByTestId("star-players-requires-advanced"),
    ).toBeTruthy();
  });
});
