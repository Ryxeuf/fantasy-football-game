import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import TeamLogo from "./TeamLogo";

describe("TeamLogo", () => {
  it("rend un SVG inline pour un slug connu", () => {
    const { container } = render(<TeamLogo slug="skaven" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("viewBox")).toBe("0 0 64 64");
  });

  it("respecte la taille passee en prop", () => {
    const { container } = render(<TeamLogo slug="skaven" size={96} />);
    const svg = container.querySelector("svg");
    expect(svg!.getAttribute("width")).toBe("96");
    expect(svg!.getAttribute("height")).toBe("96");
  });

  it("expose un titre accessible quand title est fourni", () => {
    const { container, getByRole } = render(
      <TeamLogo slug="dwarf" title="Dwarf Roster" />
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Dwarf Roster");
    expect(getByRole("img")).toBe(svg);
  });

  it("est decoratif (aria-hidden) sans title", () => {
    const { container } = render(<TeamLogo slug="dwarf" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
  });

  it("applique la className passee au wrapper", () => {
    const { container } = render(
      <TeamLogo slug="skaven" className="custom-class" />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("custom-class");
  });

  it("fallback gracieux pour un slug undefined", () => {
    const { container } = render(<TeamLogo slug={undefined} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("fallback gracieux pour un slug inconnu", () => {
    const { container } = render(<TeamLogo slug="not_a_real_roster" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // logo par defaut contient le glyph "NA"
    expect(svg!.textContent).toContain("NA");
  });

  it("rend des SVG differents selon le slug", () => {
    const { container: a } = render(<TeamLogo slug="skaven" />);
    const { container: b } = render(<TeamLogo slug="dwarf" />);
    expect(a.querySelector("svg")!.outerHTML).not.toBe(
      b.querySelector("svg")!.outerHTML
    );
  });

  // Logo uploade par le coach : prioritaire sur le logo programmatique.
  it("affiche le logo uploade quand `logoUrl` est fourni", () => {
    const { container } = render(
      <TeamLogo
        slug="skaven"
        logoUrl="/images/team-logos/reavers-abc123abc123.png"
        size={24}
        title="Reikland Reavers"
      />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(
      "/images/team-logos/reavers-abc123abc123.png",
    );
    expect(img?.getAttribute("alt")).toBe("Reikland Reavers");
    // Pas de double rendu : le SVG programmatique n'est pas monte.
    expect(container.querySelector("svg")).toBeNull();
  });

  it("traite `logoUrl` null comme absent (retro-compat API)", () => {
    const { container } = render(
      <TeamLogo slug="orc" logoUrl={null} size={24} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
