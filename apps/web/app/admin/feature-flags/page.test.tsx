import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("../../lib/featureFlags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/featureFlags")>();
  return {
    ...actual,
    adminListFlags: vi.fn(),
    adminCreateFlag: vi.fn(),
    adminDeleteFlag: vi.fn(),
    adminSyncFlags: vi.fn(),
    adminUpdateFlag: vi.fn(),
  };
});

import AdminFeatureFlagsPage from "./page";
import {
  adminDeleteFlag,
  adminListFlags,
  type FeatureFlag,
} from "../../lib/featureFlags";

const mockedList = vi.mocked(adminListFlags);

function flag(key: string, knownInCode?: boolean): FeatureFlag {
  return {
    id: `id-${key}`,
    key,
    description: null,
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    userOverrideCount: 0,
    ...(knownInCode === undefined ? {} : { knownInCode }),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AdminFeatureFlagsPage — flags absents du code", () => {
  it("signale un flag retiré du code (ligne + bandeau)", async () => {
    mockedList.mockResolvedValue([
      flag("league", false),
      flag("online_play", true),
    ]);
    render(<AdminFeatureFlagsPage />);

    await waitFor(() =>
      expect(screen.getByTestId("flag-missing-from-code-league")).toBeTruthy(),
    );
    expect(
      screen.queryByTestId("flag-missing-from-code-online_play"),
    ).toBeNull();
    expect(
      screen.getByTestId("feature-flags-missing-from-code").textContent,
    ).toContain("league");
  });

  it("n'affiche rien quand tous les flags sont connus du code", async () => {
    mockedList.mockResolvedValue([flag("online_play", true), flag("legacy")]);
    render(<AdminFeatureFlagsPage />);

    await waitFor(() => expect(screen.getByText("online_play")).toBeTruthy());
    expect(screen.queryByTestId("feature-flags-missing-from-code")).toBeNull();
    expect(screen.queryByTestId("flag-missing-from-code-legacy")).toBeNull();
  });
});

describe("AdminFeatureFlagsPage — utilisable sur mobile", () => {
  it("rend une liste (pas de tableau) où chaque flag porte ses actions", async () => {
    mockedList.mockResolvedValue([
      { ...flag("home_news_ticker", true), userOverrideCount: 2 },
    ]);
    const { container } = render(<AdminFeatureFlagsPage />);

    const row = await screen.findByTestId("flag-row-home_news_ticker");
    // Plus de tableau : sa dernière colonne sortait de l'écran sur mobile.
    expect(container.querySelector("table")).toBeNull();
    const actions = within(row);
    expect(actions.getByRole("button", { name: "Supprimer" })).toBeTruthy();
    expect(actions.getByRole("link", { name: "2 overrides" }).getAttribute("href")).toBe(
      "/admin/feature-flags/id-home_news_ticker",
    );
  });

  it("supprime un flag depuis sa ligne après confirmation", async () => {
    mockedList.mockResolvedValue([flag("home_news_ticker", true)]);
    vi.mocked(adminDeleteFlag).mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AdminFeatureFlagsPage />);

    const row = await screen.findByTestId("flag-row-home_news_ticker");
    fireEvent.click(within(row).getByRole("button", { name: "Supprimer" }));

    await waitFor(() =>
      expect(screen.queryByTestId("flag-row-home_news_ticker")).toBeNull(),
    );
    expect(adminDeleteFlag).toHaveBeenCalledWith("id-home_news_ticker");
    confirm.mockRestore();
  });
});
