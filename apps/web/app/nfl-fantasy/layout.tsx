import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "Nuffle Coach — Fantasy NFL skinné Blood Bowl",
  description:
    "Nuffle Coach : draft tes joueurs NFL renommes en BB, regle ton lineup chaque semaine, affronte tes coachs.",
};

export default function NflFantasyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link
            href="/nfl-fantasy"
            className="text-lg font-semibold tracking-tight text-orange-400 hover:text-orange-300"
          >
            🏈 Nuffle Coach
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-300 sm:gap-4">
            <Link href="/nfl-fantasy" className="hover:text-white">
              Mes coachs
            </Link>
            <Link href="/nfl-fantasy/new" className="hover:text-white">
              Créer
            </Link>
            <Link href="/nfl-fantasy/join" className="hover:text-white">
              Rejoindre
            </Link>
            <Link href="/nfl-fantasy/players" className="hover:text-white">
              Joueurs
            </Link>
            <Link href="/nfl-fantasy/about" className="hover:text-white">
              À propos
            </Link>
            <Link
              href="/"
              className="rounded-md border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-400 hover:border-slate-500 hover:text-white"
            >
              Retour BB
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
