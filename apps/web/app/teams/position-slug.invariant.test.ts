import { describe, it, expect } from "vitest";
import { TEAM_ROSTERS_BY_RULESET } from "@bb/game-engine";

/**
 * Invariant dont depend la reconstruction de slug d'URL des pages position
 * (`/teams/[slug]/[position]`, cf. `position-slug.ts` -> `resolvePosition`) :
 * pour chaque roster season_3, le slug de chacune de ses positions DOIT
 * commencer par `${rosterSlug}_`. Si un futur roster derogeait, la
 * reconstruction tomberait sur le repli suffixe ; ce test documente et
 * protege la convention.
 */
describe("invariant: slug de position prefixe par le roster (season_3)", () => {
  const rosters = TEAM_ROSTERS_BY_RULESET.season_3;

  it("expose au moins un roster season_3", () => {
    expect(Object.keys(rosters).length).toBeGreaterThan(0);
  });

  for (const [rosterSlug, roster] of Object.entries(rosters)) {
    it(`${rosterSlug}: toutes les positions sont prefixees`, () => {
      const offenders = roster.positions
        .map((p) => p.slug)
        .filter((slug) => !slug.startsWith(`${rosterSlug}_`));
      expect(offenders).toEqual([]);
    });
  }
});
