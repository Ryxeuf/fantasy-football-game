import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { PlayStyleSelector } from "./PlayStyleSelector";

describe("PlayStyleSelector", () => {
  it("affiche les 4 styles et marque l'actif", () => {
    render(<PlayStyleSelector value="offensive" onChange={() => {}} />);

    for (const style of ["balanced", "offensive", "air_raid", "defensive"]) {
      expect(screen.getByTestId(`play-style-option-${style}`)).toBeTruthy();
    }
    expect(
      screen
        .getByTestId("play-style-option-offensive")
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByTestId("play-style-option-balanced")
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("coerce une valeur invalide vers balanced", () => {
    render(<PlayStyleSelector value="garbage" onChange={() => {}} />);
    expect(
      screen
        .getByTestId("play-style-option-balanced")
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("appelle onChange avec le style clique", () => {
    const onChange = vi.fn();
    render(<PlayStyleSelector value="balanced" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("play-style-option-air_raid"));
    expect(onChange).toHaveBeenCalledWith("air_raid");
  });

  it("affiche les plafonds du style actif (air_raid : 6 receveurs max)", () => {
    render(<PlayStyleSelector value="air_raid" onChange={() => {}} />);
    expect(screen.getByTitle(/WR\/TE : 6 max/)).toBeTruthy();
    expect(screen.getByText(/Linemen \/ défense ∞/)).toBeTruthy();
  });

  it("desactive les boutons quand disabled", () => {
    const onChange = vi.fn();
    render(<PlayStyleSelector value="balanced" onChange={onChange} disabled />);
    const opt = screen.getByTestId(
      "play-style-option-offensive",
    ) as HTMLButtonElement;
    expect(opt.disabled).toBe(true);
    fireEvent.click(opt);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("affiche l'indicateur d'enregistrement", () => {
    render(<PlayStyleSelector value="balanced" onChange={() => {}} saving />);
    expect(screen.getByText("Enregistrement…")).toBeTruthy();
  });
});
