"use client";
import Image from "next/image";
import Logo from "./components/Logo";
import { useLanguage } from "./contexts/LanguageContext";
import HomeStructuredData from "./components/HomeStructuredData";
import { useFeatureFlag } from "./hooks/useFeatureFlag";
import { ONLINE_PLAY_FLAG } from "./lib/featureFlagKeys";

export default function LandingPage() {
  const { t } = useLanguage();
  const onlinePlayEnabled = useFeatureFlag(ONLINE_PLAY_FLAG);

  const quickLinks = [
    { href: "/teams", label: t.home.quickAccessTeams, icon: "⚽" },
    { href: "/star-players", label: t.home.quickAccessStarPlayers, icon: "⭐" },
    { href: "/skills", label: t.home.quickAccessSkills, icon: "📚" },
    { href: "/tutoriel", label: t.home.quickAccessTutorial, icon: "🎓" },
  ];

  return (
    <>
      <HomeStructuredData />
      <div className="min-h-screen">
        {/* Beta Launch Banner */}
        <section className="w-full bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-600 text-white py-3 px-6 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="font-semibold text-sm md:text-base">
              {t.home.betaBanner}
            </p>
          </div>
        </section>

        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-gradient-to-br from-nuffle-anthracite via-nuffle-bronze to-nuffle-anthracite">
          <div className="w-full px-4 sm:px-6 py-12 sm:py-16 md:py-20 flex flex-col-reverse md:flex-row items-center gap-6 md:gap-10">
            <div className="text-nuffle-ivory max-w-xl w-full">
              <div className="mb-4 md:mb-6">
                <Logo variant="default" showText={true} textColor="text-nuffle-ivory" />
              </div>
              <h1 className="sr-only">Nuffle Arena — {t.home.title}</h1>
              <p className="mt-4 md:mt-6 text-lg sm:text-xl text-nuffle-ivory/90 leading-relaxed font-subtitle">
                {t.home.title}
              </p>
              <p className="mt-3 md:mt-4 text-base sm:text-lg text-nuffle-ivory/80 leading-relaxed font-body">
                {t.home.description}
              </p>
              <p className="mt-2 md:mt-3 text-sm sm:text-base text-nuffle-ivory/70 leading-relaxed font-body">
                {t.home.subtitle}
              </p>
              <div className="mt-6 md:mt-8 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                <a
                  href="/me/teams"
                  className="px-6 py-3 rounded-lg bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-center"
                >
                  {t.home.manageTeams}
                </a>
                <a
                  href="/teams"
                  className="px-6 py-3 rounded-lg border-2 border-nuffle-gold/50 text-nuffle-ivory hover:bg-nuffle-gold/20 font-subtitle font-semibold transition-all text-center"
                >
                  {t.home.discoverTeams}
                </a>
              </div>
            </div>
            <div className="relative w-full md:w-auto">
              <div className="rounded-xl border-2 border-nuffle-gold/30 bg-nuffle-bronze/20 backdrop-blur-sm p-4 sm:p-6 shadow-2xl">
                <Image
                  src="/images/bb_dice_sides.webp"
                  alt="Dés de blocage Blood Bowl"
                  width={540}
                  height={360}
                  className="w-full max-w-[540px] mx-auto rounded-md"
                  priority
                />
              </div>
              <div className="hidden md:block absolute -bottom-6 -left-6 rotate-[-8deg] rounded-lg border-2 border-nuffle-gold/30 bg-nuffle-bronze/30 p-3 shadow-xl backdrop-blur-sm">
                <Image
                  src="/images/blocking_dice/pow.png"
                  alt="Dé de blocage POW"
                  width={80}
                  height={80}
                  className="w-20"
                />
              </div>
              <div className="hidden md:block absolute -top-6 -right-8 rotate-[12deg] rounded-lg border-2 border-nuffle-gold/30 bg-nuffle-bronze/30 p-3 shadow-xl backdrop-blur-sm">
                <Image
                  src="/images/blocking_dice/push_back.png"
                  alt="Dé de blocage PUSH"
                  width={80}
                  height={80}
                  className="w-20"
                />
              </div>
            </div>
          </div>
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(203,161,53,0.15),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(107,78,46,0.15),transparent_40%)]" />
        </section>

        {/* Stats band */}
        <section className="w-full px-4 sm:px-6 py-8 md:py-10 bg-nuffle-ivory border-b-2 border-nuffle-bronze/20">
          <h2 className="sr-only">{t.home.statsTitle}</h2>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-5xl mx-auto text-center">
            <div className="rounded-xl bg-white shadow-md border border-nuffle-bronze/20 p-4 sm:p-6">
              <dt className="text-xs sm:text-sm text-nuffle-anthracite/70 font-body uppercase tracking-wide">
                {t.home.statsRosters}
              </dt>
              <dd className="mt-1 text-3xl sm:text-4xl font-heading font-bold text-nuffle-gold">30</dd>
            </div>
            <div className="rounded-xl bg-white shadow-md border border-nuffle-bronze/20 p-4 sm:p-6">
              <dt className="text-xs sm:text-sm text-nuffle-anthracite/70 font-body uppercase tracking-wide">
                {t.home.statsStarPlayers}
              </dt>
              <dd className="mt-1 text-3xl sm:text-4xl font-heading font-bold text-nuffle-gold">60+</dd>
            </div>
            <div className="rounded-xl bg-white shadow-md border border-nuffle-bronze/20 p-4 sm:p-6">
              <dt className="text-xs sm:text-sm text-nuffle-anthracite/70 font-body uppercase tracking-wide">
                {t.home.statsSkills}
              </dt>
              <dd className="mt-1 text-3xl sm:text-4xl font-heading font-bold text-nuffle-gold">130+</dd>
            </div>
            <div className="rounded-xl bg-white shadow-md border border-nuffle-bronze/20 p-4 sm:p-6">
              <dt className="text-xs sm:text-sm text-nuffle-anthracite/70 font-body uppercase tracking-wide">
                {t.home.statsFree}
              </dt>
              <dd className="mt-1 text-3xl sm:text-4xl font-heading font-bold text-emerald-600">€0</dd>
            </div>
          </dl>
        </section>

        {/* Features */}
        <section className="w-full px-4 sm:px-6 py-12 md:py-16">
          <div className="max-w-6xl mx-auto mb-8 md:mb-10 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-nuffle-anthracite">
              {t.home.discoverTitle}
            </h2>
            <p className="mt-2 text-base sm:text-lg text-nuffle-anthracite/70 font-body">
              {t.home.discoverSubtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <a
              href="/teams"
              className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 overflow-hidden hover:border-nuffle-gold/50 hover:shadow-xl transition-all group"
            >
              <div className="h-40 flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#e8d6ae' }}>
                <Image
                  src="/images/rosters.webp"
                  alt="Rosters Blood Bowl"
                  width={400}
                  height={160}
                  className="h-full w-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="p-5 bg-white">
                <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.rosters.title}</h3>
                <p className="text-nuffle-anthracite/80 mt-1 font-body">
                  {t.home.rosters.description}
                </p>
              </div>
            </a>
            <a
              href="/star-players"
              className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 overflow-hidden hover:border-nuffle-gold/50 hover:shadow-xl transition-all group"
            >
              <div className="h-40 flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#e8d6ae' }}>
                <Image
                  src="/images/star-players.webp"
                  alt="Star Players Blood Bowl"
                  width={400}
                  height={160}
                  className="h-full w-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="p-5 bg-white">
                <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.starPlayers.title}</h3>
                <p className="text-nuffle-anthracite/80 mt-1 font-body">
                  {t.home.starPlayers.description}
                </p>
              </div>
            </a>
            <a
              href="/skills"
              className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 overflow-hidden hover:border-nuffle-gold/50 hover:shadow-xl transition-all group"
            >
              <div className="h-40 flex items-center justify-center bg-gradient-to-br from-nuffle-ivory to-nuffle-bronze/20">
                <span className="text-6xl" aria-hidden="true">📚</span>
              </div>
              <div className="p-5 bg-white">
                <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.skillsReference.title}</h3>
                <p className="text-nuffle-anthracite/80 mt-1 font-body">
                  {t.home.skillsReference.description}
                </p>
              </div>
            </a>
            <a
              href="/tutoriel"
              className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 overflow-hidden hover:border-nuffle-gold/50 hover:shadow-xl transition-all group"
            >
              <div className="h-40 flex items-center justify-center bg-gradient-to-br from-nuffle-ivory to-emerald-100">
                <span className="text-6xl" aria-hidden="true">🎓</span>
              </div>
              <div className="p-5 bg-white">
                <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.tutorial.title}</h3>
                <p className="text-nuffle-anthracite/80 mt-1 font-body">
                  {t.home.tutorial.description}
                </p>
              </div>
            </a>
            <a
              href="/local-matches"
              className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 overflow-hidden hover:border-nuffle-gold/50 hover:shadow-xl transition-all group"
            >
              <div className="h-40 flex items-center justify-center bg-gradient-to-br from-nuffle-ivory to-nuffle-gold/20">
                <span className="text-6xl" aria-hidden="true">🎲</span>
              </div>
              <div className="p-5 bg-white">
                <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.localMatches.title}</h3>
                <p className="text-nuffle-anthracite/80 mt-1 font-body">
                  {t.home.localMatches.description}
                </p>
              </div>
            </a>
            <div className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 overflow-hidden hover:border-nuffle-gold/50 hover:shadow-xl transition-all">
              <div className="h-40 flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#e8d6ae' }}>
                <Image
                  src="/images/export-pdf.webp"
                  alt="Export PDF roster"
                  width={400}
                  height={160}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="p-5 bg-white">
                <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.exportPdf.title}</h3>
                <p className="text-nuffle-anthracite/80 mt-1 font-body">
                  {t.home.exportPdf.description}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick access */}
        <section className="w-full px-4 sm:px-6 pb-8 md:pb-12">
          <div className="rounded-2xl bg-nuffle-ivory border-2 border-nuffle-bronze/30 p-5 sm:p-6 shadow-md">
            <h2 className="text-lg sm:text-xl font-heading font-bold text-nuffle-anthracite mb-4">
              {t.home.quickAccess}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-nuffle-bronze/30 hover:border-nuffle-gold/60 hover:bg-nuffle-gold/5 transition-all font-subtitle font-semibold text-nuffle-anthracite text-sm sm:text-base"
                >
                  <span aria-hidden="true">{link.icon}</span>
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Play Online (feature-flagged) */}
        {onlinePlayEnabled && (
          <section className="w-full px-4 sm:px-6 pb-8 md:pb-12">
            <div className="rounded-2xl bg-gradient-to-br from-nuffle-anthracite via-nuffle-bronze/90 to-nuffle-anthracite text-nuffle-ivory p-6 sm:p-8 md:p-12 shadow-xl border-2 border-nuffle-bronze/50">
              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold">
                    {t.play?.playOnline || "Jouer en ligne"}
                  </h2>
                  <p className="text-nuffle-ivory/80 mt-2 font-body text-sm sm:text-base">
                    {t.play?.playOnlineDesc || "Affrontez d'autres coachs en ligne ! Créez une partie ou rejoignez un match existant."}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <a
                    href="/play"
                    className="px-6 py-3 bg-nuffle-gold text-nuffle-anthracite font-subtitle font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-center whitespace-nowrap"
                  >
                    🎮 {t.play?.playOnlineButton || "Accéder au lobby"}
                  </a>
                  <a
                    href="/me/matches"
                    className="px-6 py-3 border-2 border-nuffle-gold/50 text-nuffle-ivory hover:bg-nuffle-gold/20 font-subtitle font-semibold rounded-lg transition-all text-center whitespace-nowrap"
                  >
                    📊 {t.play?.myOnlineMatches || "Mes matchs en ligne"}
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="w-full px-4 sm:px-6 pb-8 md:pb-12">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite text-center mb-6 md:mb-8">
              {t.home.faqTitle}
            </h2>
            <div className="space-y-3">
              <details className="group rounded-xl bg-white border-2 border-nuffle-bronze/30 p-4 sm:p-5 shadow-sm hover:border-nuffle-gold/50 transition-colors">
                <summary className="cursor-pointer font-subtitle font-semibold text-nuffle-anthracite flex items-center justify-between gap-2">
                  <span>{t.home.faqQ1}</span>
                  <span className="text-nuffle-gold group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
                </summary>
                <p className="mt-3 text-nuffle-anthracite/80 font-body text-sm sm:text-base">{t.home.faqA1}</p>
              </details>
              <details className="group rounded-xl bg-white border-2 border-nuffle-bronze/30 p-4 sm:p-5 shadow-sm hover:border-nuffle-gold/50 transition-colors">
                <summary className="cursor-pointer font-subtitle font-semibold text-nuffle-anthracite flex items-center justify-between gap-2">
                  <span>{t.home.faqQ2}</span>
                  <span className="text-nuffle-gold group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
                </summary>
                <p className="mt-3 text-nuffle-anthracite/80 font-body text-sm sm:text-base">{t.home.faqA2}</p>
              </details>
              <details className="group rounded-xl bg-white border-2 border-nuffle-bronze/30 p-4 sm:p-5 shadow-sm hover:border-nuffle-gold/50 transition-colors">
                <summary className="cursor-pointer font-subtitle font-semibold text-nuffle-anthracite flex items-center justify-between gap-2">
                  <span>{t.home.faqQ3}</span>
                  <span className="text-nuffle-gold group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
                </summary>
                <p className="mt-3 text-nuffle-anthracite/80 font-body text-sm sm:text-base">{t.home.faqA3}</p>
              </details>
              <details className="group rounded-xl bg-white border-2 border-nuffle-bronze/30 p-4 sm:p-5 shadow-sm hover:border-nuffle-gold/50 transition-colors">
                <summary className="cursor-pointer font-subtitle font-semibold text-nuffle-anthracite flex items-center justify-between gap-2">
                  <span>{t.home.faqQ4}</span>
                  <span className="text-nuffle-gold group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
                </summary>
                <p className="mt-3 text-nuffle-anthracite/80 font-body text-sm sm:text-base">{t.home.faqA4}</p>
              </details>
            </div>
          </div>
        </section>

        {/* Support CTA */}
        <section className="w-full px-4 sm:px-6 pb-8 md:pb-12">
          <div className="rounded-2xl bg-white border-2 border-nuffle-bronze/30 p-6 sm:p-8 md:p-10 shadow-lg hover:border-nuffle-gold/50 transition-all">
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
              <div className="flex-shrink-0">
                <svg className="w-12 h-12 sm:w-16 sm:h-16 text-red-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl sm:text-2xl font-heading font-bold text-nuffle-anthracite">
                  {t.support?.homeCta || "Vous aimez Nuffle Arena ?"}
                </h2>
                <p className="text-nuffle-anthracite/80 mt-2 font-body text-sm sm:text-base">
                  {t.support?.homeCtaDescription || "Ce projet est 100 % gratuit et maintenu par des passionnés. Un petit coup de pouce nous aide à garder les serveurs en ligne !"}
                </p>
              </div>
              <div className="flex-shrink-0">
                <a
                  href="/support"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" />
                  </svg>
                  {t.support?.homeCtaButton || "Nous soutenir"}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Callout */}
        <section className="w-full px-4 sm:px-6 pb-12 md:pb-16">
          <div className="rounded-2xl bg-gradient-to-r from-nuffle-gold via-nuffle-bronze to-nuffle-gold text-nuffle-anthracite p-6 sm:p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 shadow-xl border-2 border-nuffle-bronze/50">
            <div className="text-center md:text-left">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold">
                {t.home.createFirstTeam}
              </h2>
              <p className="text-nuffle-anthracite/90 mt-2 font-body text-sm sm:text-base">
                {t.home.createFirstTeamDesc}
              </p>
            </div>
            <a
              href="/me/teams"
              className="w-full md:w-auto px-6 py-3 bg-nuffle-anthracite text-nuffle-ivory font-subtitle font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-center"
            >
              {t.home.manageTeams}
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
