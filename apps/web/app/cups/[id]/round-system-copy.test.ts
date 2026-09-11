/**
 * Bandeau des rondes : le texte doit SUIVRE le système d'appariement choisi.
 */
import { describe, it, expect } from "vitest";
import {
  CUP_ROUND_SYSTEM_DESCRIPTION_KEYS,
  CUP_ROUND_SYSTEM_LABEL_KEYS,
  cupRoundsHeadingKeys,
} from "./round-system-copy";
import { CUP_ROUND_SYSTEMS } from "./manual-round";
import fr from "../../i18n/locales/fr.json";
import en from "../../i18n/locales/en.json";

describe("cupRoundsHeadingKeys", () => {
  it("suit le système sélectionné quand le sélecteur est affiché", () => {
    expect(
      cupRoundsHeadingKeys({ system: "swiss", systemSelectorVisible: true }),
    ).toEqual({
      titleKey: "roundsTitleWithSystem",
      systemLabelKey: "roundSystemSwiss",
      descriptionKey: "roundSystemSwissDescription",
    });
    expect(
      cupRoundsHeadingKeys({ system: "random", systemSelectorVisible: true }),
    ).toEqual({
      titleKey: "roundsTitleWithSystem",
      systemLabelKey: "roundSystemRandom",
      descriptionKey: "roundSystemRandomDescription",
    });
    expect(
      cupRoundsHeadingKeys({ system: "manual", systemSelectorVisible: true }),
    ).toEqual({
      titleKey: "roundsTitleWithSystem",
      systemLabelKey: "roundSystemManual",
      descriptionKey: "roundSystemManualDescription",
    });
  });

  it("reste neutre sans sélecteur — une coupe panache les systèmes", () => {
    for (const system of CUP_ROUND_SYSTEMS) {
      expect(
        cupRoundsHeadingKeys({ system, systemSelectorVisible: false }),
      ).toEqual({
        titleKey: "roundsTitle",
        systemLabelKey: null,
        descriptionKey: "roundsDescription",
      });
    }
  });

  it("chaque système a bien un libellé ET une description dans les deux locales", () => {
    const cups: ReadonlyArray<Record<string, unknown>> = [fr.cups, en.cups];
    for (const locale of cups) {
      expect(typeof locale.roundsTitle).toBe("string");
      expect(typeof locale.roundsDescription).toBe("string");
      expect(String(locale.roundsTitleWithSystem)).toContain("{{system}}");
      for (const system of CUP_ROUND_SYSTEMS) {
        expect(typeof locale[CUP_ROUND_SYSTEM_LABEL_KEYS[system]]).toBe("string");
        expect(typeof locale[CUP_ROUND_SYSTEM_DESCRIPTION_KEYS[system]]).toBe(
          "string",
        );
      }
    }
  });

  it("deux systèmes n'ont jamais la même description", () => {
    const descriptions = CUP_ROUND_SYSTEMS.map(
      (s) => (fr.cups as Record<string, string>)[CUP_ROUND_SYSTEM_DESCRIPTION_KEYS[s]],
    );
    expect(new Set(descriptions).size).toBe(CUP_ROUND_SYSTEMS.length);
  });
});
