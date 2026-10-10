import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import BuildInducementPicker from "./BuildInducementPicker";
import type { BuildInducementOption } from "./build-inducements";

const OPTIONS: BuildInducementOption[] = [
  { slug: "team_mascot", name: "Mascotte d'Équipe", cost: 25_000, maxQuantity: 1, description: "" },
  { slug: "bloodweiser_kegs", name: "Fûts de Blitz Premium", cost: 50_000, maxQuantity: 2, description: "+1 au rétablissement des K.-O." },
];

describe("BuildInducementPicker", () => {
  it("liste le catalogue servi avec prix et plafond", () => {
    render(
      <BuildInducementPicker
        options={OPTIONS}
        selection={{}}
        onChange={vi.fn()}
        availableBudgetK={500}
      />,
    );
    expect(screen.getByTestId("build-inducements")).toBeTruthy();
    expect(
      screen.getByTestId("build-inducement-bloodweiser_kegs").textContent,
    ).toMatch(/50k · 0-2/);
    expect(screen.getByTestId("build-inducements-total").textContent).toBe("0k");
  });

  it("ajoute une unité et annonce le total", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <BuildInducementPicker
        options={OPTIONS}
        selection={{}}
        onChange={onChange}
        availableBudgetK={500}
      />,
    );
    fireEvent.click(screen.getByTestId("build-inducement-bloodweiser_kegs-plus"));
    expect(onChange).toHaveBeenCalledWith({ bloodweiser_kegs: 1 });

    rerender(
      <BuildInducementPicker
        options={OPTIONS}
        selection={{ bloodweiser_kegs: 2 }}
        onChange={onChange}
        availableBudgetK={500}
      />,
    );
    expect(screen.getByTestId("build-inducements-total").textContent).toBe("100k");
  });

  it("bloque l'ajout au plafond et quand le budget ne suffit pas", () => {
    render(
      <BuildInducementPicker
        options={OPTIONS}
        selection={{ team_mascot: 1 }}
        onChange={vi.fn()}
        availableBudgetK={60}
      />,
    );
    // Plafond de la Mascotte atteint.
    expect(
      (screen.getByTestId("build-inducement-team_mascot-plus") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    // 60k − 25k = 35k restants : un Fût à 50k ne passe pas.
    expect(
      (screen.getByTestId("build-inducement-bloodweiser_kegs-plus") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("retire une unité", () => {
    const onChange = vi.fn();
    render(
      <BuildInducementPicker
        options={OPTIONS}
        selection={{ bloodweiser_kegs: 2 }}
        onChange={onChange}
        availableBudgetK={500}
      />,
    );
    fireEvent.click(screen.getByTestId("build-inducement-bloodweiser_kegs-minus"));
    expect(onChange).toHaveBeenCalledWith({ bloodweiser_kegs: 1 });
  });

  it("affiche le rappel du règlement", () => {
    render(
      <BuildInducementPicker
        options={OPTIONS}
        selection={{}}
        onChange={vi.fn()}
        availableBudgetK={500}
        hint="NAF World Cup 2027 : l'or non dépensé à la création est perdu."
      />,
    );
    expect(screen.getByTestId("build-inducements-hint").textContent).toMatch(
      /non dépensé/,
    );
  });
});
