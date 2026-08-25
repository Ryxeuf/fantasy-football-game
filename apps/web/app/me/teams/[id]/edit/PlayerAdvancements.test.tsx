/**
 * Annulation d'une amélioration achetée (compétence ou caractéristique).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PlayerAdvancements from "./PlayerAdvancements";

const removeAdvancement = vi.fn();
vi.mock("./psp-pool-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./psp-pool-client")>();
  return {
    ...actual,
    removeAdvancement: (...args: unknown[]) => removeAdvancement(...args),
  };
});

const SKILL_NAMES = new Map([
  ["block", "Blocage"],
  ["dodge", "Esquive"],
]);

const ADVANCEMENTS = [
  { type: "primary", skillSlug: "block", pspCost: 6, fundedBy: "pool" as const },
  { type: "characteristic", stat: "ma", pspCost: 14, fundedBy: "pool" as const },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PlayerAdvancements", () => {
  it("ne rend rien pour un joueur sans amélioration", () => {
    const { container } = render(
      <PlayerAdvancements
        teamId="T1"
        playerId="P1"
        advancements={[]}
        skillNames={SKILL_NAMES}
        onRemoved={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("liste chaque amélioration avec son nom et son coût", () => {
    render(
      <PlayerAdvancements
        teamId="T1"
        playerId="P1"
        advancements={ADVANCEMENTS}
        skillNames={SKILL_NAMES}
        onRemoved={vi.fn()}
      />,
    );
    const panel = screen.getByTestId("player-advancements-P1");
    expect(panel.textContent).toContain("Blocage (Principale)");
    expect(panel.textContent).toContain("6 PSP");
    expect(panel.textContent).toContain("Caractéristique +1 MA");
  });

  it("annule l'amélioration ciblée et remonte le joueur mis à jour", async () => {
    const updated = { skills: "", advancements: "[]", spp: 0 };
    removeAdvancement.mockResolvedValue({
      player: updated,
      refunded: 6,
      refundedTo: "pool",
    });
    const onRemoved = vi.fn();

    render(
      <PlayerAdvancements
        teamId="T1"
        playerId="P1"
        advancements={ADVANCEMENTS}
        skillNames={SKILL_NAMES}
        onRemoved={onRemoved}
      />,
    );
    fireEvent.click(screen.getByTestId("remove-advancement-P1-1"));

    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith(updated));
    expect(removeAdvancement).toHaveBeenCalledWith("T1", "P1", 1);
  });

  it("affiche le refus du serveur sans casser la liste", async () => {
    removeAdvancement.mockRejectedValue(
      new Error("Cette équipe est engagée en compétition"),
    );
    render(
      <PlayerAdvancements
        teamId="T1"
        playerId="P1"
        advancements={ADVANCEMENTS}
        skillNames={SKILL_NAMES}
        onRemoved={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("remove-advancement-P1-0"));

    await waitFor(() =>
      expect(screen.getByTestId("advancement-error-P1").textContent).toContain(
        "engagée en compétition",
      ),
    );
  });

  it("désactive l'annulation quand l'édition est verrouillée", () => {
    render(
      <PlayerAdvancements
        teamId="T1"
        playerId="P1"
        advancements={ADVANCEMENTS}
        skillNames={SKILL_NAMES}
        onRemoved={vi.fn()}
        disabled
      />,
    );
    expect(
      (screen.getByTestId("remove-advancement-P1-0") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
