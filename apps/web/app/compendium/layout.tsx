import type { Metadata } from "next";
import { compendium } from "./data";

export const metadata: Metadata = {
  title: "Compendium des règles Blood Bowl",
  description:
    "Le compendium des règles de Blood Bowl 2025 (saison 3) : coup d'envoi, blessures, jeu en ligue, amélioration des joueurs, compétences, coups de pouce, personnel d'équipe, star players et règles spéciales.",
  keywords: [
    "Blood Bowl",
    "règles",
    "compendium",
    "saison 3",
    "2025",
    "coup d'envoi",
    "compétences",
    "coups de pouce",
  ],
};

export default function CompendiumLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="space-y-6">
      <p className="text-xs text-nuffle-anthracite/50">{compendium.meta.edition}</p>
      {children}
    </div>
  );
}
