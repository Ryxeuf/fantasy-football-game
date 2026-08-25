/**
 * Le bandeau de résumé du builder doit déduire les Star Players recrutés du
 * budget restant : ils sont payés sur le budget de construction au même titre
 * que les joueurs et le staff.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const apiRequest = vi.fn();
vi.mock("../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import NewTeamPage from "./page";
import { LanguageProvider } from "../../../contexts/LanguageContext";

const STAR = {
  slug: "cindy-piewhistle",
  displayName: "Cindy Piewhistle",
  cost: 130000,
  ma: 5,
  st: 2,
  ag: 3,
  pa: 4,
  av: 7,
  skills: "",
  hirableBy: ["all"],
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  localStorage.setItem("auth_token", "token");
  apiRequest.mockResolvedValue({
    roster: { positions: [], specialRules: [] },
    ruleset: "season_3",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes("builder-rosters")
        ? { rosters: [{ slug: "skaven", name: "Skavens" }] }
        : url.includes("star-players")
          ? { starPlayers: [STAR] }
          : {};
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(payload),
      } as Response);
    }),
  );
});

describe("Builder — budget et Star Players", () => {
  it("déduit le coût du Star Player du budget restant affiché en entête", async () => {
    render(
      <LanguageProvider>
        <NewTeamPage />
      </LanguageProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("builder-advanced-toggle")).toBeTruthy(),
    );
    const before = screen.getByTestId("remaining-budget").textContent;
    expect(before).toContain("1000");

    fireEvent.click(screen.getByTestId("builder-advanced-toggle"));

    const checkbox = await screen.findByLabelText(/Cindy Piewhistle/i);
    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(screen.getByTestId("remaining-budget").textContent).toContain(
        "870",
      ),
    );
    expect(screen.getByTestId("star-players-cost-summary").textContent).toContain(
      "130",
    );
  });
});
