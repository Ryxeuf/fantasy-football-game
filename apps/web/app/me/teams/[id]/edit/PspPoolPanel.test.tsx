/**
 * Panneau « Édition avancée » : réglage du pool de PSP après création.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PspPoolPanel from "./PspPoolPanel";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const savePspPool = vi.fn();
vi.mock("./psp-pool-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./psp-pool-client")>();
  return { ...actual, savePspPool: (...args: unknown[]) => savePspPool(...args) };
});

const FREE = {
  pool: 0,
  spent: 0,
  remaining: 0,
  locked: false,
  tournamentRuleset: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PspPoolPanel", () => {
  it("masque le réglage tant que l'édition avancée n'est pas activée", () => {
    render(
      <PspPoolPanel teamId="T1" state={FREE} onChange={vi.fn()} />,
    );
    expect(screen.queryByTestId("psp-pool-input")).toBeNull();

    fireEvent.click(screen.getByTestId("edit-advanced-toggle"));
    expect(screen.getByTestId("psp-pool-input")).toBeTruthy();
  });

  it("s'ouvre déjà déplié quand un pool existe", () => {
    render(
      <PspPoolPanel
        teamId="T1"
        state={{ ...FREE, pool: 20, remaining: 20 }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("psp-pool-total").textContent).toBe("20");
    expect(screen.getByTestId("psp-pool-input")).toBeTruthy();
  });

  it("enregistre le nouveau pool et remonte l'état renvoyé", async () => {
    const next = { ...FREE, pool: 30, remaining: 30 };
    savePspPool.mockResolvedValue(next);
    const onChange = vi.fn();

    render(<PspPoolPanel teamId="T1" state={FREE} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("edit-advanced-toggle"));
    fireEvent.change(screen.getByTestId("psp-pool-input"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByTestId("psp-pool-save"));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(next));
    expect(savePspPool).toHaveBeenCalledWith("T1", 30);
  });

  it("désactive « Appliquer » tant que la valeur n'a pas changé", () => {
    render(
      <PspPoolPanel
        teamId="T1"
        state={{ ...FREE, pool: 20, remaining: 20 }}
        onChange={vi.fn()}
      />,
    );
    expect(
      (screen.getByTestId("psp-pool-save") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("affiche l'erreur serveur (pool sous les PSP déjà dépensés)", async () => {
    savePspPool.mockRejectedValue(
      new Error("16 PSP sont déjà dépensés : annule des compétences"),
    );
    render(
      <PspPoolPanel
        teamId="T1"
        state={{ ...FREE, pool: 20, spent: 16, remaining: 4 }}
        onChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("psp-pool-input"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByTestId("psp-pool-save"));

    await waitFor(() =>
      expect(screen.getByTestId("psp-pool-error").textContent).toContain(
        "déjà dépensés",
      ),
    );
  });

  it("verrouille le réglage quand la coupe impose le pool", () => {
    render(
      <PspPoolPanel
        teamId="T1"
        state={{ ...FREE, pool: 44, remaining: 44, locked: true }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("edit-advanced-toggle")).toBeNull();
    expect(screen.queryByTestId("psp-pool-input")).toBeNull();
    expect(screen.getByTestId("psp-pool-locked")).toBeTruthy();
  });

  it("annonce le règlement de tournoi applicable", () => {
    render(
      <PspPoolPanel
        teamId="T1"
        state={{ ...FREE, pool: 20, remaining: 20 }}
        onChange={vi.fn()}
        tournamentLabel="NAF World Cup"
      />,
    );
    expect(screen.getByTestId("psp-pool-tournament").textContent).toContain(
      "NAF World Cup",
    );
  });
});
