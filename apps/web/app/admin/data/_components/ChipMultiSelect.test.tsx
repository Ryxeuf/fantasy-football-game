/**
 * Sélecteur générique « chips + recherche » des formulaires admin data.
 * L'UX de référence est celle du sélecteur de compétences des positions.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ChipMultiSelect, type ChipOption } from "./ChipMultiSelect";
import { SkillMultiSelect } from "./SkillMultiSelect";

const OPTIONS: ChipOption[] = [
  { value: "block", label: "Blocage", sublabel: "Block", group: "General" },
  { value: "dodge", label: "Esquive", sublabel: "Dodge", group: "Agility" },
  { value: "mighty-blow", label: "Châtaigne", group: "Strength" },
];

const GROUPS = {
  General: { label: "Général", chipClass: "bg-blue-100 text-blue-800 border-blue-300" },
  Agility: { label: "Agilité", chipClass: "bg-green-100 text-green-800 border-green-300" },
  Strength: { label: "Force", chipClass: "bg-red-100 text-red-800 border-red-300" },
};

function renderSelect(
  selected: string[],
  onChange = vi.fn(),
  options: ChipOption[] = OPTIONS,
) {
  render(
    <ChipMultiSelect
      options={options}
      selected={selected}
      onChange={onChange}
      groups={GROUPS}
      testId="pick"
    />,
  );
  return onChange;
}

describe("ChipMultiSelect", () => {
  it("affiche les valeurs sélectionnées en chips retirables", () => {
    const onChange = renderSelect(["block", "dodge"]);

    expect(screen.getByTestId("pick-chip-block")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retirer Blocage" }));

    expect(onChange).toHaveBeenCalledWith(["dodge"]);
  });

  it("ajoute une valeur depuis les suggestions et vide la recherche", () => {
    const onChange = renderSelect([]);
    const search = screen.getByTestId("pick-search");

    fireEvent.change(search, { target: { value: "esqui" } });
    fireEvent.click(screen.getByTestId("pick-option-dodge"));

    expect(onChange).toHaveBeenCalledWith(["dodge"]);
    expect((search as HTMLInputElement).value).toBe("");
  });

  it("n'offre pas en suggestion une valeur déjà sélectionnée", () => {
    renderSelect(["block"]);
    fireEvent.focus(screen.getByTestId("pick-search"));

    expect(screen.queryByTestId("pick-option-block")).toBeNull();
    expect(screen.getByTestId("pick-option-dodge")).toBeTruthy();
  });

  it("filtre les suggestions par la recherche (label, valeur ou sous-libellé)", () => {
    renderSelect([]);
    const search = screen.getByTestId("pick-search");

    fireEvent.change(search, { target: { value: "Dodge" } });
    expect(screen.getByTestId("pick-option-dodge")).toBeTruthy();
    expect(screen.queryByTestId("pick-option-block")).toBeNull();
  });

  it("filtre les suggestions par groupe", () => {
    renderSelect([]);
    fireEvent.click(screen.getByRole("button", { name: "Force" }));
    fireEvent.focus(screen.getByTestId("pick-search"));

    expect(screen.getByTestId("pick-option-mighty-blow")).toBeTruthy();
    expect(screen.queryByTestId("pick-option-block")).toBeNull();
  });

  it("conserve et affiche « hors catalogue » une valeur sélectionnée inconnue", () => {
    const onChange = renderSelect(["piling-on", "block"]);

    const chip = screen.getByTestId("pick-chip-piling-on");
    expect(within(chip).getByText(/hors catalogue/)).toBeTruthy();

    // La retirer est possible, mais elle n'est jamais perdue autrement.
    fireEvent.click(screen.getByRole("button", { name: "Retirer piling-on" }));
    expect(onChange).toHaveBeenCalledWith(["block"]);
  });

  it("masque les filtres de groupe quand le catalogue n'est pas groupé", () => {
    render(
      <ChipMultiSelect
        options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]}
        selected={[]}
        onChange={vi.fn()}
        testId="flat"
      />,
    );
    expect(screen.queryByRole("button", { name: "Toutes" })).toBeNull();
  });

  it("dédoublonne les options par valeur", () => {
    renderSelect([], vi.fn(), [...OPTIONS, { value: "block", label: "Doublon" }]);
    fireEvent.focus(screen.getByTestId("pick-search"));

    expect(screen.getAllByTestId("pick-option-block")).toHaveLength(1);
  });
});

describe("SkillMultiSelect", () => {
  it("mappe un catalogue de compétences vers les chips par catégorie", () => {
    const onChange = vi.fn();
    render(
      <SkillMultiSelect
        skills={[
          { slug: "block", nameFr: "Blocage", nameEn: "Block", category: "General" },
          { slug: "dodge", nameFr: "Esquive", nameEn: "Dodge", category: "Agility" },
        ]}
        selectedSlugs={["block"]}
        onChange={onChange}
        testId="skills"
      />,
    );

    expect(screen.getByTestId("skills-chip-block")).toBeTruthy();

    fireEvent.focus(screen.getByTestId("skills-search"));
    fireEvent.click(screen.getByTestId("skills-option-dodge"));
    expect(onChange).toHaveBeenCalledWith(["block", "dodge"]);
  });
});
