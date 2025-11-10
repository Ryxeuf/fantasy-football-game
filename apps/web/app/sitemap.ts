import { MetadataRoute } from 'next';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nufflearena.fr';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pages statiques
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/teams`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/star-players`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/legal/mentions-legales`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/conditions-utilisation`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Pages dynamiques - Teams
  let teamPages: MetadataRoute.Sitemap = [];
  try {
    const teamsResponse = await fetch(`${API_BASE}/api/rosters?lang=fr`, {
      next: { revalidate: 3600 }, // Cache pendant 1 heure
    });
    
    if (teamsResponse.ok) {
      const teamsData = await teamsResponse.json();
      teamPages = (teamsData.rosters || []).map((team: { slug: string }) => ({
        url: `${BASE_URL}/teams/${team.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }));
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
        starPlayerPages = starPlayersData.data.map((player: { slug: string }) => ({
          url: `${BASE_URL}/star-players/${player.slug}`,
          lastModified: new Date(),
          changeFrequency: 'monthly' as const,
          priority: 0.6,
        }));
      }
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des Star Players pour le sitemap:', error);
  }

  return [...staticPages, ...teamPages, ...starPlayerPages];
}

