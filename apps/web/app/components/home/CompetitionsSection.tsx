"use client";
import { useLanguage } from "../../contexts/LanguageContext";
import { CupCrest, LeagueCrest } from "./NuffleScenes";
import SectionTitle from "./SectionTitle";

/**
 * Compétitions (ligue + coupes) — placées JUSTE APRÈS le hero : c'est la
 * valeur principale du site, elle était reléguée à ~3,5 écrans sur bureau et
 * 6 sur mobile. Deux cartes côte à côte (la ligue, phare, en poster sombre ;
 * les coupes en panneau clair) au lieu d'un panneau + un grand poster.
 */
export default function CompetitionsSection() {
  const { t } = useLanguage();
  const { leagues, cups, competitions } = t.home;

  return (
    <section
      data-testid="home-competitions"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14"
    >
      <SectionTitle
        kicker={competitions.kicker}
        title={competitions.title}
        subtitle={competitions.subtitle}
      />

      <div className="mt-8 grid gap-5 md:grid-cols-5">
        {/* Ligue — poster sombre, fonctionnalité phare */}
        <article className="relative overflow-hidden rounded-2xl bg-[#1B1610] text-nuffle-ivory ring-1 ring-nuffle-gold/50 shadow-[0_18px_44px_rgba(27,22,16,0.35)] p-6 sm:p-7 md:col-span-3">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(203,161,53,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(122,31,31,0.28),transparent_55%)]"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-4">
            <LeagueCrest className="w-16 sm:w-20 flex-shrink-0 drop-shadow-[0_8px_20px_rgba(27,22,16,0.5)]" />
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-nuffle-gold/50 bg-nuffle-gold/10 px-3 py-1 text-[11px] font-subtitle font-bold uppercase tracking-[0.18em] text-nuffle-gold">
                <span className="h-1.5 w-1.5 rounded-full bg-nuffle-gold" aria-hidden="true" />
                {leagues.tagline}
              </span>
              <h3 className="mt-2 text-2xl sm:text-3xl font-heading font-bold bg-gradient-to-br from-[#F3Dd92] via-nuffle-gold to-[#a8852b] bg-clip-text text-transparent">
                {leagues.title}
              </h3>
            </div>
          </div>
          <p className="relative mt-4 text-nuffle-ivory/80 font-body text-sm sm:text-base">
            {leagues.description}
          </p>
          <ul className="relative mt-4 flex flex-wrap gap-2">
            {leagues.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-nuffle-gold/30 bg-nuffle-gold/10 px-3 py-1 text-xs font-subtitle font-semibold text-nuffle-gold/90"
              >
                {tag}
              </li>
            ))}
          </ul>
          <div className="relative mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <a
              href="/leagues"
              data-testid="home-leagues-cta"
              className="inline-flex justify-center items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-b from-[#E0BC52] to-nuffle-gold hover:from-nuffle-gold hover:to-[#a8852b] text-nuffle-anthracite font-subtitle font-bold uppercase tracking-wide shadow-[0_8px_28px_rgba(203,161,53,0.4)] hover:-translate-y-0.5 transition-all"
            >
              {leagues.cta} <span aria-hidden="true">→</span>
            </a>
            <a
              href="/leagues/new"
              className="inline-flex justify-center items-center gap-2 px-6 py-3 rounded-xl border-2 border-nuffle-gold/40 text-nuffle-ivory hover:bg-nuffle-gold/15 font-subtitle font-bold uppercase tracking-wide transition-all"
            >
              {leagues.ctaCreate}
            </a>
          </div>
          <p className="relative mt-3 text-xs font-subtitle font-semibold uppercase tracking-wide text-nuffle-ivory/55">
            {leagues.badge}
          </p>
        </article>

        {/* Coupes — panneau clair */}
        <article className="flex flex-col rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-6 sm:p-7 shadow-[0_2px_10px_rgba(107,78,46,0.06)] md:col-span-2">
          <div className="flex items-center gap-4">
            <CupCrest className="w-14 sm:w-16 flex-shrink-0" />
            <h3 className="text-xl sm:text-2xl font-heading font-bold text-nuffle-anthracite">
              {cups.title}
            </h3>
          </div>
          <p className="mt-4 text-nuffle-anthracite/75 font-body text-sm sm:text-base">
            {cups.description}
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {cups.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-nuffle-bronze/25 bg-white/50 px-3 py-1 text-xs font-subtitle font-semibold text-nuffle-bronze"
              >
                {tag}
              </li>
            ))}
          </ul>
          <div className="mt-5 md:mt-auto md:pt-5">
          <a
            href="/cups"
            data-testid="home-cups-cta"
            className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl border-2 border-nuffle-bronze/40 text-nuffle-bronze hover:border-nuffle-gold hover:text-nuffle-anthracite hover:bg-nuffle-gold/10 font-subtitle font-bold uppercase tracking-wide transition-all"
          >
            {cups.cta} <span aria-hidden="true">→</span>
          </a>
          </div>
        </article>
      </div>
    </section>
  );
}
