import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Toutes les équipes Blood Bowl",
  description: "Découvrez tous les rosters Blood Bowl disponibles. Explorez les équipes officielles et NAF, leurs caractéristiques, budgets et positions. Créez votre équipe dès maintenant.",
  keywords: [
    "Blood Bowl",
    "Rosters",
    "Équipes",
    "Tier I",
    "Tier II",
    "Tier III",
    "NAF",
    "Nuffle Arena",
  ],
  openGraph: {
    title: "Toutes les équipes Blood Bowl - Nuffle Arena",
    description: "Découvrez tous les rosters Blood Bowl disponibles. Explorez les équipes officielles et NAF.",
    type: "website",
  },
};

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

