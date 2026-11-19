import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LanguageSwitcher from "./LanguageSwitcher";

const setLanguage = vi.fn();
let currentLanguage: "fr" | "en" = "fr";

vi.mock("../contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: currentLanguage, setLanguage }),
}));

/** Indicateurs régionaux Unicode : les emoji de drapeaux, que Windows n'affiche pas. */
const FLAG_EMOJI = /[\u{1F1E6}-\u{1F1FF}]/u;

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    setLanguage.mockReset();
    currentLanguage = "fr";
  });

  it("affiche le drapeau de la langue courante en image, sans emoji", () => {
    const { container } = render(<LanguageSwitcher />);
    expect(screen.getByTestId("flag-fr").tagName.toLowerCase()).toBe("svg");
    expect(container.textContent ?? "").not.toMatch(FLAG_EMOJI);
  });

  it("suit la langue courante", () => {
    currentLanguage = "en";
    render(<LanguageSwitcher />);
    expect(screen.getByTestId("flag-en")).toBeTruthy();
    expect(screen.queryByTestId("flag-fr")).toBeNull();
  });

  it("propose les deux langues avec leur drapeau en image et applique le choix", () => {
    const { container } = render(<LanguageSwitcher />);
    fireEvent.click(screen.getByLabelText("Sélecteur de langue"));

    expect(screen.getAllByTestId("flag-fr")).toHaveLength(2); // bouton + option
    expect(screen.getAllByTestId("flag-en")).toHaveLength(1);
    expect(container.textContent ?? "").not.toMatch(FLAG_EMOJI);

    fireEvent.click(screen.getByText("English"));
    expect(setLanguage).toHaveBeenCalledWith("en");
    expect(screen.queryByText("English")).toBeNull(); // menu refermé
  });
});
