/**
 * Grille de cases à cocher des écrans d'admin d'un roster.
 *
 * Écrit après un rapport « décocher fonctionne, cocher non » : le geste
 * réel de l'utilisateur est un clic sur le LIBELLÉ (l'input est enveloppé
 * dans un <label>), pas sur la case. Un libellé mal associé, ou une case
 * qui bascule deux fois, se verrait ici et pas dans un test qui clique
 * directement sur l'input.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlugCheckboxGrid, toggleSlug, parseSlugList } from "./SlugCheckboxGrid";

const CATALOG = [
  { slug: "alpha", label: "Alpha" },
  { slug: "beta", label: "Beta" },
];

function renderGrid(selected: string[]) {
  const onToggle = vi.fn();
  render(
    <SlugCheckboxGrid
      catalog={CATALOG}
      selected={selected}
      onToggle={onToggle}
      testId="grid"
    />,
  );
  return onToggle;
}

describe("SlugCheckboxGrid", () => {
  it("AJOUT : cocher une case non sélectionnée remonte le slug une seule fois", () => {
    const onToggle = renderGrid([]);
    fireEvent.click(screen.getByTestId("grid-alpha"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("alpha");
  });

  it("AJOUT via le libellé : un clic sur le texte ne bascule qu'une fois", () => {
    const onToggle = renderGrid([]);
    // Le <label> enveloppe l'input : cliquer le texte doit produire UN
    // seul changement (sinon la case se coche puis se décoche aussitôt,
    // ce qui donne exactement « l'ajout ne fonctionne pas »).
    fireEvent.click(screen.getByText("Alpha"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("alpha");
  });

  it("SUPPRESSION : décocher une case sélectionnée remonte le slug", () => {
    const onToggle = renderGrid(["alpha"]);
    expect(
      (screen.getByTestId("grid-alpha") as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(screen.getByTestId("grid-alpha"));
    expect(onToggle).toHaveBeenCalledWith("alpha");
  });

  it("conserve et coche un slug hors catalogue", () => {
    renderGrid(["gamma"]);
    const extra = screen.getByTestId("grid-gamma") as HTMLInputElement;
    expect(extra.checked).toBe(true);
    expect(screen.getByText(/hors catalogue/)).toBeTruthy();
  });

  it("n'affiche pas deux fois un slug à la fois sélectionné et au catalogue", () => {
    renderGrid(["alpha"]);
    expect(screen.getAllByTestId("grid-alpha")).toHaveLength(1);
  });
});

describe("toggleSlug", () => {
  it("ajoute un slug absent, sans muter la liste d'origine", () => {
    const before = ["alpha"];
    const after = toggleSlug(before, "beta");
    expect(after).toEqual(["alpha", "beta"]);
    expect(before).toEqual(["alpha"]);
  });

  it("retire un slug présent", () => {
    expect(toggleSlug(["alpha", "beta"], "alpha")).toEqual(["beta"]);
  });
});

describe("parseSlugList", () => {
  it("accepte tableau, JSON sérialisé et CSV", () => {
    expect(parseSlugList(["a", "b"])).toEqual(["a", "b"]);
    expect(parseSlugList('["a","b"]')).toEqual(["a", "b"]);
    expect(parseSlugList("a, b")).toEqual(["a", "b"]);
  });

  it("renvoie une liste vide pour null, undefined ou chaîne vide", () => {
    expect(parseSlugList(null)).toEqual([]);
    expect(parseSlugList(undefined)).toEqual([]);
    expect(parseSlugList("   ")).toEqual([]);
  });
});
