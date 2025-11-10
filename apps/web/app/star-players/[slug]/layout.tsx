import { Metadata } from 'next';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8201';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nufflearena.fr';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { slug } = params;
  
  try {
    const response = await fetch(`${API_BASE}/star-players/${slug}`, {
      next: { revalidate: 3600 }, // Cache pendant 1 heure
    });
    
    if (!response.ok) {
      return {
        title: 'Star Player introuvable',
        description: 'Le Star Player demandé n\'a pas été trouvé.',
      };
    }
    
    const data = await response.json();
    
    if (!data.success || !data.data) {
      return {
        title: 'Star Player introuvable',
        description: 'Le Star Player demandé n\'a pas été trouvé.',
      };
    }
    
    const starPlayer = data.data;
    const title = `${starPlayer.displayName} - Star Player Blood Bowl`;
    const description = `Découvrez ${starPlayer.displayName}, Star Player Blood Bowl. Coût: ${(starPlayer.cost / 1000).toLocaleString()}k po. MA ${starPlayer.ma}, ST ${starPlayer.st}, AG ${starPlayer.ag}+. ${starPlayer.hirableBy.includes('all') ? 'Disponible pour toutes les équipes' : `Disponible pour ${starPlayer.hirableBy.length} ligue(s)`}.`;
    
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
      openGraph: {
        title,
        description,
        type: 'website',
        url: `${BASE_URL}/star-players/${slug}`,
        siteName: 'Nuffle Arena',
        images: starPlayer.imageUrl ? [
          {
            url: starPlayer.imageUrl.replace('/data/Star-Players_files/', `${BASE_URL}/images/star-players/`),
            width: 1200,
            height: 1200,
            alt: `${starPlayer.displayName} - Star Player Blood Bowl`,
          },
        ] : [
          {
            url: `${BASE_URL}/images/logo.png`,
            width: 1200,
            height: 630,
            alt: `${starPlayer.displayName} - Star Player Blood Bowl`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: starPlayer.imageUrl ? [starPlayer.imageUrl.replace('/data/Star-Players_files/', `${BASE_URL}/images/star-players/`)] : [`${BASE_URL}/images/logo.png`],
      },
    };
  } catch (error) {
    console.error('Erreur lors de la génération des métadonnées:', error);
    return {
      title: 'Star Player - Nuffle Arena',
      description: 'Découvrez les Star Players Blood Bowl disponibles sur Nuffle Arena.',
    };
  }
}

export default function StarPlayerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

