import { describe, it, expect } from "vitest";
import { heroLoginHref, heroPrimaryCta } from "./hero-cta";

describe("heroPrimaryCta", () => {
  it("envoie un visiteur déconnecté vers l'inscription, retour à ses équipes", () => {
    const cta = heroPrimaryCta(false);
    expect(cta.labelKey).toBe("ctaCreateTeam");
    expect(cta.href).toBe("/register?redirect=%2Fme%2Fteams");
  });

  it("envoie un coach connecté directement à ses équipes", () => {
    expect(heroPrimaryCta(true)).toEqual({ href: "/me/teams", labelKey: "manageTeams" });
  });
});

describe("heroLoginHref", () => {
  it("ramène aux équipes après connexion", () => {
    expect(heroLoginHref()).toBe("/login?redirect=%2Fme%2Fteams");
  });
});
