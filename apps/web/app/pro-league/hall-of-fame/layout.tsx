import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hall of Fame Pro League | Nuffle Arena",
  description:
    "Les joueurs immortalises de la Pro League Nuffle Arena. Tombes au champ d'honneur de Nuffle ou couronnes par leur palmares.",
  openGraph: {
    title: "Hall of Fame — Les legendes de la Pro League",
    description:
      "Snapshot fige des joueurs immortalises (mort en match, palmares carriere).",
    type: "website",
  },
};

export default function HallOfFameLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return <>{children}</>;
}
