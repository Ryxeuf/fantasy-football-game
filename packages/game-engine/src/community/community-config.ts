/**
 * Community config (O.9 community features).
 *
 * Centralises the public community links (Discord invite, etc.) so the
 * web client, server, and mobile share the same source of truth.
 *
 * Resolution: caller passes an env-shaped object (typically `process.env`
 * filtered to whitelisted keys). Invalid / non-https values fall back to
 * the canonical defaults to avoid leaking misconfigured URLs into the UI.
 */

export interface CommunityLinks {
  /** Discord invite URL (must be https://discord.gg/...). */
  discordInviteUrl: string;
}

export interface CommunityEnv {
  DISCORD_INVITE_URL?: string;
}

/**
 * Canonical defaults — kept in sync with what currently ships in the web
 * footer so behaviour is unchanged when no override is provided.
 */
export const DEFAULT_COMMUNITY_LINKS: CommunityLinks = {
  discordInviteUrl: 'https://discord.gg/XEZJTgEHKn',
};

/**
 * Resolve community links from environment overrides.
 *
 * Validation rules:
 *   - URL must parse as a valid URL
 *   - URL must use https://discord.gg/ prefix (no other hosts allowed)
 *   - On any failure, fall back to {@link DEFAULT_COMMUNITY_LINKS}
 */
export function buildCommunityLinks(env: CommunityEnv | undefined): CommunityLinks {
  const discord = sanitizeDiscordInvite(env?.DISCORD_INVITE_URL);
  return {
    discordInviteUrl: discord ?? DEFAULT_COMMUNITY_LINKS.discordInviteUrl,
  };
}

function sanitizeDiscordInvite(value: string | undefined): string | null {
  if (!value || value.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.hostname !== 'discord.gg') return null;
  if (parsed.pathname.length <= 1) return null;
  return parsed.toString().replace(/\/$/, '');
}
