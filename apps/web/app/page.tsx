"use client";
import Image from "next/image";
import Logo from "./components/Logo";
import { useLanguage } from "./contexts/LanguageContext";
import HomeStructuredData from "./components/HomeStructuredData";

export default function LandingPage() {
  const { t } = useLanguage();
  return (
    <>
      <HomeStructuredData />
      <div className="min-h-screen">
      {/* Beta Warning Banner */}
      <section className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-white py-3 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="font-semibold text-sm md:text-base">
            <span className="font-bold">Version BETA</span> - Les données sont susceptibles d'être modifiées ou supprimées sans préavis
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
                href="/login"
                className="px-6 py-3 rounded-lg border-2 border-nuffle-gold/50 text-nuffle-ivory hover:bg-nuffle-gold/20 font-subtitle font-semibold transition-all text-center"
              >
                {t.home.login}
              </a>
            </div>
          </div>
          <div className="relative w-full md:w-auto">
            <div className="rounded-xl border-2 border-nuffle-gold/30 bg-nuffle-bronze/20 backdrop-blur-sm p-4 sm:p-6 shadow-2xl">
              <Image
                src="/images/bb_dice_sides.webp"
                alt="Dés de blocage"
                width={540}
                height={360}
                className="w-full max-w-[540px] mx-auto rounded-md"
                priority
              />
            </div>
            <div className="hidden md:block absolute -bottom-6 -left-6 rotate-[-8deg] rounded-lg border-2 border-nuffle-gold/30 bg-nuffle-bronze/30 p-3 shadow-xl backdrop-blur-sm">
              <Image
                src="/images/blocking_dice/pow.png"
                alt="POW"
                width={80}
                height={80}
                className="w-20"
              />
            </div>
            <div className="hidden md:block absolute -top-6 -right-8 rotate-[12deg] rounded-lg border-2 border-nuffle-gold/30 bg-nuffle-bronze/30 p-3 shadow-xl backdrop-blur-sm">
              <Image
                src="/images/blocking_dice/push_back.png"
                alt="PUSH"
                width={80}
                height={80}
                className="w-20"
              />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(203,161,53,0.15),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(107,78,46,0.15),transparent_40%)]" />
      </section>

      {/* Features */}
      <section className="w-full px-4 sm:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 overflow-hidden hover:border-nuffle-gold/50 transition-all">
            <div className="h-40 flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#e8d6ae' }}>
              <Image
                src="/images/rosters.webp"
                alt="Rosters"
                width={400}
                height={160}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="p-5 bg-white">
              <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.rosters.title}</h3>
              <p className="text-nuffle-anthracite/80 mt-1 font-body">
                {t.home.rosters.description}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 overflow-hidden hover:border-nuffle-gold/50 transition-all">
            <div className="h-40 flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#e8d6ae' }}>
              <Image
                src="/images/star-players.webp"
                alt="Star Players"
                width={400}
                height={160}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="p-5 bg-white">
              <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.starPlayers.title}</h3>
              <p className="text-nuffle-anthracite/80 mt-1 font-body">
                {t.home.starPlayers.description}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 overflow-hidden hover:border-nuffle-gold/50 transition-all">
            <div className="h-40 flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#e8d6ae' }}>
              <Image
                src="/images/export-pdf.webp"
                alt="Export PDF"
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

      {/* Play Online */}
      <section className="w-full px-4 sm:px-6 pb-8 md:pb-12">
        <div className="rounded-2xl bg-gradient-to-br from-nuffle-anthracite via-nuffle-bronze/90 to-nuffle-anthracite text-nuffle-ivory p-6 sm:p-8 md:p-12 shadow-xl border-2 border-nuffle-bronze/50">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold">
                {t.play?.playOnline || "Jouer en ligne"}
              </h3>
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

      {/* Support CTA */}
      <section className="w-full px-4 sm:px-6 pb-8 md:pb-12">
        <div className="rounded-2xl bg-white border-2 border-nuffle-bronze/30 p-6 sm:p-8 md:p-10 shadow-lg hover:border-nuffle-gold/50 transition-all">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <div className="flex-shrink-0">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl sm:text-2xl font-heading font-bold text-nuffle-anthracite">
                {t.support?.homeCta || "Vous aimez Nuffle Arena ?"}
              </h3>
              <p className="text-nuffle-anthracite/80 mt-2 font-body text-sm sm:text-base">
                {t.support?.homeCtaDescription || "Ce projet est 100 % gratuit et maintenu par des passionnés. Un petit coup de pouce nous aide à garder les serveurs en ligne !"}
              </p>
            </div>
            <div className="flex-shrink-0">
              <a
                href="/support"
                className="inline-flex items-center gap-2 px-6 py-3 bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
            <h3 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold">
              {t.home.createFirstTeam}
            </h3>
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
