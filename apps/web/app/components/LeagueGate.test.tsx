import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("../lib/featureFlags", () => ({
  fetchMyFlags: vi.fn(),
}));

import { fetchMyFlags } from "../lib/featureFlags";
import { FeatureFlagProvider } from "../contexts/FeatureFlagContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { LeagueGate } from "./LeagueGate";

const mockedFetchMyFlags = fetchMyFlags as unknown as ReturnType<typeof vi.fn>;

function Inside() {
  return <div data-testid="inside">LEAGUE CONTENT</div>;
}

function renderWithProvider(children: ReactNode) {
  return render(
    <LanguageProvider>
      <FeatureFlagProvider>{children}</FeatureFlagProvider>
    </LanguageProvider>,
  );
}

describe("LeagueGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("auth_token", "fake-token");
  });

  it("renders children when the `league` flag is active", async () => {
    mockedFetchMyFlags.mockResolvedValue(["league"]);
    renderWithProvider(
      <LeagueGate>
        <Inside />
      </LeagueGate>,
    );
    await waitFor(() => expect(screen.getByTestId("inside")).toBeTruthy());
  });

  it("renders the disabled screen when the flag is absent", async () => {
    mockedFetchMyFlags.mockResolvedValue(["online_play"]);
    renderWithProvider(
      <LeagueGate>
        <Inside />
      </LeagueGate>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("league-gate-disabled")).toBeTruthy(),
    );
    expect(screen.queryByTestId("inside")).toBeNull();
  });

  it("is gated independently of online_play (online_play seul ne suffit pas)", async () => {
    mockedFetchMyFlags.mockResolvedValue(["online_play"]);
    renderWithProvider(
      <LeagueGate>
        <Inside />
      </LeagueGate>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("league-gate-disabled")).toBeTruthy(),
    );
  });
});
