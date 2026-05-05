/**
 * L2.C.8 — Sprint Ligues v2 PR9 : JSON-LD SportsEvent pour
 * `/leagues/[id]/seasons/[sid]/recap`.
 *
 * Pure (pas de fetch, pas d'I/O). Genere un objet JSON-LD
 * consommable par Google (Rich Results) et les LLM. Emis seulement
 * quand la saison est `completed` et qu'un champion existe — sinon
 * on renvoie null pour ne pas polluer l'index avec des evenements
 * inacheves.
 */

export interface SeasonEventInput {
  baseUrl: string;
  leagueId: string;
  seasonId: string;
  seasonName: string;
  leagueName: string;
  /** Statut de la saison : "completed" requis pour emettre le schema. */
  status: string;
  /** ISO date du snapshot d'awards (createdAt) si dispo. */
  endedAt: string | null;
  championCoachName: string | null;
  championTeamName: string | null;
}

export interface SeasonSportsEventSchema {
  "@context": "https://schema.org";
  "@type": "SportsEvent";
  name: string;
  description: string;
  identifier: string;
  url: string;
  endDate?: string;
  eventStatus: string;
  eventAttendanceMode: string;
  location: {
    "@type": "VirtualLocation";
    url: string;
  };
  organizer: {
    "@type": "Organization";
    name: string;
    url: string;
  };
  winner?: {
    "@type": "Person";
    name: string;
  };
}

export function buildSeasonEventSchema(
  input: SeasonEventInput,
): SeasonSportsEventSchema | null {
  if (input.status !== "completed") return null;
  if (!input.championCoachName) return null;
  if (input.baseUrl.length === 0) return null;

  const url = `${input.baseUrl}/leagues/${input.leagueId}/seasons/${input.seasonId}/recap`;
  const description = input.championTeamName
    ? `${input.seasonName} de ${input.leagueName} — Champion : ${input.championCoachName} (${input.championTeamName}).`
    : `${input.seasonName} de ${input.leagueName} — Champion : ${input.championCoachName}.`;

  const schema: SeasonSportsEventSchema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${input.leagueName} — ${input.seasonName}`,
    description,
    identifier: input.seasonId,
    url,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode:
      "https://schema.org/OnlineEventAttendanceMode",
    location: {
      "@type": "VirtualLocation",
      url: input.baseUrl,
    },
    organizer: {
      "@type": "Organization",
      name: "Nuffle Arena",
      url: input.baseUrl,
    },
    winner: {
      "@type": "Person",
      name: input.championCoachName,
    },
  };
  if (input.endedAt) {
    schema.endDate = input.endedAt;
  }
  return schema;
}
