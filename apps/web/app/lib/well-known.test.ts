/**
 * Tests pour les builders /humans.txt et /.well-known/security.txt
 * (Q.22 — Sprint 23).
 *
 * - humans.txt : convention humanstxt.org, document texte qui credite
 *   l equipe + l environnement technique.
 * - security.txt : RFC 9116, document texte qui indique comment
 *   reporter une vulnerabilite (Contact, Expires obligatoires).
 */
import { describe, it, expect } from "vitest";
import { buildHumansTxt, buildSecurityTxt } from "./well-known";

describe("buildHumansTxt", () => {
  it("inclut les sections TEAM et SITE de la convention humanstxt.org", () => {
    const txt = buildHumansTxt({
      siteUrl: "https://nufflearena.fr",
      teamLine: "Nuffle Arena maintainers",
      contactUrl: "https://github.com/Ryxeuf/fantasy-football-game",
    });
    expect(txt).toContain("/* TEAM */");
    expect(txt).toContain("/* SITE */");
    expect(txt).toContain("Nuffle Arena maintainers");
  });

  it("inclut un Last update au format YYYY/MM/DD", () => {
    const txt = buildHumansTxt({
      siteUrl: "https://nufflearena.fr",
      teamLine: "x",
      contactUrl: "https://github.com/x/y",
      lastUpdate: new Date("2026-04-26T10:00:00Z"),
    });
    expect(txt).toContain("Last update: 2026/04/26");
  });

  it("inclut la stack technologique (Next.js, TypeScript)", () => {
    const txt = buildHumansTxt({
      siteUrl: "https://nufflearena.fr",
      teamLine: "x",
      contactUrl: "https://github.com/x/y",
    });
    expect(txt.toLowerCase()).toContain("next.js");
    expect(txt.toLowerCase()).toContain("typescript");
  });

  it("est deterministe pour une lastUpdate fixe", () => {
    const input = {
      siteUrl: "https://nufflearena.fr",
      teamLine: "x",
      contactUrl: "https://github.com/x/y",
      lastUpdate: new Date("2026-04-26T00:00:00Z"),
    };
    expect(buildHumansTxt(input)).toBe(buildHumansTxt(input));
  });
});

describe("buildSecurityTxt", () => {
  const today = new Date("2026-04-26T00:00:00Z");

  it("inclut Contact et Expires (champs obligatoires RFC 9116)", () => {
    const txt = buildSecurityTxt({
      contact: "mailto:security@nufflearena.fr",
      expires: new Date("2027-04-26T00:00:00Z"),
    });
    expect(txt).toContain("Contact: mailto:security@nufflearena.fr");
    expect(txt).toMatch(/Expires: 2027-04-26T00:00:00\.000Z/);
  });

  it("inclut Preferred-Languages quand fourni", () => {
    const txt = buildSecurityTxt({
      contact: "mailto:security@nufflearena.fr",
      expires: new Date("2027-04-26T00:00:00Z"),
      preferredLanguages: ["fr", "en"],
    });
    expect(txt).toContain("Preferred-Languages: fr, en");
  });

  it("inclut Canonical quand fourni (URL completes)", () => {
    const txt = buildSecurityTxt({
      contact: "mailto:security@nufflearena.fr",
      expires: new Date("2027-04-26T00:00:00Z"),
      canonical: "https://nufflearena.fr/.well-known/security.txt",
    });
    expect(txt).toContain(
      "Canonical: https://nufflearena.fr/.well-known/security.txt",
    );
  });

  it("inclut Acknowledgments si fourni", () => {
    const txt = buildSecurityTxt({
      contact: "mailto:security@nufflearena.fr",
      expires: new Date("2027-04-26T00:00:00Z"),
      acknowledgments: "https://nufflearena.fr/security-thanks",
    });
    expect(txt).toContain(
      "Acknowledgments: https://nufflearena.fr/security-thanks",
    );
  });

  it("rejette une expiration deja passee (defense)", () => {
    expect(() =>
      buildSecurityTxt({
        contact: "mailto:security@nufflearena.fr",
        expires: new Date("2020-01-01T00:00:00Z"),
        now: today,
      }),
    ).toThrow(/expires/i);
  });

  it("rejette un contact ne ressemblant pas a une URL/mailto", () => {
    expect(() =>
      buildSecurityTxt({
        contact: "not-a-url-or-mailto",
        expires: new Date("2027-04-26T00:00:00Z"),
      }),
    ).toThrow(/contact/i);
  });

  it("est deterministe", () => {
    const input = {
      contact: "mailto:security@nufflearena.fr",
      expires: new Date("2027-04-26T00:00:00Z"),
    };
    expect(buildSecurityTxt(input)).toBe(buildSecurityTxt(input));
  });

  it("se termine par une nouvelle ligne (convention text/plain)", () => {
    const txt = buildSecurityTxt({
      contact: "mailto:security@nufflearena.fr",
      expires: new Date("2027-04-26T00:00:00Z"),
    });
    expect(txt.endsWith("\n")).toBe(true);
  });
});
