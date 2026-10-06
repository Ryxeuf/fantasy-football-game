import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../../lib/admin-dice-themes", () => ({ adminGetCoachCrownsRewards: vi.fn() }));

import { adminGetCoachCrownsRewards } from "../../../lib/admin-dice-themes";
import { CoachCrownsRewards } from "./CoachCrownsRewards";

const load = adminGetCoachCrownsRewards as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CoachCrownsRewards (admin)", () => {
  it("liste les récompenses et signale les plafonnées", async () => {
    load.mockResolvedValue([
      { id: "r1", sourceKey: "sheet:s1:home", kind: "sheet", periodKey: "cup:c1", amount: 10, baseAmount: 25, createdAt: "2026-10-06T10:00:00Z" },
      { id: "r2", sourceKey: "signup:u1", kind: "signup", periodKey: null, amount: 250, baseAmount: 250, createdAt: "2026-10-05T10:00:00Z" },
    ]);
    render(<CoachCrownsRewards userId="u1" />);
    const capped = await screen.findByTestId("coach-crowns-reward-r1");
    expect(capped.textContent).toContain("Feuille de match (domicile)");
    expect(capped.textContent).toContain("Coupe");
    expect(capped.textContent).toContain("plafonnée (barème 25)");
    const signup = screen.getByTestId("coach-crowns-reward-r2");
    expect(signup.textContent).toContain("Bonus de bienvenue");
    expect(signup.textContent).not.toContain("plafonnée");
    expect(load).toHaveBeenCalledWith("u1");
  });

  it("registre vide", async () => {
    load.mockResolvedValue([]);
    render(<CoachCrownsRewards userId="u1" />);
    expect(await screen.findByText("Aucune récompense.")).toBeTruthy();
  });

  it("échec du chargement : message, sans bloquer", async () => {
    load.mockRejectedValue(new Error("403 interdit"));
    render(<CoachCrownsRewards userId="u1" />);
    expect((await screen.findByRole("alert")).textContent).toContain("403 interdit");
  });
});
