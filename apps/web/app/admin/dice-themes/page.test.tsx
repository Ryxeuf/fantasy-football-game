import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/admin-dice-themes", () => ({
  adminListDiceThemes: vi.fn(),
  adminUpdateDiceTheme: vi.fn(),
  adminResetDiceTheme: vi.fn(),
}));

import { adminListDiceThemes, adminUpdateDiceTheme, adminResetDiceTheme } from "../../lib/admin-dice-themes";
import AdminDiceThemesPage from "./page";

type Mock = ReturnType<typeof vi.fn>;
const list = adminListDiceThemes as unknown as Mock;
const update = adminUpdateDiceTheme as unknown as Mock;
const reset = adminResetDiceTheme as unknown as Mock;

function theme(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    collection: "team",
    priceCrowns: 400,
    enabled: true,
    sortOrder: 100,
    name: { fr: `Thème ${id}`, en: id },
    description: { fr: "d", en: "d" },
    isDefault: false,
    inDatabase: true,
    compiled: { priceCrowns: 400, enabled: true, name: { fr: id, en: id } },
    stats: { owners: 1, purchases: 1, gifts: 0, selectedBy: 1, revenueCrowns: 400 },
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  list.mockResolvedValue([
    theme("nuffle", { collection: "classic", priceCrowns: null, isDefault: true, inDatabase: false }),
    theme("orques"),
  ]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("AdminDiceThemesPage", () => {
  it("liste les thèmes avec aperçu et statistiques", async () => {
    render(<AdminDiceThemesPage />);
    const row = await screen.findByTestId("admin-dice-theme-orques");
    expect(row.textContent).toContain("Thème orques");
    expect(row.textContent).toContain("1 acquis");
    expect(row.querySelectorAll("img")).toHaveLength(5);
    expect(screen.getByTestId("admin-dice-theme-nuffle").textContent).toContain("Compilé");
    expect(screen.getByTestId("admin-dice-themes-summary").textContent).toContain("Recette");
  });

  it("le défaut ne se retire pas de la vente", async () => {
    render(<AdminDiceThemesPage />);
    const toggle = (await screen.findByTestId("admin-dice-toggle-nuffle")) as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
  });

  it("retire un thème de la vente", async () => {
    update.mockResolvedValue(theme("orques", { enabled: false }));
    render(<AdminDiceThemesPage />);
    fireEvent.click(await screen.findByTestId("admin-dice-toggle-orques"));
    await waitFor(() => expect(update).toHaveBeenCalledWith("orques", { enabled: false }));
    await waitFor(() => expect(screen.getByTestId("admin-dice-toggle-orques").textContent).toBe("Retiré"));
  });

  it("édite le prix depuis la modale", async () => {
    update.mockResolvedValue(theme("orques", { priceCrowns: 500 }));
    render(<AdminDiceThemesPage />);
    fireEvent.click(await screen.findByTestId("admin-dice-edit-orques"));
    fireEvent.change(screen.getByTestId("edit-price"), { target: { value: "500" } });
    fireEvent.click(screen.getByTestId("edit-save"));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("orques", expect.objectContaining({ priceCrowns: 500, enabled: true })),
    );
    await waitFor(() => expect(screen.queryByTestId("dice-theme-edit-modal")).toBeNull());
  });

  it("prix invalide : enregistrement désactivé", async () => {
    render(<AdminDiceThemesPage />);
    fireEvent.click(await screen.findByTestId("admin-dice-edit-orques"));
    fireEvent.change(screen.getByTestId("edit-price"), { target: { value: "-3" } });
    expect((screen.getByTestId("edit-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("réinitialise depuis le code après confirmation", async () => {
    reset.mockResolvedValue(theme("orques"));
    render(<AdminDiceThemesPage />);
    await screen.findByTestId("admin-dice-theme-orques");
    fireEvent.click(screen.getAllByText("Réinitialiser")[1]);
    await waitFor(() => expect(reset).toHaveBeenCalledWith("orques"));
  });

  it("filtre « Classiques »", async () => {
    render(<AdminDiceThemesPage />);
    await screen.findByTestId("admin-dice-theme-orques");
    fireEvent.click(screen.getByTestId("admin-dice-filter-classic"));
    expect(screen.queryByTestId("admin-dice-theme-orques")).toBeNull();
    expect(screen.getByTestId("admin-dice-theme-nuffle")).toBeTruthy();
  });
});
