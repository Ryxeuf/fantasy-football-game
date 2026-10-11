/**
 * Contexte d'achat de coups de pouce au build : régime et liste de la coupe,
 * règlement de tournoi. La liste du commissaire fait foi, règlement compris.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

import { NAF_WORLD_CUP_2027 } from "@bb/game-engine";
import { buildInducementContextFrom } from "./build-inducement-context";

const PACK_SLUGS = NAF_WORLD_CUP_2027.allowedInducements.map((r) => r.slug);

describe("buildInducementContextFrom", () => {
  it("hors coupe et hors règlement : aucun achat, tout le catalogue", () => {
    expect(buildInducementContextFrom({ cup: null, pack: null })).toEqual({
      allowed: false,
      pack: null,
      allowlist: { allowed: null, extras: [] },
      cupMode: null,
    });
  });

  it("règlement seul : la liste du règlement", () => {
    const ctx = buildInducementContextFrom({ cup: null, pack: NAF_WORLD_CUP_2027 });
    expect(ctx.allowed).toBe(true);
    expect(ctx.allowlist).toEqual({ allowed: PACK_SLUGS, extras: [] });
  });

  it("coupe à règlement : le commissaire retire et ajoute", () => {
    const ctx = buildInducementContextFrom({
      cup: {
        format: "bb11",
        tournamentRuleset: NAF_WORLD_CUP_2027.slug,
        inducementMode: null,
        allowedInducements: '["team_mascot","weather_mage"]',
      },
      pack: NAF_WORLD_CUP_2027,
    });
    expect(ctx.cupMode).toBe("build");
    expect(ctx.allowlist).toEqual({
      allowed: ["team_mascot", "weather_mage"],
      extras: ["weather_mage"],
    });
  });

  it("coupe sans liste : celle du règlement", () => {
    const ctx = buildInducementContextFrom({
      cup: { format: "bb11", tournamentRuleset: NAF_WORLD_CUP_2027.slug, allowedInducements: null },
      pack: NAF_WORLD_CUP_2027,
    });
    expect(ctx.allowlist.allowed).toEqual(PACK_SLUGS);
  });

  it("coupe sans règlement, liste vide explicite : rien à vendre", () => {
    const ctx = buildInducementContextFrom({
      cup: { format: "bb11", inducementMode: "build", allowedInducements: [] },
      pack: null,
    });
    expect(ctx.allowlist).toEqual({ allowed: [], extras: [] });
  });
});
