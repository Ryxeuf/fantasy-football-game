/**
 * Discord webhook payload builder (O.9 community features).
 *
 * Pure formatter — given a featured match (typically the Match of the
 * Week), produces a Discord-compatible webhook payload that the server
 * can POST to a configured webhook URL.
 *
 * No side effects, no fetch — keeps the engine free of HTTP concerns.
 */
import { ROSTER_COLORS, DEFAULT_TEAM_COLORS } from '../rosters/team-colors';

export interface DiscordMatchAnnouncementInput {
  /** Public URL of the match page (must be a valid http/https URL). */
  matchUrl: string;
  teamAName: string;
  teamBName: string;
  teamARoster?: string;
  teamBRoster?: string;
  scoreA: number;
  scoreB: number;
  totalCasualties: number;
  /** Optional banner string, e.g. "Match of the Week". */
  highlight?: string;
}

/** Discord embed field — keep aligned with Discord's webhook spec. */
export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title: string;
  url?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
}

export interface DiscordWebhookPayload {
  content?: string;
  embeds: DiscordEmbed[];
}

const TITLE_LIMIT = 256;

/**
 * Build a Discord webhook payload announcing a featured match.
 *
 * @throws if `matchUrl` is not a valid http(s) URL.
 */
export function buildDiscordMatchAnnouncement(
  input: DiscordMatchAnnouncementInput,
): DiscordWebhookPayload {
  assertHttpUrl(input.matchUrl);

  const winnerRoster = pickWinnerRoster(input);
  const color = winnerRoster
    ? (ROSTER_COLORS[winnerRoster]?.primary ?? DEFAULT_TEAM_COLORS.primary)
    : DEFAULT_TEAM_COLORS.primary;

  const title = truncate(
    `${input.teamAName} ${input.scoreA} - ${input.scoreB} ${input.teamBName}`,
    TITLE_LIMIT,
  );

  const description = input.highlight ? `**${input.highlight}**` : undefined;

  const fields: DiscordEmbedField[] = [
    {
      name: 'Score',
      value: `${input.scoreA} - ${input.scoreB}`,
      inline: true,
    },
    {
      name: 'Casualties',
      value: `${Math.max(0, input.totalCasualties)}`,
      inline: true,
    },
  ];

  return {
    embeds: [
      {
        title,
        url: input.matchUrl,
        description,
        color,
        fields,
      },
    ],
  };
}

function pickWinnerRoster(
  input: DiscordMatchAnnouncementInput,
): string | undefined {
  if (input.scoreA > input.scoreB) return input.teamARoster;
  if (input.scoreB > input.scoreA) return input.teamBRoster;
  return undefined; // draw: keep default colour
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + '…';
}

function assertHttpUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid match URL: ${value}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid match URL protocol: ${parsed.protocol}`);
  }
}
