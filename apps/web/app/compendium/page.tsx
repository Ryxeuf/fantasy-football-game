import Link from "next/link";
import type { Metadata } from "next";
import { chapters, compendium } from "./data";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Compendium des règles Blood Bowl 2025 (Saison 3)",
  description: compendium.meta.disclaimer,
  alternates: { canonical: `${BASE_URL}/compendium` },
  openGraph: {
    title: "Compendium des règles Blood Bowl 2025 (Saison 3)",
    description:
      "Toutes les règles de Blood Bowl 2025 (saison 3) organisées en chapitres consultables.",
    url: `${BASE_URL}/compendium`,
    type: "website",
  },
};

export default function CompendiumIndexPage(): JSX.Element {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: compendium.meta.title,
    inLanguage: "fr",
    url: `${BASE_URL}/compendium`,
    hasPart: chapters.map((c) => ({
      "@type": "Article",
      name: c.title,
      url: `${BASE_URL}/compendium/${c.slug}`,
      abstract: c.summary,
    })),
  };

  return (
    <div className="space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl border border-nuffle-bronze/25 bg-gradient-to-br from-nuffle-anthracite to-[#2c2620] px-6 py-10 text-center shadow-sm sm:px-10 sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-nuffle-gold/70 to-transparent"
        />
        <p className="font-subtitle text-xs font-semibold uppercase tracking-[0.25em] text-nuffle-gold">
          {compendium.meta.edition}
        </p>
        <h1 className="mt-3 font-heading text-4xl font-bold text-nuffle-ivory sm:text-5xl">
          Compendium des règles
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-nuffle-ivory/75 sm:text-base">
          Toutes les règles du jeu, organisées en chapitres consultables — du
          coup d&apos;envoi aux star players. Cliquez sur un chapitre pour le
          lire.
        </p>
        <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-nuffle-gold/30 bg-nuffle-gold/10 px-4 py-1.5 font-score text-lg tracking-wide text-nuffle-gold">
          {chapters.length} chapitres
        </p>
      </header>

      {/* Grille des chapitres */}
      <ol className="grid gap-4 sm:grid-cols-2">
        {chapters.map((chapter, i) => (
          <li key={chapter.slug}>
            <Link
              href={`/compendium/${chapter.slug}`}
              className="group flex h-full items-start gap-4 rounded-2xl border border-nuffle-bronze/20 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-nuffle-gold/60 hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-nuffle-ivory/60 font-score text-2xl leading-none text-nuffle-gold ring-1 ring-inset ring-nuffle-gold/30 transition-colors group-hover:bg-nuffle-gold group-hover:text-white">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <h2 className="font-heading text-lg font-bold text-nuffle-anthracite">
                    {chapter.title}
                  </h2>
                  <span
                    aria-hidden
                    className="ml-auto translate-x-0 text-nuffle-bronze/40 transition-all group-hover:translate-x-0.5 group-hover:text-nuffle-gold"
                  >
                    →
                  </span>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-nuffle-anthracite/70">
                  {chapter.summary}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <p className="text-center text-xs text-nuffle-anthracite/45">
        {compendium.meta.disclaimer}
      </p>
    </div>
  );
}
