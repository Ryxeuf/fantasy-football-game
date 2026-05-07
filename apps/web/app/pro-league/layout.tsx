import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pro League — Old World League | Nuffle Arena",
  description:
    "Suivez la Pro League Nuffle Arena : 16 equipes simulees, 15 journees, paris, Gazette quotidienne et Hall of Fame. Une ligue Blood Bowl-like jouee par l'IA, supportee par les fans.",
  keywords: [
    "Blood Bowl",
    "Pro League",
    "Old World League",
    "Nuffle Arena",
    "fantasy football",
    "betting",
    "Gazette",
    "Hall of Fame",
  ],
  openGraph: {
    title: "Pro League Nuffle Arena — Ligue simulee 16 equipes",
    description:
      "16 equipes hommage NFL × races Blood Bowl. Paris, Gazette quotidienne, Hall of Fame. Suivez votre equipe favorite.",
    type: "website",
  },
};

export default function ProLeagueLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return <>{children}</>;
}
