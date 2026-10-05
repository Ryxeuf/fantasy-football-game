import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/admin-dice-themes", () => ({
  adminListCoachCosmetics: vi.fn(),
}));

import { adminListCoachCosmetics } from "../../lib/admin-dice-themes";
import AdminCoachCosmeticsPage from "./page";

const list = adminListCoachCosmetics as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  list.mockResolvedValue({
    items: [{ id: "u1", email: "coach@x.fr", coachName: "Gones", crowns: 1250, acquiredThemes: 2, diceTheme: "orques" }],
    total: 30,
    page: 1,
    limit: 25,
  });
});

describe("AdminCoachCosmeticsPage", () => {
  it("liste solde, thèmes acquis et thème choisi, avec lien de gestion", async () => {
    render(<AdminCoachCosmeticsPage />);
    const row = await screen.findByTestId("coach-cosmetics-row-u1");
    expect(row.textContent).toContain("Gones");
    expect(row.textContent?.replace(/\s/g, " ")).toContain("1 250");
    expect(row.textContent).toContain("orques");
    expect(screen.getByTestId("coach-cosmetics-open-u1").getAttribute("href")).toBe("/admin/coach-cosmetics/u1");
    expect(screen.getByText(/page 1\/2/)).toBeTruthy();
  });

  it("recherche et pagination relancent la requête", async () => {
    render(<AdminCoachCosmeticsPage />);
    await screen.findByTestId("coach-cosmetics-row-u1");
    fireEvent.change(screen.getByTestId("coach-cosmetics-search"), { target: { value: "gones" } });
    fireEvent.click(screen.getByText("Rechercher"));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ search: "gones", page: 1, limit: 25 }));
    fireEvent.click(screen.getByText("→"));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ search: "gones", page: 2, limit: 25 }));
  });
});
