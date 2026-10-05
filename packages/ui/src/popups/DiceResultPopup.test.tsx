import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DiceResult } from "@bb/game-engine";
import DiceResultPopup from "./DiceResultPopup";
import { DiceSkinProvider } from "../dice/DiceSkinContext";
import { getDiceSkin } from "../dice/skins";

const result: DiceResult = {
  type: "dodge",
  playerId: "p1",
  diceRoll: 4,
  targetNumber: 3,
  success: true,
  modifiers: 0,
};

describe("DiceResultPopup", () => {
  it("dessine le jet en dé à points (dé original hors provider)", () => {
    const { container } = render(<DiceResultPopup result={result} onClose={vi.fn()} />);
    const die = screen.getByRole("img", { name: "Jet : 4" });
    expect(die).toHaveAttribute("data-dice-theme", "nuffle");
    expect(container.querySelectorAll("[data-pip]")).toHaveLength(4);
    expect(screen.getByText("✅ Réussi !")).toBeInTheDocument();
  });

  it("suit le thème de dés du coach", () => {
    render(
      <DiceSkinProvider skin={getDiceSkin("skavens")}>
        <DiceResultPopup result={{ ...result, diceRoll: 1, success: false }} onClose={vi.fn()} />
      </DiceSkinProvider>,
    );
    expect(screen.getByRole("img", { name: "Jet : 1" })).toHaveAttribute("data-dice-theme", "skavens");
    expect(screen.getByText("TURNOVER !")).toBeInTheDocument();
  });

  it("un jet d'armure (2D6) s'affiche chiffré, même sous 7", () => {
    const { container } = render(
      <DiceResultPopup result={{ ...result, type: "armor", diceRoll: 5, targetNumber: 9 }} onClose={vi.fn()} />,
    );
    expect(container.querySelectorAll("[data-pip]")).toHaveLength(0);
    expect(container.querySelector("[data-die-value]")?.textContent).toBe("5");
  });
});
