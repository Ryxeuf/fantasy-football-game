import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import SearchClient from "./SearchClient";
import type { SearchRecord } from "./search";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

const RECORDS: SearchRecord[] = [
  {
    id: "rule:blessures",
    type: "rule",
    title: "Blessures",
    subtitle: "Règles",
    text: "Jet d'armure puis jet de blessure.",
    url: "/compendium/blessures",
  },
  {
    id: "skill:blocage",
    type: "skill",
    title: "Blocage",
    subtitle: "Compétence",
    text: "Relance un blocage raté.",
    url: "/skills/blocage",
  },
];

describe("SearchClient", () => {
  it("affiche une invite tant que la requête est vide", () => {
    render(<SearchClient records={RECORDS} />);
    expect(screen.queryByTestId("search-results")).toBeNull();
    expect(screen.getByTestId("search-input")).toBeTruthy();
  });

  it("affiche les résultats correspondants avec lien profond", () => {
    render(<SearchClient records={RECORDS} />);
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "blessures" },
    });
    const results = screen.getByTestId("search-results");
    const link = within(results).getByRole("link", { name: /Blessures/i });
    expect(link.getAttribute("href")).toBe("/compendium/blessures");
  });

  it("filtre par type", () => {
    render(<SearchClient records={RECORDS} />);
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "bl" },
    });
    // Les deux types sont présents au départ.
    expect(screen.getByTestId("search-count").textContent).toMatch(/2 résultat/);
    // Filtre sur Compétences.
    fireEvent.click(screen.getByRole("tab", { name: /Compétences/i }));
    const results = screen.getByTestId("search-results");
    const hrefs = within(results)
      .getAllByRole("link")
      .map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/skills/blocage");
    expect(hrefs).not.toContain("/compendium/blessures");
  });
});
