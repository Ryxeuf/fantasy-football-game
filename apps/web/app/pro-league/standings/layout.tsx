import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Classement Pro League — Old World League | Nuffle Arena",
  description:
    "Le classement live des 16 equipes de la Pro League Nuffle Arena : victoires, defaites, points et tie-break selon les regles BB.",
};

export default function StandingsLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return <>{children}</>;
}
