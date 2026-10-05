import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/admin-crowns", async (orig) => ({
  ...(await orig<typeof import("../../lib/admin-crowns")>()),
  adminListWallets: vi.fn(),
  adminCreateWallet: vi.fn(),
  adminCreateMissingWallets: vi.fn(),
}));

import { adminCreateMissingWallets, adminCreateWallet, adminListWallets } from "../../lib/admin-crowns";
import AdminWalletsPage from "./page";

const list = adminListWallets as unknown as ReturnType<typeof vi.fn>;
const createOne = adminCreateWallet as unknown as ReturnType<typeof vi.fn>;
const createMissing = adminCreateMissingWallets as unknown as ReturnType<typeof vi.fn>;

const PAGE = {
  items: [
    {
      id: "u1",
      email: "a@x.fr",
      coachName: "Gones",
      createdAt: "2026-10-01T00:00:00.000Z",
      wallet: { crowns: 1250, createdAt: "2026-10-02T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z", transactions: 3 },
    },
    { id: "u2", email: "b@x.fr", coachName: "Krânes", createdAt: "2026-10-01T00:00:00.000Z", wallet: null },
  ],
  total: 2,
  page: 1,
  limit: 25,
  counts: { all: 2, with: 1, without: 1 },
};

beforeEach(() => {
  vi.resetAllMocks();
  list.mockResolvedValue(PAGE);
  window.history.replaceState(null, "", "/admin/wallets");
});

describe("AdminWalletsPage", () => {
  it("distingue les coachs avec et sans wallet", async () => {
    render(<AdminWalletsPage />);
    const withWallet = await screen.findByTestId("wallet-row-u1");
    expect(withWallet.textContent?.replace(/\s/g, " ")).toContain("1 250");
    expect(screen.getByTestId("wallet-open-u1").getAttribute("href")).toBe("/admin/wallets/u1");
    expect(screen.getByTestId("wallet-row-u2").textContent).toContain("Aucun wallet");
    expect(screen.getByTestId("wallet-create-u2")).toBeTruthy();
    expect(screen.getByTestId("wallets-filter-without").textContent).toContain("(1)");
    expect(screen.getByTestId("wallets-create-missing").textContent).toContain("Créer les 1 wallet manquant");
  });

  it("lit le filtre initial dans l'URL", async () => {
    window.history.replaceState(null, "", "/admin/wallets?status=without");
    render(<AdminWalletsPage />);
    await waitFor(() => expect(list).toHaveBeenCalledWith({ status: "without", search: undefined, page: 1, limit: 25 }));
    // Jamais de requête avec un filtre provisoire.
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("filtre et recherche relancent la requête", async () => {
    render(<AdminWalletsPage />);
    await screen.findByTestId("wallet-row-u1");
    fireEvent.click(screen.getByTestId("wallets-filter-without"));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ status: "without", search: undefined, page: 1, limit: 25 }));
    fireEvent.change(screen.getByTestId("wallets-search"), { target: { value: "gones" } });
    fireEvent.click(screen.getByText("Rechercher"));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ status: "without", search: "gones", page: 1, limit: 25 }));
  });

  it("crée le wallet d'un coach puis recharge", async () => {
    createOne.mockResolvedValueOnce({ created: true, wallet: { userId: "u2", crowns: 0, createdAt: "x" } });
    render(<AdminWalletsPage />);
    fireEvent.click(await screen.findByTestId("wallet-create-u2"));
    await waitFor(() => expect(createOne).toHaveBeenCalledWith("u2"));
    expect((await screen.findByTestId("wallets-notice")).textContent).toContain("Wallet créé pour Krânes");
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("crée tous les wallets manquants après confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    createMissing.mockResolvedValueOnce({ created: 1, remaining: 0 });
    render(<AdminWalletsPage />);
    await screen.findByTestId("wallet-row-u1");
    fireEvent.click(screen.getByTestId("wallets-create-missing"));
    await waitFor(() => expect(createMissing).toHaveBeenCalled());
    expect((await screen.findByTestId("wallets-notice")).textContent).toContain("1 wallet créé.");
    confirm.mockRestore();
  });

  it("annulation de la confirmation : rien n'est créé", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AdminWalletsPage />);
    await screen.findByTestId("wallet-row-u1");
    fireEvent.click(screen.getByTestId("wallets-create-missing"));
    expect(createMissing).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("tout le monde a un wallet : bouton de masse désactivé", async () => {
    list.mockResolvedValue({ ...PAGE, items: [PAGE.items[0]], counts: { all: 1, with: 1, without: 0 } });
    render(<AdminWalletsPage />);
    const btn = (await screen.findByText("Tous les coachs ont un wallet")) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
