"use client";

/**
 * Page détail d'un joueur Pro League — Lot G.
 *
 * Drill-down depuis la roster table de la page équipe (Lot E).
 * Affiche :
 *  - Identité (nom, position, équipe avec lien retour)
 *  - Stats (avec bonus mis en évidence)
 *  - Skills acquis
 *  - Progression (level, SPP avec progress bar, TV)
 *  - Career counters (TD/CAS/COMP/MVP)
 *  - Pools d'accès skill (G/A/S/P/M primary/secondary)
 *  - Status / form / niggling
 *
 * Public, pas d'auth (cohérent avec /pro-league/teams/[slug]).
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../../../../lib/api-client";

type SkillCategory = "G" | "A" | "S" | "P" | "M";

interface PlayerStats {
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
}

interface StatBonuses {
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
}

interface Progression {
  level: number;
  spp: number;
  nextLevelSpp: number | null;
  /** Lot K — applier en retard, advancement en attente. */
  readyToLevelUp?: boolean;
  tv: number;
}

interface Career {
  tdCount: number;
  casCount: number;
  compCount: number;
  mvpCount: number;
}

interface SkillAccess {
  primary: SkillCategory[];
  secondary: SkillCategory[];
}

interface PlayerTeam {
  slug: string;
  name: string;
  city: string;
  race: string;
  primaryColor: string | null;
}

interface PlayerDetail {
  id: string;
  name: string;
  position: string;
  status: string;
  form: number;
  niggling: number;
  skills: string[];
  stats: PlayerStats;
  statBonuses: StatBonuses;
  progression: Progression;
  career: Career;
  skillAccess: SkillAccess;
  team: PlayerTeam;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-700/30 text-emerald-200",
  injured: "bg-amber-700/30 text-amber-200",
  dead: "bg-rose-900/40 text-rose-200",
  retired: "bg-slate-700/30 text-slate-300",
};

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  G: "General",
  A: "Agility",
  S: "Strength",
  P: "Passing",
  M: "Mutation",
};

function formatTv(gp: number): string {
  return `${Math.round(gp / 1000)}k`;
}

function StatCell({
  label,
  value,
  bonus,
}: {
  label: string;
  value: number | null;
  bonus: number;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center rounded border border-slate-800 bg-slate-900 p-3">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <span className="font-mono text-2xl text-slate-100">
        {value ?? "—"}
        {bonus > 0 && (
          <span
            className="ml-1 align-top text-xs text-amber-300"
            title={`+${bonus} acquis via doubles roll`}
          >
            +{bonus}
          </span>
        )}
      </span>
    </div>
  );
}

function SppProgressBar({
  spp,
  nextLevelSpp,
  level,
  readyToLevelUp,
}: Progression): JSX.Element {
  if (nextLevelSpp === null) {
    return (
      <div className="rounded border border-amber-600 bg-amber-900/20 p-3 text-sm text-amber-300">
        ⭐ <strong>Legend</strong> · {spp} SPP cumulés (au-dessus du dernier
        seuil 176).
      </div>
    );
  }
  const THRESHOLDS = [0, 6, 16, 31, 51, 76, 176];
  const prev = THRESHOLDS[level - 1] ?? 0;
  const range = Math.max(1, nextLevelSpp - prev);
  const pct = Math.max(0, Math.min(100, ((spp - prev) / range) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
        <span>
          Level {level} → {level + 1}
        </span>
        <span className="font-mono">
          {spp} / {nextLevelSpp} SPP ({Math.round(pct)}%)
        </span>
        {readyToLevelUp === true && (
          <span
            data-testid="player-ready-badge"
            className="rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold text-emerald-50"
            title="Advancement en attente — l'applier sweepLevelUps tourne toutes les 30 min"
          >
            ⬆ ready
          </span>
        )}
      </div>
      <div className="h-2 w-full rounded bg-slate-800">
        <div
          data-testid="player-spp-bar"
          className="h-full rounded bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface PlayerPageProps {
  readonly params: { slug: string; playerId: string };
}

interface PlayerMatchSpp {
  tdCount: number;
  casCount: number;
  compCount: number;
  mvpCount: number;
  totalSpp: number;
}

interface PlayerMatchHistoryEntry {
  matchId: string;
  roundNumber: number;
  scheduledAt: string;
  status: string;
  isHome: boolean;
  opponent: {
    slug: string;
    name: string;
    city: string;
    primaryColor: string | null;
  };
  scoreHome: number | null;
  scoreAway: number | null;
  outcome: string | null;
  spp: PlayerMatchSpp;
}

interface PlayerCareerSnapshot {
  playerId: string;
  matchesPlayed: number;
  tdTotal: number;
  casTotal: number;
  compTotal: number;
  mvpTotal: number;
  sppTotal: number;
  bestMatchId: string | null;
  bestMatchSpp: number | null;
  worstMatchId: string | null;
  worstMatchSpp: number | null;
  topNemesisTeamId: string | null;
  topVictoryTeamId: string | null;
  streakKind: "win" | "loss" | "draw" | "none";
  streakLength: number;
  recomputedAt: string;
}

interface PlayerCareerResponse {
  snapshot: PlayerCareerSnapshot;
}

interface PlayerHistoryResponse {
  matches: PlayerMatchHistoryEntry[];
}

export default function ProLeaguePlayerPage({
  params,
}: PlayerPageProps): JSX.Element {
  const { slug, playerId } = params;
  const [data, setData] = useState<PlayerDetail | null>(null);
  const [history, setHistory] = useState<PlayerMatchHistoryEntry[]>([]);
  const [career, setCareer] = useState<PlayerCareerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiRequest<PlayerDetail>(`/api/pro-league/players/${playerId}`),
      apiRequest<PlayerHistoryResponse>(
        `/api/pro-league/players/${playerId}/history`,
      ).catch(() => ({ matches: [] }) as PlayerHistoryResponse),
      apiRequest<PlayerCareerResponse>(
        `/api/pro-league/players/${playerId}/career`,
      ).catch(() => ({ snapshot: null }) as unknown as PlayerCareerResponse),
    ])
      .then(([d, h, c]) => {
        if (cancelled) return;
        setData(d);
        setHistory(h.matches);
        setCareer(c.snapshot ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  if (loading) {
    return (
      <div className="p-6 text-slate-400">
        <Link
          href={`/pro-league/teams/${slug}`}
          className="text-sm text-slate-500 hover:text-slate-300"
        >
          ← retour
        </Link>
        <div className="mt-4">Chargement…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Link
          href={`/pro-league/teams/${slug}`}
          className="text-sm text-slate-500 hover:text-slate-300"
        >
          ← retour
        </Link>
        <div className="mt-4 rounded border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-6">Joueur introuvable</div>;

  return (
    <div className="mx-auto max-w-4xl p-6 text-slate-200">
      <Link
        href={`/pro-league/teams/${data.team.slug}`}
        className="text-sm text-slate-500 hover:text-slate-300"
      >
        ← {data.team.city} {data.team.name}
      </Link>

      <header className="mt-4 mb-6 flex items-center gap-4 border-b border-slate-800 pb-4">
        <div
          aria-hidden
          className="h-12 w-2 rounded-full"
          style={{ background: data.team.primaryColor ?? "#475569" }}
        />
        <div className="flex-1">
          <h1
            data-testid="player-name"
            className="text-3xl font-bold text-slate-100"
          >
            {data.name}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-slate-400">
            <span>{data.position}</span>
            <span aria-hidden>·</span>
            <span>{data.team.race}</span>
            <span
              data-testid="player-status"
              className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[data.status] ?? STATUS_STYLES.active}`}
            >
              {data.status}
            </span>
            {data.niggling > 0 && (
              <span
                className="rounded bg-amber-900/40 px-2 py-0.5 text-xs text-amber-300"
                title="Niggling injuries (-10k TV chacune)"
              >
                {data.niggling} niggling
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-slate-500">Level</div>
          <div
            data-testid="player-level"
            className="font-mono text-3xl text-slate-100"
          >
            {data.progression.level}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-slate-500">TV</div>
          <div
            data-testid="player-tv"
            className="font-mono text-3xl text-slate-100"
          >
            {formatTv(data.progression.tv)}
          </div>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium uppercase text-slate-400">
          Stats
        </h2>
        <div className="grid grid-cols-5 gap-2">
          <StatCell label="MA" value={data.stats.ma} bonus={data.statBonuses.ma} />
          <StatCell label="ST" value={data.stats.st} bonus={data.statBonuses.st} />
          <StatCell label="AG" value={data.stats.ag} bonus={data.statBonuses.ag} />
          <StatCell label="PA" value={data.stats.pa} bonus={data.statBonuses.pa} />
          <StatCell label="AV" value={data.stats.av} bonus={data.statBonuses.av} />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium uppercase text-slate-400">
          Progression
        </h2>
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <SppProgressBar {...data.progression} />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium uppercase text-slate-400">
          Carrière
        </h2>
        <div
          data-testid="player-career"
          className="grid grid-cols-4 gap-2 text-center"
        >
          <div className="rounded border border-slate-800 bg-slate-900 p-3">
            <div className="text-xs uppercase text-slate-500">TD</div>
            <div className="font-mono text-2xl text-emerald-300">
              {data.career.tdCount}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900 p-3">
            <div className="text-xs uppercase text-slate-500">CAS</div>
            <div className="font-mono text-2xl text-rose-300">
              {data.career.casCount}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900 p-3">
            <div className="text-xs uppercase text-slate-500">COMP</div>
            <div className="font-mono text-2xl text-sky-300">
              {data.career.compCount}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900 p-3">
            <div className="text-xs uppercase text-slate-500">MVP</div>
            <div className="font-mono text-2xl text-amber-300">
              {data.career.mvpCount}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium uppercase text-slate-400">
          Skills acquis
        </h2>
        {data.skills.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun skill (rookie).</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.skills.map((s) => (
              <span
                key={s}
                className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium uppercase text-slate-400">
          Pools d&apos;accès skill
        </h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded border border-emerald-700 bg-emerald-900/20 p-3">
            <div className="mb-1 text-xs uppercase text-emerald-300">
              Primary <span className="text-slate-500">(20k TV / skill)</span>
            </div>
            <div data-testid="primary-access">
              {data.skillAccess.primary
                .map((c) => `${c} (${CATEGORY_LABELS[c]})`)
                .join(" · ")}
            </div>
          </div>
          <div className="rounded border border-slate-700 bg-slate-900 p-3">
            <div className="mb-1 text-xs uppercase text-slate-400">
              Secondary <span className="text-slate-500">(30k TV / skill)</span>
            </div>
            <div data-testid="secondary-access">
              {data.skillAccess.secondary.length === 0
                ? "—"
                : data.skillAccess.secondary
                    .map((c) => `${c} (${CATEGORY_LABELS[c]})`)
                    .join(" · ")}
            </div>
          </div>
        </div>
      </section>

      {career && (
        <section
          className="mb-6 rounded-lg border border-slate-700 bg-slate-900/40 p-4"
          data-testid="player-career-snapshot"
        >
          <h2 className="mb-3 text-sm font-medium uppercase text-slate-400">
            Career
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-slate-500">Matchs joues</div>
              <div className="font-mono text-base text-slate-200">
                {career.matchesPlayed}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">SPP total</div>
              <div className="font-mono text-base text-slate-200">
                {career.sppTotal}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">TD / CAS / MVP</div>
              <div className="font-mono text-base text-slate-200">
                {career.tdTotal} / {career.casTotal} / {career.mvpTotal}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Streak</div>
              <div
                className={`font-mono text-base ${career.streakKind === "win" ? "text-emerald-400" : career.streakKind === "loss" ? "text-rose-400" : "text-slate-300"}`}
                data-testid="career-streak"
              >
                {career.streakKind === "none"
                  ? "—"
                  : `${career.streakLength} ${career.streakKind}${career.streakLength > 1 ? "s" : ""}`}
              </div>
            </div>
          </div>
          {(career.bestMatchId ||
            career.topNemesisTeamId ||
            career.topVictoryTeamId) && (
            <div className="mt-3 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-3">
              {career.bestMatchId && (
                <div data-testid="career-best-match">
                  <span className="text-slate-500">Meilleur match : </span>
                  <Link
                    href={`/pro-league/matches/${career.bestMatchId}`}
                    className="text-emerald-400 hover:underline"
                  >
                    {career.bestMatchSpp} SPP
                  </Link>
                </div>
              )}
              {career.topNemesisTeamId && (
                <div data-testid="career-nemesis">
                  <span className="text-slate-500">Nemesis : </span>
                  <span className="text-rose-400">
                    {career.topNemesisTeamId}
                  </span>
                </div>
              )}
              {career.topVictoryTeamId && (
                <div data-testid="career-victory">
                  <span className="text-slate-500">Souffre-douleur : </span>
                  <span className="text-emerald-400">
                    {career.topVictoryTeamId}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium uppercase text-slate-400">
          Derniers matchs (5)
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun match joué pour ce joueur — ou les replays ne sont plus
            disponibles.
          </p>
        ) : (
          <ul data-testid="player-history" className="space-y-1.5">
            {history.map((m) => (
              <PlayerHistoryRow key={m.matchId} match={m} />
            ))}
          </ul>
        )}
      </section>

      <section className="text-xs text-slate-500">
        Forme actuelle :{" "}
        <span className="font-mono text-slate-300">{data.form}/100</span>
      </section>
    </div>
  );
}

function PlayerHistoryRow({
  match,
}: {
  match: PlayerMatchHistoryEntry;
}): JSX.Element {
  const at = new Date(match.scheduledAt);
  const formattedDate = at.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const finished = match.status === "completed";
  const myScore = match.isHome ? match.scoreHome : match.scoreAway;
  const oppScore = match.isHome ? match.scoreAway : match.scoreHome;
  const won =
    finished &&
    ((match.isHome && match.outcome === "home") ||
      (!match.isHome && match.outcome === "away"));
  const drew = finished && match.outcome === "draw";
  const resultClass = finished
    ? won
      ? "text-emerald-300"
      : drew
        ? "text-slate-300"
        : "text-rose-300"
    : "text-slate-500";

  const sppParts: string[] = [];
  if (match.spp.tdCount > 0) sppParts.push(`${match.spp.tdCount} TD`);
  if (match.spp.casCount > 0) sppParts.push(`${match.spp.casCount} CAS`);
  if (match.spp.compCount > 0) sppParts.push(`${match.spp.compCount} COMP`);
  if (match.spp.mvpCount > 0) sppParts.push(`${match.spp.mvpCount} MVP`);
  const sppDetail = sppParts.length > 0 ? ` (${sppParts.join(", ")})` : "";
  const sppSummary =
    match.spp.totalSpp > 0
      ? `+${match.spp.totalSpp} SPP${sppDetail}`
      : finished
        ? "+0 SPP"
        : "—";

  return (
    <li
      data-testid="player-history-row"
      className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
    >
      <div className="flex items-center gap-3">
        <span className="w-12 text-xs uppercase text-slate-500">
          R{match.roundNumber} · {match.isHome ? "H" : "A"}
        </span>
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-full ring-1 ring-slate-700"
          style={{ background: match.opponent.primaryColor ?? "#475569" }}
        />
        <span className="font-medium text-slate-100">
          {match.opponent.name}
        </span>
        <span className="text-xs text-slate-500">{formattedDate}</span>
      </div>
      <div className="flex items-center gap-3">
        {finished && myScore !== null && oppScore !== null && (
          <span className={`font-mono text-sm ${resultClass}`}>
            {myScore}–{oppScore}
          </span>
        )}
        <span
          data-testid="player-history-spp"
          className={`font-mono text-xs ${
            match.spp.totalSpp > 0 ? "text-emerald-300" : "text-slate-500"
          }`}
        >
          {sppSummary}
        </span>
      </div>
    </li>
  );
}
