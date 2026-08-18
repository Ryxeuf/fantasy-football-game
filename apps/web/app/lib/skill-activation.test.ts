import { describe, it, expect } from "vitest";
import {
  getSkillActivation,
  getSkillActivationHint,
  getSkillActivationLabel,
  SKILL_ACTIVATION_BADGE_CLASSES,
  SKILL_ACTIVATION_DARK_CLASSES,
  SKILL_ACTIVATION_OUTLINED_CLASSES,
} from "./skill-activation";

describe("skill-activation (E8 — actif / passif)", () => {
  it("classe une compétence passive et une compétence active", () => {
    expect(getSkillActivation(true)).toBe("passive");
    expect(getSkillActivation(false)).toBe("active");
  });

  it("retombe sur « actif » quand le flag est absent (API pré-E8 / fallback)", () => {
    expect(getSkillActivation(undefined)).toBe("active");
    expect(getSkillActivation(null)).toBe("active");
    expect(getSkillActivationLabel(undefined, "fr")).toBe("Actif");
  });

  it("traduit le libellé du badge", () => {
    expect(getSkillActivationLabel(true, "fr")).toBe("Passif");
    expect(getSkillActivationLabel(true, "en")).toBe("Passive");
    expect(getSkillActivationLabel(false, "fr")).toBe("Actif");
    expect(getSkillActivationLabel(false, "en")).toBe("Active");
  });

  it("explique la différence dans l'infobulle native (title)", () => {
    expect(getSkillActivationHint(true, "fr")).toContain("en permanence");
    expect(getSkillActivationHint(true, "en")).toContain("always applies");
    expect(getSkillActivationHint(false, "fr")).toContain("déclenché");
    expect(getSkillActivationHint(false, "en")).toContain("triggered");
  });

  it("expose un style pour chaque variante d'affichage", () => {
    for (const styles of [
      SKILL_ACTIVATION_BADGE_CLASSES,
      SKILL_ACTIVATION_OUTLINED_CLASSES,
      SKILL_ACTIVATION_DARK_CLASSES,
    ]) {
      expect(styles.passive).toBeTruthy();
      expect(styles.active).toBeTruthy();
      expect(styles.passive).not.toBe(styles.active);
    }
  });
});
