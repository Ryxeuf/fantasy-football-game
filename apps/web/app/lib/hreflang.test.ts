/**
 * Tests pour le helper hreflang alternates (Q.27 — Sprint 23).
 *
 * Q.27 vise a preparer le split i18n par page : aujourd hui une seule
 * URL sert FR et EN via LanguageContext, mais quand le split aura
 * lieu (/fr/teams vs /en/teams), il faudra emettre des hreflang
 * differents par langue.
 *
 * Ce helper centralise la logique pour que la migration future ne
 * touche qu un seul endroit. En l etat (i18n unifiee), il retourne
 * la meme URL pour fr / en / x-default — comportement identique a
 * l existant duplique dans 8+ layouts.
 */
import { describe, it, expect } from "vitest";
import {
  buildHreflangAlternates,
  buildCanonicalUrl,
  type HreflangInput,
} from "./hreflang";

const baseInput: HreflangInput = {
  baseUrl: "https://nufflearena.fr",
  pathname: "/teams",
};

describe("buildCanonicalUrl", () => {
  it("compose baseUrl + pathname avec un seul slash", () => {
    expect(buildCanonicalUrl({ baseUrl: "https://nufflearena.fr", pathname: "/teams" })).toBe(
      "https://nufflearena.fr/teams",
    );
  });

  it("strip le trailing slash de baseUrl", () => {
    expect(buildCanonicalUrl({ baseUrl: "https://nufflearena.fr/", pathname: "/teams" })).toBe(
      "https://nufflearena.fr/teams",
    );
  });

  it("ajoute un leading slash si pathname n en a pas", () => {
    expect(buildCanonicalUrl({ baseUrl: "https://nufflearena.fr", pathname: "teams" })).toBe(
      "https://nufflearena.fr/teams",
    );
  });

  it("retourne baseUrl sans trailing slash pour la home (pathname /)", () => {
    expect(buildCanonicalUrl({ baseUrl: "https://nufflearena.fr", pathname: "/" })).toBe(
      "https://nufflearena.fr",
    );
  });
});

describe("buildHreflangAlternates", () => {
  it("emet les 3 alternates fr-FR / en / x-default", () => {
    const alt = buildHreflangAlternates(baseInput);
    expect(Object.keys(alt.languages).sort()).toEqual([
      "fr-FR",
      "x-default",
      "en",
    ].sort());
  });

  it("expose un canonical aligne avec buildCanonicalUrl", () => {
    const alt = buildHreflangAlternates(baseInput);
    expect(alt.canonical).toBe("https://nufflearena.fr/teams");
  });

  it("en l etat (i18n unifiee), toutes les langues pointent sur la meme URL", () => {
    const alt = buildHreflangAlternates(baseInput);
    expect(alt.languages["fr-FR"]).toBe(alt.languages.en);
    expect(alt.languages.en).toBe(alt.languages["x-default"]);
  });

  it("respecte le split i18n quand splitI18n=true (futur prochain)", () => {
    const alt = buildHreflangAlternates({ ...baseInput, splitI18n: true });
    expect(alt.languages["fr-FR"]).toBe("https://nufflearena.fr/fr/teams");
    expect(alt.languages.en).toBe("https://nufflearena.fr/en/teams");
    expect(alt.languages["x-default"]).toBe("https://nufflearena.fr/teams");
  });

  it("avec splitI18n et pathname /, route les langues vers /fr et /en", () => {
    const alt = buildHreflangAlternates({
      baseUrl: "https://nufflearena.fr",
      pathname: "/",
      splitI18n: true,
    });
    expect(alt.languages["fr-FR"]).toBe("https://nufflearena.fr/fr");
    expect(alt.languages.en).toBe("https://nufflearena.fr/en");
    expect(alt.languages["x-default"]).toBe("https://nufflearena.fr");
  });

  it("est deterministe", () => {
    expect(buildHreflangAlternates(baseInput)).toEqual(
      buildHreflangAlternates(baseInput),
    );
  });

  it("rejette une baseUrl non https", () => {
    expect(() =>
      buildHreflangAlternates({ ...baseInput, baseUrl: "http://nufflearena.fr" }),
    ).toThrow(/https/i);
  });

  it("rejette une baseUrl invalide", () => {
    expect(() =>
      buildHreflangAlternates({ ...baseInput, baseUrl: "not-a-url" }),
    ).toThrow(/baseurl/i);
  });
});
