/**
 * E10 — l'allocateur d'améliorations au build permet d'empiler jusqu'à
 * DEUX compétences par joueur (coût croissant, 2e ≠ 1re).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BuildAdvancementAllocator, {
  type BuildAdvancement,
} from "./BuildAdvancementAllocator";

const apiRequest = vi.fn();
vi.mock("../../../lib/api-client", () => ({
  apiRequest: (path: string, init?: RequestInit) => apiRequest(path, init),
}));

const POSITIONS = [
  {
    slug: "custom_lineman",
    displayName: "Lineman",
    primarySkills: "G",
    secondarySkills: "A",
  },
];

const CATALOG = {
  skills: [
    { slug: "block", nameFr: "Blocage", category: "General" },
    { slug: "tackle", nameFr: "Tacle", category: "General" },
    { slug: "dodge", nameFr: "Esquive", category: "Agility" },
  ],
};

function Harness({ initial = [] as BuildAdvancement[] }) {
  let current = initial;
  const Wrapper = () => {
    const [value, setValue] = (require("react") as typeof import("react")).useState(
      current,
    );
    return (
      <BuildAdvancementAllocator
        ruleset="season_3"
        positions={POSITIONS}
        counts={{ custom_lineman: 1 }}
        pool={30}
        value={value}
        onChange={setValue}
      />
    );
  };
  return <Wrapper />;
}

describe("E10 — BuildAdvancementAllocator (empilement 2 compétences)", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue(CATALOG);
  });

  it("permet une 2e compétence après la 1re, filtrée pour éviter le doublon", async () => {
    render(<Harness />);
    // Slot 0 disponible au départ, pas de slot 1.
    const slot0 = await screen.findByTestId(
      "allocator-skill-custom_lineman-0-0",
    );
    expect(
      screen.queryByTestId("allocator-skill-custom_lineman-0-1"),
    ).toBeNull();

    // Choisit Blocage sur le slot 0 → le slot 1 apparaît.
    await waitFor(() =>
      expect(
        (slot0 as HTMLSelectElement).querySelectorAll("option").length,
      ).toBeGreaterThan(1),
    );
    fireEvent.change(slot0, { target: { value: "block" } });
    const slot1 = await screen.findByTestId(
      "allocator-skill-custom_lineman-0-1",
    );

    // Le slot 1 ne propose plus Blocage (déjà pris), mais Tacle oui.
    const slot1Options = Array.from(
      (slot1 as HTMLSelectElement).querySelectorAll("option"),
    ).map((o) => o.getAttribute("value"));
    expect(slot1Options).not.toContain("block");
    expect(slot1Options).toContain("tackle");

    // Choisit Tacle en 2e : pool 30 - 6 (palier 1) - 8 (palier 2) = 16.
    fireEvent.change(slot1, { target: { value: "tackle" } });
    await waitFor(() =>
      expect(screen.getByTestId("allocator-remaining").textContent).toBe("16"),
    );

    // Pas de 3e slot (max 2).
    expect(
      screen.queryByTestId("allocator-skill-custom_lineman-0-2"),
    ).toBeNull();
  });
});
