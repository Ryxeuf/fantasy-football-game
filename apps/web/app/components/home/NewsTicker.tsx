"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import { useFeatureFlagOrOff } from "../../hooks/useFeatureFlag";
import { HOME_NEWS_TICKER_FLAG } from "../../lib/featureFlagKeys";
import {
  tickerDurationSeconds,
  toTickerLines,
  type NewsTickerLine,
  type NewsTickerResponse,
} from "./news-ticker";

/**
 * Bandeau défilant « À la une » en tête de la home : derniers résultats de
 * ligue et de coupe publiques, dernier article de la Gazette, compétitions
 * ouvertes aux inscriptions.
 *
 * Derrière le flag `home_news_ticker` (OFF par défaut, fermé hors
 * provider) : flag inactif => aucun appel API, aucun rendu.
 *
 * Rien n'est rendu tant que l'API n'a rien servi (ni pendant le chargement,
 * ni en cas d'erreur) : pas de bandeau vide. Le défilement se met en pause
 * au survol / focus clavier et se fige (défilement manuel) si l'utilisateur
 * a demandé moins d'animations.
 */
const TICKER_CSS = `
.na-ticker-track{animation:na-ticker var(--na-ticker-duration,40s) linear infinite}
.na-ticker:hover .na-ticker-track,.na-ticker:focus-within .na-ticker-track{animation-play-state:paused}
@keyframes na-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion: reduce){
  .na-ticker-track{animation:none}
  .na-ticker-viewport{overflow-x:auto}
  .na-ticker-clone{display:none}
}
`;

function TickerEntry({ line, hidden }: { line: NewsTickerLine; hidden?: boolean }) {
  return (
    <li className="flex shrink-0 items-center">
      <a
        href={line.href}
        tabIndex={hidden ? -1 : undefined}
        className="group inline-flex items-center gap-2 px-5 py-2 text-sm font-body text-nuffle-ivory/85 hover:text-nuffle-gold focus-visible:text-nuffle-gold focus-visible:outline-none whitespace-nowrap"
      >
        <span aria-hidden="true">{line.icon}</span>
        <span className="font-subtitle text-[11px] font-bold uppercase tracking-wider text-nuffle-gold/90">
          {line.tag}
        </span>
        {line.context && <span className="text-nuffle-ivory/60">{line.context}</span>}
        {line.score && (
          <span className="font-semibold text-nuffle-ivory group-hover:text-nuffle-gold">
            {line.score}
          </span>
        )}
      </a>
      <span className="text-nuffle-gold/40" aria-hidden="true">◆</span>
    </li>
  );
}

export default function NewsTicker() {
  const { t } = useLanguage();
  const enabled = useFeatureFlagOrOff(HOME_NEWS_TICKER_FLAG);
  const [response, setResponse] = useState<NewsTickerResponse | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    apiRequest<NewsTickerResponse>("/api/public/news-ticker")
      .then((r) => {
        if (!cancelled) setResponse(r);
      })
      .catch(() => {
        // Repli silencieux : la home se passe du bandeau.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const labels = t.home.ticker;
  const lines = toTickerLines(response, labels);
  if (!enabled || lines.length === 0) return null;

  const duration = `${tickerDurationSeconds(lines.length)}s`;

  return (
    <section
      data-testid="home-news-ticker"
      aria-label={labels.title}
      className="na-ticker relative flex items-stretch border-b border-nuffle-gold/30 bg-[#1B1610] text-nuffle-ivory"
    >
      <style>{TICKER_CSS}</style>
      <h2 className="relative z-10 flex shrink-0 items-center gap-2 bg-gradient-to-b from-[#E0BC52] to-nuffle-gold px-3 sm:px-4 font-subtitle text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-nuffle-anthracite shadow-[6px_0_12px_rgba(27,22,16,0.6)]">
        <span className="h-1.5 w-1.5 rounded-full bg-nuffle-red animate-pulse motion-reduce:animate-none" aria-hidden="true" />
        {labels.title}
      </h2>
      <div className="na-ticker-viewport relative min-w-0 flex-1 overflow-hidden">
        <div
          className="na-ticker-track flex w-max"
          style={{ ["--na-ticker-duration" as string]: duration }}
        >
          <ul className="flex shrink-0 items-center">
            {lines.map((line) => (
              <TickerEntry key={line.key} line={line} />
            ))}
          </ul>
          {/* Copie pour une boucle sans couture ; ignorée des lecteurs d'écran. */}
          <ul className="na-ticker-clone flex shrink-0 items-center" aria-hidden="true">
            {lines.map((line) => (
              <TickerEntry key={`clone-${line.key}`} line={line} hidden />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
