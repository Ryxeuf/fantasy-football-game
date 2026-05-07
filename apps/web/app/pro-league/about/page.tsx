"use client";

import Link from "next/link";

import { useLanguage } from "../../contexts/LanguageContext";

/**
 * Page marketing Pro League — sprint 1.F.4 + i18n.
 *
 * Client component pour acceder a useLanguage(). Le contenu (pitch,
 * features, calendrier, FAQ, disclaimer) est entierement traduit via
 * `t.proLeague.about.*`.
 *
 * SEO meta dans `./layout.tsx`. JSON-LD parent (SportsLeague + FAQPage)
 * deja injecte par le layout `/pro-league` (sprint 1.F.3).
 */

interface FeatureCard {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly cta: string;
}

interface FaqEntry {
  readonly key: string;
  readonly q: string;
  readonly a: string;
}

interface ScheduleSlot {
  readonly key: string;
  readonly label: string;
  readonly time: string;
  readonly description: string;
}

export default function ProLeagueAboutPage(): JSX.Element {
  const { t } = useLanguage();
  const a = t.proLeague.about;

  const features: readonly FeatureCard[] = [
    {
      key: "live",
      title: a.featureLiveTitle,
      description: a.featureLiveBody,
      href: "/pro-league",
      cta: a.featureLiveCta,
    },
    {
      key: "bets",
      title: a.featureBetsTitle,
      description: a.featureBetsBody,
      href: "/pro-league/leaderboard",
      cta: a.featureBetsCta,
    },
    {
      key: "gazette",
      title: a.featureGazetteTitle,
      description: a.featureGazetteBody,
      href: "/pro-league/gazette",
      cta: a.featureGazetteCta,
    },
    {
      key: "hof",
      title: a.featureHofTitle,
      description: a.featureHofBody,
      href: "/pro-league/hall-of-fame",
      cta: a.featureHofCta,
    },
  ];

  const faq: readonly FaqEntry[] = [
    { key: "q1", q: a.faqQ1, a: a.faqA1 },
    { key: "q2", q: a.faqQ2, a: a.faqA2 },
    { key: "q3", q: a.faqQ3, a: a.faqA3 },
    { key: "q4", q: a.faqQ4, a: a.faqA4 },
    { key: "q5", q: a.faqQ5, a: a.faqA5 },
    { key: "q6", q: a.faqQ6, a: a.faqA6 },
    { key: "q7", q: a.faqQ7, a: a.faqA7 },
    { key: "q8", q: a.faqQ8, a: a.faqA8 },
  ];

  const schedule: readonly ScheduleSlot[] = [
    {
      key: "tuesday",
      label: a.scheduleTuesdayLabel,
      time: a.scheduleTuesdayTime,
      description: a.scheduleTuesdayBody,
    },
    {
      key: "daily",
      label: a.scheduleDailyLabel,
      time: a.scheduleDailyTime,
      description: a.scheduleDailyBody,
    },
    {
      key: "reset",
      label: a.scheduleResetLabel,
      time: a.scheduleResetTime,
      description: a.scheduleResetBody,
    },
    {
      key: "season",
      label: a.scheduleSeasonLabel,
      time: a.scheduleSeasonTime,
      description: a.scheduleSeasonBody,
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
      <header className="mb-8 flex items-center justify-between gap-3">
        <Link
          href="/pro-league"
          className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
        >
          {a.backToHub}
        </Link>
      </header>

      <section
        data-testid="about-hero"
        className="mb-10 rounded-lg border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 px-6 py-8"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
          {a.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-amber-100 sm:text-4xl">
          {a.title}
        </h1>
        <p className="mt-3 text-base text-slate-300">{a.intro}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/pro-league"
            className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-500"
          >
            {a.ctaHub}
          </Link>
          <Link
            href="/pro-league/standings"
            className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            {a.ctaStandings}
          </Link>
        </div>
      </section>

      <section data-testid="about-howitworks" className="mb-10">
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-slate-100">
          {a.howItWorksTitle}
        </h2>
        <ol className="flex flex-col gap-3 text-sm text-slate-300">
          {(
            [
              [a.howItWorksStep1Title, a.howItWorksStep1Body],
              [a.howItWorksStep2Title, a.howItWorksStep2Body],
              [a.howItWorksStep3Title, a.howItWorksStep3Body],
              [a.howItWorksStep4Title, a.howItWorksStep4Body],
            ] as ReadonlyArray<readonly [string, string]>
          ).map(([title, body], idx) => (
            <li key={idx} className="flex gap-3">
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-amber-50"
              >
                {idx + 1}
              </span>
              <span>
                <strong className="text-slate-100">{title}</strong> {body}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section data-testid="about-features" className="mb-10">
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-slate-100">
          {a.featuresTitle}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <article
              key={f.key}
              data-testid="about-feature-card"
              className="flex flex-col rounded border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <h3 className="text-base font-semibold text-amber-100">
                {f.title}
              </h3>
              <p className="mt-1 flex-1 text-sm text-slate-300">
                {f.description}
              </p>
              <Link
                href={f.href as never}
                className="mt-3 inline-block text-sm font-semibold text-amber-300 hover:text-amber-200"
              >
                {f.cta} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section data-testid="about-schedule" className="mb-10">
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-slate-100">
          {a.scheduleTitle}
        </h2>
        <div className="overflow-x-auto rounded border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="w-32 px-3 py-2 text-left">
                  {a.scheduleHeaderWhen}
                </th>
                <th className="w-24 px-3 py-2 text-left">
                  {a.scheduleHeaderTime}
                </th>
                <th className="px-3 py-2 text-left">
                  {a.scheduleHeaderWhat}
                </th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((s) => (
                <tr
                  key={s.key}
                  data-testid="about-schedule-row"
                  className="border-t border-slate-800"
                >
                  <td className="px-3 py-2 font-semibold text-slate-100">
                    {s.label}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-300">
                    {s.time}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {s.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        data-testid="about-faq"
        aria-labelledby="about-faq-heading"
        className="mb-10"
      >
        <h2
          id="about-faq-heading"
          className="mb-3 text-2xl font-bold tracking-tight text-slate-100"
        >
          {a.faqTitle}
        </h2>
        <ul className="flex flex-col gap-3">
          {faq.map((item) => (
            <li
              key={item.key}
              data-testid="about-faq-item"
              className="rounded border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100 group-open:text-amber-200">
                  {item.q}
                </summary>
                <p className="mt-2 text-sm text-slate-300">{item.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <aside
        data-testid="about-disclaimer"
        role="note"
        aria-label="No real money disclaimer"
        className="mb-10 rounded-lg border border-amber-700 bg-amber-950/40 px-5 py-4"
      >
        <h2 className="mb-1 text-base font-semibold text-amber-200">
          {a.disclaimerTitle}
        </h2>
        <p className="text-sm text-amber-100/90">{a.disclaimerBody}</p>
      </aside>

      <footer className="mt-2 mb-8 flex flex-wrap gap-2">
        <Link
          href="/pro-league"
          className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-500"
        >
          {a.footerCtaHub}
        </Link>
        <Link
          href="/pro-league/gazette"
          className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          {a.footerCtaGazette}
        </Link>
      </footer>
    </main>
  );
}
