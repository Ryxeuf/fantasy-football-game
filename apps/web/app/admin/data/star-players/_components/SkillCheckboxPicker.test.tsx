/**
 * Grille de compétences en cases à cocher (formulaires Star Player).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { SkillCheckboxPicker } from "./SkillCheckboxPicker";

const SKILLS = [
  { slug: "block", nameFr: "Blocage", nameEn: "Block", category: "General" },
  { slug: "dodge", nameFr: "Esquive", nameEn: "Dodge", category: "Agility" },
  { slug: "mighty-blow", nameFr: "Châtaigne", nameEn: "Mighty Blow", category: "Strength" },
];

function setup(selected: string[] = [], skills = SKILLS) {
  const onToggle = vi.fn();
  render(
    <SkillCheckboxPicker
      skills={skills}
      selected={selected}
      onToggle={onToggle}
    />,
  );
  return { onToggle };
}

const box = (slug: string) =>
  screen.getByTestId(`star-player-skills-${slug}`) as HTMLInputElement;

describe("SkillCheckboxPicker", () => {
  it("coche les compétences déjà sélectionnées", () => {
    setup(["dodge"]);
    expect(box("block").checked).toBe(false);
    expect(box("dodge").checked).toBe(true);
    expect(
      screen.getByTestId("star-player-skills-count").textContent,
    ).toContain("1");
  });

  it("remonte le slug coché puis décoché", () => {
    const { onToggle } = setup(["dodge"]);
    fireEvent.click(box("block"));
    fireEvent.click(box("dodge"));
    expect(onToggle).toHaveBeenNthCalledWith(1, "block");
    expect(onToggle).toHaveBeenNthCalledWith(2, "dodge");
  });

  it("filtre sur le nom, le slug ou le nom anglais", () => {
    setup();
    fireEvent.change(screen.getByTestId("star-player-skills-search"), {
      target: { value: "esqui" },
    });
    expect(screen.queryByTestId("star-player-skills-block")).toBeNull();
    expect(screen.getByTestId("star-player-skills-dodge")).toBeTruthy();

    fireEvent.change(screen.getByTestId("star-player-skills-search"), {
      target: { value: "mighty" },
    });
    expect(screen.getByTestId("star-player-skills-mighty-blow")).toBeTruthy();
  });

  it("conserve un slug hors catalogue déjà enregistré", () => {
    setup(["loner-4"]);
    expect(box("loner-4").checked).toBe(true);
    expect(screen.getByText("Hors catalogue")).toBeTruthy();
  });

  it("dédoublonne un slug présent sur plusieurs rulesets", () => {
    setup([], [...SKILLS, { slug: "block", nameFr: "Blocage", nameEn: "Block", category: "General" }]);
    expect(screen.getAllByTestId("star-player-skills-block")).toHaveLength(1);
  });
});
