import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

// Mock de la couche réseau AVANT import du provider.
vi.mock("../lib/featureFlags", () => ({
  fetchMyFlags: vi.fn(),
}));

import { fetchMyFlags } from "../lib/featureFlags";
import { FeatureFlagProvider } from "../contexts/FeatureFlagContext";
import { useFeatureFlag } from "./useFeatureFlag";

const mockedFetchMyFlags = fetchMyFlags as unknown as ReturnType<typeof vi.fn>;

function Probe({ flagKey }: { flagKey: string }) {
  const enabled = useFeatureFlag(flagKey);
  return <div data-testid="result">{enabled ? "on" : "off"}</div>;
}

function renderWithProvider(children: ReactNode) {
  return render(<FeatureFlagProvider>{children}</FeatureFlagProvider>);
}

describe("useFeatureFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("auth_token", "fake-token");
  });

  it("returns true when the flag is in the active set", async () => {
    mockedFetchMyFlags.mockResolvedValue(["beta_ui"]);
    renderWithProvider(<Probe flagKey="beta_ui" />);
    await waitFor(() =>
      expect(screen.getByTestId("result").textContent).toBe("on"),
    );
  });

  it("returns false for a key not in the active set", async () => {
    mockedFetchMyFlags.mockResolvedValue(["other_flag"]);
    renderWithProvider(<Probe flagKey="beta_ui" />);
    await waitFor(() =>
      expect(screen.getByTestId("result").textContent).toBe("off"),
    );
  });

  it("returns false when no token is present (no fetch)", async () => {
    window.localStorage.removeItem("auth_token");
    renderWithProvider(<Probe flagKey="beta_ui" />);
    await waitFor(() =>
      expect(screen.getByTestId("result").textContent).toBe("off"),
    );
    expect(mockedFetchMyFlags).not.toHaveBeenCalled();
  });

  it("returns false if the fetch throws", async () => {
    mockedFetchMyFlags.mockRejectedValue(new Error("boom"));
    renderWithProvider(<Probe flagKey="beta_ui" />);
    await waitFor(() =>
      expect(screen.getByTestId("result").textContent).toBe("off"),
    );
  });
});
