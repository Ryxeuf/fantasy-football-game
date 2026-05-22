import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "Nuffle Coach — Fantasy NFL skinné Blood Bowl",
  description:
    "Nuffle Coach : draft tes joueurs NFL renommes en BB, regle ton lineup chaque semaine, affronte tes coachs.",
};

export default function NuffleCoachLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <nav
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-nuffle-bronze/30 bg-white px-4 py-3 shadow-sm"
        aria-label="Sous-navigation Nuffle Coach"
      >
        <Link
          href="/nfl-fantasy"
          className="font-heading text-lg font-bold tracking-tight text-nuffle-bronze hover:text-nuffle-gold"
        >
          🏈 Nuffle Coach
        </Link>
        <div className="flex flex-wrap items-center gap-3 text-sm text-nuffle-anthracite/80 sm:gap-4">
          <Link href="/nfl-fantasy" className="hover:text-nuffle-gold">
            Mes championnats
          </Link>
          <Link href="/nfl-fantasy/new" className="hover:text-nuffle-gold">
            Créer
          </Link>
          <Link href="/nfl-fantasy/public" className="hover:text-nuffle-gold">
            Publics
          </Link>
          <Link href="/nfl-fantasy/join" className="hover:text-nuffle-gold">
            Rejoindre
          </Link>
          <Link href="/nfl-fantasy/players" className="hover:text-nuffle-gold">
            Joueurs
          </Link>
          <Link href="/nfl-fantasy/about" className="hover:text-nuffle-gold">
            À propos
          </Link>
        </div>
      </nav>
      <div>{children}</div>
    </div>
  );
}
