import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CompendiumIndexPage from "./page";
import { chapters } from "./data";

describe("CompendiumIndexPage (rendu)", () => {
  it("rend le hero et une carte par chapitre, sans exposer la source", () => {
    render(<CompendiumIndexPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Compendium des règles/i }),
    ).toBeTruthy();

    // Une carte (lien) par chapitre.
    for (const c of chapters) {
      expect(screen.getByRole("link", { name: new RegExp(c.title, "i") })).toBeTruthy();
    }

    // La source ne doit plus apparaître (ni compteur de pages, ni chemin).
    expect(screen.queryByText(/pages? de règles/i)).toBeNull();
    expect(screen.queryByText(/docs\//i)).toBeNull();
  });
});
