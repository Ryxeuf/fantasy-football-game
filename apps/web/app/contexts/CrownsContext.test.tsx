import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

vi.mock("../lib/api-client", () => ({ apiRequest: vi.fn() }));
const { flags } = vi.hoisted(() => ({ flags: { keys: [] as string[] } }));
vi.mock("../lib/featureFlags", () => ({
  fetchMyFlags: vi.fn(async () => flags.keys),
}));

import { apiRequest } from "../lib/api-client";
import { FeatureFlagProvider } from "./FeatureFlagContext";
import { CrownsProvider, useCrowns, type CrownsContextValue } from "./CrownsContext";
import { CROWNS_FLAG } from "../lib/featureFlagKeys";

const mockedApi = apiRequest as unknown as ReturnType<typeof vi.fn>;

let captured: CrownsContextValue | null = null;
function Probe() {
  captured = useCrowns();
  return <span data-testid="crowns">{`${captured.enabled}:${captured.balance}`}</span>;
}

function renderWithProviders() {
  return render(
    <FeatureFlagProvider>
      <CrownsProvider>
        <Probe />
      </CrownsProvider>
    </FeatureFlagProvider>,
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("CrownsContext", () => {
  beforeEach(() => {
    mockedApi.mockReset();
    captured = null;
    window.localStorage.clear();
    window.localStorage.setItem("auth_token", "tok");
    flags.keys = [CROWNS_FLAG];
  });

  it("hors provider : rien (no-op)", () => {
    render(<Probe />);
    expect(screen.getByTestId("crowns").textContent).toBe("false:null");
  });

  it("flag OFF : AUCUNE requête, solde inconnu", async () => {
    flags.keys = [];
    renderWithProviders();
    await flush();
    expect(screen.getByTestId("crowns").textContent).toBe("false:null");
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("flag ON + anonyme : aucune requête", async () => {
    window.localStorage.clear();
    renderWithProviders();
    await flush();
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("flag ON + connecté : charge solde et historique", async () => {
    mockedApi.mockResolvedValue({ balance: 750, transactions: [{ id: "t1" }] });
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId("crowns").textContent).toBe("true:750"));
    expect(mockedApi).toHaveBeenCalledWith("/crowns/me");
    expect(captured!.transactions).toHaveLength(1);
  });

  it("applyBalance remplace le solde sans requête", async () => {
    mockedApi.mockResolvedValue({ balance: 750, transactions: [] });
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId("crowns").textContent).toBe("true:750"));
    act(() => captured!.applyBalance(350));
    expect(screen.getByTestId("crowns").textContent).toBe("true:350");
    expect(mockedApi).toHaveBeenCalledTimes(1);
  });

  it("erreur réseau : solde inconnu, jamais d'exception", async () => {
    mockedApi.mockRejectedValue(new Error("boom"));
    renderWithProviders();
    await waitFor(() => expect(mockedApi).toHaveBeenCalled());
    await flush();
    expect(screen.getByTestId("crowns").textContent).toBe("true:null");
    expect(captured!.error).toBe(true);
    mockedApi.mockResolvedValueOnce({ balance: 20, transactions: [] });
    await act(async () => {
      await captured!.refresh();
    });
    expect(captured!.error).toBe(false);
    expect(screen.getByTestId("crowns").textContent).toBe("true:20");
  });
});
