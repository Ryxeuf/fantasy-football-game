import Link from "next/link";
import type { Metadata, Route } from "next";
import { getServerApiBase, safeServerJson } from "../lib/serverApi";
import { HELP_CATEGORIES, HELP_ACCESS_LABELS, type HelpFeature } from "./help-catalogue";
import { parseGlobalFlags, visibleHelpCategories } from "./help-visibility";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

/**
 * ISR court : ouvrir un flag à tout le monde doit faire apparaître sa
 * fonctionnalité dans l'aide sans redéploiement.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Aide — toutes les fonctionnalités de Nuffle Arena",
  description:
    "Le guide de toutes les fonctionnalités de Nuffle Arena, classées par catégorie : équipes, ligues, coupes, feuille de match, règles, outils d'analyse, compte et notifications.",
  alternates: { canonical: `${BASE_URL}/aide` },
  openGraph: {
    title: "Aide — toutes les fonctionnalités de Nuffle Arena",
    description:
      "Équipes, compétitions, feuille de match, règles et outils : tout ce que propose Nuffle Arena, avec un lien vers chaque page.",
    url: `${BASE_URL}/aide`,
    type: "website",
  },
};

/**
 * Flags activés POUR TOUT LE MONDE : la lecture anonyme de
 * `/api/feature-flags/me` (aucun jeton envoyé ⇒ ni override, ni bypass
 * admin). API injoignable ⇒ aucun flag : l'aide ne liste alors que ce qui
 * n'est derrière aucun gate.
 */
async function fetchGlobalFlags(): Promise<ReadonlySet<string>> {
  const envelope = await safeServerJson<unknown>(
    `${getServerApiBase()}/api/feature-flags/me`,
    { next: { revalidate } },
  );
  return parseGlobalFlags(envelope);
}

function FeatureCard({ feature }: { readonly feature: HelpFeature }): JSX.Element {
  return (
    <li
      id={feature.id}
      className="scroll-mt-24 flex flex-col rounded-2xl border border-nuffle-bronze/20 bg-white p-5 shadow-sm"
      data-testid={`help-feature-${feature.id}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-2xl leading-none">
          {feature.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-lg font-bold text-nuffle-anthracite">
            <Link href={feature.href as Route} className="hover:text-nuffle-gold hover:underline">
              {feature.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-nuffle-bronze">
            {HELP_ACCESS_LABELS[feature.access]}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-nuffle-anthracite/80">{feature.description}</p>
      {feature.links && feature.links.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {feature.links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href as Route}
                className="inline-flex items-center rounded-full border border-nuffle-bronze/25 px-3 py-1 text-xs font-semibold text-nuffle-bronze transition-colors hover:border-nuffle-gold hover:text-nuffle-gold"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto pt-4">
        <Link
          href={feature.href as Route}
          className="inline-flex items-center gap-1 text-sm font-semibold text-nuffle-gold hover:underline"
        >
          Ouvrir <span aria-hidden>→</span>
        </Link>
      </div>
    </li>
  );
}

export default async function HelpPage(): Promise<JSX.Element> {
  const categories = visibleHelpCategories(HELP_CATEGORIES, await fetchGlobalFlags());
  const featureCount = categories.reduce((n, c) => n + c.features.length, 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl border border-nuffle-bronze/25 bg-gradient-to-br from-nuffle-anthracite to-[#2c2620] px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-nuffle-gold/70 to-transparent"
        />
        <p className="font-subtitle text-xs font-semibold uppercase tracking-[0.25em] text-nuffle-gold">
          Aide
        </p>
        <h1 className="mt-3 font-heading text-4xl font-bold text-nuffle-ivory sm:text-5xl">
          Tout ce que propose Nuffle Arena
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-nuffle-ivory/75 sm:text-base">
          Chaque fonctionnalité du site, classée par catégorie, avec ce qu&apos;elle permet de
          faire et un lien direct. Vous cherchez une règle précise ? Le{" "}
          <Link href="/compendium" className="font-semibold text-nuffle-gold hover:underline">
            compendium
          </Link>{" "}
          et la{" "}
          <Link href="/recherche" className="font-semibold text-nuffle-gold hover:underline">
            recherche
          </Link>{" "}
          sont faits pour ça.
        </p>
        <p className="mt-4 text-xs text-nuffle-ivory/60">
          {featureCount} fonctionnalités · {categories.length} catégories
        </p>
      </header>

      {/* Sommaire */}
      <nav
        aria-label="Catégories"
        className="rounded-2xl border border-nuffle-bronze/20 bg-nuffle-ivory/30 p-4 sm:p-5"
      >
        <p className="mb-3 font-subtitle text-[11px] font-semibold uppercase tracking-[0.18em] text-nuffle-bronze">
          Catégories
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <li key={category.id}>
              <a
                href={`#${category.id}`}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-nuffle-anthracite/80 transition-colors hover:bg-white hover:text-nuffle-anthracite"
              >
                <span aria-hidden>{category.icon}</span>
                <span className="font-semibold">{category.title}</span>
                <span className="ml-auto font-score text-sm text-nuffle-gold">
                  {category.features.length}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {categories.map((category) => (
        <section
          key={category.id}
          id={category.id}
          aria-labelledby={`${category.id}-title`}
          className="scroll-mt-24 space-y-4"
        >
          <div className="border-b border-nuffle-bronze/15 pb-2">
            <h2
              id={`${category.id}-title`}
              className="flex items-center gap-2.5 font-heading text-2xl font-bold text-nuffle-anthracite"
            >
              <span aria-hidden>{category.icon}</span>
              {category.title}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-nuffle-anthracite/70">
              {category.intro}
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {category.features.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </ul>
        </section>
      ))}

      <p className="text-center text-sm text-nuffle-anthracite/60">
        Une fonctionnalité manque, ou ne marche pas comme décrit ?{" "}
        <Link href="/feedback" className="font-semibold text-nuffle-bronze hover:text-nuffle-gold hover:underline">
          Dites-le nous
        </Link>
        .
      </p>
    </div>
  );
}
