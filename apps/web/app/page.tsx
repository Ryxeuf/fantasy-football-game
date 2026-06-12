"use client";
import Image from "next/image";
import Logo from "./components/Logo";
import { useLanguage } from "./contexts/LanguageContext";
import HomeStructuredData from "./components/HomeStructuredData";
import LatestBlogPosts from "./components/LatestBlogPosts";
import { useFeatureFlag } from "./hooks/useFeatureFlag";
import { ONLINE_PLAY_FLAG } from "./lib/featureFlagKeys";

// Placeholders flous (16px) générés depuis les illustrations : affichés
// instantanément pendant le chargement -> fondu progressif au lieu d'un vide.
const BLUR_ROSTERS =
  "data:image/webp;base64,UklGRn4AAABXRUJQVlA4IHIAAADwAQCdASoQABAAAwBSJQBOgMWv3hpvliAA/usmQEkRWvMJoCFpv6NujvLqVZUE46/Ob8WflY4kjDvycWr+x9Z9iLyIn6sVQLluCbwQfCATGyF+9Olf7MzrTK/SbmGj9wJK/55HdRfloYD2GExEwJasIAA=";
const BLUR_STAR_PLAYERS =
  "data:image/webp;base64,UklGRoIAAABXRUJQVlA4IHYAAABwAgCdASoQABAAAwBSJZgCdAYuvvu78e5AvMAAAP7rhb++TW68TIlRZ8IoNji6exbqz16065yk6oWxiZKdZ7NVnpF480cbNV6cKhBx5PC98JR9Q+se82ptjHOz+TCADcC1B0Pzv04btCAdM/BskU3HE3YGAAAA";
const BLUR_EXPORT_PDF =
  "data:image/webp;base64,UklGRoQAAABXRUJQVlA4IHgAAAAQAgCdASoQABAAAwBSJYgCdAEPgC+/ZmAAAP7wOyGFDOABt3K1js84WYwgiQ4YcayeIMmjsrFRAIR54IjiCLXEMG2Hm/MpSb5Z2N8zmm3k4pZ8A+Nfj5gVdn13CTYQ1UALdOu4wu8t4/Viq/x8cGyRTccTdlUAAAA=";

const SKILL_CATEGORY_ICONS = [
  { src: "/images/Competence-Generale.png", alt: "Compétences générales" },
  { src: "/images/Competence-Agilite.png", alt: "Compétences d'agilité" },
  { src: "/images/Competence-Force.png", alt: "Compétences de force" },
  { src: "/images/Competence-Passe.png", alt: "Compétences de passe" },
  { src: "/images/Competence-Mutation.png", alt: "Mutations" },
  { src: "/images/Competence-Scelerate.png", alt: "Compétences scélérates" },
];

function SectionHeading({ title, subtitle, light = false }: { title: string; subtitle?: string; light?: boolean }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-3 mb-3" aria-hidden="true">
        <span className={`h-px w-12 sm:w-16 ${light ? "bg-nuffle-gold/50" : "bg-nuffle-bronze/50"}`} />
        <span className="text-nuffle-gold text-lg leading-none">✦</span>
        <span className={`h-px w-12 sm:w-16 ${light ? "bg-nuffle-gold/50" : "bg-nuffle-bronze/50"}`} />
      </div>
      <h2 className={`text-2xl sm:text-3xl md:text-4xl font-heading font-bold ${light ? "text-nuffle-ivory" : "text-nuffle-anthracite"}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-2 text-base sm:text-lg font-body ${light ? "text-nuffle-ivory/70" : "text-nuffle-anthracite/70"}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default function LandingPage() {
  const { t } = useLanguage();
  const onlinePlayEnabled = useFeatureFlag(ONLINE_PLAY_FLAG);

  const quickLinks = [
    { href: "/teams", label: t.home.quickAccessTeams, icon: "⚽" },
    { href: "/star-players", label: t.home.quickAccessStarPlayers, icon: "⭐" },
    { href: "/skills", label: t.home.quickAccessSkills, icon: "📚" },
    { href: "/tutoriel", label: t.home.quickAccessTutorial, icon: "🎓" },
  ];

  const stats = [
    { label: t.home.statsRosters, value: "30" },
    { label: t.home.statsStarPlayers, value: "60+" },
    { label: t.home.statsSkills, value: "130+" },
    { label: t.home.statsFree, value: t.home.statsFreeValue },
  ];

  return (
    <>
      <HomeStructuredData />
      <div className="min-h-screen">
        {/* Beta Launch Banner */}
        <section className="w-full bg-gradient-to-r from-nuffle-red via-[#5e1717] to-nuffle-red text-nuffle-ivory py-2.5 px-6 border-b border-nuffle-gold/40">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
            <svg className="w-5 h-5 flex-shrink-0 text-nuffle-gold" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="font-subtitle font-semibold text-sm md:text-base tracking-wide uppercase">
              {t.home.betaBanner}
            </p>
          </div>
        </section>

        {/* Hero — stade de nuit : anthracite, halo rouge sang, lignes de terrain */}
        <section className="relative isolate overflow-hidden bg-nuffle-anthracite border-b-4 border-nuffle-gold/70">
          <div
            className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(122,31,31,0.5),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(203,161,53,0.22),transparent_45%),radial-gradient(ellipse_at_center,rgba(0,0,0,0)_40%,rgba(0,0,0,0.55)_100%)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 -z-10 opacity-[0.045] bg-[repeating-linear-gradient(to_bottom,transparent,transparent_70px,#E9E2D0_70px,#E9E2D0_72px)]"
            aria-hidden="true"
          />
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20 md:py-24 flex flex-col-reverse md:flex-row items-center gap-8 md:gap-12">
            <div className="text-nuffle-ivory max-w-xl w-full">
              <div className="mb-5 md:mb-7">
                <Logo variant="default" showText={true} textColor="text-nuffle-ivory" />
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-nuffle-gold/50 bg-nuffle-gold/10 px-4 py-1.5 text-xs sm:text-sm font-subtitle font-semibold uppercase tracking-widest text-nuffle-gold">
                <span className="h-1.5 w-1.5 rounded-full bg-nuffle-gold animate-pulse" aria-hidden="true" />
                {t.home.heroBadge}
              </span>
              <h1 className="sr-only">Nuffle Arena — {t.home.title}</h1>
              <p
                className="mt-4 md:mt-5 font-heading font-bold text-3xl sm:text-4xl md:text-5xl leading-tight bg-gradient-to-br from-[#E8C96A] via-nuffle-gold to-[#9a7a28] bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(203,161,53,0.25)]"
                aria-hidden="true"
              >
                {t.home.title}
              </p>
              <p className="mt-4 md:mt-5 text-base sm:text-lg text-nuffle-ivory/85 leading-relaxed font-body">
                {t.home.description}
              </p>
              <p className="mt-3 text-sm sm:text-base text-nuffle-ivory/65 leading-relaxed font-body">
                {t.home.subtitle}
              </p>
              <blockquote className="mt-5 border-l-4 border-nuffle-red pl-4 text-sm sm:text-base italic text-nuffle-ivory/60 font-body">
                {t.home.heroQuote}
              </blockquote>
              <div className="mt-7 md:mt-9 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                <a
                  href="/me/teams"
                  className="px-7 py-3.5 rounded-lg bg-gradient-to-b from-[#E0BC52] to-nuffle-gold hover:from-nuffle-gold hover:to-[#a8852b] text-nuffle-anthracite font-subtitle font-bold uppercase tracking-wide shadow-[0_4px_20px_rgba(203,161,53,0.4)] hover:shadow-[0_6px_28px_rgba(203,161,53,0.55)] transition-all transform hover:scale-105 text-center"
                >
                  {t.home.manageTeams}
                </a>
                <a
                  href="/teams"
                  className="px-7 py-3.5 rounded-lg border-2 border-nuffle-ivory/30 text-nuffle-ivory hover:border-nuffle-gold hover:bg-nuffle-gold/10 hover:text-nuffle-gold font-subtitle font-bold uppercase tracking-wide transition-all text-center"
                >
                  {t.home.discoverTeams}
                </a>
              </div>
            </div>
            <div className="relative w-full md:w-auto">
              <div className="rotate-[1.5deg] rounded-xl border-2 border-nuffle-gold/40 bg-black/40 backdrop-blur-sm p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                <Image
                  src="/images/bb_dice_sides.webp"
                  alt="Dés de blocage Blood Bowl"
                  width={540}
                  height={360}
                  className="w-full max-w-[540px] mx-auto rounded-md"
                  priority
                />
              </div>
              <div className="hidden md:block absolute -bottom-8 -left-8 rotate-[-10deg] rounded-lg border-2 border-nuffle-red/60 bg-black/50 p-3 shadow-[0_10px_30px_rgba(122,31,31,0.5)] backdrop-blur-sm">
                <Image
                  src="/images/blocking_dice/pow.png"
                  alt="Dé de blocage POW"
                  width={80}
                  height={80}
                  className="w-20"
                />
              </div>
              <div className="hidden md:block absolute -top-7 -right-9 rotate-[14deg] rounded-lg border-2 border-nuffle-gold/40 bg-black/50 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-sm">
                <Image
                  src="/images/blocking_dice/push_back.png"
                  alt="Dé de blocage PUSH"
                  width={80}
                  height={80}
                  className="w-20"
                />
              </div>
              <div className="hidden lg:block absolute top-1/2 -right-16 rotate-[-6deg] rounded-lg border-2 border-nuffle-bronze/60 bg-black/50 p-2.5 shadow-xl backdrop-blur-sm">
                <Image
                  src="/images/blocking_dice/both_down.png"
                  alt="Dé de blocage BOTH DOWN"
                  width={64}
                  height={64}
                  className="w-16"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Scoreboard — bandeau de stats façon panneau d'affichage de stade */}
        <section className="w-full bg-[#15130f] border-b-4 border-nuffle-red/70 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.04] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#CBA135_10px,#CBA135_12px)]"
            aria-hidden="true"
          />
          <h2 className="sr-only">{t.home.statsTitle}</h2>
          <dl className="relative grid grid-cols-2 md:grid-cols-4 max-w-6xl mx-auto text-center divide-x divide-y md:divide-y-0 divide-nuffle-gold/15">
            {stats.map((stat) => (
              <div key={stat.label} className="px-4 py-6 sm:py-8">
                <dd className="font-score text-4xl sm:text-5xl md:text-6xl text-nuffle-gold tracking-wider drop-shadow-[0_0_14px_rgba(203,161,53,0.35)]">
                  {stat.value}
                </dd>
                <dt className="mt-1 text-[11px] sm:text-xs text-nuffle-ivory/60 font-subtitle uppercase tracking-[0.2em]">
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>
        </section>

        {/* Features */}
        <section className="w-full px-4 sm:px-6 py-14 md:py-20">
          <div className="max-w-6xl mx-auto mb-10 md:mb-12">
            <SectionHeading title={t.home.discoverTitle} subtitle={t.home.discoverSubtitle} />
          </div>
          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <a
              href="/teams"
              className="rounded-xl bg-[#FDFBF5] shadow-lg border-2 border-nuffle-bronze/40 overflow-hidden hover:border-nuffle-gold hover:shadow-2xl hover:-translate-y-1 transition-all group"
            >
              <div className="h-40 flex items-center justify-center overflow-hidden border-b-2 border-nuffle-gold/30" style={{ backgroundColor: '#e8d6ae' }}>
                <Image
                  src="/images/rosters.webp"
                  alt="Rosters Blood Bowl"
                  width={320}
                  height={320}
                  placeholder="blur"
                  blurDataURL={BLUR_ROSTERS}
                  className="h-full w-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="p-5">
                <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.rosters.title}</h3>
                <span className="block h-0.5 w-10 bg-nuffle-gold mt-1.5 mb-2 group-hover:w-16 transition-all" aria-hidden="true" />
                <p className="text-nuffle-anthracite/80 font-body">
                  {t.home.rosters.description}
                </p>
              </div>
            </a>
            <a
              href="/star-players"
              className="rounded-xl bg-[#FDFBF5] shadow-lg border-2 border-nuffle-bronze/40 overflow-hidden hover:border-nuffle-gold hover:shadow-2xl hover:-translate-y-1 transition-all group"
            >
              <div className="h-40 flex items-center justify-center overflow-hidden border-b-2 border-nuffle-gold/30" style={{ backgroundColor: '#e8d6ae' }}>
                <Image
                  src="/images/star-players.webp"
                  alt="Star Players Blood Bowl"
                  width={320}
                  height={320}
                  placeholder="blur"
                  blurDataURL={BLUR_STAR_PLAYERS}
                  className="h-full w-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="p-5">
                <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.starPlayers.title}</h3>
                <span className="block h-0.5 w-10 bg-nuffle-gold mt-1.5 mb-2 group-hover:w-16 transition-all" aria-hidden="true" />
                <p className="text-nuffle-anthracite/80 font-body">
                  {t.home.starPlayers.description}
                </p>
              </div>
            </a>
            <a
              href="/skills"
              className="rounded-xl bg-[#FDFBF5] shadow-lg border-2 border-nuffle-bronze/40 overflow-hidden hover:border-nuffle-gold hover:shadow-2xl hover:-translate-y-1 transition-all group"
            >
              <div className="h-40 grid grid-cols-3 place-items-center gap-2 px-8 bg-gradient-to-br from-nuffle-anthracite to-[#3a2e1c] border-b-2 border-nuffle-gold/30">
                {SKILL_CATEGORY_ICONS.map((icon) => (
                  <Image
                    key={icon.src}
                    src={icon.src}
                    alt={icon.alt}
                    width={56}
                    height={56}
                    className="w-12 h-12 object-contain drop-shadow-[0_0_8px_rgba(203,161,53,0.4)] group-hover:scale-110 transition-transform"
                  />
                ))}
              </div>
              <div className="p-5">
                <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.skillsReference.title}</h3>
                <span className="block h-0.5 w-10 bg-nuffle-gold mt-1.5 mb-2 group-hover:w-16 transition-all" aria-hidden="true" />
                <p className="text-nuffle-anthracite/80 font-body">
                  {t.home.skillsReference.description}
                </p>
              </div>
            </a>
            <a
              href="/tutoriel"
              className="rounded-xl bg-[#FDFBF5] shadow-lg border-2 border-nuffle-bronze/40 overflow-hidden hover:border-nuffle-gold hover:shadow-2xl hover:-translate-y-1 transition-all group"
            >
              <div className="h-40 flex items-center justify-center bg-gradient-to-br from-nuffle-anthracite via-[#2b2316] to-nuffle-anthracite border-b-2 border-nuffle-gold/30">
                <span
                  className="flex items-center justify-center w-24 h-24 rounded-full border-2 border-nuffle-gold/60 bg-nuffle-gold/10 text-5xl group-hover:scale-110 transition-transform"
                  aria-hidden="true"
                >
                  🎓
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.tutorial.title}</h3>
                <span className="block h-0.5 w-10 bg-nuffle-gold mt-1.5 mb-2 group-hover:w-16 transition-all" aria-hidden="true" />
                <p className="text-nuffle-anthracite/80 font-body">
                  {t.home.tutorial.description}
                </p>
              </div>
            </a>
            <a
              href="/local-matches"
              className="rounded-xl bg-[#FDFBF5] shadow-lg border-2 border-nuffle-bronze/40 overflow-hidden hover:border-nuffle-gold hover:shadow-2xl hover:-translate-y-1 transition-all group"
            >
              <div className="h-40 flex items-center justify-center gap-3 bg-gradient-to-br from-[#1f3d2b] to-[#0f241a] border-b-2 border-nuffle-gold/30">
                <Image
                  src="/images/blocking_dice/pow.png"
                  alt=""
                  width={64}
                  height={64}
                  className="w-14 rotate-[-8deg] drop-shadow-lg group-hover:rotate-[-16deg] transition-transform"
                  aria-hidden="true"
                />
                <Image
                  src="/images/blocking_dice/both_down.png"
                  alt=""
                  width={64}
                  height={64}
                  className="w-16 drop-shadow-lg group-hover:scale-110 transition-transform"
                  aria-hidden="true"
                />
                <Image
                  src="/images/blocking_dice/stumble.png"
                  alt=""
                  width={64}
                  height={64}
                  className="w-14 rotate-[10deg] drop-shadow-lg group-hover:rotate-[18deg] transition-transform"
                  aria-hidden="true"
                />
              </div>
              <div className="p-5">
                <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.localMatches.title}</h3>
                <span className="block h-0.5 w-10 bg-nuffle-gold mt-1.5 mb-2 group-hover:w-16 transition-all" aria-hidden="true" />
                <p className="text-nuffle-anthracite/80 font-body">
                  {t.home.localMatches.description}
                </p>
              </div>
            </a>
            <div className="rounded-xl bg-[#FDFBF5] shadow-lg border-2 border-nuffle-bronze/40 overflow-hidden hover:border-nuffle-gold hover:shadow-2xl hover:-translate-y-1 transition-all">
              <div className="h-40 flex items-center justify-center overflow-hidden border-b-2 border-nuffle-gold/30" style={{ backgroundColor: '#e8d6ae' }}>
                <Image
                  src="/images/export-pdf.webp"
                  alt="Export PDF roster"
                  width={320}
                  height={320}
                  placeholder="blur"
                  blurDataURL={BLUR_EXPORT_PDF}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="p-5">
                <h3 className="font-heading font-bold text-lg text-nuffle-anthracite">{t.home.exportPdf.title}</h3>
                <span className="block h-0.5 w-10 bg-nuffle-gold mt-1.5 mb-2" aria-hidden="true" />
                <p className="text-nuffle-anthracite/80 font-body">
                  {t.home.exportPdf.description}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick access — bandeau sombre façon signalétique de stade */}
        <section className="w-full bg-nuffle-anthracite border-y-2 border-nuffle-gold/40 px-4 sm:px-6 py-8 md:py-10 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.04] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#E9E2D0_10px,#E9E2D0_12px)]"
            aria-hidden="true"
          />
          <div className="relative max-w-6xl mx-auto">
            <h2 className="text-lg sm:text-xl font-heading font-bold text-nuffle-gold uppercase tracking-wider mb-4 flex items-center gap-2">
              <span aria-hidden="true">⚡</span>
              {t.home.quickAccess}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 px-4 py-3 bg-white/5 rounded-lg border border-nuffle-gold/40 hover:bg-nuffle-gold hover:text-nuffle-anthracite text-nuffle-ivory transition-all font-subtitle font-semibold text-sm sm:text-base"
                >
                  <span aria-hidden="true">{link.icon}</span>
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Latest blog posts */}
        <div className="pt-10 md:pt-14">
          <LatestBlogPosts />
        </div>

        {/* Play Online (feature-flagged) */}
        {onlinePlayEnabled && (
          <section className="w-full px-4 sm:px-6 pb-8 md:pb-12">
            <div className="max-w-6xl mx-auto rounded-2xl bg-gradient-to-br from-nuffle-red via-[#3d1212] to-nuffle-anthracite text-nuffle-ivory p-6 sm:p-8 md:p-12 shadow-xl border-2 border-nuffle-gold/50">
              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-nuffle-gold">
                    {t.play?.playOnline || "Jouer en ligne"}
                  </h2>
                  <p className="text-nuffle-ivory/80 mt-2 font-body text-sm sm:text-base">
                    {t.play?.playOnlineDesc || "Affrontez d'autres coachs en ligne ! Créez une partie ou rejoignez un match existant."}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <a
                    href="/play"
                    className="px-6 py-3 bg-nuffle-gold text-nuffle-anthracite font-subtitle font-bold uppercase tracking-wide rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-center whitespace-nowrap"
                  >
                    🎮 {t.play?.playOnlineButton || "Accéder au lobby"}
                  </a>
                  <a
                    href="/me/matches"
                    className="px-6 py-3 border-2 border-nuffle-gold/50 text-nuffle-ivory hover:bg-nuffle-gold/20 font-subtitle font-bold uppercase tracking-wide rounded-lg transition-all text-center whitespace-nowrap"
                  >
                    📊 {t.play?.myOnlineMatches || "Mes matchs en ligne"}
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="w-full px-4 sm:px-6 py-8 md:py-12">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 md:mb-8">
              <SectionHeading title={t.home.faqTitle} />
            </div>
            <div className="space-y-3">
              {[
                { q: t.home.faqQ1, a: t.home.faqA1 },
                { q: t.home.faqQ2, a: t.home.faqA2 },
                { q: t.home.faqQ3, a: t.home.faqA3 },
                { q: t.home.faqQ4, a: t.home.faqA4 },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl bg-[#FDFBF5] border-2 border-nuffle-bronze/40 p-4 sm:p-5 shadow-sm hover:border-nuffle-gold transition-colors"
                >
                  <summary className="cursor-pointer font-subtitle font-semibold text-nuffle-anthracite flex items-center justify-between gap-2">
                    <span>{item.q}</span>
                    <span className="text-nuffle-gold group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
                  </summary>
                  <p className="mt-3 text-nuffle-anthracite/80 font-body text-sm sm:text-base border-t border-nuffle-bronze/20 pt-3">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Support CTA */}
        <section className="w-full px-4 sm:px-6 pb-8 md:pb-12">
          <div className="max-w-6xl mx-auto rounded-2xl bg-[#FDFBF5] border-2 border-nuffle-bronze/40 p-6 sm:p-8 md:p-10 shadow-lg hover:border-nuffle-gold transition-all">
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
              <div className="flex-shrink-0">
                <svg className="w-12 h-12 sm:w-16 sm:h-16 text-nuffle-red" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                  className="inline-flex items-center gap-2 px-6 py-3 bg-nuffle-gold hover:bg-nuffle-gold/90 text-nuffle-anthracite font-subtitle font-bold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 whitespace-nowrap"
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

        {/* Callout final — affiche de match */}
        <section className="w-full px-4 sm:px-6 pb-12 md:pb-16">
          <div className="max-w-6xl mx-auto relative rounded-2xl bg-nuffle-anthracite text-nuffle-ivory p-6 sm:p-8 md:p-12 shadow-2xl border-2 border-nuffle-gold/60 overflow-hidden">
            <div
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(122,31,31,0.45),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(203,161,53,0.18),transparent_50%)]"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 opacity-[0.04] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#CBA135_10px,#CBA135_12px)]"
              aria-hidden="true"
            />
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-5 md:gap-8">
              <div className="text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold bg-gradient-to-br from-[#E8C96A] via-nuffle-gold to-[#9a7a28] bg-clip-text text-transparent">
                  {t.home.createFirstTeam}
                </h2>
                <p className="text-nuffle-ivory/80 mt-2 font-body text-sm sm:text-base">
                  {t.home.createFirstTeamDesc}
                </p>
              </div>
              <a
                href="/me/teams"
                className="w-full md:w-auto px-8 py-4 bg-gradient-to-b from-[#E0BC52] to-nuffle-gold hover:from-nuffle-gold hover:to-[#a8852b] text-nuffle-anthracite font-subtitle font-bold uppercase tracking-wide rounded-lg shadow-[0_4px_20px_rgba(203,161,53,0.4)] hover:shadow-[0_6px_28px_rgba(203,161,53,0.55)] transition-all transform hover:scale-105 text-center"
              >
                {t.home.manageTeams}
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
