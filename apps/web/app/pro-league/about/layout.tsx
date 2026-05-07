import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "À propos de la Pro League | Nuffle Arena",
  description:
    "Comment fonctionne la Pro League Nuffle Arena : 16 équipes simulées, 15 journées, paris virtuels en Crowns, Nuffle Gazette quotidienne, Hall of Fame. Aucun argent réel impliqué.",
  keywords: [
    "Blood Bowl",
    "Pro League",
    "Old World League",
    "Nuffle Arena",
    "fantasy football",
    "betting virtuel",
    "no real money",
    "FAQ",
  ],
  openGraph: {
    title: "Pro League Nuffle Arena — Comment ça marche",
    description:
      "Pitch produit, calendrier, FAQ et règles paris virtuels (no real money) de la Pro League.",
    type: "website",
  },
};

export default function ProLeagueAboutLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return <>{children}</>;
}
