/**
 * Tests pour `BadgeToastProvider` + `useBadgeNotify` (Sprint O — Lot O.C.3).
 *
 * Couvre :
 *   - Catalogue charge au mount.
 *   - notifyAndEvaluate() avec newlyEarned=[] → pas de toast.
 *   - notifyAndEvaluate() avec newlyEarned=["first_kickoff"] → 1 toast.
 *   - Multiple unlocks → 1 toast par badge.
 *   - Toast dismiss via bouton X.
 *   - useBadgeNotify() hors provider → no-op silencieux.
 *   - notifyAndEvaluate() en erreur API → no-op silencieux (ne crash pas).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";

vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class ApiClientError extends Error {
    public readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = "ApiClientError";
    }
  },
}));

import { apiRequest } from "../../lib/api-client";
import {
  BadgeToastProvider,
  useBadgeNotify,
} from "./BadgeToastProvider";

const mockedApi = vi.mocked(apiRequest);

const FAKE_CATALOGUE = {
  badges: [
    {
      code: "first_kickoff",
      name: "First Kickoff",
      description: "Premier pari.",
      emoji: "🥇",
    },
    {
      code: "oracle_of_nuffle",
      name: "Oracle of Nuffle",
      description: "10 paris gagnants.",
      emoji: "🔮",
    },
  ],
};

function TestHarness({
  triggerCount = 0,
}: {
  triggerCount?: number;
}): JSX.Element {
  const { notifyAndEvaluate } = useBadgeNotify();
  return (
    <button
      data-testid="trigger-evaluate"
      onClick={() => void notifyAndEvaluate()}
    >
      trigger (count: {triggerCount})
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BadgeToastProvider — Lot O.C.3", () => {
  it("ne montre aucun toast au mount", async () => {
    mockedApi.mockResolvedValueOnce(FAKE_CATALOGUE);
    render(
      <BadgeToastProvider>
        <TestHarness />
      </BadgeToastProvider>,
    );
    await waitFor(() => {
      // Container existe mais vide.
      expect(screen.getByTestId("badge-toast-container").children.length).toBe(
        0,
      );
    });
  });

  it("notifyAndEvaluate() avec newlyEarned=[] → pas de toast", async () => {
    mockedApi
      .mockResolvedValueOnce(FAKE_CATALOGUE) // catalogue
      .mockResolvedValueOnce({ newlyEarned: [] }); // evaluate
    render(
      <BadgeToastProvider>
        <TestHarness />
      </BadgeToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-evaluate"));
    });
    expect(screen.getByTestId("badge-toast-container").children.length).toBe(
      0,
    );
  });

  it("notifyAndEvaluate() avec newlyEarned=[first_kickoff] → 1 toast avec name + emoji", async () => {
    mockedApi
      .mockResolvedValueOnce(FAKE_CATALOGUE)
      .mockResolvedValueOnce({ newlyEarned: ["first_kickoff"] });
    render(
      <BadgeToastProvider>
        <TestHarness />
      </BadgeToastProvider>,
    );
    // Attendre que le catalogue soit charge
    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-evaluate"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("badge-toast-first_kickoff")).toBeTruthy();
    });
    const toast = screen.getByTestId("badge-toast-first_kickoff");
    expect(toast.textContent).toContain("First Kickoff");
    expect(toast.textContent).toContain("🥇");
  });

  it("multiple unlocks → 1 toast par badge", async () => {
    mockedApi
      .mockResolvedValueOnce(FAKE_CATALOGUE)
      .mockResolvedValueOnce({
        newlyEarned: ["first_kickoff", "oracle_of_nuffle"],
      });
    render(
      <BadgeToastProvider>
        <TestHarness />
      </BadgeToastProvider>,
    );
    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-evaluate"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("badge-toast-first_kickoff")).toBeTruthy();
      expect(screen.getByTestId("badge-toast-oracle_of_nuffle")).toBeTruthy();
    });
  });

  it("bouton dismiss ferme un toast individuellement", async () => {
    mockedApi
      .mockResolvedValueOnce(FAKE_CATALOGUE)
      .mockResolvedValueOnce({ newlyEarned: ["first_kickoff"] });
    render(
      <BadgeToastProvider>
        <TestHarness />
      </BadgeToastProvider>,
    );
    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-evaluate"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("badge-toast-first_kickoff")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("badge-toast-dismiss-first_kickoff"));
    expect(screen.queryByTestId("badge-toast-first_kickoff")).toBeNull();
  });

  it("erreur API silencieuse : pas de crash, container reste vide", async () => {
    mockedApi
      .mockResolvedValueOnce(FAKE_CATALOGUE)
      .mockRejectedValueOnce(new Error("boom"));
    render(
      <BadgeToastProvider>
        <TestHarness />
      </BadgeToastProvider>,
    );
    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-evaluate"));
    });
    expect(screen.getByTestId("badge-toast-container").children.length).toBe(
      0,
    );
  });

  it("useBadgeNotify hors provider : no-op silencieux", async () => {
    // Pas de BadgeToastProvider — useBadgeNotify renvoie un no-op
    render(<TestHarness />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-evaluate"));
    });
    // Pas de crash. Aucun container monte (provider absent).
    expect(screen.queryByTestId("badge-toast-container")).toBeNull();
  });

  it("fallback emoji si catalogue indisponible", async () => {
    mockedApi
      .mockRejectedValueOnce(new Error("catalogue down"))
      .mockResolvedValueOnce({ newlyEarned: ["unknown_badge"] });
    render(
      <BadgeToastProvider>
        <TestHarness />
      </BadgeToastProvider>,
    );
    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("trigger-evaluate"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("badge-toast-unknown_badge")).toBeTruthy();
    });
    const toast = screen.getByTestId("badge-toast-unknown_badge");
    expect(toast.textContent).toContain("🏆"); // fallback emoji
    expect(toast.textContent).toContain("unknown_badge"); // fallback name = code
  });
});
