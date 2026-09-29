import { describe, it, expect } from "vitest";
import { ALLOWED_TEAMS } from "@bb/game-engine";
import { FACTIONS } from "./NuffleScenes";
import fr from "../../i18n/locales/fr.json";
import en from "../../i18n/locales/en.json";

describe("vitrine des factions de la home", () => {
  it("chaque ecu pointe vers un roster existant", () => {
    for (const f of FACTIONS) expect(ALLOWED_TEAMS).toContain(f.slug);
  });

  it("chaque ecu a un libelle traduit en FR et en EN", () => {
    for (const f of FACTIONS) {
      expect(fr.home.factions.names[f.slug]).toBeTruthy();
      expect(en.home.factions.names[f.slug]).toBeTruthy();
    }
    expect(en.home.factions.names.orc).toBe("Orcs");
    expect(fr.home.factions.names.orc).toBe("Orques");
  });
});
