"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../../lib/api-client";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useWallet } from "../../../lib/use-wallet";

import { MarketsList } from "../../_components/MarketsList";
import { MvpVoteSection } from "./_components/MvpVoteSection";
import { FanPredictionsThread } from "./_components/FanPredictionsThread";
import { WalletBadge } from "../../_components/WalletBadge";
import ShareButtons from "../../_components/ShareButtons";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

/**
 * Page détail d'un match Pro League — sprint Pro League lot 1.C.3.
 *
 * 3 modes d'affichage selon `match.status` :
 *  - **scheduled / ready** (pré-match) : bandeau équipes, kickoff,
 *    compte à rebours, lien vers /live.
 *  - **in_progress** (en direct) : redirige immédiatement vers /live.
 *  - **completed** (post-match) : score final, summary
 *    (TD/cas/turnover/nuffle), highlights pré-extraits, replay link.
 *
 * Hors scope MVP : odds (1.D.3), MVP automatique (1.E), chat fans
 * (1.E).
 */

interface DetailTeam {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly race: string;
  readonly nflFlavor: string | null;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
  readonly baseTv: number;
}

interface Highlight {
  readonly type: "TD" | "CASUALTY" | "NUFFLE";
  readonly atMs: number;
  readonly meta: Record<string, unknown>;
}

interface MatchDetail {
  readonly id: string;
  readonly seasonId: string;
  readonly seasonYear: number;
  readonly roundNumber: number;
  readonly status: string;
  readonly scheduledAt: string;
  readonly simulatedAt: string | null;
  readonly completedAt: string | null;
  readonly engineVer: string | null;
  readonly homeTeam: DetailTeam;
  readonly awayTeam: DetailTeam;
  readonly scoreHome: number | null;
  readonly scoreAway: number | null;
  readonly outcome: string | null;
  readonly touchdownCount: number | null;
  readonly casualtyCount: number | null;
  readonly turnoverCount: number | null;
  readonly nuffleCount: number | null;
  readonly replay: {
    readonly durationMs: number;
    readonly highlights: readonly Highlight[];
  } | null;
}

const HIGHLIGHT_BADGE_STYLES: Record<Highlight["type"], string> = {
  TD: "bg-emerald-700 text-emerald-50",
  CASUALTY: "bg-rose-700 text-rose-50",
  NUFFLE: "bg-purple-700 text-purple-50",
};

interface MatchTranslations {
  relativeInProgress: string;
  relativeDayHour: string;
  relativeHourMin: string;
  relativeMin: string;
}

function formatRelative(
  target: Date,
  now: Date,
  m: MatchTranslations,
): string {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs < 0) return m.relativeInProgress;
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (days >= 1) {
    return m.relativeDayHour
      .replace("{days}", String(days))
      .replace("{hours}", String(hours));
  }
  if (hours >= 1) {
    return m.relativeHourMin
      .replace("{hours}", String(hours))
      .replace("{minutes}", minutes.toString().padStart(2, "0"));
  }
  return m.relativeMin.replace("{minutes}", String(minutes));
}

function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface EventsTranslations {
  touchdownTeam: string;
  casualty: string;
  casualtyWithCause: string;
  nuffle: string;
}

function summarizeHighlight(h: Highlight, e: EventsTranslations): string {
  switch (h.type) {
    case "TD": {
      const team = String(h.meta.team ?? "").toUpperCase();
      return e.touchdownTeam.replace("{team}", team);
    }
    case "CASUALTY": {
      if (h.meta.causedBy) {
        return e.casualtyWithCause.replace(
          "{cause}",
          String(h.meta.causedBy),
        );
      }
      return e.casualty;
    }
    case "NUFFLE":
      return e.nuffle.replace(
        "{id}",
        String(h.meta.id ?? h.meta.eventId ?? "?"),
      );
  }
}

function TeamPanel({
  team,
  alignRight = false,
}: {
  team: DetailTeam;
  alignRight?: boolean;
}): JSX.Element {
  const { t } = useLanguage();
  return (
    <div
      className={`flex flex-1 flex-col gap-1 ${alignRight ? "items-end text-right" : ""}`}
    >
      <span className="text-xs uppercase text-white/70">{team.race}</span>
      <h2
        className="text-2xl font-black leading-tight text-white drop-shadow"
        data-testid={alignRight ? "away-team-name" : "home-team-name"}
      >
        {team.name}
      </h2>
      <span className="text-sm text-white/80">{team.city}</span>
      <span className="font-mono text-xs text-white/60">TV {team.baseTv}</span>
      <Link
        href={`/pro-league/teams/${encodeURIComponent(team.slug)}`}
        className="mt-1 inline-block rounded border border-white/30 px-2 py-0.5 text-xs text-white/90 hover:bg-white/10"
      >
        {t.proLeague.match.viewTeam}
      </Link>
    </div>
  );
}

function ScoreboardBanner({
  match,
}: {
  match: MatchDetail;
}): JSX.Element {
  const { t } = useLanguage();
  const home = match.homeTeam;
  const away = match.awayTeam;
  return (
    <header
      data-testid="match-banner"
      className="flex flex-col gap-3 px-4 py-6"
      style={{
        background: `linear-gradient(135deg, ${home.primaryColor ?? "#1e293b"} 0%, ${away.primaryColor ?? "#0f172a"} 100%)`,
      }}
    >
      <div className="flex items-center justify-between">
        <Link
          href="/pro-league"
          className="rounded border border-white/30 px-2 py-1 text-xs text-white/90 hover:bg-white/10"
        >
          {t.proLeague.common.backToHub}
        </Link>
        <span className="font-mono text-xs text-white/70">
          {t.proLeague.match.bannerSeasonInfo
            .replace("{year}", String(match.seasonYear))
            .replace("{round}", String(match.roundNumber))}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <TeamPanel team={home} />
        <div
          data-testid="scoreboard"
          className="flex flex-col items-center font-mono text-white"
        >
          {match.scoreHome !== null && match.scoreAway !== null ? (
            <span className="text-4xl font-black drop-shadow">
              {match.scoreHome} – {match.scoreAway}
            </span>
          ) : (
            <span className="text-2xl font-bold text-white/70">
              {t.proLeague.match.statusVs}
            </span>
          )}
          <span className="mt-1 text-xs uppercase text-white/70">
            {match.status}
          </span>
        </div>
        <TeamPanel team={away} alignRight />
      </div>
    </header>
  );
}

function PreMatchCard({
  match,
  now,
}: {
  match: MatchDetail;
  now: Date;
}): JSX.Element {
  const { t, language } = useLanguage();
  const localeTag = language === "fr" ? "fr-FR" : "en-US";
  const at = new Date(match.scheduledAt);
  const formattedDate = at.toLocaleString(localeTag, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const isReady = match.status === "ready";
  return (
    <section
      data-testid="pre-match-card"
      className="rounded border border-slate-800 bg-slate-900 px-4 py-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs uppercase text-slate-500">
            {t.proLeague.match.kickoffLabel}
          </span>
          <span className="text-sm text-slate-200">{formattedDate}</span>
        </div>
        <span className="font-mono text-lg text-emerald-300">
          {formatRelative(at, now, t.proLeague.match)}
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {isReady
          ? t.proLeague.match.preMatchReady
          : t.proLeague.match.preMatchScheduled}
      </p>
      <Link
        href={`/pro-league/matches/${match.id}/live`}
        className="mt-3 inline-block rounded bg-emerald-700 px-3 py-1.5 text-sm text-emerald-50 hover:bg-emerald-600"
      >
        {t.proLeague.match.followLive}
      </Link>
    </section>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: number | null;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center rounded border border-slate-800 bg-slate-900 px-3 py-2">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <span className="font-mono text-xl font-bold text-slate-100">
        {value ?? "—"}
      </span>
    </div>
  );
}

function PostMatchCard({ match }: { match: MatchDetail }): JSX.Element {
  const { t } = useLanguage();
  return (
    <>
      <section
        data-testid="post-match-stats"
        className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        <StatBox
          label={t.proLeague.match.statTouchdowns}
          value={match.touchdownCount}
        />
        <StatBox
          label={t.proLeague.match.statCasualties}
          value={match.casualtyCount}
        />
        <StatBox
          label={t.proLeague.match.statTurnovers}
          value={match.turnoverCount}
        />
        <StatBox
          label={t.proLeague.match.statNuffle}
          value={match.nuffleCount}
        />
      </section>

      {match.replay && match.replay.highlights.length > 0 ? (
        <section
          data-testid="post-match-highlights"
          className="mb-6 rounded border border-slate-800 bg-slate-900 px-4 py-3"
        >
          <h2 className="mb-2 text-lg font-semibold text-slate-100">
            {t.proLeague.match.highlightsTitle}
          </h2>
          <ol className="flex flex-col gap-1">
            {match.replay.highlights.map((h, i) => (
              <li
                key={i}
                className="flex items-center gap-3 text-sm text-slate-200"
              >
                <span className="font-mono text-xs text-slate-500">
                  {formatClock(h.atMs)}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-mono ${HIGHLIGHT_BADGE_STYLES[h.type]}`}
                >
                  {h.type}
                </span>
                <span className="flex-1">
                  {summarizeHighlight(h, t.proLeague.events)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <Link
        href={`/pro-league/matches/${match.id}/replay`}
        className="inline-block rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
      >
        {t.proLeague.match.replayLink}
      </Link>
    </>
  );
}

interface MatchDetailPageProps {
  readonly params: { id: string };
}

function MatchMarkets({ matchId }: { matchId: string }): JSX.Element {
  const wallet = useWallet();
  return <MarketsList matchId={matchId} authed={wallet.authed} />;
}

export default function ProLeagueMatchDetailPage({
  params,
}: MatchDetailPageProps): JSX.Element {
  const { t } = useLanguage();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<MatchDetail>(
      `/pro-league/matches/${encodeURIComponent(params.id)}`,
    )
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "fetch error";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col bg-slate-950 text-slate-100">
      {loading ? (
        <p className="px-4 py-6 text-sm text-slate-400">
          {t.proLeague.common.loading}
        </p>
      ) : error ? (
        <p
          role="alert"
          className="m-4 rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : !data ? (
        <p className="px-4 py-6 text-sm text-slate-400">
          {t.proLeague.match.unknownMatch}
        </p>
      ) : (
        <>
          <ScoreboardBanner match={data} />
          <div className="px-4 py-3">
            <ShareButtons
              url={`${SITE_URL.replace(/\/$/, "")}/pro-league/matches/${data.id}`}
              text={
                data.scoreHome !== null && data.scoreAway !== null
                  ? `${data.homeTeam.name} ${data.scoreHome}-${data.scoreAway} ${data.awayTeam.name} — Pro League Nuffle Arena`
                  : `${data.homeTeam.name} vs ${data.awayTeam.name} — Pro League Nuffle Arena`
              }
              hashtags={["bloodbowl", "nufflearena"]}
            />
          </div>
          <div className="px-4 py-6">
            {data.status === "scheduled" || data.status === "ready" ? (
              <>
                <PreMatchCard match={data} now={now} />
                <section data-testid="markets-section" className="mt-4">
                  <h2 className="mb-2 text-lg font-semibold text-slate-100">
                    {t.proLeague.match.bettingTitle}
                  </h2>
                  <MatchMarkets matchId={data.id} />
                </section>
                <FanPredictionsThread
                  matchId={data.id}
                  matchStatus={data.status}
                />
              </>
            ) : data.status === "in_progress" ? (
              <section
                data-testid="live-card"
                className="rounded border border-emerald-700 bg-emerald-950 px-4 py-3"
              >
                <p className="text-sm text-emerald-200">
                  {t.proLeague.match.liveCardBody}
                </p>
                <Link
                  href={`/pro-league/matches/${data.id}/live`}
                  className="mt-3 inline-block rounded bg-emerald-700 px-3 py-1.5 text-sm text-emerald-50 hover:bg-emerald-600"
                >
                  {t.proLeague.match.viewLive}
                </Link>
              </section>
            ) : data.status === "completed" ? (
              <>
                <PostMatchCard match={data} />
                <MvpVoteSection matchId={data.id} />
                <FanPredictionsThread
                  matchId={data.id}
                  matchStatus={data.status}
                />
              </>
            ) : (
              <p className="text-sm text-rose-300">
                {t.proLeague.match.matchInError.replace(
                  "{status}",
                  data.status,
                )}
              </p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
