import { describe, it, expect } from "vitest";
import {
  formatScoreLine,
  tickerDurationSeconds,
  toTickerLines,
  type NewsTickerItem,
} from "./news-ticker";

const LABELS = {
  leagueResult: "Ligue",
  cupResult: "Coupe",
  blogPost: "Gazette",
  leagueOpen: "Inscriptions · Ligue",
  cupOpen: "Inscriptions · Coupe",
  forfeit: "forfait",
};

const RESULT: NewsTickerItem = {
  kind: "league_result",
  id: "s1",
  at: "2026-09-20T10:00:00Z",
  href: "/leagues/L1",
  title: "Ligue du Reikland",
  home: { name: "Rats", roster: "skaven" },
  away: { name: "Nains", roster: "dwarf" },
  scoreHome: 2,
  scoreAway: 1,
};

describe("formatScoreLine", () => {
  it("écrit la rencontre et le score", () => {
    expect(formatScoreLine(RESULT, "forfait")).toBe("Rats 2 – 1 Nains");
  });
  it("nomme l'équipe forfait", () => {
    expect(formatScoreLine({ ...RESULT, forfeitSide: "away" }, "forfait")).toBe(
      "Rats 2 – 1 Nains (forfait Nains)",
    );
    expect(formatScoreLine({ ...RESULT, forfeitSide: "home" }, "forfait")).toBe(
      "Rats 2 – 1 Nains (forfait Rats)",
    );
  });
});

describe("toTickerLines", () => {
  it("rend chaque famille avec son étiquette", () => {
    const lines = toTickerLines(
      {
        items: [
          RESULT,
          { ...RESULT, kind: "cup_result", id: "m1", href: "/cups/C1", title: "Coupe d'automne" },
          { kind: "blog_post", id: "b1", at: "", href: "/blog/x", title: "Nouvel article" },
          { kind: "competition_open", competition: "cup", id: "c2", at: "", href: "/cups/C2", title: "Open" },
          { kind: "competition_open", competition: "league", id: "l2", at: "", href: "/leagues/L2", title: "Open L" },
        ],
      },
      LABELS,
    );
    expect(lines.map((l) => l.tag)).toEqual([
      "Ligue",
      "Coupe",
      "Gazette",
      "Inscriptions · Coupe",
      "Inscriptions · Ligue",
    ]);
    expect(lines[0]).toMatchObject({ context: "Ligue du Reikland", score: "Rats 2 – 1 Nains" });
    expect(lines[2].score).toBeUndefined();
    expect(new Set(lines.map((l) => l.key)).size).toBe(5);
  });

  it("tolère une réponse absente ou vide", () => {
    expect(toTickerLines(null, LABELS)).toEqual([]);
    expect(toTickerLines({}, LABELS)).toEqual([]);
    expect(toTickerLines({ items: "nope" as never }, LABELS)).toEqual([]);
  });

  it("ignore les items mal formés ou à lien externe", () => {
    const lines = toTickerLines(
      {
        items: [
          { ...RESULT, kind: "unknown" as never },
          { ...RESULT, href: "https://evil.example" },
          { ...RESULT, href: "//evil.example" },
          { ...RESULT, scoreAway: undefined },
          { ...RESULT, away: undefined },
          { kind: "blog_post", id: "b", at: "", href: "/blog/x", title: "" },
          null as never,
        ],
      },
      LABELS,
    );
    expect(lines).toEqual([]);
  });
});

describe("tickerDurationSeconds", () => {
  it("croît avec le nombre de lignes, borné", () => {
    expect(tickerDurationSeconds(1)).toBe(20);
    expect(tickerDurationSeconds(5)).toBe(30);
    expect(tickerDurationSeconds(50)).toBe(90);
  });
});
