/**
 * Page maintenance — Sprint P (Lot P.A.1).
 *
 * Affichee quand le serveur API retourne 503 (mode maintenance global).
 * Pas de fetch DB, pas de side effect — page statique server-rendered.
 *
 * Le frontend rediriger automatiquement vers cette page peut etre
 * ajoute en futur (intercepteur API global qui detecte 503 sur les
 * fetchs). Pour la v1, l'admin partage le lien `/maintenance` ou les
 * users tombent dessus via leurs requetes echouees.
 */
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maintenance — Nuffle Arena",
  description:
    "Le site est temporairement indisponible pour maintenance. Reviens dans quelques minutes.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage(): JSX.Element {
  return (
    <main
      data-testid="maintenance-page"
      className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center bg-slate-950 px-6 py-12 text-center text-slate-100"
    >
      <div className="mb-6 text-6xl" aria-hidden="true">
        🚧
      </div>
      <h1 className="mb-4 text-3xl font-bold tracking-wide text-amber-200 sm:text-4xl">
        Nuffle siffle un temps mort
      </h1>
      <p className="mb-6 text-base text-slate-300 sm:text-lg">
        Le site est temporairement indisponible pour maintenance. Les
        Hommes-Lézards refont la pelouse, les Orcs reprogrammèrent
        l&apos;arbitre, et le serveur fait un check d&apos;armure.
      </p>
      <p className="mb-8 text-sm text-slate-400">
        Reviens dans quelques minutes. La Pro League reprend bientôt son
        cours.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <Link
          href="/"
          className="rounded border border-slate-700 px-4 py-2 text-slate-300 hover:bg-slate-800"
        >
          ← Page d&apos;accueil
        </Link>
        <a
          href="https://discord.gg/nuffle"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-indigo-700 bg-indigo-950 px-4 py-2 text-indigo-200 hover:bg-indigo-900"
        >
          Discord ↗
        </a>
      </div>
    </main>
  );
}
