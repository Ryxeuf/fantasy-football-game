import { describe, it, expect } from "vitest";
import {
  DEFAULT_RULESET,
  filterStarPlayers,
  formatHirableBy,
  formatStarCost,
  formatStarStat,
  getStarSkillList,
  parseStarPlayersResponse,
  resolveStarImageUrl,
  type StarPlayerSummary,
} from "./star-players";

const SAMPLE: StarPlayerSummary = {
  slug: "akhorne_the_squirrel",
  displayName: "Akhorne The Squirrel",
  cost: 80000,
  ma: 7,
  st: 1,
  ag: 2,
  pa: null,
  av: 6,
  skills: "claws,dauntless,dodge",
  hirableBy: ["all"],
  specialRule: "Rage aveugle",
  imageUrl: "/data/Star-Players_files/akhorne.webp",
  isMegaStar: false,
};

describe("parseStarPlayersResponse", () => {
  it("returns empty list when response is not the expected shape", () => {
    expect(parseStarPlayersResponse(null)).toEqual([]);
    expect(parseStarPlayersResponse({})).toEqual([]);
    expect(parseStarPlayersResponse({ success: true })).toEqual([]);
  });

  it("extracts valid star players from the server envelope", () => {
    const response = {
      success: true,
      count: 1,
      data: [
        {
          slug: "akhorne_the_squirrel",
          displayName: "Akhorne The Squirrel",
          cost: 80000,
          ma: 7,
          st: 1,
          ag: 2,
          pa: null,
          av: 6,
          skills: "claws,dauntless,dodge",
          hirableBy: ["all"],
          specialRule: "Rage aveugle",
          imageUrl: "/foo.webp",
          isMegaStar: false,
        },
      ],
    };
    const parsed = parseStarPlayersResponse(response);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].slug).toBe("akhorne_the_squirrel");
    expect(parsed[0].pa).toBeNull();
  });

  it("deduplicates by slug when the server returns multiple rulesets", () => {
    const response = {
      data: [
        { ...SAMPLE },
        { ...SAMPLE, cost: 90000 },
        { ...SAMPLE, slug: "other_star" },
      ],
    };
    const parsed = parseStarPlayersResponse(response);
    const slugs = parsed.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(parsed).toHaveLength(2);
  });

  it("ignores entries with missing mandatory fields", () => {
    const response = {
      data: [
        { slug: "bad", cost: 1 },
        { ...SAMPLE },
      ],
    };
    expect(parseStarPlayersResponse(response)).toHaveLength(1);
  });
});

describe("filterStarPlayers", () => {
  const players: StarPlayerSummary[] = [
    { ...SAMPLE },
    {
      ...SAMPLE,
      slug: "griff_oberwald",
      displayName: "Griff Oberwald",
      cost: 320000,
      hirableBy: ["human", "imperial_nobility"],
      skills: "block,dodge,fend,sprint,sure-feet,sure-hands",
    },
    {
      ...SAMPLE,
      slug: "morg_n_thorg",
      displayName: "Morg N Thorg",
      cost: 430000,
      skills: "block,frenzy,loner-4,mighty-blow,thick-skull,throw-team-mate",
      hirableBy: ["all"],
      isMegaStar: true,
    },
  ];

  it("returns everything when no filters are set", () => {
    expect(filterStarPlayers(players, {})).toEqual(players);
  });

  it("filters by slug or displayName with case-insensitive search", () => {
    expect(filterStarPlayers(players, { search: "GRIFF" })).toHaveLength(1);
    expect(filterStarPlayers(players, { search: "morg" })).toHaveLength(1);
    expect(filterStarPlayers(players, { search: "akhorn" })).toHaveLength(1);
  });

  it("filters by max cost (inclusive)", () => {
    expect(
      filterStarPlayers(players, { maxCost: 320000 }).map((p) => p.slug),
    ).toEqual(["akhorne_the_squirrel", "griff_oberwald"]);
  });

  it("filters by skill slug substring", () => {
    const frenzied = filterStarPlayers(players, { skill: "frenzy" });
    expect(frenzied).toHaveLength(1);
    expect(frenzied[0].slug).toBe("morg_n_thorg");
  });

  it("filters by hirableBy entry", () => {
    const forImperial = filterStarPlayers(players, {
      hirableBy: "imperial_nobility",
    });
    expect(forImperial.map((p) => p.slug)).toEqual(["griff_oberwald"]);
  });

  it("filters by megaStar flag", () => {
    expect(
      filterStarPlayers(players, { megaStarOnly: true }).map((p) => p.slug),
    ).toEqual(["morg_n_thorg"]);
  });

  it("combines multiple filters", () => {
    const result = filterStarPlayers(players, {
      search: "th",
      maxCost: 500000,
      skill: "block",
    });
    expect(result.map((p) => p.slug)).toEqual(["morg_n_thorg"]);
  });
});

describe("formatStarCost", () => {
  it("displays gold in thousands with a K suffix", () => {
    expect(formatStarCost(80000)).toBe("80K po");
    expect(formatStarCost(320000)).toBe("320K po");
  });

  it("handles zero and undefined gracefully", () => {
    expect(formatStarCost(0)).toBe("0K po");
    expect(formatStarCost(undefined)).toBe("0K po");
  });
});

describe("formatStarStat", () => {
  it("returns a dash for null passing stat", () => {
    expect(formatStarStat("pa", null)).toBe("-");
  });

  it("appends a plus sign for pa/ag/av when value > 0", () => {
    expect(formatStarStat("pa", 3)).toBe("3+");
    expect(formatStarStat("ag", 2)).toBe("2+");
    expect(formatStarStat("av", 9)).toBe("9+");
  });

  it("returns raw numeric string for ma/st", () => {
    expect(formatStarStat("ma", 7)).toBe("7");
    expect(formatStarStat("st", 4)).toBe("4");
  });
});

describe("getStarSkillList", () => {
  it("splits the comma-separated skills and trims whitespace", () => {
    expect(getStarSkillList(" block,dodge ,frenzy")).toEqual([
      "block",
      "dodge",
      "frenzy",
    ]);
  });

  it("returns empty array for empty or missing input", () => {
    expect(getStarSkillList("")).toEqual([]);
    expect(getStarSkillList(undefined)).toEqual([]);
  });
});

describe("formatHirableBy", () => {
  it('returns "Toutes les equipes" for the special "all" entry', () => {
    expect(formatHirableBy(["all"])).toBe("Toutes les equipes");
  });

  it("joins multiple roster slugs with a separator", () => {
    const result = formatHirableBy(["human", "imperial_nobility"]);
    expect(result).toContain("human");
    expect(result).toContain("imperial_nobility");
    expect(result).toContain(",");
  });

  it("returns a fallback string when empty", () => {
    expect(formatHirableBy([])).toBe("Aucune equipe");
  });
});

describe("resolveStarImageUrl", () => {
  it("returns null when no URL provided", () => {
    expect(resolveStarImageUrl(undefined, "https://api.example")).toBeNull();
    expect(resolveStarImageUrl("", "https://api.example")).toBeNull();
  });

  it("prefixes server-relative URLs with the API base", () => {
    expect(
      resolveStarImageUrl("/data/foo.webp", "https://api.example"),
    ).toBe("https://api.example/data/foo.webp");
  });

  it("keeps already absolute URLs unchanged", () => {
    const abs = "https://cdn.example.com/foo.webp";
    expect(resolveStarImageUrl(abs, "https://api.example")).toBe(abs);
  });
});

describe("DEFAULT_RULESET", () => {
  it("defaults to season_3", () => {
    expect(DEFAULT_RULESET).toBe("season_3");
  });
});
