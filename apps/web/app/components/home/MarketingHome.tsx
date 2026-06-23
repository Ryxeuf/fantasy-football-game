"use client";
import { useEffect, useState, type ReactNode } from "react";
import Logo from "../Logo";
import { useLanguage } from "../../contexts/LanguageContext";
import HomeStructuredData from "../HomeStructuredData";
import LatestBlogPosts from "../LatestBlogPosts";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { ONLINE_PLAY_FLAG } from "../../lib/featureFlagKeys";
import { apiRequest } from "../../lib/api-client";
import {
  NuffleMedallion,
  BlockDie,
  EmblemRosters,
  EmblemStar,
  EmblemSkills,
  EmblemTutorial,
  EmblemTabletop,
  EmblemPdf,
} from "./NuffleArt";
import {
  FactionCrest,
  FACTIONS,
  LeagueCrest,
  CupCrest,
  Flourish,
  StadiumBackdrop,
} from "./NuffleScenes";
import BlockDiceRoller from "./BlockDiceRoller";

/* Materiau « jeton sombre grave » — l'unique accent sombre, reutilise
   partout (badges d'icones, poster final) pour eviter le patchwork. */
const COIN_BADGE =
  "relative flex items-center justify-center rounded-full bg-[#1B1610] text-nuffle-gold ring-1 ring-nuffle-gold/40 shadow-[inset_0_1px_0_rgba(232,201,106,0.25),0_6px_16px_rgba(27,22,16,0.35)]";

function SectionTitle({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      {kicker && (
        <p className="font-subtitle text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-nuffle-gold/90">
          {kicker}
        </p>
      )}
      <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-nuffle-anthracite">
        {title}
      </h2>
      <span className="mt-3 inline-block h-px w-20 bg-gradient-to-r from-transparent via-nuffle-gold to-transparent" aria-hidden="true" />
      {subtitle && (
        <p className="mt-3 text-base sm:text-lg text-nuffle-bronze/90 font-body">{subtitle}</p>
      )}
    </div>
  );
}

interface FeatureCardProps {
  href?: string;
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
  cta?: string;
}

function FeatureCard({ href, icon, title, description, badge, cta }: FeatureCardProps) {
  const inner = (
    <>
      <div className="flex items-start gap-4">
        <span className={`${COIN_BADGE} h-14 w-14 flex-shrink-0`}>
          <span className="h-8 w-8 flex items-center justify-center [&>svg]:h-8 [&>svg]:w-8">{icon}</span>
        </span>
        <div className="min-w-0">
          <h3 className="font-heading font-bold text-lg leading-tight text-nuffle-anthracite">{title}</h3>
          {badge && (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-nuffle-gold/50 bg-nuffle-gold/15 px-2.5 py-0.5 text-[11px] font-subtitle font-bold uppercase tracking-wide text-nuffle-bronze">
              <span className="h-1.5 w-1.5 rounded-full bg-nuffle-gold" aria-hidden="true" />
              {badge}
            </span>
          )}
        </div>
      </div>
      <span className="mt-4 block h-px w-full bg-nuffle-bronze/15" aria-hidden="true" />
      <p className="mt-4 text-nuffle-anthracite/75 font-body text-sm sm:text-[15px] leading-relaxed">
        {description}
      </p>
      {href && cta && (
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-subtitle font-semibold text-nuffle-bronze group-hover:text-nuffle-gold transition-colors">
          {cta}
          <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
        </span>
      )}
    </>
  );

  const cardClass =
    "group h-full rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-6 shadow-[0_2px_10px_rgba(107,78,46,0.06)] hover:border-nuffle-gold/60 hover:shadow-[0_10px_30px_rgba(107,78,46,0.14)] hover:-translate-y-1 transition-all";

  return href ? (
    <a href={href} className={cardClass}>
      {inner}
    </a>
  ) : (
    <div className={cardClass}>{inner}</div>
  );
}

interface PublicStats {
  rosters: number;
  starPlayers: number;
  skills: number;
  teamsCreated: number;
  coaches: number;
  matchesTracked: number;
}

// Seuil avant d'afficher la preuve sociale d'activité : evite un
// "Déjà 3 équipes" peu flatteur en debut de beta. S'active tout seul.
const MIN_ACTIVITY_TEAMS = 25;

interface MarketingHomeProps {
  /**
   * Nom d'affichage du coach connecté, ou `null` pour un visiteur déconnecté.
   * Quand présent, la home affiche un bandeau personnalisé pointant vers le
   * tableau de bord `/me`. Optionnel : la home reste rendable seule (SSR/SEO).
   */
  readonly coachName?: string | null;
}

export default function MarketingHome({ coachName = null }: MarketingHomeProps) {
  const { t, language } = useLanguage();
  const onlinePlayEnabled = useFeatureFlag(ONLINE_PLAY_FLAG);

  // Stats live (compteurs reels) via /api/public/stats — endpoint leger
  // (6 COUNT), fetch cote client avec repli sur les valeurs catalogue.
  const [liveStats, setLiveStats] = useState<PublicStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiRequest<PublicStats>("/api/public/stats")
      .then((s) => { if (!cancelled) setLiveStats(s); })
      .catch(() => { /* repli silencieux sur les valeurs catalogue */ });
    return () => { cancelled = true; };
  }, []);

  const stats = [
    { label: t.home.statsRosters, value: liveStats?.rosters ?? "31" },
    { label: t.home.statsStarPlayers, value: liveStats?.starPlayers ?? "60+" },
    { label: t.home.statsSkills, value: liveStats?.skills ?? "130+" },
    { label: t.home.statsFree, value: t.home.statsFreeValue },
  ];

  const numLocale = language === "en" ? "en-US" : "fr-FR";
  const showActivity = Boolean(liveStats && liveStats.teamsCreated >= MIN_ACTIVITY_TEAMS);
  const activityLine = liveStats
    ? t.home.activityLine
        .replace("{teams}", liveStats.teamsCreated.toLocaleString(numLocale))
        .replace("{matches}", liveStats.matchesTracked.toLocaleString(numLocale))
    : "";

  const explore = t.home.exploreCta;
  const features: ReadonlyArray<FeatureCardProps> = [
    { href: "/teams", icon: <EmblemRosters />, title: t.home.rosters.title, description: t.home.rosters.description, cta: explore },
    { href: "/star-players", icon: <EmblemStar />, title: t.home.starPlayers.title, description: t.home.starPlayers.description, cta: explore },
    { href: "/skills", icon: <EmblemSkills />, title: t.home.skillsReference.title, description: t.home.skillsReference.description, cta: explore },
    { href: "/tutoriel", icon: <EmblemTutorial />, title: t.home.tutorial.title, description: t.home.tutorial.description, cta: explore },
    { href: "/local-matches", icon: <EmblemTabletop />, title: t.home.localMatches.title, description: t.home.localMatches.description, cta: explore },
    { icon: <EmblemPdf />, title: t.home.exportPdf.title, description: t.home.exportPdf.description },
  ];

  const quickLinks = [
    { href: "/teams", label: t.home.quickAccessTeams },
    { href: "/star-players", label: t.home.quickAccessStarPlayers },
    { href: "/skills", label: t.home.quickAccessSkills },
    { href: "/tutoriel", label: t.home.quickAccessTutorial },
  ];

  // Citation de Nuffle tiree au hasard a chaque chargement. On part de
  // l'index 0 (stable SSR + premier rendu client) puis on randomise au
  // mount pour eviter tout mismatch d'hydratation.
  const heroQuotes = t.home.heroQuotes;
  const [quoteIndex, setQuoteIndex] = useState(0);
  useEffect(() => {
    setQuoteIndex(Math.floor(Math.random() * heroQuotes.length));
  }, [heroQuotes.length]);
  const heroQuote = heroQuotes[quoteIndex] ?? heroQuotes[0];

  return (
    <>
      <HomeStructuredData />
      {/* Canvas unique : un seul fond parchemin chaud sur toute la page,
          full-bleed (on sort du padding du layout) pour eviter les seams. */}
      <div className="-mx-4 sm:-mx-6 -mb-4 sm:-mb-6 bg-gradient-to-b from-[#F3EAD6] via-[#EFE4CD] to-[#E7DABF] text-nuffle-anthracite">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* texture : hachures de terrain tres discretes, communes a la page */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[repeating-linear-gradient(115deg,transparent,transparent_46px,#6B4E2E_46px,#6B4E2E_47px)]"
            aria-hidden="true"
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-14 sm:pt-16 sm:pb-20 grid md:grid-cols-[1.1fr_0.9fr] items-center gap-10 md:gap-12">
            <div>
              {/* Bandeau coach connecté : raccourci vers le tableau de bord
                  personnalisé (/me). Absent pour les visiteurs déconnectés. */}
              {coachName && (
                <a
                  href="/me"
                  data-testid="home-dashboard-link"
                  className="group mb-5 inline-flex items-center gap-2 rounded-xl bg-[#1B1610] text-nuffle-ivory ring-1 ring-nuffle-gold/40 px-4 py-2.5 shadow-[0_6px_16px_rgba(27,22,16,0.35)] hover:-translate-y-0.5 transition-all"
                >
                  <span className="text-sm font-body text-nuffle-ivory/80">
                    {t.home.dashboardBannerGreeting.replace("{name}", coachName)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-subtitle font-bold uppercase tracking-wide text-nuffle-gold">
                    {t.home.dashboardBannerCta}
                    <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                  </span>
                </a>
              )}
              <div className="mb-6">
                <Logo variant="default" showText={true} />
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-nuffle-gold/50 bg-nuffle-gold/10 px-4 py-1.5 text-xs sm:text-sm font-subtitle font-semibold uppercase tracking-[0.2em] text-nuffle-bronze">
                <span className="h-1.5 w-1.5 rounded-full bg-nuffle-gold" aria-hidden="true" />
                {t.home.heroBadge}
              </span>
              <h1 className="mt-5 font-heading font-bold text-4xl sm:text-5xl md:text-[3.4rem] leading-[1.05] text-nuffle-anthracite">
                {t.home.title}
              </h1>
              <p className="mt-5 text-base sm:text-lg text-nuffle-anthracite/80 leading-relaxed font-body max-w-xl">
                {t.home.description}
              </p>
              <p className="mt-3 text-sm sm:text-base text-nuffle-bronze/90 leading-relaxed font-body max-w-xl">
                {t.home.subtitle}
              </p>

              <div className="mt-7 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                <a
                  href="/me/teams"
                  className="px-7 py-3.5 rounded-xl bg-gradient-to-b from-[#E0BC52] to-nuffle-gold hover:from-nuffle-gold hover:to-[#a8852b] text-nuffle-anthracite font-subtitle font-bold uppercase tracking-wide shadow-[0_6px_20px_rgba(203,161,53,0.35)] hover:shadow-[0_8px_28px_rgba(203,161,53,0.5)] transition-all hover:-translate-y-0.5 text-center"
                >
                  {t.home.manageTeams}
                </a>
                <a
                  href="/teams"
                  className="px-7 py-3.5 rounded-xl border-2 border-nuffle-bronze/40 text-nuffle-bronze hover:border-nuffle-gold hover:text-nuffle-anthracite hover:bg-nuffle-gold/10 font-subtitle font-bold uppercase tracking-wide transition-all text-center"
                >
                  {t.home.discoverTeams}
                </a>
              </div>

              {/* Stats integrees au hero (pas de bande separee) */}
              <dl
                data-testid="home-stats"
                className="mt-9 grid grid-cols-4 gap-2 sm:gap-4 max-w-lg border-t border-nuffle-bronze/20 pt-5"
              >
                {stats.map((stat) => (
                  <div key={stat.label} className="text-center sm:text-left">
                    <dd className="font-score text-3xl sm:text-4xl text-nuffle-bronze leading-none tracking-wide">
                      {stat.value}
                    </dd>
                    <dt className="mt-1 text-[10px] sm:text-xs text-nuffle-anthracite/55 font-subtitle uppercase tracking-wider leading-tight">
                      {stat.label}
                    </dt>
                  </div>
                ))}
              </dl>
              {showActivity && (
                <p className="mt-4 max-w-lg text-xs sm:text-sm text-nuffle-bronze/80 font-body">
                  <span className="text-nuffle-gold" aria-hidden="true">●</span> {activityLine}
                </p>
              )}
            </div>

            {/* Medaillon + lanceur de dés interactif */}
            <div className="relative mx-auto w-full max-w-[380px]">
              <StadiumBackdrop className="pointer-events-none absolute -inset-x-10 -top-10 -bottom-4 h-[120%] w-[120%] opacity-60" />
              <NuffleMedallion className="relative w-full drop-shadow-[0_18px_40px_rgba(27,22,16,0.25)]" />
              <div className="relative -mt-4">
                <BlockDiceRoller />
              </div>
            </div>
          </div>

          {/* citation Nuffle — liseré */}
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pb-10">
            <blockquote className="border-l-4 border-nuffle-red/70 pl-4 text-sm sm:text-base italic text-nuffle-bronze/80 font-body">
              {heroQuote}
            </blockquote>
          </div>
        </section>

        {/* Vitrine des factions — bande d'ecus graves */}
        <section className="border-y border-nuffle-bronze/20 bg-[#1B1610]/[0.03]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12">
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-nuffle-anthracite">
                {t.home.factions.title}
              </h2>
              <p className="mt-1 text-sm sm:text-base text-nuffle-bronze/90 font-body">
                {t.home.factions.subtitle}
              </p>
            </div>
            <ul className="mt-8 flex flex-wrap items-start justify-center gap-x-6 gap-y-6 sm:gap-x-9">
              {FACTIONS.map((f) => (
                <li key={f.label} className="group flex w-16 flex-col items-center gap-2 sm:w-20">
                  <FactionCrest
                    emblem={f.emblem}
                    className="w-12 sm:w-14 drop-shadow-[0_6px_14px_rgba(27,22,16,0.3)] transition-transform group-hover:-translate-y-1"
                  />
                  <span className="text-center text-[11px] sm:text-xs font-subtitle font-semibold uppercase tracking-wide text-nuffle-bronze/80 leading-tight">
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-7 text-center">
              <a
                href="/teams"
                className="inline-flex items-center gap-1.5 text-sm font-subtitle font-semibold text-nuffle-bronze hover:text-nuffle-gold transition-colors"
              >
                {t.home.discoverTeams} <span aria-hidden="true">→</span>
              </a>
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-20">
          <SectionTitle kicker={t.home.featuresKicker} title={t.home.discoverTitle} subtitle={t.home.discoverSubtitle} />
          <div className="mt-10 md:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>

          {/* Acces rapide — pills discrets, meme famille */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            <span className="text-xs font-subtitle font-semibold uppercase tracking-[0.2em] text-nuffle-bronze/70">
              {t.home.quickAccess} :
            </span>
            {quickLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full border border-nuffle-bronze/30 bg-[#FBF7EC] px-4 py-1.5 text-sm font-subtitle font-semibold text-nuffle-bronze hover:border-nuffle-gold hover:text-nuffle-anthracite hover:bg-nuffle-gold/10 transition-all"
              >
                {link.label}
              </a>
            ))}
          </div>
        </section>

        {/* Compétitions — coupes + annonce ligue (bêta) */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-20">
          <SectionTitle
            kicker={t.home.competitions.kicker}
            title={t.home.competitions.title}
            subtitle={t.home.competitions.subtitle}
          />

          <div className="mt-10 md:mt-12 space-y-6">
            {/* Coupes — panneau clair, disponible */}
            <div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-6 sm:p-7 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
              <CupCrest className="w-24 sm:w-28 flex-shrink-0" />
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-xl sm:text-2xl font-heading font-bold text-nuffle-anthracite">
                  {t.home.cups.title}
                </h3>
                <p className="mt-2 text-nuffle-anthracite/75 font-body text-sm sm:text-base">
                  {t.home.cups.description}
                </p>
                <ul className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                  {t.home.cups.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full border border-nuffle-bronze/25 bg-white/50 px-3 py-1 text-xs font-subtitle font-semibold text-nuffle-bronze"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href="/cups"
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-6 py-3 rounded-xl border-2 border-nuffle-bronze/40 text-nuffle-bronze hover:border-nuffle-gold hover:text-nuffle-anthracite hover:bg-nuffle-gold/10 font-subtitle font-bold uppercase tracking-wide transition-all"
              >
                {t.home.cups.cta} <span aria-hidden="true">→</span>
              </a>
            </div>

            {/* Gestion de ligue — annonce bêta, traitement distinct (poster sombre orné) */}
            <div className="relative overflow-hidden rounded-3xl bg-[#1B1610] text-nuffle-ivory ring-1 ring-nuffle-gold/50 shadow-[0_24px_60px_rgba(27,22,16,0.4)]">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[repeating-linear-gradient(115deg,transparent,transparent_40px,#E8C96A_40px,#E8C96A_41px)]"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(203,161,53,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(122,31,31,0.28),transparent_55%)]"
                aria-hidden="true"
              />
              {/* fioritures d'angle */}
              <Flourish className="pointer-events-none absolute left-3 top-3 w-9 opacity-60" />
              <Flourish className="pointer-events-none absolute left-3 bottom-3 w-9 opacity-60 [transform:scaleY(-1)]" />
              <Flourish className="pointer-events-none absolute right-3 bottom-3 w-9 opacity-60 [transform:scale(-1)]" />

              {/* sceau bêta */}
              <div className="pointer-events-none absolute right-5 top-5 sm:right-8 sm:top-8 rotate-12">
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border-2 border-nuffle-gold/70">
                  <div className="flex h-[86%] w-[86%] items-center justify-center rounded-full border border-nuffle-gold/40">
                    <span className="font-heading font-bold text-sm sm:text-base uppercase tracking-wide text-nuffle-gold">
                      {t.home.leagues.seal}
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-10 p-8 sm:p-10 md:p-12">
                <div className="flex-shrink-0">
                  <LeagueCrest className="w-36 sm:w-44 drop-shadow-[0_12px_30px_rgba(27,22,16,0.5)]" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <span className="inline-flex items-center gap-2 rounded-full border border-nuffle-gold/50 bg-nuffle-gold/10 px-4 py-1.5 text-xs font-subtitle font-bold uppercase tracking-[0.2em] text-nuffle-gold">
                    <span className="h-1.5 w-1.5 rounded-full bg-nuffle-gold animate-pulse" aria-hidden="true" />
                    {t.home.leagues.tagline}
                  </span>
                  <h3 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-heading font-bold bg-gradient-to-br from-[#F3Dd92] via-nuffle-gold to-[#a8852b] bg-clip-text text-transparent">
                    {t.home.leagues.title}
                  </h3>
                  <p className="mt-3 text-nuffle-ivory/75 font-body text-sm sm:text-base max-w-2xl mx-auto md:mx-0">
                    {t.home.leagues.description}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                    {t.home.leagues.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-nuffle-gold/30 bg-nuffle-gold/10 px-3 py-1 text-xs font-subtitle font-semibold text-nuffle-gold/90"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
                    <a
                      href="/feedback"
                      className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-b from-[#E0BC52] to-nuffle-gold hover:from-nuffle-gold hover:to-[#a8852b] text-nuffle-anthracite font-subtitle font-bold uppercase tracking-wide shadow-[0_8px_28px_rgba(203,161,53,0.4)] hover:-translate-y-0.5 transition-all"
                    >
                      {t.home.leagues.cta} <span aria-hidden="true">→</span>
                    </a>
                    <span className="text-xs font-subtitle font-semibold uppercase tracking-wide text-nuffle-ivory/55">
                      {t.home.leagues.badge}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Latest blog posts */}
        <LatestBlogPosts />

        {/* Play Online (feature-flagged) — poster sombre */}
        {onlinePlayEnabled && (
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8">
            <div className="relative overflow-hidden rounded-3xl bg-[#1B1610] text-nuffle-ivory p-7 sm:p-10 ring-1 ring-nuffle-gold/40">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[repeating-linear-gradient(115deg,transparent,transparent_40px,#E8C96A_40px,#E8C96A_41px)]"
                aria-hidden="true"
              />
              <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-10">
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-2xl md:text-3xl font-heading font-bold text-nuffle-gold">
                    {t.play?.playOnline || "Jouer en ligne"}
                  </h2>
                  <p className="text-nuffle-ivory/75 mt-2 font-body text-sm sm:text-base max-w-xl">
                    {t.play?.playOnlineDesc || "Affrontez d'autres coachs en ligne ! Créez une partie ou rejoignez un match existant."}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <a
                    href="/play"
                    className="px-6 py-3 rounded-xl bg-gradient-to-b from-[#E0BC52] to-nuffle-gold text-nuffle-anthracite font-subtitle font-bold uppercase tracking-wide shadow-lg hover:-translate-y-0.5 transition-all text-center whitespace-nowrap"
                  >
                    {t.play?.playOnlineButton || "Accéder au lobby"}
                  </a>
                  <a
                    href="/me/matches"
                    className="px-6 py-3 rounded-xl border-2 border-nuffle-gold/40 text-nuffle-ivory hover:bg-nuffle-gold/15 font-subtitle font-bold uppercase tracking-wide transition-all text-center whitespace-nowrap"
                  >
                    {t.play?.myOnlineMatches || "Mes matchs en ligne"}
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-14 md:py-20">
          <SectionTitle kicker={t.home.faqKicker} title={t.home.faqTitle} />
          <div className="mt-8 space-y-3">
            {[
              { q: t.home.faqQ1, a: t.home.faqA1 },
              { q: t.home.faqQ2, a: t.home.faqA2 },
              { q: t.home.faqQ3, a: t.home.faqA3 },
              { q: t.home.faqQ4, a: t.home.faqA4 },
            ].map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 px-5 py-4 shadow-[0_2px_10px_rgba(107,78,46,0.05)] hover:border-nuffle-gold/50 transition-colors"
              >
                <summary className="cursor-pointer list-none font-subtitle font-semibold text-nuffle-anthracite flex items-center justify-between gap-3">
                  <span>{item.q}</span>
                  <span className="flex-shrink-0 text-nuffle-gold group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
                </summary>
                <p className="mt-3 text-nuffle-anthracite/75 font-body text-sm sm:text-base border-t border-nuffle-bronze/15 pt-3">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Support CTA */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14 md:pb-20">
          <div className="rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-6 sm:p-8 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
            <div className="flex flex-col md:flex-row items-center gap-5 md:gap-8">
              <span className={`${COIN_BADGE} h-16 w-16 flex-shrink-0`}>
                <svg className="h-8 w-8 text-nuffle-red" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </span>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl sm:text-2xl font-heading font-bold text-nuffle-anthracite">
                  {t.support?.homeCta || "Vous aimez Nuffle Arena ?"}
                </h2>
                <p className="text-nuffle-anthracite/75 mt-2 font-body text-sm sm:text-base">
                  {t.support?.homeCtaDescription || "Ce projet est 100 % gratuit et maintenu par des passionnés. Un petit coup de pouce nous aide à garder les serveurs en ligne !"}
                </p>
              </div>
              <a
                href="/support"
                className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-b from-[#E0BC52] to-nuffle-gold hover:from-nuffle-gold hover:to-[#a8852b] text-nuffle-anthracite font-subtitle font-bold uppercase tracking-wide shadow-lg hover:-translate-y-0.5 transition-all whitespace-nowrap"
              >
                {t.support?.homeCtaButton || "Nous soutenir"}
              </a>
            </div>
          </div>
        </section>

        {/* Poster final — meme materiau jeton que le hero, en grand */}
        <section className="px-4 sm:px-6 pb-16 md:pb-24">
          <div className="relative max-w-6xl mx-auto overflow-hidden rounded-[28px] bg-[#1B1610] text-nuffle-ivory ring-1 ring-nuffle-gold/50 px-6 py-12 sm:px-12 sm:py-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[repeating-linear-gradient(115deg,transparent,transparent_40px,#E8C96A_40px,#E8C96A_41px)]"
              aria-hidden="true"
            />
            <div className="pointer-events-none absolute -right-10 -top-12 w-56 opacity-20 hidden sm:block" aria-hidden="true">
              <NuffleMedallion className="w-full" />
            </div>
            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-nuffle-gold/40 px-4 py-1.5 text-xs font-subtitle font-semibold uppercase tracking-[0.2em] text-nuffle-gold/90">
                <BlockDie face="pow" className="w-4" />
                {t.home.heroBadge}
              </span>
              <h2 className="mt-5 text-3xl sm:text-4xl md:text-5xl font-heading font-bold bg-gradient-to-br from-[#F3Dd92] via-nuffle-gold to-[#a8852b] bg-clip-text text-transparent leading-tight">
                {t.home.createFirstTeam}
              </h2>
              <p className="mt-4 text-nuffle-ivory/75 font-body text-sm sm:text-base">
                {t.home.createFirstTeamDesc}
              </p>
              <a
                href="/me/teams"
                className="mt-7 inline-flex px-8 py-4 rounded-xl bg-gradient-to-b from-[#E0BC52] to-nuffle-gold hover:from-nuffle-gold hover:to-[#a8852b] text-nuffle-anthracite font-subtitle font-bold uppercase tracking-wide shadow-[0_8px_28px_rgba(203,161,53,0.4)] hover:-translate-y-0.5 transition-all"
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
