import { describe, it, expect } from "vitest";
import {
  TERRAIN_SKINS,
  DEFAULT_TERRAIN_SKIN_ID,
  getTerrainSkin,
  resolveTerrainSkinFromWeather,
  type TerrainSkin,
  type TerrainSkinId,
} from "./terrain-skins";

describe("Regle: terrain-skins (H.7 variantes de terrain)", () => {
  describe("TERRAIN_SKINS registry", () => {
    it("contains exactly 3 skins: grass, ruins, snow", () => {
      const ids = Object.keys(TERRAIN_SKINS);
      expect(ids).toHaveLength(3);
      expect(ids).toContain("grass");
      expect(ids).toContain("ruins");
      expect(ids).toContain("snow");
    });

    it("every skin has all required color fields", () => {
      const requiredFields: (keyof TerrainSkin)[] = [
        "id",
        "name",
        "fieldColor",
        "endzoneTeamAColor",
        "endzoneTeamBColor",
        "endzoneSecondaryColor",
        "lineColor",
        "centerLineColor",
        "gridColor",
        "gridAlpha",
      ];
      for (const [id, skin] of Object.entries(TERRAIN_SKINS)) {
        for (const field of requiredFields) {
          expect(skin[field], `${id} missing ${field}`).toBeDefined();
        }
      }
    });

    it("every skin has numeric color values (24-bit hex)", () => {
      for (const [id, skin] of Object.entries(TERRAIN_SKINS)) {
        expect(typeof skin.fieldColor, `${id}.fieldColor`).toBe("number");
        expect(typeof skin.endzoneTeamAColor, `${id}.endzoneTeamAColor`).toBe("number");
        expect(typeof skin.endzoneTeamBColor, `${id}.endzoneTeamBColor`).toBe("number");
        expect(typeof skin.endzoneSecondaryColor, `${id}.endzoneSecondaryColor`).toBe("number");
        expect(typeof skin.lineColor, `${id}.lineColor`).toBe("number");
        expect(typeof skin.centerLineColor, `${id}.centerLineColor`).toBe("number");
        expect(typeof skin.gridColor, `${id}.gridColor`).toBe("number");
      }
    });

    it("gridAlpha is between 0 and 1 for every skin", () => {
      for (const [id, skin] of Object.entries(TERRAIN_SKINS)) {
        expect(skin.gridAlpha, `${id}.gridAlpha`).toBeGreaterThanOrEqual(0);
        expect(skin.gridAlpha, `${id}.gridAlpha`).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("DEFAULT_TERRAIN_SKIN_ID", () => {
    it("defaults to grass", () => {
      expect(DEFAULT_TERRAIN_SKIN_ID).toBe("grass");
    });

    it("points to a valid skin in the registry", () => {
      expect(TERRAIN_SKINS[DEFAULT_TERRAIN_SKIN_ID]).toBeDefined();
    });
  });

  describe("getTerrainSkin()", () => {
    it("returns grass skin for 'grass'", () => {
      const skin = getTerrainSkin("grass");
      expect(skin.id).toBe("grass");
    });

    it("returns ruins skin for 'ruins'", () => {
      const skin = getTerrainSkin("ruins");
      expect(skin.id).toBe("ruins");
    });

    it("returns snow skin for 'snow'", () => {
      const skin = getTerrainSkin("snow");
      expect(skin.id).toBe("snow");
    });

    it("returns default (grass) for undefined", () => {
      const skin = getTerrainSkin(undefined);
      expect(skin.id).toBe("grass");
    });

    it("returns default (grass) for unknown skin id", () => {
      const skin = getTerrainSkin("lava" as TerrainSkinId);
      expect(skin.id).toBe("grass");
    });
  });

  describe("resolveTerrainSkinFromWeather()", () => {
    it("maps hivernale weather conditions to snow", () => {
      expect(resolveTerrainSkinFromWeather("Blizzard")).toBe("snow");
    });

    it("maps snow-related conditions to snow", () => {
      expect(resolveTerrainSkinFromWeather("Neige épaisse")).toBe("snow");
    });

    it("maps souterraine/cimetiere conditions to ruins", () => {
      expect(resolveTerrainSkinFromWeather("Éboulement")).toBe("ruins");
    });

    it("maps ruins-related conditions to ruins", () => {
      expect(resolveTerrainSkinFromWeather("Ruines instables")).toBe("ruins");
    });

    it("returns grass for standard conditions", () => {
      expect(resolveTerrainSkinFromWeather("Conditions parfaites")).toBe("grass");
    });

    it("returns grass for undefined condition", () => {
      expect(resolveTerrainSkinFromWeather(undefined)).toBe("grass");
    });

    it("returns grass for unknown condition", () => {
      expect(resolveTerrainSkinFromWeather("Something unknown")).toBe("grass");
    });
  });

  describe("grass skin has original hardcoded colors", () => {
    it("fieldColor matches original 0x6b8e23", () => {
      expect(TERRAIN_SKINS.grass.fieldColor).toBe(0x6b8e23);
    });

    it("endzoneTeamAColor matches original red", () => {
      expect(TERRAIN_SKINS.grass.endzoneTeamAColor).toBe(0xff0000);
    });

    it("endzoneTeamBColor matches original blue", () => {
      expect(TERRAIN_SKINS.grass.endzoneTeamBColor).toBe(0x0000ff);
    });

    it("lineColor matches original white", () => {
      expect(TERRAIN_SKINS.grass.lineColor).toBe(0xffffff);
    });

    it("centerLineColor matches original yellow", () => {
      expect(TERRAIN_SKINS.grass.centerLineColor).toBe(0xffff00);
    });

    it("gridColor matches original light grey", () => {
      expect(TERRAIN_SKINS.grass.gridColor).toBe(0xcccccc);
    });

    it("gridAlpha matches original 0.3", () => {
      expect(TERRAIN_SKINS.grass.gridAlpha).toBe(0.3);
    });
  });

  describe("visual contrast: skins are visually distinct", () => {
    it("each skin has a different fieldColor", () => {
      const colors = Object.values(TERRAIN_SKINS).map((s) => s.fieldColor);
      const unique = new Set(colors);
      expect(unique.size).toBe(colors.length);
    });

    it("each skin has a different centerLineColor", () => {
      const colors = Object.values(TERRAIN_SKINS).map((s) => s.centerLineColor);
      const unique = new Set(colors);
      expect(unique.size).toBe(colors.length);
    });
  });
});
