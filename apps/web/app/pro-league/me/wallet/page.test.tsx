import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../../../lib/api-client", () => ({
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

vi.mock("../../../lib/use-wallet", () => ({
  useWallet: () => ({
    authed: true,
    balance: 1234,
    refresh: vi.fn(),
    claimDaily: vi.fn(),
    canClaimDaily: false,
  }),
}));

vi.mock("../../_components/WalletBadge", () => ({
  WalletBadge: () => <div data-testid="wallet-badge-stub" />,
}));

import { apiRequest, ApiClientError } from "../../../lib/api-client";
import ProLeagueWalletPage from "./page";

const mockedApi = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

interface WalletData {
  balance: number;
  transactions: Array<{
    id: string;
    type: "BET" | "WIN" | "REWARD" | "DAILY" | "BADGE";
    amount: number;
    ref: string | null;
    createdAt: string;
  }>;
}

function makeData(overrides: Partial<WalletData> = {}): WalletData {
  return {
    balance: 1234,
    transactions: [
      {
        id: "tx1",
        type: "BET",
        amount: 100,
        ref: "bet_abc123",
        createdAt: new Date("2026-05-08T18:30:00Z").toISOString(),
      },
      {
        id: "tx2",
        type: "WIN",
        amount: 250,
        ref: "bet_abc123",
        createdAt: new Date("2026-05-08T22:15:00Z").toISOString(),
      },
      {
        id: "tx3",
        type: "DAILY",
        amount: 50,
        ref: null,
        createdAt: new Date("2026-05-09T08:00:00Z").toISOString(),
      },
    ],
    ...overrides,
  };
}

describe("ProLeagueWalletPage — Lot N", () => {
  it("affiche 'Chargement…' pendant le fetch", () => {
    mockedApi.mockReturnValue(new Promise(() => undefined));
    render(<ProLeagueWalletPage />);
    expect(screen.getByText(/Chargement/)).toBeTruthy();
  });

  it("affiche le solde + transactions BET/WIN/DAILY", async () => {
    mockedApi.mockResolvedValueOnce(makeData());
    render(<ProLeagueWalletPage />);
    await waitFor(() => {
      expect(screen.getByTestId("wallet-balance")).toBeTruthy();
    });
    // Solde formaté FR
    const balance = screen.getByTestId("wallet-balance");
    expect(balance.textContent).toContain("1");
    expect(balance.textContent).toContain("234");
    // Liste de transactions
    const ul = screen.getByTestId("wallet-transactions");
    expect(ul.children.length).toBe(3);
    // Une row par type → testid distinct
    expect(screen.getByTestId("wallet-tx-bet")).toBeTruthy();
    expect(screen.getByTestId("wallet-tx-win")).toBeTruthy();
    expect(screen.getByTestId("wallet-tx-daily")).toBeTruthy();
  });

  it("formate les montants : BET signé '−', WIN signé '+'", async () => {
    mockedApi.mockResolvedValueOnce(makeData());
    render(<ProLeagueWalletPage />);
    await waitFor(() => {
      expect(screen.getByTestId("wallet-tx-bet")).toBeTruthy();
    });
    expect(screen.getByTestId("wallet-tx-bet").textContent).toContain("−100");
    expect(screen.getByTestId("wallet-tx-win").textContent).toContain("+250");
    expect(screen.getByTestId("wallet-tx-daily").textContent).toContain("+50");
  });

  it("empty state quand aucune transaction", async () => {
    mockedApi.mockResolvedValueOnce(makeData({ transactions: [] }));
    render(<ProLeagueWalletPage />);
    await waitFor(() => {
      expect(screen.getByTestId("wallet-empty")).toBeTruthy();
    });
    expect(screen.queryByTestId("wallet-transactions")).toBeNull();
  });

  it("affiche le message connecte-toi sur 401", async () => {
    mockedApi.mockRejectedValueOnce(new ApiClientError("unauth", 401));
    render(<ProLeagueWalletPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toContain("Connecte-toi");
  });

  it("propage l'erreur générique sur 500", async () => {
    mockedApi.mockRejectedValueOnce(new Error("boom"));
    render(<ProLeagueWalletPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toContain("boom");
  });
});
