import { describe, it, expect } from "vitest";
import {
  absolutizeAssetUrl,
  resolveTeamOgLogo,
  rosterEmblem,
} from "./og-team-logo";

const BASE = "https://nufflearena.fr";

describe("absolutizeAssetUrl", () => {
  it("préfixe une URL relative avec la base", () => {
    expect(absolutizeAssetUrl("/images/team-logos/x.png", BASE)).toBe(
      "https://nufflearena.fr/images/team-logos/x.png",
    );
  });

  it("ne double jamais le slash de jonction", () => {
    expect(absolutizeAssetUrl("images/x.png", `${BASE}/`)).toBe(
      "https://nufflearena.fr/images/x.png",
    );
  });

  it("laisse une URL déjà absolue intacte", () => {
    expect(absolutizeAssetUrl("https://api.example/x.png", BASE)).toBe(
      "https://api.example/x.png",
    );
    expect(absolutizeAssetUrl("//cdn.example/x.png", BASE)).toBe(
      "//cdn.example/x.png",
    );
  });

  it("laisse une data URI intacte", () => {
    expect(absolutizeAssetUrl("data:image/png;base64,AAA", BASE)).toBe(
      "data:image/png;base64,AAA",
    );
  });

  it("rend null plutôt qu'un src vide (qui ferait échouer l'image OG)", () => {
    expect(absolutizeAssetUrl(null, BASE)).toBeNull();
    expect(absolutizeAssetUrl(undefined, BASE)).toBeNull();
    expect(absolutizeAssetUrl("   ", BASE)).toBeNull();
  });
});

describe("rosterEmblem", () => {
  it("porte le monogramme et les couleurs canoniques du roster", () => {
    const emblem = rosterEmblem("skaven");
    expect(emblem.kind).toBe("emblem");
    expect(emblem.glyph).toBe("S");
    expect(emblem.background).toMatch(/^#[0-9a-f]{6}$/);
    expect(emblem.foreground).toMatch(/^#[0-9a-f]{6}$/);
    // Les Skavens ont un emblème circulaire (`ROSTER_LOGOS`).
    expect(emblem.round).toBe(true);
  });

  it("distingue deux rosters", () => {
    expect(rosterEmblem("skaven")).not.toEqual(rosterEmblem("dwarf"));
  });

  it("rend un emblème neutre pour un roster inconnu ou absent", () => {
    const unknown = rosterEmblem("roster-qui-n-existe-pas");
    expect(unknown.glyph).toBe("NA");
    expect(rosterEmblem(null).glyph).toBe("NA");
    expect(rosterEmblem(undefined).glyph).toBe("NA");
  });
});

describe("resolveTeamOgLogo", () => {
  it("préfère le logo uploadé par le coach", () => {
    expect(
      resolveTeamOgLogo({
        logoUrl: "/images/team-logos/rats.png",
        roster: "skaven",
        assetBase: BASE,
      }),
    ).toEqual({
      kind: "image",
      src: "https://nufflearena.fr/images/team-logos/rats.png",
    });
  });

  it("retombe sur l'emblème du roster sans logo uploadé", () => {
    expect(
      resolveTeamOgLogo({ logoUrl: null, roster: "skaven", assetBase: BASE }),
    ).toEqual(rosterEmblem("skaven"));
  });

  it("rend toujours quelque chose, même sans roster", () => {
    const out = resolveTeamOgLogo({ assetBase: BASE });
    expect(out.kind).toBe("emblem");
  });
});
