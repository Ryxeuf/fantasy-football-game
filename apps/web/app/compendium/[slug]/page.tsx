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
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="text-sm text-nuffle-anthracite/55">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="transition-colors hover:text-nuffle-bronze">
              Accueil
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link
              href="/compendium"
              className="transition-colors hover:text-nuffle-bronze"
            >
              Compendium
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="font-semibold text-nuffle-anthracite" aria-current="page">
            {chapter.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Rail latéral (sticky) : navigation des chapitres + sommaire. */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-6">
            <nav aria-label="Chapitres">
              <p className="mb-2 font-subtitle text-[11px] font-semibold uppercase tracking-[0.18em] text-nuffle-bronze">
                Chapitres
              </p>
              <ol className="space-y-0.5 text-sm">
                {chapters.map((c, i) => {
                  const current = c.slug === chapter.slug;
                  return (
                    <li key={c.slug}>
                      <Link
                        href={`/compendium/${c.slug}`}
                        aria-current={current ? "page" : undefined}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${
                          current
                            ? "bg-nuffle-gold/15 font-semibold text-nuffle-anthracite ring-1 ring-inset ring-nuffle-gold/30"
                            : "text-nuffle-anthracite/70 hover:bg-nuffle-ivory/50 hover:text-nuffle-anthracite"
                        }`}
                      >
                        <span className="font-score text-sm text-nuffle-gold">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate">{c.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </nav>

            {toc.length > 1 && (
              <nav aria-label="Sommaire du chapitre">
                <p className="mb-2 font-subtitle text-[11px] font-semibold uppercase tracking-[0.18em] text-nuffle-bronze">
                  Dans ce chapitre
                </p>
                <ul className="space-y-1 border-l border-nuffle-bronze/20 text-sm">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="-ml-px block border-l border-transparent py-0.5 pl-3 text-nuffle-anthracite/65 transition-colors hover:border-nuffle-gold hover:text-nuffle-gold"
                      >
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </aside>

        {/* Contenu */}
        <article className="min-w-0 space-y-8">
          <header className="space-y-3 border-b border-nuffle-bronze/15 pb-6">
            <span className="font-score text-3xl leading-none text-nuffle-gold">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h1 className="font-heading text-3xl font-bold text-nuffle-anthracite sm:text-4xl">
              {chapter.title}
            </h1>
            <p className="max-w-2xl text-[15px] leading-relaxed text-nuffle-anthracite/70">
              {chapter.summary}
            </p>
          </header>

          {/* Sommaire inline (mobile uniquement). */}
          {toc.length > 1 && (
            <nav
              aria-label="Sommaire du chapitre"
              className="rounded-xl border border-nuffle-bronze/20 bg-nuffle-ivory/30 p-4 lg:hidden"
            >
              <p className="mb-2 font-subtitle text-[11px] font-semibold uppercase tracking-[0.18em] text-nuffle-bronze">
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
          )}

          <Blocks blocks={chapter.blocks} />

          {/* Précédent / suivant en cartes. */}
          <nav className="grid gap-3 border-t border-nuffle-bronze/15 pt-6 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/compendium/${prev.slug}`}
                className="group rounded-xl border border-nuffle-bronze/20 bg-white px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-nuffle-gold/60 hover:shadow-sm"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-nuffle-bronze">
                  ← Précédent
                </span>
                <span className="mt-0.5 block font-heading font-semibold text-nuffle-anthracite group-hover:text-nuffle-gold">
                  {prev.title}
                </span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next ? (
              <Link
                href={`/compendium/${next.slug}`}
                className="group rounded-xl border border-nuffle-bronze/20 bg-white px-4 py-3 text-right transition-all hover:-translate-y-0.5 hover:border-nuffle-gold/60 hover:shadow-sm"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-nuffle-bronze">
                  Suivant →
                </span>
                <span className="mt-0.5 block font-heading font-semibold text-nuffle-anthracite group-hover:text-nuffle-gold">
                  {next.title}
                </span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
          </nav>

          <footer className="text-xs text-nuffle-anthracite/45">
            {compendium.meta.disclaimer}
          </footer>
        </article>
      </div>
    </div>
  );
}
