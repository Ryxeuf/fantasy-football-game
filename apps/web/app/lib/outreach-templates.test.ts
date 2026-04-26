/**
 * Tests pour le module de templates d'annonce communautaire
 * (Q.26 — Sprint 23).
 *
 * Le module versionne les templates de messages d'annonce destines aux
 * canaux communautaires (r/bloodbowl, TalkFantasyFootball, Discord BB,
 * blog Mordorbihan, etc.). Le suivi opere a la main, mais les
 * templates sont versionnes pour garantir la coherence du ton.
 */
import { describe, it, expect } from "vitest";
import {
  OUTREACH_CHANNELS,
  OUTREACH_TEMPLATES,
  renderOutreachTemplate,
  type OutreachChannel,
  type OutreachTemplate,
} from "./outreach-templates";

describe("OUTREACH_CHANNELS", () => {
  it("inclut au minimum les 4 canaux cibles de Q.26", () => {
    expect(OUTREACH_CHANNELS).toContain("reddit_bloodbowl");
    expect(OUTREACH_CHANNELS).toContain("talkfantasyfootball");
    expect(OUTREACH_CHANNELS).toContain("discord_bloodbowl");
    expect(OUTREACH_CHANNELS).toContain("mordorbihan_blog");
  });

  it("toutes les valeurs sont distinctes", () => {
    const values = Array.from(OUTREACH_CHANNELS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("OUTREACH_TEMPLATES", () => {
  it("definit un template par canal", () => {
    for (const channel of OUTREACH_CHANNELS) {
      expect(
        OUTREACH_TEMPLATES[channel],
        `template manquant pour ${channel}`,
      ).toBeDefined();
    }
  });

  it("chaque template a title, body, callToAction non vides", () => {
    for (const channel of OUTREACH_CHANNELS) {
      const t = OUTREACH_TEMPLATES[channel];
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThan(20);
      expect(t.callToAction.length).toBeGreaterThan(0);
    }
  });

  it("chaque template mentionne {siteUrl} pour interpolation", () => {
    for (const channel of OUTREACH_CHANNELS) {
      const t = OUTREACH_TEMPLATES[channel];
      const all = `${t.title} ${t.body} ${t.callToAction}`;
      expect(
        all.includes("{siteUrl}"),
        `template ${channel} doit utiliser {siteUrl}`,
      ).toBe(true);
    }
  });
});

describe("renderOutreachTemplate", () => {
  const baseInput = {
    siteUrl: "https://nufflearena.fr",
    discordInvite: "https://discord.gg/XEZJTgEHKn",
  };

  it("interpole {siteUrl} au minimum dans le call to action", () => {
    const r = renderOutreachTemplate("reddit_bloodbowl", baseInput);
    expect(r.callToAction).toContain("https://nufflearena.fr");
  });

  it("ne laisse aucun siteUrl placeholder non resolu", () => {
    for (const channel of OUTREACH_CHANNELS) {
      const r = renderOutreachTemplate(channel, baseInput);
      const all = `${r.title} ${r.body} ${r.callToAction}`;
      expect(all.includes("{siteUrl}"), `${channel} a un siteUrl non resolu`).toBe(false);
    }
  });

  it("interpole {discordInvite} si fourni", () => {
    const r = renderOutreachTemplate("discord_bloodbowl", {
      ...baseInput,
      discordInvite: "https://discord.gg/customInvite",
    });
    const all = `${r.title} ${r.body} ${r.callToAction}`;
    expect(all).toContain("https://discord.gg/customInvite");
  });

  it("ne laisse aucun placeholder {x} non resolu apres render", () => {
    for (const channel of OUTREACH_CHANNELS) {
      const r = renderOutreachTemplate(channel, baseInput);
      const all = `${r.title} ${r.body} ${r.callToAction}`;
      expect(/\{[^}]+\}/.test(all), `${channel} a un placeholder non resolu`).toBe(false);
    }
  });

  it("est deterministe : meme entree -> meme sortie", () => {
    const a = renderOutreachTemplate("reddit_bloodbowl", baseInput);
    const b = renderOutreachTemplate("reddit_bloodbowl", baseInput);
    expect(a).toEqual(b);
  });

  it("leve une erreur pour un canal inconnu", () => {
    expect(() =>
      renderOutreachTemplate("unknown" as OutreachChannel, baseInput),
    ).toThrow(/channel/i);
  });

  it("rejette siteUrl vide / non-url", () => {
    expect(() =>
      renderOutreachTemplate("reddit_bloodbowl", {
        ...baseInput,
        siteUrl: "not-a-url",
      }),
    ).toThrow(/siteUrl/i);
  });
});

describe("compatibilite type", () => {
  it("OutreachTemplate accepte le shape attendu", () => {
    const t: OutreachTemplate = {
      title: "x",
      body: "y",
      callToAction: "z",
    };
    expect(t.title).toBe("x");
  });
});
