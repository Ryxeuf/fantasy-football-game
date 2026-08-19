import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AideDeJeuClient } from "./AideDeJeuClient";

function setUrl(search: string): void {
  window.history.replaceState({}, "", `/aide-de-jeu${search}`);
}

describe("AideDeJeuClient", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setUrl("");
  });

  it("ouvre sur la phase d'avant-match", () => {
    render(<AideDeJeuClient />);
    expect(screen.getByRole("heading", { name: /Avant le match/ })).toBeTruthy();
    expect(screen.getByTestId("step-meteo")).toBeTruthy();
  });

  it("bascule vers la phase pendant le match", () => {
    render(<AideDeJeuClient />);
    fireEvent.click(screen.getByTestId("phase-tab-pendant"));

    expect(screen.getByRole("heading", { name: /Pendant le match/ })).toBeTruthy();
    expect(screen.getByTestId("step-turnover")).toBeTruthy();
    expect(screen.queryByTestId("step-meteo")).toBeNull();
  });

  it("bascule vers la phase d'après-match", () => {
    render(<AideDeJeuClient />);
    fireEvent.click(screen.getByTestId("phase-tab-apres"));
    expect(screen.getByTestId("step-erreurs")).toBeTruthy();
  });

  it("ouvre la fiche météo depuis une étape", () => {
    render(<AideDeJeuClient />);
    const step = screen.getByTestId("step-meteo");
    fireEvent.click(within(step).getByRole("button", { name: "2D6 Météo" }));

    const panel = screen.getByRole("dialog", { name: "Météo" });
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(within(panel).getByText("Blizzard")).toBeTruthy();
  });

  it("écrit la fiche ouverte dans l'URL", () => {
    render(<AideDeJeuClient />);
    fireEvent.click(screen.getByTestId("sheet-chip-contester"));

    expect(new URL(window.location.href).searchParams.get("fiche")).toBe("contester");
  });

  it("ouvre directement la fiche passée dans l'URL", () => {
    setUrl("?fiche=elimination");
    render(<AideDeJeuClient />);

    expect(
      screen.getByRole("dialog", { name: "Élimination & séquelles" }),
    ).toBeTruthy();
  });

  it("ignore une fiche inconnue sans casser la page", () => {
    setUrl("?fiche=fiche-inventee");
    render(<AideDeJeuClient />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: /Avant le match/ })).toBeTruthy();
  });

  it("rouvre le panneau quand l'historique revient sur une fiche", () => {
    render(<AideDeJeuClient />);
    fireEvent.click(screen.getByTestId("sheet-chip-meteo"));
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    setUrl("?fiche=meteo");
    fireEvent.popState(window);

    expect(screen.getByRole("dialog", { name: "Météo" })).toBeTruthy();
  });

  it("ferme la fiche et nettoie l'URL", () => {
    render(<AideDeJeuClient />);
    fireEvent.click(screen.getByTestId("sheet-chip-meteo"));
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(new URL(window.location.href).searchParams.has("fiche")).toBe(false);
  });

  it("ferme la fiche sur Escape", () => {
    render(<AideDeJeuClient />);
    fireEvent.click(screen.getByTestId("sheet-chip-meteo"));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("bascule d'onglet dans une fiche à variantes", () => {
    setUrl("?fiche=coup-d-envoi");
    render(<AideDeJeuClient />);
    const panel = screen.getByRole("dialog");

    expect(within(panel).getByText(/À mort l'arbitre/)).toBeTruthy();

    fireEvent.click(within(panel).getByRole("tab", { name: "Variante (D16)" }));
    expect(within(panel).getByText(/Trappe traîtresse/)).toBeTruthy();
  });

  it("propose les douze terrains dans la fiche météo", () => {
    setUrl("?fiche=meteo");
    render(<AideDeJeuClient />);
    const panel = screen.getByRole("dialog");
    expect(within(panel).getAllByRole("tab")).toHaveLength(12);
  });

  it("coche une étape d'avant-match et met le compteur à jour", () => {
    render(<AideDeJeuClient />);
    const step = screen.getByTestId("step-meteo");

    fireEvent.click(within(step).getByRole("button", { name: /Cocher/ }));

    expect(within(step).getByRole("button", { name: /Décocher/ })).toBeTruthy();
    expect(screen.getByText("1 / 6")).toBeTruthy();
  });

  it("réinitialise la checklist d'avant-match", () => {
    render(<AideDeJeuClient />);
    const step = screen.getByTestId("step-meteo");
    fireEvent.click(within(step).getByRole("button", { name: /Cocher/ }));
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));

    expect(screen.getByText("0 / 6")).toBeTruthy();
  });

  it("garde des checklists distinctes pour l'avant et l'après-match", () => {
    render(<AideDeJeuClient />);
    fireEvent.click(
      within(screen.getByTestId("step-meteo")).getByRole("button", { name: /Cocher/ }),
    );

    fireEvent.click(screen.getByTestId("phase-tab-apres"));
    expect(screen.getByText("0 / 5")).toBeTruthy();
  });

  it("n'affiche les actions du tour que pendant le match", () => {
    render(<AideDeJeuClient />);
    expect(screen.queryByTestId("turn-action-blitz")).toBeNull();

    fireEvent.click(screen.getByTestId("phase-tab-pendant"));
    const blitz = screen.getByTestId("turn-action-blitz");
    expect(blitz.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(blitz);
    expect(screen.getByTestId("turn-action-blitz").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("expose toutes les tables en accès direct", () => {
    render(<AideDeJeuClient />);
    expect(screen.getByTestId("sheet-chip-prieres-nuffle")).toBeTruthy();
    expect(screen.getByTestId("sheet-chip-erreurs-couteuses")).toBeTruthy();
  });
});
