import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useParams: () => ({ userId: "u2" }) }));
vi.mock("../../../lib/admin-crowns", () => ({ adminCreateWallet: vi.fn() }));

import { adminCreateWallet } from "../../../lib/admin-crowns";
import AdminWalletDetailPage from "./page";

const create = adminCreateWallet as unknown as ReturnType<typeof vi.fn>;

function walletResponse(exists: boolean) {
  return {
    user: { id: "u2", email: "b@x.fr", coachName: "Krânes" },
    wallet: { userId: "u2", exists, crowns: 0, createdAt: null, updatedAt: null },
    transactions: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
    pendingBets: [],
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function respond(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
}

describe("AdminWalletDetailPage — wallet absent", () => {
  it("annonce l'absence de wallet et le crée", async () => {
    fetchMock.mockImplementationOnce(() => respond(walletResponse(false))).mockImplementation(() => respond(walletResponse(true)));
    create.mockResolvedValueOnce({ created: true, wallet: { userId: "u2", crowns: 0, createdAt: "x" } });

    render(<AdminWalletDetailPage />);
    expect((await screen.findByTestId("wallet-missing")).textContent).toContain("pas encore de wallet");

    fireEvent.click(screen.getByTestId("btn-create-wallet"));
    await waitFor(() => expect(create).toHaveBeenCalledWith("u2"));
    await waitFor(() => expect(screen.queryByTestId("wallet-missing")).toBeNull());
  });

  it("wallet présent : pas de bandeau, retour vers la liste des wallets", async () => {
    fetchMock.mockImplementation(() => respond(walletResponse(true)));
    render(<AdminWalletDetailPage />);
    await screen.findByTestId("wallet-balance");
    expect(screen.queryByTestId("wallet-missing")).toBeNull();
    expect(screen.getByText("← Wallets").getAttribute("href")).toBe("/admin/wallets");
  });
});
