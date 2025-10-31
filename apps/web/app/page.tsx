"use client";
import Logo from "./components/Logo";
import { useLanguage } from "./contexts/LanguageContext";

export default function LandingPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-nuffle-anthracite via-nuffle-bronze to-nuffle-anthracite">
        <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col-reverse md:flex-row items-center gap-10">
          <div className="text-nuffle-ivory max-w-xl">
            <div className="mb-6">
              <Logo variant="default" showText={true} textColor="text-nuffle-ivory" />
            </div>
            <p className="mt-6 text-xl text-nuffle-ivory/90 leading-relaxed font-subtitle">
              {t.home.title}
            </p>
            <p className="mt-4 text-lg text-nuffle-ivory/80 leading-relaxed font-body">
              {t.home.description}
            </p>
            <p className="mt-3 text-nuffle-ivory/70 leading-relaxed font-body">
              {t.home.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/me/teams"
                className="px-6 py-3 rounded-lg bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                {t.home.manageTeams}
              </a>
              <a
                href="/login"
                className="px-6 py-3 rounded-lg border-2 border-nuffle-gold/50 text-nuffle-ivory hover:bg-nuffle-gold/20 font-subtitle font-semibold transition-all"
              >
                {t.home.login}
              </a>
              <a
                href="/register"
                className="px-6 py-3 rounded-lg border-2 border-nuffle-bronze/50 text-nuffle-ivory/90 hover:text-nuffle-ivory hover:bg-nuffle-bronze/20 font-subtitle font-semibold transition-all"
              >
                {t.home.register}
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-xl border-2 border-nuffle-gold/30 bg-nuffle-bronze/20 backdrop-blur-sm p-6 shadow-2xl">
              <img
                src="/images/bb_dice_sides.png"
                alt="Dés de blocage"
                className="w-[540px] max-w-full rounded-md"
              />
            </div>
            <div className="hidden md:block absolute -bottom-6 -left-6 rotate-[-8deg] rounded-lg border-2 border-nuffle-gold/30 bg-nuffle-bronze/30 p-3 shadow-xl backdrop-blur-sm">
              <img
                src="/images/blocking_dice/pow.png"
                alt="POW"
                className="w-20"
              />
            </div>
            <div className="hidden md:block absolute -top-6 -right-8 rotate-[12deg] rounded-lg border-2 border-nuffle-gold/30 bg-nuffle-bronze/30 p-3 shadow-xl backdrop-blur-sm">
              <img
                src="/images/blocking_dice/push_back.png"
                alt="PUSH"
                className="w-20"
              />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(203,161,53,0.15),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(107,78,46,0.15),transparent_40%)]" />
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-xl bg-white shadow-lg border-2 border-nuffle-bronze/30 overflow-hidden hover:border-nuffle-gold/50 transition-all">
            <div className="h-40 flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#e8d6ae' }}>
              <img
                src="/images/rosters.png"
                alt="Rosters"
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
              <img
                src="/images/star-players.png"
                alt="Star Players"
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
              <img
                src="/images/export-pdf.png"
                alt="Export PDF"
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

      {/* Callout */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-2xl bg-gradient-to-r from-nuffle-gold via-nuffle-bronze to-nuffle-gold text-nuffle-anthracite p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border-2 border-nuffle-bronze/50">
          <div>
            <h3 className="text-2xl md:text-3xl font-heading font-bold">
              {t.home.createFirstTeam}
            </h3>
            <p className="text-nuffle-anthracite/90 mt-2 font-body">
              {t.home.createFirstTeamDesc}
            </p>
          </div>
          <a
            href="/me/teams"
            className="px-6 py-3 bg-nuffle-anthracite text-nuffle-ivory font-subtitle font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            {t.home.manageTeams}
          </a>
        </div>
      </section>
    </div>
  );
}
