import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nuffle Gazette — Edition quotidienne | Nuffle Arena",
  description:
    "La Nuffle Gazette : journal sportif fictif de la Pro League. Articles quotidiens generes par IA, signes par 3 personas (le cynique, l'enthousiaste orc, le statisticien).",
  openGraph: {
    title: "Nuffle Gazette — La Pro League par ses redacteurs",
    description:
      "Editions quotidiennes : articles, breves, editos. 3 personas, ton pulp Blood Bowl-like.",
    type: "website",
  },
};

export default function GazetteLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return <>{children}</>;
}
