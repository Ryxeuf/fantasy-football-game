import { describe, it, expect } from "vitest";
import {
  privateTeamDivertTarget,
  SHARE_RESOLVER_PREFIX,
} from "./private-team-share-divert";

describe("privateTeamDivertTarget", () => {
  it("détourne la fiche d'équipe vers le résolveur public", () => {
    expect(
      privateTeamDivertTarget({
        pathname: "/me/teams/cmth24v0402zhmv0z13fki28f",
        syncFallback: false,
      }),
    ).toBe(`${SHARE_RESOLVER_PREFIX}/cmth24v0402zhmv0z13fki28f`);
  });

  it("reconduit le repli /auth/sync quand aucun cookie n'était présent", () => {
    expect(
      privateTeamDivertTarget({ pathname: "/me/teams/abc", syncFallback: true }),
    ).toBe(`${SHARE_RESOLVER_PREFIX}/abc?sync=1`);
  });

  it("tolère le slash final", () => {
    expect(
      privateTeamDivertTarget({
        pathname: "/me/teams/abc/",
        syncFallback: false,
      }),
    ).toBe(`${SHARE_RESOLVER_PREFIX}/abc`);
  });

  it("ne touche ni la liste, ni le builder, ni les sous-pages", () => {
    for (const pathname of [
      "/me/teams",
      "/me/teams/",
      "/me/teams/new",
      "/me/teams/abc/edit",
      "/me/teams/abc/journal",
      "/me/teams/abc/opengraph-image",
      "/me/profile",
    ]) {
      // `/me/teams/new` a la forme d'une feuille : c'est le builder, il
      // DOIT continuer de passer par le login sans détour par le résolveur.
      expect(privateTeamDivertTarget({ pathname, syncFallback: false })).toBeNull();
    }
  });

  it("ne détourne pas une requête portant une query string", () => {
    expect(
      privateTeamDivertTarget({
        pathname: "/me/teams/abc",
        search: "?tab=roster",
        syncFallback: false,
      }),
    ).toBeNull();
  });

  it("ne détourne que les lectures", () => {
    expect(
      privateTeamDivertTarget({
        pathname: "/me/teams/abc",
        method: "POST",
        syncFallback: false,
      }),
    ).toBeNull();
    expect(
      privateTeamDivertTarget({
        pathname: "/me/teams/abc",
        method: "head",
        syncFallback: false,
      }),
    ).toBe(`${SHARE_RESOLVER_PREFIX}/abc`);
  });

  it("ignore un id porteur de caractères de chemin", () => {
    expect(
      privateTeamDivertTarget({
        pathname: "/me/teams/../../admin",
        syncFallback: false,
      }),
    ).toBeNull();
  });
});
