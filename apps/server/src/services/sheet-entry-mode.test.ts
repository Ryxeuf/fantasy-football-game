import { describe, it, expect } from "vitest";
import { SHEET_ENTRY_MODES, parseSheetEntryMode } from "./sheet-entry-mode";

describe("parseSheetEntryMode", () => {
  it("connaît exactement deux modes", () => {
    expect(SHEET_ENTRY_MODES).toEqual(["full", "simplified"]);
  });

  it("lit une coupe antérieure au réglage (null) en saisie complète", () => {
    expect(parseSheetEntryMode(null)).toBe("full");
    expect(parseSheetEntryMode(undefined)).toBe("full");
  });

  it("rend les deux modes connus tels quels", () => {
    expect(parseSheetEntryMode("full")).toBe("full");
    expect(parseSheetEntryMode("simplified")).toBe("simplified");
  });

  it("ramène une valeur inconnue à la saisie complète", () => {
    expect(parseSheetEntryMode("SIMPLIFIED")).toBe("full");
    expect(parseSheetEntryMode("quick")).toBe("full");
    expect(parseSheetEntryMode(1)).toBe("full");
  });
});
