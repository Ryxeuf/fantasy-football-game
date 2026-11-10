import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SkillPrerequisitesField from "./SkillPrerequisitesField";

const OPTIONS = [
  { slug: "throw-team-mate", nameFr: "Lancer de Coéquipier" },
  { slug: "stunty", nameFr: "Minus" },
];

describe("SkillPrerequisitesField", () => {
  it("ajoute un prérequis", () => {
    const onChange = vi.fn();
    render(<SkillPrerequisitesField value={[]} options={OPTIONS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Prérequis"), {
      target: { value: "stunty" },
    });
    expect(onChange).toHaveBeenCalledWith(["stunty"]);
  });

  it("retire un prérequis", () => {
    const onChange = vi.fn();
    render(<SkillPrerequisitesField value={["stunty"]} options={OPTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Retirer le prérequis Minus"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("ne repropose pas un prérequis déjà choisi", () => {
    render(<SkillPrerequisitesField value={["stunty"]} options={OPTIONS} onChange={vi.fn()} />);
    const labels = screen.getAllByRole("option").map((o) => o.textContent);
    expect(labels).toEqual(["Ajouter un prérequis…", "Lancer de Coéquipier"]);
  });
});
