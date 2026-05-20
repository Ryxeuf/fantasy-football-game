import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "Nuffle Arena — NFL Fantasy",
  description: "Mode fantasy NFL skinné Blood Bowl : draft, lineup hebdo, mercato.",
};

export default function NflFantasyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/nfl-fantasy"
            className="text-lg font-semibold tracking-tight text-orange-400 hover:text-orange-300"
          >
            🏈 Nuffle Arena · NFL Fantasy
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <Link href="/nfl-fantasy" className="hover:text-white">
              Mes leagues
            </Link>
            <Link href="/nfl-fantasy/new" className="hover:text-white">
              Créer
            </Link>
            <Link href="/nfl-fantasy/join" className="hover:text-white">
              Rejoindre
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
