import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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
import { adminListFlags, type FeatureFlag } from "../../lib/featureFlags";

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
