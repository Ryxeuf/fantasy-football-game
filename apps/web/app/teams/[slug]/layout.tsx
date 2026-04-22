import { Metadata } from 'next';
import { getServerApiBase, safeServerJson } from '../../lib/serverApi';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nufflearena.fr';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { slug } = params;

  try {
    const data = await safeServerJson<{ roster?: any }>(
      `${getServerApiBase()}/api/rosters/${slug}?lang=fr`,
      { next: { revalidate: 3600 } },
    );

    const team = data?.roster;

    if (!team) {
      return {
        title: 'Équipe introuvable',
        description: 'L\'équipe demandée n\'a pas été trouvée.',
      };
    }
    
    const title = `${team.name} - Roster Blood Bowl`;
    const description = `Découvrez le roster ${team.name} pour Blood Bowl. Tier ${team.tier}, budget de ${team.budget}k po. ${team.positions.length} positions disponibles. Créez votre équipe ${team.name} maintenant.`;
    
    return {
      title,
      description,
      keywords: [
        team.name,
        'Blood Bowl',
        'Roster',
        `Tier ${team.tier}`,
        'Fantasy Football',
        'Nuffle Arena',
      ],
      openGraph: {
        title,
        description,
        type: 'website',
        url: `${BASE_URL}/teams/${slug}`,
        siteName: 'Nuffle Arena',
        images: [
          {
            url: `${BASE_URL}/images/logo.png`,
            width: 1200,
            height: 630,
            alt: `${team.name} - Roster Blood Bowl`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [`${BASE_URL}/images/logo.png`],
      },
    };
  } catch (error) {
    console.error('Erreur lors de la génération des métadonnées:', error);
    return {
      title: 'Équipe - Nuffle Arena',
      description: 'Découvrez les rosters Blood Bowl disponibles sur Nuffle Arena.',
    };
  }
}

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

