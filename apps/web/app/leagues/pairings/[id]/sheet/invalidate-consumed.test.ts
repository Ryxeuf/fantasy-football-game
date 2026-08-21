/**
 * Déblocage « advancement-consumed » : détection de l'erreur renvoyée
 * par l'API d'invalidation (« Reversion impossible: advancement-consumed »)
 * qui déclenche la confirmation puis le retry avec
 * `removeConsumedAdvancements: true`.
 */
import { describe, it, expect } from "vitest";
import {
  isAdvancementConsumedError,
  REMOVE_CONSUMED_CONFIRM_MESSAGE,
} from "./invalidate-consumed";

describe("isAdvancementConsumedError", () => {
  it("détecte le refus advancement-consumed de l'API", () => {
    expect(
      isAdvancementConsumedError(
        new Error("Reversion impossible: advancement-consumed"),
      ),
    ).toBe(true);
  });

  it("ignore les autres refus de reversion", () => {
    expect(
      isAdvancementConsumedError(
        new Error("Reversion impossible: season-completed"),
      ),
    ).toBe(false);
    expect(
      isAdvancementConsumedError(
        new Error("Fenetre de correction fermee : les 2 equipes ont deja rejoue"),
      ),
    ).toBe(false);
  });

  it("ignore les valeurs non-Error", () => {
    expect(isAdvancementConsumedError("advancement-consumed")).toBe(false);
    expect(isAdvancementConsumedError(null)).toBe(false);
    expect(isAdvancementConsumedError(undefined)).toBe(false);
  });
});

describe("REMOVE_CONSUMED_CONFIRM_MESSAGE", () => {
  it("prévient que les évolutions post-match seront retirées et les PSP remboursés", () => {
    expect(REMOVE_CONSUMED_CONFIRM_MESSAGE).toContain("PSP");
    expect(REMOVE_CONSUMED_CONFIRM_MESSAGE).toContain("APRÈS la validation");
    expect(REMOVE_CONSUMED_CONFIRM_MESSAGE).toContain("retirera ces évolutions");
  });
});
