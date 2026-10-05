/**
 * Le seed du catalogue des thèmes de dés est « create-if-missing » : la table
 * est lue en priorité, un prix corrigé en admin ne doit pas être écrasé au
 * déploiement suivant.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    diceTheme: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

import { prisma } from "../prisma";
import { DICE_THEME_CATALOGUE } from "../services/dice-theme-catalogue";
import { syncDiceThemes } from "./sync-dice-themes";

const db = prisma as unknown as {
  diceTheme: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("syncDiceThemes", () => {
  it("crée tout le catalogue quand la table est vide", async () => {
    db.diceTheme.findMany.mockResolvedValue([]);
    const res = await syncDiceThemes({ write: true });
    expect(res.created).toHaveLength(DICE_THEME_CATALOGUE.length);
    expect(db.diceTheme.create).toHaveBeenCalledTimes(DICE_THEME_CATALOGUE.length);
    expect(db.diceTheme.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ slug: "nuffle", priceCrowns: null, enabled: true, collection: "classic" }),
    });
  });

  it("n'écrase JAMAIS une ligne éditée en admin sans `force`", async () => {
    db.diceTheme.findMany.mockResolvedValue(DICE_THEME_CATALOGUE.map((t) => ({ slug: t.id })));
    const res = await syncDiceThemes({ write: true });
    expect(res.created).toHaveLength(0);
    expect(res.skipped).toHaveLength(DICE_THEME_CATALOGUE.length);
    expect(db.diceTheme.update).not.toHaveBeenCalled();
  });

  it("`force` réinitialise depuis le catalogue compilé", async () => {
    db.diceTheme.findMany.mockResolvedValue([{ slug: "orques" }]);
    const res = await syncDiceThemes({ write: true, force: true });
    expect(res.updated).toEqual(["orques"]);
    expect(db.diceTheme.update).toHaveBeenCalledWith({
      where: { slug: "orques" },
      data: expect.objectContaining({ nameFr: "Orques", priceCrowns: 400 }),
    });
  });

  it("dry-run par défaut : rien n'est écrit", async () => {
    db.diceTheme.findMany.mockResolvedValue([]);
    const res = await syncDiceThemes();
    expect(res.write).toBe(false);
    expect(res.created).toHaveLength(DICE_THEME_CATALOGUE.length);
    expect(db.diceTheme.create).not.toHaveBeenCalled();
  });
});
