/**
 * Builder — Fans Dévoués : le premier fan gratuit est une règle de LIGUE,
 * accordé à l'inscription en ligue. Le builder part donc de 0 fan, le
 * minimum est 0 et la règle est annoncée sur la ligne des Fans Dévoués.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../lib/api-client", () => ({
  apiRequest: vi.fn().mockResolvedValue({ roster: { positions: [], specialRules: [] } }),
}));

import NewTeamPage from "./page";
import { LanguageProvider } from "../../../contexts/LanguageContext";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/me/teams/new");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes("builder-rosters")
        ? { rosters: [{ slug: "skaven", name: "Skavens" }] }
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

function renderBuilder() {
  return render(
    <LanguageProvider>
      <NewTeamPage />
    </LanguageProvider>,
  );
}

describe("Builder — Fans Dévoués sans fan offert", () => {
  it("part de 0 fan, autorise 0 et annonce la règle de ligue", async () => {
    renderBuilder();

    const value = await screen.findByTestId("staff-dedicated-fans-value");
    expect(value.textContent).toBe("0");
    // Déjà au minimum : on ne peut pas descendre sous 0.
    expect(
      (screen.getByTestId("staff-dedicated-fans-dec") as HTMLButtonElement).disabled,
    ).toBe(true);

    await waitFor(() =>
      expect(screen.getByTestId("staff-dedicated-fans").textContent).toContain(
        "inscrite en ligue",
      ),
    );
  });
});
