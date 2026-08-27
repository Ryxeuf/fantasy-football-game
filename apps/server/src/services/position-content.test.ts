import { describe, it, expect } from "vitest";
import { resolvePositionContent } from "./position-content";

describe("resolvePositionContent", () => {
  it("renvoie du vide quand aucune colonne n'est renseignée (db push sans backfill)", () => {
    expect(resolvePositionContent(null, false)).toEqual({
      imageUrl: null,
      description: null,
      fluff: null,
    });
    expect(resolvePositionContent({}, true)).toEqual({
      imageUrl: null,
      description: null,
      fluff: null,
    });
  });

  it("sert le français par défaut", () => {
    const view = resolvePositionContent(
      {
        imageUrl: "/images/positions/amazon_guerriere_aigle.png",
        descriptionFr: "Blitzeuse rapide.",
        descriptionEn: "Fast blitzer.",
        fluffFr: "Les filles de l'Aigle…",
        fluffEn: "The Eagle's daughters…",
      },
      false,
    );
    expect(view).toEqual({
      imageUrl: "/images/positions/amazon_guerriere_aigle.png",
      description: "Blitzeuse rapide.",
      fluff: "Les filles de l'Aigle…",
    });
  });

  it("sert l'anglais quand il est demandé", () => {
    const view = resolvePositionContent(
      { descriptionFr: "Blitzeuse.", descriptionEn: "Blitzer." },
      true,
    );
    expect(view.description).toBe("Blitzer.");
  });

  it("retombe sur le français quand la traduction manque", () => {
    const view = resolvePositionContent(
      { descriptionFr: "Blitzeuse.", fluffFr: "Lore FR." },
      true,
    );
    expect(view.description).toBe("Blitzeuse.");
    expect(view.fluff).toBe("Lore FR.");
  });

  it("traite une chaîne vide ou blanche comme absente", () => {
    const view = resolvePositionContent(
      { imageUrl: "   ", descriptionFr: "", descriptionEn: "  ", fluffFr: "" },
      true,
    );
    expect(view).toEqual({ imageUrl: null, description: null, fluff: null });
  });

  it("trim le contenu servi", () => {
    const view = resolvePositionContent(
      { descriptionFr: "  Blitzeuse.  ", imageUrl: " /a.png " },
      false,
    );
    expect(view.description).toBe("Blitzeuse.");
    expect(view.imageUrl).toBe("/a.png");
  });
});
