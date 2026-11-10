import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillPrerequisiteNotice from "./SkillPrerequisiteNotice";

const TTM = {
  slug: "throw-team-mate",
  nameFr: "Lancer de Coéquipier",
  nameEn: "Throw Team-Mate",
};

describe("SkillPrerequisiteNotice", () => {
  it("n'affiche rien sans prérequis", () => {
    const { container } = render(
      <SkillPrerequisiteNotice skillSlug="block" prerequisites={[]} language="fr" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("affiche le prérequis avec un lien vers sa fiche", () => {
    render(
      <SkillPrerequisiteNotice skillSlug="strong-arm" prerequisites={[TTM]} language="fr" />,
    );
    expect(screen.getByTestId("skill-prerequisite-strong-arm").textContent).toContain(
      "Prérequis : Lancer de Coéquipier",
    );
    expect(screen.getByRole("link").getAttribute("href")).toBe("/skills/throw-team-mate");
  });

  it("sépare les alternatives et suit la langue", () => {
    render(
      <SkillPrerequisiteNotice
        skillSlug="x"
        prerequisites={[TTM, { slug: "stunty", nameFr: "Minus", nameEn: "Stunty" }]}
        language="en"
      />,
    );
    expect(screen.getByTestId("skill-prerequisite-x").textContent).toContain(
      "Requires: Throw Team-Mate or Stunty",
    );
  });
});
