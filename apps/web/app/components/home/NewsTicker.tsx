"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import { useFeatureFlagOrOff } from "../../hooks/useFeatureFlag";
import { HOME_NEWS_TICKER_FLAG } from "../../lib/featureFlagKeys";
import {
  formatRelativeAge,
  toTickerView,
  type NewsTickerFamily,
  type NewsTickerHeadline,
  type NewsTickerResponse,
  type NewsTickerResultCard,
  type NewsTickerSide,
} from "./news-ticker";

/**
 * Bandeau « À la une » en tête de la home, en deux zones :
 *  - une LIGNE d'actualité (Gazette, inscriptions ouvertes) qui change toutes
 *    les 6 s — le texte ne bouge jamais pendant qu'on le lit ;
 *  - des CARTES de résultats fixes (ligue et coupe publiques), qu'on fait
 *    défiler au doigt ou avec les flèches.
 *
 * Derrière le flag `home_news_ticker` (OFF par défaut, fermé hors
 * provider) : flag inactif => aucun appel API, aucun rendu.
 *
 * Rien n'est rendu tant que l'API n'a rien servi (ni pendant le chargement,
 * ni en cas d'erreur) : pas de bandeau vide. Une zone sans contenu est
 * omise. La rotation se met en pause au survol / focus clavier / bouton, et
 * ne démarre pas si l'utilisateur a demandé moins d'animations.
 */
const ROTATE_SECONDS = 6;

const TICKER_CSS = `
@keyframes na-ticker-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes na-ticker-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.na-ticker-enter{animation:na-ticker-enter .28s ease-out}
.na-ticker-strip{scrollbar-width:thin;scrollbar-color:rgba(233,226,208,.25) transparent}
@media (prefers-reduced-motion: reduce){.na-ticker-enter{animation:none}}
`;

const FAMILY_BADGE: Record<NewsTickerFamily, string> = {
  league: "bg-nuffle-gold text-nuffle-anthracite",
  cup: "bg-[#B8473C] text-[#FFF4EC]",
  blog: "bg-nuffle-ivory text-nuffle-anthracite",
  open: "bg-[#5F8D4A] text-[#F2F8EC]",
};

const ICON_BUTTON =
  "inline-grid h-7 w-7 shrink-0 place-items-center rounded-md border border-nuffle-ivory/20 text-sm text-nuffle-ivory hover:border-nuffle-ivory/40 hover:bg-nuffle-ivory/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E0BC52] disabled:cursor-default disabled:opacity-30";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

function Badge({ family, label }: { family: NewsTickerFamily; label: string }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-[3px] px-1.5 font-subtitle text-[10.5px] font-extrabold uppercase tracking-[0.1em] whitespace-nowrap ${FAMILY_BADGE[family]}`}
    >
      {label}
    </span>
  );
}

function Age({ at, now, locale }: { at: string; now: number; locale: string }) {
  const label = formatRelativeAge(at, now, locale);
  if (!label) return null;
  return (
    <time dateTime={at} className="shrink-0 whitespace-nowrap text-xs tabular-nums text-nuffle-ivory/60">
      {label}
    </time>
  );
}

// ---------------------------------------------------------------------------
// Ligne d'actualité tournante
// ---------------------------------------------------------------------------

interface HeadlineLineLabels {
  readonly news: string;
  readonly previous: string;
  readonly next: string;
  readonly pause: string;
  readonly play: string;
}

function HeadlineLine({
  headlines,
  labels,
  now,
  locale,
}: {
  headlines: ReadonlyArray<NewsTickerHeadline>;
  labels: HeadlineLineLabels;
  now: number;
  locale: string;
}) {
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = headlines.length;
  const rotating = count > 1;

  useEffect(() => {
    if (prefersReducedMotion()) setUserPaused(true);
  }, []);

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  const current = headlines[index % count];
  const paused = userPaused || hovered;

  return (
    <div
      ref={rootRef}
      data-testid="home-news-ticker-headlines"
      role="region"
      aria-roledescription="carrousel"
      aria-label={labels.news}
      className="relative flex min-h-10 items-center gap-2.5 border-b border-nuffle-ivory/10 bg-[#251E15] py-1.5 pl-4 pr-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setHovered(false);
      }}
    >
      <div className="flex min-w-0 flex-1" aria-live={rotating && !userPaused ? "off" : "polite"}>
        <a
          key={current.key}
          href={current.href}
          className="na-ticker-enter group flex min-w-0 items-center gap-2.5 text-sm text-nuffle-ivory"
        >
          <Badge family={current.family} label={current.tag} />
          <span className="min-w-0 truncate font-heading font-semibold group-hover:text-[#E0BC52]">
            {current.title}
          </span>
          <span className="hidden sm:inline">
            <Age at={current.at} now={now} locale={locale} />
          </span>
          <span className="hidden shrink-0 whitespace-nowrap text-[13px] font-semibold text-nuffle-gold sm:inline">
            {current.cta} →
          </span>
        </a>
      </div>
      {rotating && (
        <>
          <span className="hidden min-w-8 text-center font-subtitle text-xs font-semibold tabular-nums text-nuffle-ivory/60 sm:inline">
            {index + 1}/{count}
          </span>
          <button type="button" className={ICON_BUTTON} aria-label={labels.previous} onClick={() => go(-1)}>
            ‹
          </button>
          <button type="button" className={ICON_BUTTON} aria-label={labels.next} onClick={() => go(1)}>
            ›
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            aria-label={userPaused ? labels.play : labels.pause}
            aria-pressed={userPaused}
            onClick={() => setUserPaused((p) => !p)}
          >
            <span aria-hidden="true">{userPaused ? "▶" : "❚❚"}</span>
          </button>
          {!userPaused && (
            <span
              key={`progress-${current.key}`}
              data-testid="home-news-ticker-progress"
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 h-px w-full origin-left bg-nuffle-gold"
              style={{
                animation: `na-ticker-progress ${ROTATE_SECONDS}s linear forwards`,
                animationPlayState: paused ? "paused" : "running",
              }}
              onAnimationEnd={() => go(1)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartes de résultats
// ---------------------------------------------------------------------------

function TeamRow({ team, forfeitLabel }: { team: NewsTickerSide; forfeitLabel: string }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 text-sm ${
        team.winner ? "font-bold text-nuffle-ivory" : "text-nuffle-ivory/75"
      }`}
    >
      <span
        className="inline-grid h-6 w-[22px] shrink-0 place-items-center pb-1 font-subtitle text-[9px] font-extrabold"
        style={{
          background: team.crest.background,
          color: team.crest.color,
          clipPath: "polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)",
        }}
      >
        {team.crest.initials}
      </span>
      <span className="min-w-0 flex-1 truncate">{team.name}</span>
      {team.forfeit && (
        <span className="shrink-0 rounded-[3px] border border-[#F0B8B0]/45 px-1 py-0.5 font-subtitle text-[10px] font-bold uppercase tracking-wide text-[#F0B8B0]">
          {forfeitLabel}
        </span>
      )}
      <span
        className={`min-w-4 text-right font-score text-2xl leading-none tabular-nums ${
          team.winner ? "text-[#E0BC52]" : "text-nuffle-ivory/55"
        }`}
      >
        {team.score}
      </span>
    </div>
  );
}

function ResultCard({
  card,
  forfeitLabel,
  now,
  locale,
}: {
  card: NewsTickerResultCard;
  forfeitLabel: string;
  now: number;
  locale: string;
}) {
  return (
    <li className="shrink-0 snap-start">
      <a
        href={card.href}
        data-testid="home-news-ticker-result"
        className="flex min-h-[124px] w-[76vw] max-w-[248px] flex-col gap-1.5 rounded-lg border border-nuffle-ivory/10 bg-[#2C241A] px-3 py-2.5 text-nuffle-ivory hover:border-nuffle-gold/45 hover:bg-[#372D20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E0BC52] sm:w-[232px]"
      >
        <span className="sr-only">{card.summary}</span>
        <span aria-hidden="true" className="flex items-center justify-between gap-2">
          <Badge family={card.family} label={card.tag} />
          <Age at={card.at} now={now} locale={locale} />
        </span>
        <span aria-hidden="true" className="truncate text-[12.5px] text-nuffle-ivory/70" title={card.context}>
          {card.context}
        </span>
        {/* `minmax(0,1fr)` : sans lui, la piste `auto` prend la largeur d'un nom
            long non coupé et pousse le score hors de la carte. */}
        <span aria-hidden="true" className="mt-auto grid grid-cols-[minmax(0,1fr)] gap-1">
          <TeamRow team={card.home} forfeitLabel={forfeitLabel} />
          <TeamRow team={card.away} forfeitLabel={forfeitLabel} />
        </span>
      </a>
    </li>
  );
}

function ResultStrip({
  results,
  labels,
  now,
  locale,
}: {
  results: ReadonlyArray<NewsTickerResultCard>;
  labels: { latestResults: string; scrollBack: string; scrollForward: string; forfeit: string };
  now: number;
  locale: string;
}) {
  const stripRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const updateEdges = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges, results.length]);

  const scroll = (direction: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(240, el.clientWidth * 0.8),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <div className="pb-3.5 pt-3">
      <div className="flex items-center gap-3 px-4 pb-2.5">
        <h3 className="m-0 flex items-center gap-2 font-subtitle text-[11px] font-extrabold uppercase tracking-[0.18em] text-nuffle-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-[#D0463B]" aria-hidden="true" />
          {labels.latestResults}
        </h3>
        <span className="flex-1" />
        <button
          type="button"
          className={`${ICON_BUTTON} hidden sm:inline-grid`}
          aria-label={labels.scrollBack}
          disabled={edges.start}
          onClick={() => scroll(-1)}
        >
          ‹
        </button>
        <button
          type="button"
          className={`${ICON_BUTTON} hidden sm:inline-grid`}
          aria-label={labels.scrollForward}
          disabled={edges.end}
          onClick={() => scroll(1)}
        >
          ›
        </button>
      </div>
      <ul
        ref={stripRef}
        onScroll={updateEdges}
        className="na-ticker-strip m-0 flex list-none snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 pt-0.5"
      >
        {results.map((card) => (
          <ResultCard key={card.key} card={card} forfeitLabel={labels.forfeit} now={now} locale={locale} />
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function NewsTicker() {
  const { t, language } = useLanguage();
  const enabled = useFeatureFlagOrOff(HOME_NEWS_TICKER_FLAG);
  const [response, setResponse] = useState<NewsTickerResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    apiRequest<NewsTickerResponse>("/api/public/news-ticker")
      .then((r) => {
        if (!cancelled) {
          setResponse(r);
          setNow(Date.now());
        }
      })
      .catch(() => {
        // Repli silencieux : la home se passe du bandeau.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const labels = t.home.ticker;
  const { results, headlines } = toTickerView(response, labels);
  if (!enabled || (results.length === 0 && headlines.length === 0)) return null;

  return (
    <section
      data-testid="home-news-ticker"
      aria-label={labels.title}
      className="border-b border-nuffle-gold/30 bg-[#1B1610] text-nuffle-ivory"
    >
      <style>{TICKER_CSS}</style>
      <h2 className="sr-only">{labels.title}</h2>
      {headlines.length > 0 && (
        <HeadlineLine headlines={headlines} labels={labels} now={now} locale={language} />
      )}
      {results.length > 0 && (
        <ResultStrip results={results} labels={labels} now={now} locale={language} />
      )}
    </section>
  );
}
