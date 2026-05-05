/**
 * L2.C.8 — Tests du builder PURE `buildSeasonEventSchema`.
 */

import { describe, it, expect } from "vitest";
import { buildSeasonEventSchema } from "./season-event-schema";

const base = {
  baseUrl: "https://nuffle-arena.com",
  leagueId: "league-1",
  seasonId: "season-1",
  seasonName: "Saison 1",
  leagueName: "Ligue Skaven",
};

describe("buildSeasonEventSchema", () => {
  it("returns null when status is not completed", () => {
    expect(
      buildSeasonEventSchema({
        ...base,
        status: "in_progress",
        endedAt: null,
        championCoachName: "Alice",
        championTeamName: "Skaven Squad",
      }),
    ).toBeNull();
  });

  it("returns null when championCoachName is missing", () => {
    expect(
      buildSeasonEventSchema({
        ...base,
        status: "completed",
        endedAt: null,
        championCoachName: null,
        championTeamName: null,
      }),
    ).toBeNull();
  });

  it("returns null when baseUrl is empty", () => {
    expect(
      buildSeasonEventSchema({
        ...base,
        baseUrl: "",
        status: "completed",
        endedAt: null,
        championCoachName: "Alice",
        championTeamName: null,
      }),
    ).toBeNull();
  });

  it("emits a valid schema when all conditions are met", () => {
    const schema = buildSeasonEventSchema({
      ...base,
      status: "completed",
      endedAt: "2026-05-04T10:00:00.000Z",
      championCoachName: "Alice",
      championTeamName: "Skaven Squad",
    });
    expect(schema).not.toBeNull();
    expect(schema?.name).toBe("Ligue Skaven — Saison 1");
    expect(schema?.url).toBe(
      "https://nuffle-arena.com/leagues/league-1/seasons/season-1/recap",
    );
    expect(schema?.endDate).toBe("2026-05-04T10:00:00.000Z");
    expect(schema?.winner).toEqual({
      "@type": "Person",
      name: "Alice",
    });
    expect(schema?.organizer.name).toBe("Nuffle Arena");
    expect(schema?.description).toContain("Champion : Alice");
    expect(schema?.description).toContain("Skaven Squad");
  });

  it("omits endDate when endedAt is null", () => {
    const schema = buildSeasonEventSchema({
      ...base,
      status: "completed",
      endedAt: null,
      championCoachName: "Alice",
      championTeamName: null,
    });
    expect(schema?.endDate).toBeUndefined();
  });

  it("uses simpler description when championTeamName is null", () => {
    const schema = buildSeasonEventSchema({
      ...base,
      status: "completed",
      endedAt: null,
      championCoachName: "Alice",
      championTeamName: null,
    });
    expect(schema?.description).toBe(
      "Saison 1 de Ligue Skaven — Champion : Alice.",
    );
  });
});
