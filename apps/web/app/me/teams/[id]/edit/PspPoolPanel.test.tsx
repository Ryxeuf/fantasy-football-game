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
const saveInitialBudget = vi.fn();
vi.mock("./psp-pool-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./psp-pool-client")>();
  return {
    ...actual,
    savePspPool: (...args: unknown[]) => savePspPool(...args),
    saveInitialBudget: (...args: unknown[]) => saveInitialBudget(...args),
  };
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

describe("PspPoolPanel — repli de l'édition avancée", () => {
  it("replie le panneau quand on éteint l'interrupteur", () => {
    // Régression : `state.pool > 0` rouvrait le corps quoi qu'on clique, et
    // l'interrupteur paraissait mort.
    render(
      <PspPoolPanel
        teamId="T1"
        state={{ ...FREE, pool: 66, spent: 66, initialBudget: 1180 }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("psp-pool-total")).toBeTruthy();

    fireEvent.click(screen.getByTestId("edit-advanced-toggle"));

    expect(screen.queryByTestId("psp-pool-total")).toBeNull();
    expect(screen.queryByTestId("psp-pool-input")).toBeNull();
    expect(screen.queryByTestId("initial-budget-input")).toBeNull();
  });

  it("garde le corps visible, sans interrupteur, quand tout est imposé", () => {
    render(
      <PspPoolPanel
        teamId="T1"
        state={{
          ...FREE,
          pool: 66,
          spent: 66,
          locked: true,
          lockedBy: "tournament",
          initialBudget: 1180,
          budgetLocked: true,
          budgetLockedBy: "tournament",
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("edit-advanced-toggle")).toBeNull();
    expect(screen.getByTestId("psp-pool-total").textContent).toBe("66");
  });
});

describe("PspPoolPanel — valeurs imposées par le règlement", () => {
  it("verrouille pool ET budget sous un règlement de tournoi", () => {
    render(
      <PspPoolPanel
        teamId="T1"
        state={{
          ...FREE,
          pool: 66,
          spent: 66,
          locked: true,
          lockedBy: "tournament",
          initialBudget: 1180,
          budgetLocked: true,
          budgetLockedBy: "tournament",
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("psp-pool-input")).toBeNull();
    expect(screen.queryByTestId("initial-budget-input")).toBeNull();
    expect(screen.getByTestId("psp-pool-locked").textContent).toContain(
      "règlement de tournoi",
    );
    expect(screen.getByTestId("initial-budget-locked").textContent).toContain(
      "1180",
    );
  });

  it("laisse pool ET budget réglables sans règlement ni coupe", async () => {
    const next = { ...FREE, pool: 20, remaining: 20, initialBudget: 1200 };
    saveInitialBudget.mockResolvedValue(next);
    const onChange = vi.fn();

    render(
      <PspPoolPanel
        teamId="T1"
        state={{ ...FREE, pool: 20, remaining: 20, initialBudget: 1000 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId("initial-budget-input"), {
      target: { value: "1200" },
    });
    fireEvent.click(screen.getByTestId("initial-budget-save"));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(next));
    expect(saveInitialBudget).toHaveBeenCalledWith("T1", 1200);
  });

  it("affiche l'erreur serveur d'un budget sous l'or déjà engagé", async () => {
    saveInitialBudget.mockRejectedValue(
      new Error("995k po sont déjà engagés : retire des joueurs"),
    );
    render(
      <PspPoolPanel
        teamId="T1"
        state={{ ...FREE, pool: 20, remaining: 20, initialBudget: 1000 }}
        onChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("initial-budget-input"), {
      target: { value: "900" },
    });
    fireEvent.click(screen.getByTestId("initial-budget-save"));

    await waitFor(() =>
      expect(screen.getByTestId("initial-budget-error").textContent).toContain(
        "déjà engagés",
      ),
    );
  });

  it("n'affiche pas de ligne budget si le serveur ne le sert pas encore", () => {
    // Rétro-compat : web déployé avant serveur.
    render(
      <PspPoolPanel
        teamId="T1"
        state={{ ...FREE, pool: 20, remaining: 20 }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("initial-budget-input")).toBeNull();
    expect(screen.getByTestId("psp-pool-input")).toBeTruthy();
  });
});
