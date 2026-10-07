import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useParams: () => ({ userId: "u1" }) }));
vi.mock("../../../lib/admin-dice-themes", () => ({
  adminGetCoachCosmetics: vi.fn(),
  adminGrantDiceTheme: vi.fn(),
  adminRevokeDiceTheme: vi.fn(),
  adminSetCoachDiceTheme: vi.fn(),
  adjustCoachCrowns: vi.fn(),
  adminGetCoachCrownsRewards: vi.fn(),
  acquisitionSourceLabel: (s: string) => (s === "purchase" ? "Achat" : "Cadeau admin"),
}));

import * as api from "../../../lib/admin-dice-themes";
import Page from "./page";

type Mock = ReturnType<typeof vi.fn>;
const m = api as unknown as Record<string, Mock>;

const DETAIL = {
  user: { id: "u1", email: "coach@x.fr", coachName: "Gones" },
  crowns: 600,
  storedThemeId: "orques",
  effectiveThemeId: "orques",
  acquisitions: [
    { themeId: "orques", source: "purchase", priceCrowns: 400, grantedById: null, createdAt: "2026-10-01T10:00:00Z", known: true },
  ],
  themes: [
    { id: "nuffle", name: { fr: "Original", en: "Original" }, collection: "classic", priceCrowns: null, enabled: true, owned: true, free: true },
    { id: "orques", name: { fr: "Orques", en: "Orcs" }, collection: "team", priceCrowns: 400, enabled: true, owned: true, free: false },
    { id: "nains", name: { fr: "Nains", en: "Dwarves" }, collection: "team", priceCrowns: 400, enabled: true, owned: false, free: false },
  ],
  transactions: [{ id: "t1", type: "SINK", amount: -400, ref: "dice-theme:orques", createdAt: "2026-10-01T10:00:00Z" }],
};

beforeEach(() => {
  vi.resetAllMocks();
  m.adminGetCoachCosmetics.mockResolvedValue(DETAIL);
  m.adminGetCoachCrownsRewards.mockResolvedValue([]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("Admin — cosmétiques d'un coach", () => {
  it("solde, journal lisible, thème choisi et acquisitions", async () => {
    render(<Page />);
    expect((await screen.findByTestId("coach-crowns-balance")).textContent).toContain("600");
    expect(screen.getByTestId("coach-crowns-history").textContent).toContain("Achat du thème de dés « Orques »");
    expect(screen.getByTestId("coach-acquisition-orques").textContent).toContain("Achat");
    expect((screen.getByTestId("coach-theme-select") as HTMLSelectElement).value).toBe("orques");
  });

  it("affiche le registre des récompenses du coach", async () => {
    m.adminGetCoachCrownsRewards.mockResolvedValue([
      {
        id: "r1",
        sourceKey: "sheet:s1:away",
        kind: "sheet",
        periodKey: "season:x",
        amount: 25,
        baseAmount: 25,
        createdAt: "2026-10-06T10:00:00Z",
      },
    ]);
    render(<Page />);
    expect((await screen.findByTestId("coach-crowns-reward-r1")).textContent).toContain("Feuille de match (extérieur)");
    expect(m.adminGetCoachCrownsRewards).toHaveBeenCalledWith("u1");
  });

  it("offre un thème non possédé", async () => {
    m.adminGrantDiceTheme.mockResolvedValue(DETAIL);
    render(<Page />);
    await screen.findByTestId("coach-grant-select");
    const options = Array.from((screen.getByTestId("coach-grant-select") as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(["", "nains"]);
    fireEvent.change(screen.getByTestId("coach-grant-select"), { target: { value: "nains" } });
    fireEvent.click(screen.getByTestId("coach-grant-submit"));
    await waitFor(() => expect(m.adminGrantDiceTheme).toHaveBeenCalledWith("u1", "nains"));
    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("retire un achat en remboursant", async () => {
    m.adminRevokeDiceTheme.mockResolvedValue({ ...DETAIL, acquisitions: [], refunded: 400 });
    render(<Page />);
    fireEvent.click(await screen.findByTestId("coach-revoke-orques"));
    await waitFor(() => expect(m.adminRevokeDiceTheme).toHaveBeenCalledWith("u1", "orques", true));
  });

  it("remet le coach au thème par défaut", async () => {
    m.adminSetCoachDiceTheme.mockResolvedValue({ ...DETAIL, storedThemeId: null, effectiveThemeId: "nuffle" });
    render(<Page />);
    fireEvent.change(await screen.findByTestId("coach-theme-select"), { target: { value: "" } });
    await waitFor(() => expect(m.adminSetCoachDiceTheme).toHaveBeenCalledWith("u1", null));
  });

  it("ajuste le solde par la route wallet puis recharge", async () => {
    m.adjustCoachCrowns.mockResolvedValue({});
    render(<Page />);
    fireEvent.click(await screen.findByTestId("coach-crowns-adjust"));
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "250" } });
    fireEvent.change(inputs[inputs.length - 1], { target: { value: "Lot de tournoi" } });
    fireEvent.submit(screen.getByRole("spinbutton").closest("form")!);
    await waitFor(() => expect(m.adjustCoachCrowns).toHaveBeenCalledWith("u1", 250, "Lot de tournoi"));
    await waitFor(() => expect(m.adminGetCoachCosmetics).toHaveBeenCalledTimes(2));
  });

  it("erreur de chargement affichée", async () => {
    m.adminGetCoachCosmetics.mockRejectedValue(new Error("Utilisateur introuvable"));
    render(<Page />);
    expect((await screen.findByRole("alert")).textContent).toContain("introuvable");
  });
});
