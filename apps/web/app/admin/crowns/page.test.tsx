import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/admin-crowns", async (orig) => ({
  ...(await orig<typeof import("../../lib/admin-crowns")>()),
  adminGetCrownsOverview: vi.fn(),
  adminListCrownsLedger: vi.fn(),
}));

import { adminGetCrownsOverview, adminListCrownsLedger, type CrownsOverview } from "../../lib/admin-crowns";
import AdminCrownsPage from "./page";

const overview = adminGetCrownsOverview as unknown as ReturnType<typeof vi.fn>;
const ledger = adminListCrownsLedger as unknown as ReturnType<typeof vi.fn>;

const OVERVIEW: CrownsOverview = {
  supply: 1600,
  wallets: 3,
  usersWithoutWallet: 2,
  days: 30,
  flows: {
    allTime: [
      { type: "ADMIN_ADJUST", count: 4, credited: 3000, debited: 100, net: 2900 },
      { type: "SINK", count: 2, credited: 0, debited: 650, net: -650 },
    ],
    recent: [{ type: "SINK", count: 1, credited: 0, debited: 400, net: -400 }],
  },
  topHolders: [{ userId: "u1", coachName: "Gones", email: "a@x", crowns: 1000 }],
  flag: { exists: false, enabled: false, userOverrides: 0 },
};

beforeEach(() => {
  vi.resetAllMocks();
  overview.mockResolvedValue(OVERVIEW);
  ledger.mockResolvedValue({
    items: [
      {
        id: "t1",
        type: "SINK",
        amount: -400,
        ref: "dice-theme:orques",
        createdAt: "2026-10-05T10:00:00.000Z",
        user: { id: "u1", coachName: "Gones", email: "a@x" },
      },
    ],
    total: 1,
    page: 1,
    limit: 50,
  });
});

describe("AdminCrownsPage", () => {
  it("signale un flag absent de la base, avec lien vers les flags", async () => {
    render(<AdminCrownsPage />);
    const flag = await screen.findByTestId("crowns-flag");
    expect(flag.textContent).toContain("absent de la base");
    expect(flag.querySelector("a")?.getAttribute("href")).toBe("/admin/feature-flags");
  });

  it("masse, wallets et lien vers les coachs sans wallet", async () => {
    render(<AdminCrownsPage />);
    await screen.findByTestId("crowns-flag");
    expect(screen.getByText(/1\s600/)).toBeTruthy();
    expect(screen.getByTestId("crowns-missing-wallets-link").getAttribute("href")).toBe("/admin/wallets?status=without");
  });

  it("flux récents par défaut, puis depuis toujours", async () => {
    render(<AdminCrownsPage />);
    await screen.findByTestId("crowns-flow-SINK");
    expect(screen.queryByTestId("crowns-flow-ADMIN_ADJUST")).toBeNull();
    fireEvent.click(screen.getByTestId("crowns-period-all"));
    expect(screen.getByTestId("crowns-flow-ADMIN_ADJUST").textContent?.replace(/\s/g, " ")).toContain("+3 000");
  });

  it("changer de fenêtre recharge la vue d'ensemble", async () => {
    render(<AdminCrownsPage />);
    await screen.findByTestId("crowns-flag");
    fireEvent.change(screen.getByTestId("crowns-window"), { target: { value: "7" } });
    await waitFor(() => expect(overview).toHaveBeenLastCalledWith(7));
  });

  it("journal filtré par type", async () => {
    render(<AdminCrownsPage />);
    const row = await screen.findByTestId("crowns-tx-t1");
    expect(row.textContent).toContain("Gones");
    expect(row.textContent).toContain("dice-theme:orques");
    fireEvent.change(screen.getByTestId("crowns-ledger-type"), { target: { value: "SINK" } });
    await waitFor(() =>
      expect(ledger).toHaveBeenLastCalledWith({ type: "SINK", search: undefined, page: 1, limit: 50 }),
    );
  });

  it("flag actif : bandeau vert", async () => {
    overview.mockResolvedValue({ ...OVERVIEW, flag: { exists: true, enabled: true, userOverrides: 0 } });
    render(<AdminCrownsPage />);
    expect((await screen.findByTestId("crowns-flag")).textContent).toContain("actif pour tous");
  });
});
