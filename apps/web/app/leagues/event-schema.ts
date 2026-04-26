/**
 * Pure builder for schema.org SportsEvent JSON-LD on public leagues
 * (Q.24 — Sprint 23).
 *
 * Genere un objet JSON-LD `SportsEvent` consommable par Google
 * (Rich Results Event) et les LLM (citabilite). Pure : pas de fetch,
 * pas d'I/O. La page `/leagues/[id]` consomme ce builder pour emettre
 * le `<script type="application/ld+json">`.
 *
 * Conditions d'emission :
 *   - league.isPublic === true
 *   - sinon : retourne `null` (pas de leak de ligues privees)
 */

export type LeaguePublicStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled"
  | string;

export interface LeagueEventLeague {
  id: string;
  name: string;
  description: string | null;
  status: LeaguePublicStatus;
  startDate: Date | null;
  endDate: Date | null;
  maxParticipants: number;
  isPublic: boolean;
}

export interface LeagueEventInput {
  baseUrl: string;
  league: LeagueEventLeague;
}

export interface SportsEventOffers {
  "@type": "Offer";
  price: string;
  priceCurrency: string;
  availability: string;
  url?: string;
}

export interface SportsEventSchema {
  "@context": "https://schema.org";
  "@type": "SportsEvent";
  name: string;
  description?: string;
  identifier: string;
  url: string;
  startDate?: string;
  endDate?: string;
  eventStatus: string;
  eventAttendanceMode: string;
  location: {
    "@type": "VirtualLocation";
    url: string;
  };
  organizer: {
    "@id": string;
  };
  offers?: SportsEventOffers;
  maximumAttendeeCapacity?: number;
}

const STATUS_MAP: Record<string, string> = {
  draft: "https://schema.org/EventScheduled",
  open: "https://schema.org/EventScheduled",
  in_progress: "https://schema.org/EventScheduled",
  completed: "https://schema.org/EventScheduled",
  cancelled: "https://schema.org/EventCancelled",
  postponed: "https://schema.org/EventPostponed",
  rescheduled: "https://schema.org/EventRescheduled",
};

export function buildLeagueEventSchema(
  input: LeagueEventInput,
): SportsEventSchema | null {
  const { baseUrl, league } = input;
  if (!league.isPublic) return null;

  const cleanBase = stripTrailingSlash(baseUrl);
  const url = `${cleanBase}/leagues/${league.id}`;
  const eventStatus =
    STATUS_MAP[league.status] ?? "https://schema.org/EventScheduled";

  const schema: SportsEventSchema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: league.name,
    identifier: league.id,
    url,
    eventStatus,
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "VirtualLocation", url },
    organizer: { "@id": `${cleanBase}#organization` },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url,
    },
  };

  if (league.description) {
    schema.description = league.description;
  }
  if (league.startDate) {
    schema.startDate = league.startDate.toISOString();
  }
  if (league.endDate) {
    schema.endDate = league.endDate.toISOString();
  }
  if (league.maxParticipants > 0) {
    schema.maximumAttendeeCapacity = league.maxParticipants;
  }

  return schema;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
