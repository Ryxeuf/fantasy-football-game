import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("../lib/featureFlags", () => ({
  fetchMyFlags: vi.fn(),
}));

import { fetchMyFlags } from "../lib/featureFlags";
import { FeatureFlagProvider } from "../contexts/FeatureFlagContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { OnlinePlayGate } from "./OnlinePlayGate";

const mockedFetchMyFlags = fetchMyFlags as unknown as ReturnType<typeof vi.fn>;

function Inside() {
  return <div data-testid="inside">ONLINE CONTENT</div>;
}

function renderWithProvider(children: ReactNode) {
  return render(
    <LanguageProvider>
      <FeatureFlagProvider>{children}</FeatureFlagProvider>
    </LanguageProvider>,
  );
}

describe("OnlinePlayGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("auth_token", "fake-token");
  });

  it("renders children when online_play flag is active", async () => {
    mockedFetchMyFlags.mockResolvedValue(["online_play"]);
    renderWithProvider(
      <OnlinePlayGate>
        <Inside />
      </OnlinePlayGate>,
    );
    await waitFor(() => expect(screen.getByTestId("inside")).toBeTruthy());
  });

  it("renders the disabled screen when flag is absent", async () => {
    mockedFetchMyFlags.mockResolvedValue(["some_other_flag"]);
    renderWithProvider(
      <OnlinePlayGate>
        <Inside />
      </OnlinePlayGate>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("online-play-gate-disabled")).toBeTruthy(),
    );
    expect(screen.queryByTestId("inside")).toBeNull();
  });

  it("renders disabled screen for unauthenticated visitors", async () => {
    window.localStorage.removeItem("auth_token");
    renderWithProvider(
      <OnlinePlayGate>
        <Inside />
      </OnlinePlayGate>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("online-play-gate-disabled")).toBeTruthy(),
    );
    expect(mockedFetchMyFlags).not.toHaveBeenCalled();
  });
});
