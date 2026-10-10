import { describe, it, expect } from "vitest";
import {
  defaultCupInducementMode,
  modeToWrite,
  parseCupAllowedInducements,
  parseCupInducementMode,
  resolveCupInducementMode,
} from "./cup-inducement-mode";

const BB11 = { hasTournamentRuleset: false, format: "bb11" };
const SEVENS = { hasTournamentRuleset: false, format: "sevens" };
const PACK = { hasTournamentRuleset: true, format: "bb11" };

describe("parseCupInducementMode", () => {
  it("ne reconnaît que les trois modes", () => {
    expect(parseCupInducementMode("build")).toBe("build");
    expect(parseCupInducementMode("match")).toBe("match");
    expect(parseCupInducementMode("none")).toBe("none");
    expect(parseCupInducementMode("tournoi")).toBeNull();
    expect(parseCupInducementMode(null)).toBeNull();
    expect(parseCupInducementMode(1)).toBeNull();
  });
});

describe("resolveCupInducementMode", () => {
  it("null (coupe antérieure au réglage) ⇒ match", () => {
    expect(resolveCupInducementMode(null, BB11)).toBe("match");
  });

  it("valeur inconnue ⇒ match", () => {
    expect(resolveCupInducementMode("tournoi", BB11)).toBe("match");
  });

  it("sert le mode stocké", () => {
    expect(resolveCupInducementMode("build", BB11)).toBe("build");
    expect(resolveCupInducementMode("none", BB11)).toBe("none");
  });

  it("règlement de tournoi ⇒ build, quoi qu'en dise la colonne", () => {
    expect(resolveCupInducementMode(null, PACK)).toBe("build");
    expect(resolveCupInducementMode("none", PACK)).toBe("build");
  });

  it("Sept : build impossible, retombe sur match", () => {
    expect(resolveCupInducementMode("build", SEVENS)).toBe("match");
    expect(resolveCupInducementMode("none", SEVENS)).toBe("none");
  });
});

describe("defaultCupInducementMode", () => {
  it("BB11 ⇒ build, Sept ⇒ match, règlement ⇒ build", () => {
    expect(defaultCupInducementMode(BB11)).toBe("build");
    expect(defaultCupInducementMode(SEVENS)).toBe("match");
    expect(defaultCupInducementMode(PACK)).toBe("build");
  });
});

describe("modeToWrite", () => {
  it("création sans choix : défaut de la coupe neuve", () => {
    expect(modeToWrite(undefined, BB11)).toEqual({ ok: true, mode: "build" });
    expect(modeToWrite(undefined, SEVENS)).toEqual({ ok: true, mode: "match" });
  });

  it("règlement : build imposé même sur demande contraire", () => {
    expect(modeToWrite("match", PACK)).toEqual({ ok: true, mode: "build" });
    expect(modeToWrite("none", PACK)).toEqual({ ok: true, mode: "build" });
  });

  it("Sept : une demande explicite de build est refusée", () => {
    expect(modeToWrite("build", SEVENS)).toEqual({
      ok: false,
      error: "build_not_allowed_in_sevens",
    });
  });

  it("modification sans demande : garde la valeur courante", () => {
    expect(modeToWrite(undefined, BB11, "none")).toEqual({
      ok: true,
      mode: "none",
    });
    // Une coupe antérieure (null) sans demande reçoit le défaut d'une neuve :
    // l'appelant ne doit donc écrire que si la demande porte le champ.
    expect(modeToWrite(undefined, BB11, null)).toEqual({
      ok: true,
      mode: "build",
    });
  });

  it("sert la demande explicite", () => {
    expect(modeToWrite("none", BB11, "build")).toEqual({
      ok: true,
      mode: "none",
    });
  });
});

describe("parseCupAllowedInducements", () => {
  it("tableau natif (PG) ou chaîne (miroir SQLite)", () => {
    expect(parseCupAllowedInducements(["team_mascot", "bribe"])).toEqual([
      "team_mascot",
      "bribe",
    ]);
    expect(parseCupAllowedInducements('["team_mascot"]')).toEqual([
      "team_mascot",
    ]);
  });

  it("null, vide, illisible ⇒ aucune restriction", () => {
    expect(parseCupAllowedInducements(null)).toBeNull();
    expect(parseCupAllowedInducements([])).toBeNull();
    expect(parseCupAllowedInducements("{pas du json")).toBeNull();
    expect(parseCupAllowedInducements({ slug: "bribe" })).toBeNull();
  });

  it("dédoublonne et ignore les entrées non textuelles", () => {
    expect(
      parseCupAllowedInducements(["bribe", "bribe", 3, "", "team_mascot"]),
    ).toEqual(["bribe", "team_mascot"]);
  });
});
