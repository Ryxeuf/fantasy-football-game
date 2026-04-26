import { Metadata } from 'next';
import StarPlayerStructuredData from './StarPlayerStructuredData';
import type { StarPlayerInput } from './star-player-structured-data';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nufflearena.fr';

interface ApiEnvelope {
  success?: boolean;
  data?: StarPlayerInput;
}

async function fetchStarPlayer(slug: string): Promise<StarPlayerInput | null> {
  try {
    const response = await fetch(`${API_BASE}/star-players/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const payload: ApiEnvelope = await response.json();
    if (!payload.success || !payload.data) return null;
    return payload.data;
  } catch (error) {
    console.error("Erreur lors du chargement du Star Player:", error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { slug } = params;
  const starPlayer = await fetchStarPlayer(slug);

  if (!starPlayer) {
    return {
      title: 'Star Player introuvable',
      description: 'Le Star Player demandé n\'a pas été trouvé.',
    };
  }

  const title = `${starPlayer.displayName} - Star Player Blood Bowl`;
  const description = `Découvrez ${starPlayer.displayName}, Star Player Blood Bowl. Coût: ${(starPlayer.cost / 1000).toLocaleString()}k po. MA ${starPlayer.ma}, ST ${starPlayer.st}, AG ${starPlayer.ag}+. ${starPlayer.hirableBy.includes('all') ? 'Disponible pour toutes les équipes' : `Disponible pour ${starPlayer.hirableBy.length} ligue(s)`}.`;

  const imageAbsolute = starPlayer.imageUrl
    ? starPlayer.imageUrl.replace('/data/Star-Players_files/', `${BASE_URL}/images/star-players/`)
    : `${BASE_URL}/images/logo.png`;

  return {
    title,
    description,
    keywords: [
      starPlayer.displayName,
      'Star Player',
      'Blood Bowl',
      'Mercenaire',
      'Nuffle Arena',
    ],
    alternates: {
      canonical: `${BASE_URL}/star-players/${slug}`,
      languages: {
        'fr-FR': `${BASE_URL}/star-players/${slug}`,
        'en': `${BASE_URL}/star-players/${slug}`,
        'x-default': `${BASE_URL}/star-players/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${BASE_URL}/star-players/${slug}`,
      siteName: 'Nuffle Arena',
      images: [
        {
          url: imageAbsolute,
          width: 1200,
          height: starPlayer.imageUrl ? 1200 : 630,
          alt: `${starPlayer.displayName} - Star Player Blood Bowl`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageAbsolute],
    },
  };
}

export default async function StarPlayerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const starPlayer = await fetchStarPlayer(params.slug);
  return (
    <>
      {starPlayer && (
        <StarPlayerStructuredData
          starPlayer={starPlayer}
          baseUrl={BASE_URL}
          lang="fr"
        />
      )}
      {children}
    </>
  );
}
