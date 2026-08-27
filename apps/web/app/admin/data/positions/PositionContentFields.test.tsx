import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PositionContentFields, {
  readPositionContentFields,
} from "./PositionContentFields";

/** `getByLabelText` renvoie un HTMLElement : on lit `.value` explicitement. */
function valueOf(label: string): string {
  const el = screen.getByLabelText(label) as
    | HTMLInputElement
    | HTMLTextAreaElement;
  return el.value;
}

describe("PositionContentFields", () => {
  it("rend les cinq champs éditoriaux vides par défaut", () => {
    render(<PositionContentFields />);
    expect(valueOf("Illustration (URL)")).toBe("");
    expect(valueOf("Description (FR)")).toBe("");
    expect(valueOf("Description (EN)")).toBe("");
    expect(valueOf("Fluff / lore (FR)")).toBe("");
    expect(valueOf("Fluff / lore (EN)")).toBe("");
  });

  it("préremplit depuis la position chargée", () => {
    render(
      <PositionContentFields
        defaults={{
          imageUrl: "/images/positions/amazon_guerriere_aigle.png",
          descriptionFr: "Blitzeuse rapide.",
          fluffEn: "Eagle lore.",
        }}
      />,
    );
    expect(valueOf("Illustration (URL)")).toBe(
      "/images/positions/amazon_guerriere_aigle.png",
    );
    expect(valueOf("Description (FR)")).toBe("Blitzeuse rapide.");
    // Champ absent des defaults -> vide, jamais "null".
    expect(valueOf("Description (EN)")).toBe("");
    expect(valueOf("Fluff / lore (EN)")).toBe("Eagle lore.");
  });
});

describe("readPositionContentFields", () => {
  it("extrait les cinq champs et trim les valeurs", () => {
    const fd = new FormData();
    fd.set("imageUrl", "  /a.png ");
    fd.set("descriptionFr", " Blitzeuse. ");
    fd.set("fluffFr", "Lore.");
    expect(readPositionContentFields(fd)).toEqual({
      imageUrl: "/a.png",
      descriptionFr: "Blitzeuse.",
      descriptionEn: null,
      fluffFr: "Lore.",
      fluffEn: null,
    });
  });

  it("normalise une saisie effacée en null", () => {
    const fd = new FormData();
    fd.set("imageUrl", "");
    fd.set("descriptionFr", "   ");
    expect(readPositionContentFields(fd).imageUrl).toBeNull();
    expect(readPositionContentFields(fd).descriptionFr).toBeNull();
  });
});
