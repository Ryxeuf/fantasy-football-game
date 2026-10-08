import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SheetEntryModeField } from "./SheetEntryModeField";

describe("SheetEntryModeField", () => {
  it("coche le mode courant et présente la saisie simplifiée comme recommandée", () => {
    render(<SheetEntryModeField value="simplified" onChange={() => {}} />);
    const simplified = screen.getByTestId(
      "sheet-entry-mode-simplified",
    ) as HTMLInputElement;
    const full = screen.getByTestId("sheet-entry-mode-full") as HTMLInputElement;
    expect(simplified.checked).toBe(true);
    expect(full.checked).toBe(false);
    expect(screen.getByTestId("sheet-entry-mode-field").textContent).toContain(
      "recommandé",
    );
  });

  it("remonte le mode choisi", () => {
    const onChange = vi.fn();
    render(<SheetEntryModeField value="simplified" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("sheet-entry-mode-full"));
    expect(onChange).toHaveBeenCalledWith("full");
  });

  it("dit que le réglage se change à tout moment et renvoie à l'aide", () => {
    render(<SheetEntryModeField value="full" onChange={() => {}} />);
    expect(screen.getByTestId("sheet-entry-mode-field").textContent).toContain(
      "à tout moment",
    );
    expect(
      screen.getByTestId("sheet-entry-mode-help").getAttribute("href"),
    ).toBe("/aide#saisie-de-coupe");
  });

  it("se désactive avec le formulaire", () => {
    render(<SheetEntryModeField value="full" onChange={() => {}} disabled />);
    expect(
      (screen.getByTestId("sheet-entry-mode-simplified") as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });
});
