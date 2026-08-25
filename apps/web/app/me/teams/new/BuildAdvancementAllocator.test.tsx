/**
 * Allocateur d'améliorations au build : parcours complet du sélecteur
 * (feuille + recherche + catégories), contraintes de sélection et barème du
 * règlement de tournoi.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BuildAdvancementAllocator from "./BuildAdvancementAllocator";
import type {
  BuildAdvancement,
  AllocatorPosition,
} from "./build-advancement-rules";

const apiRequest = vi.fn();
vi.mock("../../../lib/api-client", () => ({
  apiRequest: (path: string, init?: RequestInit) => apiRequest(path, init),
}));

const POSITIONS: AllocatorPosition[] = [
  {
    slug: "custom_lineman",
    displayName: "Trois-quart",
    // Tacle est déjà sur la fiche du poste : il ne doit pas être proposable.
    skills: "tackle",
    primarySkills: "G",
    secondarySkills: "A",
  },
];

const CATALOG = {
  skills: [
    { slug: "block", nameFr: "Blocage", category: "General", isElite: true },
    { slug: "tackle", nameFr: "Tacle", category: "General" },
    { slug: "frenzy", nameFr: "Frénésie", category: "General" },
    {
      slug: "pro",
      nameFr: "Pro",
      category: "General",
      excludedFromSelection: true,
    },
    { slug: "dodge", nameFr: "Esquive", category: "Agility", isElite: true },
  ],
};

function Harness(props: { pool?: number; counts?: Record<string, number> }) {
  const [value, setValue] = useState<BuildAdvancement[]>([]);
  return (
    <BuildAdvancementAllocator
      ruleset="season_3"
      positions={POSITIONS}
      counts={props.counts ?? { custom_lineman: 1 }}
      pool={props.pool ?? 30}
      value={value}
      onChange={setValue}
    />
  );
}

/** Ouvre la feuille de sélection du joueur donné. */
async function openPicker(slug = "custom_lineman", ordinal = 0) {
  fireEvent.click(await screen.findByTestId(`allocator-add-${slug}-${ordinal}`));
  return screen.findByTestId("skill-picker");
}

describe("BuildAdvancementAllocator", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue(CATALOG);
  });

  it("achète une compétence via la feuille et décompte le pool", async () => {
    render(<Harness />);
    await openPicker();

    // Principale (accès G) : Blocage proposé, Esquive (Agilité) non.
    expect(screen.getByTestId("skill-picker-option-block")).toBeTruthy();
    expect(screen.queryByTestId("skill-picker-option-dodge")).toBeNull();

    fireEvent.click(screen.getByTestId("skill-picker-option-block"));

    await waitFor(() =>
      expect(screen.getByTestId("allocator-remaining").textContent).toBe("24"),
    );
    // La feuille se referme et la compétence apparaît sur la carte du joueur.
    expect(screen.queryByTestId("skill-picker")).toBeNull();
    expect(
      screen.getByTestId("allocator-pick-custom_lineman-0-0").textContent,
    ).toContain("Blocage");
    // Élite : le surcoût de Valeur d'Équipe est annoncé (20 000 + 10 000).
    // `toLocaleString` sépare les milliers par une espace insécable.
    expect(
      screen.getByTestId("allocator-ve").textContent?.replace(/\s/g, " "),
    ).toContain("30 000 po");
  });

  it("interdit une compétence déjà sur la fiche du poste", async () => {
    render(<Harness />);
    await openPicker();
    const tackle = screen.getByTestId(
      "skill-picker-option-tackle",
    ) as HTMLButtonElement;
    expect(tackle.disabled).toBe(true);
    expect(tackle.textContent).toContain("Déjà sur la fiche du poste");
  });

  it("interdit une compétence retirée de la sélection", async () => {
    render(<Harness />);
    await openPicker();
    expect(
      (screen.getByTestId("skill-picker-option-pro") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("interdit de reprendre la même compétence sur un joueur", async () => {
    render(<Harness />);
    await openPicker();
    fireEvent.click(screen.getByTestId("skill-picker-option-block"));
    await waitFor(() => expect(screen.queryByTestId("skill-picker")).toBeNull());

    await openPicker();
    const block = screen.getByTestId(
      "skill-picker-option-block",
    ) as HTMLButtonElement;
    expect(block.disabled).toBe(true);
    expect(block.textContent).toContain("Déjà choisie pour ce joueur");
    // Le 2e palier est facturé 8 PSP (barème BB2025).
    expect(screen.getByTestId("skill-picker-type-primary").textContent).toContain(
      "8 PSP",
    );
  });

  it("plafonne à 2 compétences par joueur", async () => {
    render(<Harness />);
    await openPicker();
    fireEvent.click(screen.getByTestId("skill-picker-option-block"));
    await waitFor(() => expect(screen.queryByTestId("skill-picker")).toBeNull());
    await openPicker();
    fireEvent.click(screen.getByTestId("skill-picker-option-frenzy"));

    await waitFor(() =>
      expect(
        (
          screen.getByTestId(
            "allocator-add-custom_lineman-0",
          ) as HTMLButtonElement
        ).disabled,
      ).toBe(true),
    );
    expect(
      screen.getByTestId("allocator-add-custom_lineman-0").textContent,
    ).toContain("maximum");
  });

  it("filtre par recherche et par catégorie", async () => {
    render(<Harness />);
    await openPicker();

    fireEvent.change(screen.getByTestId("skill-picker-search"), {
      target: { value: "fré" },
    });
    await waitFor(() =>
      expect(screen.queryByTestId("skill-picker-option-block")).toBeNull(),
    );
    expect(screen.getByTestId("skill-picker-option-frenzy")).toBeTruthy();

    // Le type Secondaire n'ouvre que l'Agilité pour ce poste.
    fireEvent.change(screen.getByTestId("skill-picker-search"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByTestId("skill-picker-type-secondary"));
    await waitFor(() =>
      expect(screen.getByTestId("skill-picker-option-dodge")).toBeTruthy(),
    );
    expect(screen.queryByTestId("skill-picker-option-block")).toBeNull();
    expect(screen.getByTestId("skill-picker-cat-A")).toBeTruthy();
    expect(screen.queryByTestId("skill-picker-cat-G")).toBeNull();
  });

  it("bloque l'achat quand le pool ne suffit plus", async () => {
    render(<Harness pool={6} />);
    await openPicker();
    // Secondaire (10 PSP) est hors budget : le bouton est annoncé comme tel.
    expect(
      screen.getByTestId("skill-picker-type-secondary").textContent,
    ).toContain("hors budget");
    fireEvent.click(screen.getByTestId("skill-picker-option-block"));
    await waitFor(() =>
      expect(screen.getByTestId("allocator-remaining").textContent).toBe("0"),
    );
    expect(
      (
        screen.getByTestId("allocator-add-custom_lineman-0") as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("retire une compétence et rend les PSP", async () => {
    render(<Harness />);
    await openPicker();
    fireEvent.click(screen.getByTestId("skill-picker-option-block"));
    await waitFor(() =>
      expect(screen.getByTestId("allocator-remaining").textContent).toBe("24"),
    );
    fireEvent.click(screen.getByTestId("allocator-remove-custom_lineman-0-0"));
    await waitFor(() =>
      expect(screen.getByTestId("allocator-remaining").textContent).toBe("30"),
    );
  });
});
