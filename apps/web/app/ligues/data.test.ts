import { describe, it, expect } from "vitest";
import { resolveRosters, type RosterInfo } from "./data";

const MAP = new Map<string, RosterInfo>([
  ["wood_elf", { slug: "wood_elf", name: "Elfes Sylvains", tier: "I", naf: false, positionCount: 6 }],
  ["high_elf", { slug: "high_elf", name: "Hauts Elfes", tier: "II", naf: false, positionCount: 5 }],
]);

describe("resolveRosters", () => {
  it("résout les slugs connus en infos d'équipe, dans l'ordre d'entrée", () => {
    const result = resolveRosters(["high_elf", "wood_elf"], MAP);
    expect(result.map((r) => r.name)).toEqual(["Hauts Elfes", "Elfes Sylvains"]);
  });

  it("retombe sur un nom dérivé du slug si l'équipe est absente de l'API", () => {
    const result = resolveRosters(["chaos_dwarf"], MAP);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      slug: "chaos_dwarf",
      name: "Chaos Dwarf",
      tier: "",
    });
  });
});
