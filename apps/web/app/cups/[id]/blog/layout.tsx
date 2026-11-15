import type { Metadata } from "next";
import type { ReactNode } from "react";

// Blog de coupe : contenu écrit par les coachs, jamais indexé (et une
// coupe privée n'existe que pour ses membres).
export const metadata: Metadata = {
  title: "Blog",
  robots: { index: false, follow: false },
};

export default function CompetitionBlogLayout({ children }: { children: ReactNode }) {
  return children;
}
