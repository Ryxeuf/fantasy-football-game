/**
 * Tests pour le builder schema.org Event pour les ligues publiques
 * (Q.24 — Sprint 23).
 *
 * Le builder produit un JSON-LD `SportsEvent` consommable par Google
 * (Rich Results Event) et les LLM (citabilite). Champs obligatoires :
 * name, startDate, location ; champs recommandes : description,
 * organizer, eventStatus, eventAttendanceMode.
 */
import { describe, it, expect } from "vitest";
import {
  buildLeagueEventSchema,
  type LeagueEventInput,
} from "./event-schema";

const baseInput: LeagueEventInput = {
  baseUrl: "https://nufflearena.fr",
  league: {
    id: "open-5-teams",
    name: "Open 5 Teams - Saison 1",
    description: "Ligue ouverte aux 5 equipes prioritaires",
    status: "open",
    startDate: new Date("2026-05-01T18:00:00Z"),
    endDate: new Date("2026-08-01T18:00:00Z"),
    maxParticipants: 16,
    isPublic: true,
  },
};

describe("buildLeagueEventSchema", () => {
  it("retourne null pour une ligue non publique (pas d emission JSON-LD)", () => {
    const schema = buildLeagueEventSchema({
      ...baseInput,
      league: { ...baseInput.league, isPublic: false },
    });
    expect(schema).toBeNull();
  });

  it("retourne un objet @context schema.org + SportsEvent", () => {
    const schema = buildLeagueEventSchema(baseInput);
    expect(schema).not.toBeNull();
    expect(schema!["@context"]).toBe("https://schema.org");
    expect(schema!["@type"]).toBe("SportsEvent");
  });

  it("inclut name, description, identifier", () => {
    const schema = buildLeagueEventSchema(baseInput)!;
    expect(schema.name).toBe("Open 5 Teams - Saison 1");
    expect(schema.description).toContain("Ligue ouverte");
    expect(schema.identifier).toBe("open-5-teams");
  });

  it("inclut startDate et endDate au format ISO 8601", () => {
    const schema = buildLeagueEventSchema(baseInput)!;
    expect(schema.startDate).toBe("2026-05-01T18:00:00.000Z");
    expect(schema.endDate).toBe("2026-08-01T18:00:00.000Z");
  });

  it("expose une URL canonique vers la page de la ligue", () => {
    const schema = buildLeagueEventSchema(baseInput)!;
    expect(schema.url).toBe("https://nufflearena.fr/leagues/open-5-teams");
  });

  it("expose location.@type = VirtualLocation (online event)", () => {
    const schema = buildLeagueEventSchema(baseInput)!;
    expect(schema.location["@type"]).toBe("VirtualLocation");
    expect(schema.location.url).toBe("https://nufflearena.fr/leagues/open-5-teams");
    expect(schema.eventAttendanceMode).toBe(
      "https://schema.org/OnlineEventAttendanceMode",
    );
  });

  it("expose organizer reliant l Organization global", () => {
    const schema = buildLeagueEventSchema(baseInput)!;
    expect(schema.organizer["@id"]).toBe("https://nufflearena.fr#organization");
  });

  it("expose offers gratuit (price=0, EUR, InStock)", () => {
    const schema = buildLeagueEventSchema(baseInput)!;
    expect(schema.offers).toBeDefined();
    expect(schema.offers!.price).toBe("0");
    expect(schema.offers!.priceCurrency).toBe("EUR");
    expect(schema.offers!.availability).toBe("https://schema.org/InStock");
  });

  it("mappe le status interne sur eventStatus schema.org", () => {
    expect(buildLeagueEventSchema(baseInput)!.eventStatus).toBe(
      "https://schema.org/EventScheduled",
    );
    expect(
      buildLeagueEventSchema({
        ...baseInput,
        league: { ...baseInput.league, status: "completed" },
      })!.eventStatus,
    ).toBe("https://schema.org/EventScheduled");
    expect(
      buildLeagueEventSchema({
        ...baseInput,
        league: { ...baseInput.league, status: "cancelled" },
      })!.eventStatus,
    ).toBe("https://schema.org/EventCancelled");
  });

  it("inclut maximumAttendeeCapacity quand maxParticipants > 0", () => {
    const schema = buildLeagueEventSchema(baseInput)!;
    expect(schema.maximumAttendeeCapacity).toBe(16);
  });

  it("omet endDate si non fournie", () => {
    const schema = buildLeagueEventSchema({
      ...baseInput,
      league: { ...baseInput.league, endDate: null },
    })!;
    expect(schema.endDate).toBeUndefined();
  });

  it("est deterministe", () => {
    const a = JSON.stringify(buildLeagueEventSchema(baseInput));
    const b = JSON.stringify(buildLeagueEventSchema(baseInput));
    expect(a).toBe(b);
  });
});
