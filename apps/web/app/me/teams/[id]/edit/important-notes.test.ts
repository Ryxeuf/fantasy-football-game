import { describe, it, expect } from "vitest";
import { getFormatConstraints } from "@bb/game-engine";
import { buildImportantNotes } from "./important-notes";

describe("buildImportantNotes", () => {
  it("n'affirme plus que les compétences ne peuvent pas être modifiées", () => {
    const notes = buildImportantNotes({
      minPlayers: 11,
      maxPlayers: 16,
      initialBudgetK: 1000,
    }).join(" | ");
    expect(notes).not.toContain("ne peuvent pas être modifiées");
    expect(notes).toContain("SPP");
    expect(notes).toContain("+ Compétence");
  });

  it("reprend les bornes de joueurs du format (BB11)", () => {
    const c = getFormatConstraints("bb11");
    const notes = buildImportantNotes({
      minPlayers: c.minPlayers,
      maxPlayers: c.maxPlayers,
      initialBudgetK: 1000,
    }).join(" | ");
    expect(notes).toContain("(11-16 joueurs");
  });

  it("reprend les bornes de joueurs du format (Sevens)", () => {
    const c = getFormatConstraints("sevens");
    const notes = buildImportantNotes({
      minPlayers: c.minPlayers,
      maxPlayers: c.maxPlayers,
      initialBudgetK: c.startingBudget,
    }).join(" | ");
    expect(notes).toContain("(7-11 joueurs");
    expect(notes).toContain("sous 7");
    expect(notes).not.toContain("11-16");
  });

  it("rappelle le budget global et le bouton de sauvegarde du staff", () => {
    const notes = buildImportantNotes({
      minPlayers: 11,
      maxPlayers: 16,
      initialBudgetK: 1000,
    }).join(" | ");
    expect(notes).toContain("joueurs + staff + Star Players");
    expect(notes).toContain("se sauvegarde à part");
  });
});
