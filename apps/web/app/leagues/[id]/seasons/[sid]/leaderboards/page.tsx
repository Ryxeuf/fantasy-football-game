"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../../../../../lib/api-client";
import { getTeamColors } from "@bb/game-engine";

// Lot J — Classements top-N joueurs d'une saison de ligue.
// Endpoint public : pas de gating auth ici.
// Design aligné sur la page recap (bannière ambre, cartes à icônes,
// pastilles de valeurs, palette nuffle-anthracite/bronze).

interface PlayerStatRow {
  rank: number;
  playerId: string;
  playerName: string;
  position: string;
  teamId: string;
  teamName: string;
  teamRoster: string;
  ownerId: string;
  ownerCoachName: string | null;
  value: number;
  secondary: { matchesPlayed: number; spp: number };
}

interface PlayerStatsCatalogue {
  seasonId: string;
  topN: number;
  scope: "career" | "season";
  topScorers: PlayerStatRow[];
  topBashers: PlayerStatRow[];
  topKillers: PlayerStatRow[];
  topAggressors: PlayerStatRow[];
  topTeamThrowers: PlayerStatRow[];
  topPassers: PlayerStatRow[];
  topInterceptors: PlayerStatRow[];
  topFutureStars: PlayerStatRow[];
  topMvps: PlayerStatRow[];
  topPunchingBags: PlayerStatRow[];
  categories: Array<{ key: keyof PlayerStatsCatalogue; label: string; description: string }>;
}

interface ByTeamResponse {
  seasonId: string;
  teams: Array<{
    teamId: string;
    teamName: string;
    catalogue: PlayerStatsCatalogue;
  }>;
}

type Mode = "global" | "by-team";

/** Icône + teinte d'accent par catégorie (même esprit que les awards du recap). */
const CATEGORY_STYLE: Record<
  string,
  { icon: string; accent: string }
> = {
  topScorers: { icon: "🏈", accent: "bg-emerald-50 border-emerald-200" },
  topBashers: { icon: "💥", accent: "bg-orange-50 border-orange-200" },
  topKillers: { icon: "☠️", accent: "bg-red-50 border-red-200" },
  topAggressors: { icon: "🥾", accent: "bg-amber-50 border-amber-200" },
  topTeamThrowers: { icon: "🫴", accent: "bg-sky-50 border-sky-200" },
  topPassers: { icon: "🎯", accent: "bg-blue-50 border-blue-200" },
  topInterceptors: { icon: "🧤", accent: "bg-indigo-50 border-indigo-200" },
  topFutureStars: { icon: "⭐", accent: "bg-yellow-50 border-yellow-200" },
  topMvps: { icon: "🏅", accent: "bg-purple-50 border-purple-200" },
  topPunchingBags: { icon: "🩹", accent: "bg-rose-50 border-rose-200" },
};

const DEFAULT_CATEGORY_STYLE = {
  icon: "📊",
  accent: "bg-slate-50 border-slate-200",
};

/** Médaille des 3 premiers rangs, chip neutre ensuite. */
function RankChip({ rank }: { rank: number }) {
  if (rank === 1) return <span aria-label="1er">🥇</span>;
  if (rank === 2) return <span aria-label="2e">🥈</span>;
  if (rank === 3) return <span aria-label="3e">🥉</span>;
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 font-mono text-[11px] text-slate-500">
      {rank}
    </span>
  );
}

/** Point coloré aux couleurs canoniques du roster de l'équipe. */
function TeamDot({ roster }: { roster: string }) {
  const colors = getTeamColors(roster);
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{
        backgroundColor: `#${colors.primary.toString(16).padStart(6, "0")}`,
      }}
    />
  );
}

export default function LeaderboardsPage() {
  const params = useParams<{ id: string; sid: string }>();
  const leagueId = params?.id ?? "";
  const seasonId = params?.sid ?? "";

  const [mode, setMode] = useState<Mode>("global");
  const [topN, setTopN] = useState(5);
  const [global, setGlobal] = useState<PlayerStatsCatalogue | null>(null);
  const [byTeam, setByTeam] = useState<ByTeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!seasonId) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "global") {
        const data = await apiRequest<PlayerStatsCatalogue>(
          `/leagues/seasons/${seasonId}/leaderboards?topN=${topN}`,
        );
        setGlobal(data);
        setByTeam(null);
      } else {
        const data = await apiRequest<ByTeamResponse>(
          `/leagues/seasons/${seasonId}/leaderboards/by-team?topN=${topN}`,
        );
        setByTeam(data);
        setGlobal(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [seasonId, mode, topN]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      {/* En-tête, même structure que le recap */}
      <div>
        <Link
          href={`/leagues/${leagueId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
        >
          ← Retour a la ligue
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-nuffle-anthracite sm:text-3xl">
            Classements de la saison
          </h1>
          {!loading && global ? (
            <span
              data-testid="leaderboards-scope"
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                global.scope === "season"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
              title={
                global.scope === "season"
                  ? "Statistiques de la saison (calculées sur les feuilles de match)."
                  : "Statistiques de carrière (aucune feuille de match saisie pour cette saison)."
              }
            >
              {global.scope === "season" ? "Saison" : "Carrière"}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Les meilleurs joueurs de la saison, catégorie par catégorie —
          agrégés depuis les feuilles de match (repli sur les compteurs
          carrière tant qu&apos;aucune feuille n&apos;est saisie).
        </p>
      </div>

      {/* Contrôles : segmented control + top-N */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex overflow-hidden rounded-lg border border-gray-300 bg-white text-sm shadow-sm"
          role="group"
          aria-label="Mode d'affichage"
          data-testid="leaderboards-mode"
        >
          {(
            [
              ["global", "Toute la ligue"],
              ["by-team", "Par equipe"],
            ] as Array<[Mode, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              data-testid={`leaderboards-mode-${value}`}
              aria-pressed={mode === value}
              className={`px-3.5 py-2 font-medium transition-colors ${
                mode === value
                  ? "bg-nuffle-anthracite text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          Top
          <input
            type="number"
            min={1}
            max={50}
            value={topN}
            onChange={(e) =>
              setTopN(Math.max(1, Math.min(50, Number(e.target.value))))
            }
            className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 shadow-sm"
            data-testid="leaderboards-topn"
          />
        </label>
      </div>

      {loading && (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          aria-hidden="true"
        >
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="h-5 w-1/2 rounded bg-slate-100" />
              <div className="mt-3 h-3 w-3/4 rounded bg-slate-100" />
              <div className="mt-4 space-y-2">
                <div className="h-3 rounded bg-slate-100" />
                <div className="h-3 rounded bg-slate-100" />
                <div className="h-3 w-2/3 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && mode === "global" && global && (
        <GlobalView catalogue={global} />
      )}
      {!loading && mode === "by-team" && byTeam && <ByTeamView data={byTeam} />}
    </main>
  );
}

function GlobalView({ catalogue }: { catalogue: PlayerStatsCatalogue }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      data-testid="leaderboards-global"
    >
      {catalogue.categories.map((cat) => {
        const rows = (catalogue[cat.key] as unknown) as PlayerStatRow[];
        return (
          <LeaderboardCard
            key={cat.key}
            categoryKey={cat.key as string}
            label={cat.label}
            description={cat.description}
            rows={Array.isArray(rows) ? rows : []}
          />
        );
      })}
    </div>
  );
}

function ByTeamView({ data }: { data: ByTeamResponse }) {
  return (
    <div className="space-y-6" data-testid="leaderboards-byteam">
      {data.teams.map((t) => (
        <section
          key={t.teamId}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <h2 className="mb-3 text-lg font-semibold text-nuffle-anthracite">
            {t.teamName}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(t.catalogue.categories ?? []).map((cat) => {
              const rows = (t.catalogue[cat.key] as unknown) as PlayerStatRow[];
              return (
                <LeaderboardCard
                  key={`${t.teamId}-${cat.key}`}
                  categoryKey={cat.key as string}
                  label={cat.label}
                  description={cat.description}
                  rows={Array.isArray(rows) ? rows : []}
                  compact
                />
              );
            })}
          </div>
        </section>
      ))}
      {data.teams.length === 0 && (
        <p className="text-sm italic text-gray-400">Aucune equipe inscrite.</p>
      )}
    </div>
  );
}

function LeaderboardCard({
  categoryKey,
  label,
  description,
  rows,
  compact,
}: {
  categoryKey: string;
  label: string;
  description: string;
  rows: PlayerStatRow[];
  compact?: boolean;
}) {
  const style = CATEGORY_STYLE[categoryKey] ?? DEFAULT_CATEGORY_STYLE;
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white ${
        compact ? "p-3" : "p-4 shadow-sm"
      }`}
      data-testid={`leaderboard-card-${label}`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-lg ${style.accent}`}
          aria-hidden="true"
        >
          {style.icon}
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight text-nuffle-anthracite">
            {label}
          </h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm italic text-gray-400">
          Pas encore de données cette saison.
        </p>
      ) : (
        <ol className="mt-3 space-y-1">
          {rows.map((r) => (
            <li
              key={r.playerId}
              className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${
                r.rank === 1
                  ? "border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50"
                  : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <RankChip rank={r.rank} />
                <span className="min-w-0">
                  <span
                    className={`font-semibold text-nuffle-anthracite ${
                      r.rank === 1 ? "" : "font-medium"
                    }`}
                  >
                    {r.playerName}
                  </span>
                  <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-gray-500">
                    <TeamDot roster={r.teamRoster} />
                    <span className="truncate">
                      {r.position} — {r.teamName}
                    </span>
                  </span>
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-bold ${
                  r.rank === 1
                    ? "bg-nuffle-gold/20 text-nuffle-bronze"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {r.value}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
