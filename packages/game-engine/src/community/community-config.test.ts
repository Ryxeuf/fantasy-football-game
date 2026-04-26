import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COMMUNITY_LINKS,
  buildCommunityLinks,
  type CommunityEnv,
} from './community-config';

describe('Regle: community-config (O.9 community)', () => {
  describe('DEFAULT_COMMUNITY_LINKS', () => {
    it('expose un lien Discord en defaut (string non vide)', () => {
      expect(typeof DEFAULT_COMMUNITY_LINKS.discordInviteUrl).toBe('string');
      expect(DEFAULT_COMMUNITY_LINKS.discordInviteUrl.length).toBeGreaterThan(0);
      expect(DEFAULT_COMMUNITY_LINKS.discordInviteUrl).toMatch(/^https:\/\/discord\.gg\//);
    });
  });

  describe('buildCommunityLinks(env)', () => {
    it('retourne les defauts si env est vide ou undefined', () => {
      expect(buildCommunityLinks({})).toEqual(DEFAULT_COMMUNITY_LINKS);
      expect(buildCommunityLinks(undefined)).toEqual(DEFAULT_COMMUNITY_LINKS);
    });

    it('override DISCORD_INVITE_URL si fourni dans env', () => {
      const env: CommunityEnv = {
        DISCORD_INVITE_URL: 'https://discord.gg/customServer',
      };
      const links = buildCommunityLinks(env);
      expect(links.discordInviteUrl).toBe('https://discord.gg/customServer');
    });

    it('ignore une URL non-https Discord (securite)', () => {
      const env: CommunityEnv = {
        DISCORD_INVITE_URL: 'http://malicious.example.com/discord',
      };
      const links = buildCommunityLinks(env);
      expect(links.discordInviteUrl).toBe(DEFAULT_COMMUNITY_LINKS.discordInviteUrl);
    });

    it('ignore une URL completement invalide (fallback aux defauts)', () => {
      const env: CommunityEnv = { DISCORD_INVITE_URL: 'not a url' };
      const links = buildCommunityLinks(env);
      expect(links.discordInviteUrl).toBe(DEFAULT_COMMUNITY_LINKS.discordInviteUrl);
    });

    it('ignore une chaine vide', () => {
      const env: CommunityEnv = { DISCORD_INVITE_URL: '' };
      const links = buildCommunityLinks(env);
      expect(links.discordInviteUrl).toBe(DEFAULT_COMMUNITY_LINKS.discordInviteUrl);
    });
  });
});
