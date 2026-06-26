import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Blocks } from "../Blocks";
import { chapters, chapterToc, compendium, getChapter } from "../data";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const revalidate = 3600;

export function generateStaticParams(): Array<{ slug: string }> {
  return chapters.map((c) => ({ slug: c.slug }));
}

interface ChapterPageProps {
  readonly params: { slug: string };
}

export function generateMetadata({ params }: ChapterPageProps): Metadata {
  const chapter = getChapter(params.slug);
  if (!chapter) return { title: "Chapitre introuvable" };
  const url = `${BASE_URL}/compendium/${chapter.slug}`;
  const title = `${chapter.title} — Règles Blood Bowl 2025`;
  return {
    title,
    description: chapter.summary,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: chapter.summary,
      url,
      type: "article",
    },
  };
}

export default function ChapterPage({ params }: ChapterPageProps): JSX.Element {
  const chapter = getChapter(params.slug);
  if (!chapter) notFound();

  const toc = chapterToc(chapter);
  const index = chapters.findIndex((c) => c.slug === chapter.slug);
  const prev = index > 0 ? chapters[index - 1] : undefined;
  const next = index < chapters.length - 1 ? chapters[index + 1] : undefined;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: chapter.title,
    inLanguage: "fr",
    url: `${BASE_URL}/compendium/${chapter.slug}`,
    abstract: chapter.summary,
    isPartOf: {
      "@type": "CollectionPage",
      name: compendium.meta.title,
      url: `${BASE_URL}/compendium`,
    },
  };

  return (
    <article className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <header className="space-y-2">
        <Link
          href="/compendium"
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← Compendium des règles
        </Link>
        <h1 className="text-3xl font-semibold text-nuffle-anthracite">
          {chapter.title}
        </h1>
        <p className="max-w-3xl text-sm text-nuffle-anthracite/70">
          {chapter.summary}
        </p>
      </header>

      {toc.length > 1 ? (
        <nav
          aria-label="Sommaire du chapitre"
          className="rounded-xl border border-nuffle-bronze/20 bg-white p-4"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-nuffle-bronze">
            Dans ce chapitre
          </p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-nuffle-anthracite/80 hover:text-nuffle-gold"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <Blocks blocks={chapter.blocks} />

      <nav className="flex flex-col gap-3 border-t border-nuffle-bronze/15 pt-6 sm:flex-row sm:justify-between">
        {prev ? (
          <Link
            href={`/compendium/${prev.slug}`}
            className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
          >
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/compendium/${next.slug}`}
            className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze sm:text-right"
          >
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <footer className="rounded-lg border border-nuffle-bronze/20 bg-nuffle-ivory/30 px-4 py-3 text-xs text-nuffle-anthracite/60">
        Source : {chapter.sourcePages.join(", ")} —{" "}
        {compendium.meta.sourceDir}. {compendium.meta.disclaimer}
      </footer>
    </article>
  );
}
