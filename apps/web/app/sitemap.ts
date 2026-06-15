import { MetadataRoute } from 'next';

import { sitemapEntryWithAlternates } from './seo/hreflang';
import { stripRosterPrefix } from './teams/position-slug';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nufflearena.fr';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Sprint R.A.4 — chaque entree sitemap inclut `alternates.languages`
  // hreflang (FR + EN + x-default) via `sitemapEntryWithAlternates`.
  // Pages statiques publiques.
  const staticPages: MetadataRoute.Sitemap = [
    sitemapEntryWithAlternates('/', {
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    }),
    sitemapEntryWithAlternates('/teams', {
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    }),
    sitemapEntryWithAlternates('/teams/positions', {
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    }),
    sitemapEntryWithAlternates('/teams/positions/comparer', {
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    }),
    sitemapEntryWithAlternates('/star-players', {
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    }),
    sitemapEntryWithAlternates('/skills', {
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }),
    sitemapEntryWithAlternates('/tutoriel', {
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    }),
    sitemapEntryWithAlternates('/tutoriel/mon-premier-match', {
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    }),
    sitemapEntryWithAlternates('/support', {
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    }),
    sitemapEntryWithAlternates('/a-propos', {
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    }),
    // /changelog volontairement exclu du sitemap (page non publiee, noindex).
    sitemapEntryWithAlternates('/legal/mentions-legales', {
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    }),
    sitemapEntryWithAlternates('/legal/conditions-utilisation', {
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    }),
    sitemapEntryWithAlternates('/legal/politique-de-confidentialite', {
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    }),
    sitemapEntryWithAlternates('/legal/politique-de-cookies', {
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    }),
    sitemapEntryWithAlternates('/pro-league', {
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    }),
    sitemapEntryWithAlternates('/pro-league/about', {
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    }),
    sitemapEntryWithAlternates('/pro-league/standings', {
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    }),
    sitemapEntryWithAlternates('/pro-league/leaderboard', {
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    }),
    sitemapEntryWithAlternates('/pro-league/gazette', {
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    }),
    sitemapEntryWithAlternates('/pro-league/hall-of-fame', {
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    }),
  ];

  // Pages dynamiques - Teams
  let teamPages: MetadataRoute.Sitemap = [];
  try {
    const teamsResponse = await fetch(`${API_BASE}/api/rosters?lang=fr`, {
      next: { revalidate: 3600 }, // Cache pendant 1 heure
    });

    if (teamsResponse.ok) {
      const teamsData = await teamsResponse.json();
      teamPages = (teamsData.rosters || []).map((team: { slug: string }) =>
        sitemapEntryWithAlternates(`/teams/${team.slug}`, {
          lastModified: now,
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        }),
      );
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des équipes pour le sitemap:', error);
  }

  // Pages dynamiques - Star Players
  let starPlayerPages: MetadataRoute.Sitemap = [];
  try {
    const starPlayersResponse = await fetch(`${API_BASE}/star-players`, {
      next: { revalidate: 3600 }, // Cache pendant 1 heure
    });

    if (starPlayersResponse.ok) {
      const starPlayersData = await starPlayersResponse.json();
      if (starPlayersData.success && starPlayersData.data) {
        starPlayerPages = starPlayersData.data.map((player: { slug: string }) =>
          sitemapEntryWithAlternates(`/star-players/${player.slug}`, {
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.6,
          }),
        );
      }
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des Star Players pour le sitemap:', error);
  }

  // Pages dynamiques - Profils coach (S26.3g)
  let coachPages: MetadataRoute.Sitemap = [];
  try {
    const coachResponse = await fetch(`${API_BASE}/coach`, {
      next: { revalidate: 3600 }, // Cache 1h
    });
    if (coachResponse.ok) {
      const body = (await coachResponse.json()) as {
        success?: boolean;
        data?: { slugs?: unknown };
      };
      const slugs = Array.isArray(body?.data?.slugs)
        ? (body.data.slugs as unknown[]).filter(
            (s): s is string => typeof s === 'string' && s.length > 0,
          )
        : [];
      if (body?.success && slugs.length > 0) {
        coachPages = slugs.map((slug) =>
          sitemapEntryWithAlternates(`/coach/${slug}`, {
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.5,
          }),
        );
      }
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des profils coach pour le sitemap:', error);
  }

  // Pro League — equipes officielles (sprint 1.F.3). Slugs stables
  // venant de PRO_LEAGUE_TEAMS dans @bb/sim-engine. Inline ici pour
  // ne pas dependre du runtime sim-engine cote sitemap.
  const PRO_LEAGUE_TEAM_SLUGS = [
    'pit-smashers',
    'dal-vipers',
    'kc-soaring-hawks',
    'ne-cold-tacticians',
    'sf-gold-rush',
    'car-jungle-queens',
    'lv-outlaws',
    'no-voodoo-saints',
    'chi-iron-bears',
    'phi-storm-eagles',
    'phx-tomb-cardinals',
    'min-frostraiders',
    'gb-cheese-halflings',
    'jax-swamp-lizards',
    'den-mile-high-centaurs',
    'buf-snow-ogres',
  ] as const;
  const proLeagueTeamPages: MetadataRoute.Sitemap = PRO_LEAGUE_TEAM_SLUGS.map(
    (slug) =>
      sitemapEntryWithAlternates(`/pro-league/teams/${slug}`, {
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }),
  );

  // Pages dynamiques - Compétences (une page par skill, SEO longue traîne)
  let skillPages: MetadataRoute.Sitemap = [];
  try {
    const skillsResponse = await fetch(`${API_BASE}/api/skills?ruleset=season_3`, {
      next: { revalidate: 3600 },
    });
    if (skillsResponse.ok) {
      const skillsData = await skillsResponse.json();
      const seen = new Set<string>();
      skillPages = (skillsData.skills || [])
        .map((s: { slug?: string }) => s.slug)
        .filter((slug: unknown): slug is string => typeof slug === 'string' && slug.length > 0)
        .filter((slug: string) => {
          if (seen.has(slug)) return false;
          seen.add(slug);
          return true;
        })
        .map((slug: string) =>
          sitemapEntryWithAlternates(`/skills/${slug}`, {
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.6,
          }),
        );
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des compétences pour le sitemap:', error);
  }

  // Pages dynamiques - Positions de roster (une page par position, season_3,
  // SEO longue traine). Les positions ne sont pas dans la liste `/api/rosters`
  // (qui n'expose que `_count`) : on recupere le detail de chaque roster
  // season_3 en parallele, puis on emet une URL `/teams/<slug>/<position>`.
  let positionPages: MetadataRoute.Sitemap = [];
  try {
    const rostersResponse = await fetch(`${API_BASE}/api/rosters?lang=fr&ruleset=season_3`, {
      next: { revalidate: 3600 },
    });
    if (rostersResponse.ok) {
      const rostersData = await rostersResponse.json();
      const slugs: string[] = (rostersData.rosters || [])
        .map((r: { slug?: string }) => r.slug)
        .filter((s: unknown): s is string => typeof s === 'string' && s.length > 0);
      const details = await Promise.all(
        slugs.map(async (slug) => {
          try {
            const res = await fetch(
              `${API_BASE}/api/rosters/${encodeURIComponent(slug)}?lang=fr&ruleset=season_3`,
              { next: { revalidate: 3600 } },
            );
            if (!res.ok) return null;
            return (await res.json()) as {
              roster?: { slug?: string; positions?: Array<{ slug?: string }> };
            };
          } catch {
            return null;
          }
        }),
      );
      const seen = new Set<string>();
      for (const detail of details) {
        const roster = detail?.roster;
        if (!roster?.slug || !Array.isArray(roster.positions)) continue;
        for (const pos of roster.positions) {
          if (typeof pos.slug !== 'string' || pos.slug.length === 0) continue;
          const segment = stripRosterPrefix(pos.slug, roster.slug);
          const path = `/teams/${roster.slug}/${segment}`;
          if (seen.has(path)) continue;
          seen.add(path);
          positionPages.push(
            sitemapEntryWithAlternates(path, {
              lastModified: now,
              changeFrequency: 'monthly' as const,
              priority: 0.6,
            }),
          );
        }
      }
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des positions pour le sitemap:', error);
  }

  return [
    ...staticPages,
    ...teamPages,
    ...starPlayerPages,
    ...skillPages,
    ...positionPages,
    ...coachPages,
    ...proLeagueTeamPages,
  ];
}
