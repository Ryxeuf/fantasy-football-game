import { describe, it, expect } from "vitest";
import {
  crestFor,
  formatRelativeAge,
  formatScoreLine,
  teamInitials,
  toTickerView,
  type NewsTickerItem,
} from "./news-ticker";

const LABELS = {
  leagueResult: "Ligue",
  cupResult: "Coupe",
  blogPost: "Gazette",
  leagueOpen: "Ligue ouverte",
  cupOpen: "Coupe ouverte",
  forfeit: "forfait",
  readMore: "Lire l'article",
  register: "S'inscrire",
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

describe("toTickerView", () => {
  it("range les résultats en cartes et le reste en actualités, dans l'ordre servi", () => {
    const view = toTickerView(
      {
        items: [
          RESULT,
          { kind: "blog_post", id: "b1", at: "", href: "/blog/x", title: "Nouvel article" },
          { ...RESULT, kind: "cup_result", id: "m1", href: "/cups/C1", title: "Coupe d'automne" },
          { kind: "competition_open", competition: "cup", id: "c2", at: "", href: "/cups/C2", title: "Open" },
          { kind: "competition_open", competition: "league", id: "l2", at: "", href: "/leagues/L2", title: "Open L" },
        ],
      },
      LABELS,
    );
    expect(view.results.map((r) => [r.family, r.tag, r.context])).toEqual([
      ["league", "Ligue", "Ligue du Reikland"],
      ["cup", "Coupe", "Coupe d'automne"],
    ]);
    expect(view.headlines.map((h) => [h.family, h.tag, h.cta])).toEqual([
      ["blog", "Gazette", "Lire l'article"],
      ["open", "Coupe ouverte", "S'inscrire"],
      ["open", "Ligue ouverte", "S'inscrire"],
    ]);
    const keys = [...view.results, ...view.headlines].map((x) => x.key);
    expect(new Set(keys).size).toBe(5);
  });

  it("désigne le vainqueur, le forfait, et résume la rencontre", () => {
    const [card] = toTickerView({ items: [{ ...RESULT, forfeitSide: "away" }] }, LABELS).results;
    expect(card.home).toMatchObject({ name: "Rats", score: 2, winner: true, forfeit: false });
    expect(card.away).toMatchObject({ name: "Nains", score: 1, winner: false, forfeit: true });
    expect(card.summary).toBe("Ligue du Reikland — Rats 2 – 1 Nains (forfait Nains)");
  });

  it("n'a pas de vainqueur sur un nul", () => {
    const [card] = toTickerView({ items: [{ ...RESULT, scoreAway: 2 }] }, LABELS).results;
    expect(card.home.winner).toBe(false);
    expect(card.away.winner).toBe(false);
  });

  it("tolère une réponse absente ou vide", () => {
    const empty = { results: [], headlines: [] };
    expect(toTickerView(null, LABELS)).toEqual(empty);
    expect(toTickerView({}, LABELS)).toEqual(empty);
    expect(toTickerView({ items: "nope" as never }, LABELS)).toEqual(empty);
  });

  it("ignore les items mal formés ou à lien externe", () => {
    const view = toTickerView(
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
    expect(view).toEqual({ results: [], headlines: [] });
  });
});

describe("teamInitials", () => {
  it("prend l'initiale des deux premiers mots significatifs", () => {
    expect(teamInitials("Gones Kass'Krânes")).toBe("GK");
    expect(teamInitials("Les Rats du Port")).toBe("RP");
    expect(teamInitials("The Reikland Reavers")).toBe("RR");
  });
  it("garde deux lettres d'un nom en un mot", () => {
    expect(teamInitials("Nains")).toBe("NA");
    expect(teamInitials("élus")).toBe("ÉL");
  });
  it("replie sur les mots mineurs, puis sur « ? »", () => {
    expect(teamInitials("Les")).toBe("LE");
    expect(teamInitials("  !! ")).toBe("?");
  });
});

describe("crestFor", () => {
  it("prend la couleur du roster et un texte lisible", () => {
    const crest = crestFor({ name: "Rats", roster: "skaven" });
    expect(crest.initials).toBe("RA");
    expect(crest.background).toMatch(/^#[0-9a-f]{6}$/);
    expect(["#ffffff", "#1c1917"]).toContain(crest.color);
  });
  it("retombe sur les couleurs par défaut pour un roster inconnu", () => {
    const crest = crestFor({ name: "X", roster: "not_a_roster" });
    expect(crest.background).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("formatRelativeAge", () => {
  const NOW = Date.parse("2026-09-29T12:00:00Z");
  const ago = (ms: number) => new Date(NOW - ms).toISOString();
  const H = 3_600_000;

  it("choisit l'unité selon l'écart", () => {
    const fmt = (unit: Intl.RelativeTimeFormatUnit, v: number) =>
      new Intl.RelativeTimeFormat("fr", { numeric: "auto", style: "short" }).format(v, unit);
    expect(formatRelativeAge(ago(10_000), NOW, "fr")).toBe(fmt("second", 0));
    expect(formatRelativeAge(ago(5 * 60_000), NOW, "fr")).toBe(fmt("minute", -5));
    expect(formatRelativeAge(ago(2 * H), NOW, "fr")).toBe(fmt("hour", -2));
    expect(formatRelativeAge(ago(26 * H), NOW, "fr")).toBe(fmt("day", -1));
    expect(formatRelativeAge(ago(10 * 24 * H), NOW, "fr")).toBe(fmt("week", -1));
    expect(formatRelativeAge(ago(70 * 24 * H), NOW, "fr")).toBe(fmt("month", -2));
  });

  it("traite une date future comme « maintenant »", () => {
    expect(formatRelativeAge(ago(-H), NOW, "en")).toBe(formatRelativeAge(ago(0), NOW, "en"));
  });

  it("rend null pour une date illisible", () => {
    expect(formatRelativeAge("", NOW, "fr")).toBeNull();
    expect(formatRelativeAge("pas une date", NOW, "fr")).toBeNull();
  });
});
