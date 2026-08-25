import { describe, it, expect } from "vitest";
import {
  BUILDER_DEFAULTS,
  DEFAULT_BUILDER_ROSTER,
  readBuilderParams,
} from "./builder-url-params";

describe("readBuilderParams", () => {
  it("lit le roster, l'édition et le format d'une fiche de roster", () => {
    const p = readBuilderParams("?roster=goblin&ruleset=season_2&format=sevens");
    expect(p.roster).toBe("goblin");
    expect(p.ruleset).toBe("season_2");
    expect(p.format).toBe("sevens");
  });

  it("ignore une édition ou un format inconnus", () => {
    const p = readBuilderParams("?ruleset=season_9&format=bb42");
    expect(p.ruleset).toBeNull();
    expect(p.format).toBeNull();
  });

  it("rend tout null sur une query string vide", () => {
    expect(readBuilderParams("")).toMatchObject({
      roster: null,
      ruleset: null,
      format: null,
      name: null,
      teamValue: null,
      tournamentRuleset: null,
      cupId: null,
      fromTeamId: null,
    });
  });

  it("parse le budget imposé et rejette une valeur non numérique", () => {
    expect(readBuilderParams("?teamValue=1200").teamValue).toBe(1200);
    expect(readBuilderParams("?teamValue=abc").teamValue).toBeNull();
  });

  it("garde cupId / fromTeamId / name tels quels", () => {
    const p = readBuilderParams("?cupId=c1&fromTeamId=t1&name=Les%20Gobs");
    expect(p.cupId).toBe("c1");
    expect(p.fromTeamId).toBe("t1");
    expect(p.name).toBe("Les Gobs");
  });

  it("reprend le slug de règlement tel quel (validé plus tard)", () => {
    // Les règlements vivent en base : l'URL ne peut plus les valider ici.
    // La page ignore un slug que l'API ne connaît pas, et le serveur refuse
    // la création avec un règlement inconnu.
    expect(readBuilderParams("?tournamentRuleset=nope").tournamentRuleset).toBe(
      "nope",
    );
    expect(readBuilderParams("?tournamentRuleset=").tournamentRuleset).toBeNull();
  });

  it("expose des défauts indépendants de l'URL (rendu serveur)", () => {
    expect(BUILDER_DEFAULTS.roster).toBe(DEFAULT_BUILDER_ROSTER);
    expect(BUILDER_DEFAULTS.ruleset).toBe("season_3");
    expect(BUILDER_DEFAULTS.format).toBe("bb11");
  });
});
