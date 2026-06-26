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
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-nuffle-anthracite">
          Compendium des règles
        </h1>
        <p className="max-w-3xl text-sm text-nuffle-anthracite/70">
          Les règles de {compendium.meta.edition}, organisées en chapitres
          consultables. Chaque chapitre est transcrit fidèlement depuis le livre
          de règles.
        </p>
      </header>

      <ol className="grid gap-4 sm:grid-cols-2">
        {chapters.map((chapter, i) => (
          <li key={chapter.slug}>
            <Link
              href={`/compendium/${chapter.slug}`}
              className="flex h-full flex-col gap-2 rounded-2xl border border-nuffle-bronze/20 bg-white p-5 shadow-sm transition-all hover:border-nuffle-gold/60 hover:shadow-md"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-score text-2xl leading-none text-nuffle-gold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="text-lg font-semibold text-nuffle-anthracite">
                  {chapter.title}
                </h2>
              </div>
              <p className="text-sm text-nuffle-anthracite/70">
                {chapter.summary}
              </p>
            </Link>
          </li>
        ))}
      </ol>

      <p className="rounded-lg border border-nuffle-bronze/20 bg-nuffle-ivory/30 px-4 py-3 text-xs text-nuffle-anthracite/60">
        {compendium.meta.disclaimer}
      </p>
    </div>
  );
}
