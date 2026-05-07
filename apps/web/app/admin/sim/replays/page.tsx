"use client";

/**
 * Console admin — lecture des 50 replays panel BB experts (sprint
 * Pro League 0.E.2 / 0.E.3).
 *
 * Sert de support à la validation **C6-C9** du gate Phase 0 → Phase 1
 * (cf. `docs/roadmap/sprints/pro-league-gate.md`) :
 *   C6 — moyenne globale ≥ 7/10
 *   C7 — pas de note < 6.5 sur lisibilité tactique
 *   C8 — pas de note < 6.5 sur cohérence des drives
 *   C9 — ≥ 4/5 testeurs recommandent Phase 1
 *
 * Permet à un admin (sprint owner / tech lead / game designer) de :
 *  - parcourir le set de 50 replays sans CLI ni clone du repo,
 *  - filtrer par race / résultat / score / casualties,
 *  - ouvrir le contenu narratif complet d'un replay côté droit,
 *  - copier rapidement le nom du fichier pour citation dans
 *    `pro-league-panel/score-synthesis.md`.
 *
 * Lecture seule : cette page n'écrit aucun état serveur.
 */

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../auth-client";

interface ReplaySummary {
  filename: string;
  index: string | null;
  homeId: string | null;
  awayId: string | null;
  seed: number | null;
  sizeBytes: number;
  parsed: {
    matchIndex: number | null;
    homeName: string | null;
    homeRace: string | null;
    awayName: string | null;
    awayRace: string | null;
    engineVer: string | null;
    homeScore: number | null;
    awayScore: number | null;
    outcome: "home" | "away" | "draw" | null;
    totals: {
      touchdowns: number | null;
      casualties: number | null;
      turnovers: number | null;
      nuffle: number | null;
    };
    totalLines: number;
  };
}

interface ListResponse {
  replays: ReplaySummary[];
  dir: string;
  missing: boolean;
}

interface DetailResponse {
  file: ReplaySummary["parsed"] & { filename: string };
  parsed: ReplaySummary["parsed"];
  content: string;
}

type OutcomeFilter = "all" | "home" | "away" | "draw";

async function fetchJSON<T>(path: string): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function formatScore(r: ReplaySummary): string {
  const { homeScore, awayScore } = r.parsed;
  if (homeScore === null || awayScore === null) return "—";
  return `${homeScore}-${awayScore}`;
}

function outcomeBadge(outcome: ReplaySummary["parsed"]["outcome"]): {
  label: string;
  className: string;
} {
  switch (outcome) {
    case "home":
      return { label: "Home", className: "bg-emerald-100 text-emerald-700" };
    case "away":
      return { label: "Away", className: "bg-sky-100 text-sky-700" };
    case "draw":
      return { label: "Draw", className: "bg-gray-100 text-gray-700" };
    default:
      return { label: "?", className: "bg-gray-100 text-gray-500" };
  }
}

export default function AdminReplaysPage() {
  const [replays, setReplays] = useState<ReplaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [dir, setDir] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [raceFilter, setRaceFilter] = useState<string>("all");

  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchJSON<ListResponse>("/admin/sim-replays/");
        setReplays(data.replays);
        setMissing(data.missing);
        setDir(data.dir);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    (async () => {
      try {
        const data = await fetchJSON<DetailResponse>(
          `/admin/sim-replays/${encodeURIComponent(selected)}`,
        );
        setDetail(data);
      } catch (e) {
        setDetailError((e as Error).message);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [selected]);

  const races = useMemo(() => {
    const set = new Set<string>();
    for (const r of replays) {
      if (r.parsed.homeRace) set.add(r.parsed.homeRace);
      if (r.parsed.awayRace) set.add(r.parsed.awayRace);
    }
    return Array.from(set).sort();
  }, [replays]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return replays.filter((r) => {
      if (outcomeFilter !== "all" && r.parsed.outcome !== outcomeFilter) {
        return false;
      }
      if (raceFilter !== "all") {
        if (
          r.parsed.homeRace !== raceFilter &&
          r.parsed.awayRace !== raceFilter
        ) {
          return false;
        }
      }
      if (q) {
        const hay = [
          r.filename,
          r.parsed.homeName,
          r.parsed.awayName,
          r.parsed.homeRace,
          r.parsed.awayRace,
          r.homeId,
          r.awayId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [replays, outcomeFilter, raceFilter, search]);

  const aggregate = useMemo(() => {
    if (replays.length === 0) {
      return { td: 0, cas: 0, to: 0, nuffle: 0, draws: 0 };
    }
    let td = 0;
    let cas = 0;
    let to = 0;
    let nuffle = 0;
    let draws = 0;
    for (const r of replays) {
      td += r.parsed.totals.touchdowns ?? 0;
      cas += r.parsed.totals.casualties ?? 0;
      to += r.parsed.totals.turnovers ?? 0;
      nuffle += r.parsed.totals.nuffle ?? 0;
      if (r.parsed.outcome === "draw") draws += 1;
    }
    return {
      td: td / replays.length,
      cas: cas / replays.length,
      to: to / replays.length,
      nuffle: nuffle / replays.length,
      draws,
    };
  }, [replays]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
          📜 Replays panel — validation C6-C9
        </h1>
        <p className="text-sm text-gray-600">
          Visualisation des 50 replays{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">
            pro-league-panel/replays/
          </code>{" "}
          utilisés pour la validation gate Phase 0 → Phase 1 (cf.{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">
            docs/roadmap/sprints/pro-league-gate.md
          </code>
          ). Lecture seule : aucune écriture serveur.
        </p>
      </header>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          ⚠️ {error}
        </div>
      )}

      {missing && !loading && !error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          ⚠️ Le dossier <code>{dir}</code> est introuvable côté serveur.
          Régénère les replays avec{" "}
          <code className="bg-white px-1 rounded">
            pnpm --filter @bb/sim-engine sim:replay --random=50 --seed=2026
            --out=docs/roadmap/sprints/pro-league-panel/replays
          </code>
          .
        </div>
      )}

      {!loading && !missing && replays.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <Stat label="Replays" value={String(replays.length)} />
            <Stat label="Ø TD / match" value={aggregate.td.toFixed(2)} />
            <Stat label="Ø Cas / match" value={aggregate.cas.toFixed(2)} />
            <Stat label="Ø TO / match" value={aggregate.to.toFixed(2)} />
            <Stat label="Nuls" value={`${aggregate.draws} / ${replays.length}`} />
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-500">
              Recherche
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="équipe, race, fichier…"
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-500">
              Résultat
            </span>
            <select
              value={outcomeFilter}
              onChange={(e) =>
                setOutcomeFilter(e.target.value as OutcomeFilter)
              }
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="all">Tous</option>
              <option value="home">Victoire domicile</option>
              <option value="away">Victoire visiteur</option>
              <option value="draw">Match nul</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-500">
              Race impliquée
            </span>
            <select
              value={raceFilter}
              onChange={(e) => setRaceFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="all">Toutes</option>
              {races.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Liste */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <header className="px-4 py-2 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide bg-gray-50 flex items-center justify-between">
            <span>
              {filtered.length} / {replays.length} replays
            </span>
            {loading && <span>Chargement…</span>}
          </header>
          <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
            {filtered.map((r) => {
              const badge = outcomeBadge(r.parsed.outcome);
              const isSelected = r.filename === selected;
              return (
                <li key={r.filename}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.filename)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-nuffle-gold/10" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-nuffle-anthracite truncate">
                          #{r.parsed.matchIndex ?? r.index ?? "?"}{" "}
                          — {r.parsed.homeName ?? r.homeId} vs{" "}
                          {r.parsed.awayName ?? r.awayId}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {r.parsed.homeRace ?? "?"} vs{" "}
                          {r.parsed.awayRace ?? "?"} · seed {r.seed ?? "?"} ·
                          engine {r.parsed.engineVer ?? "?"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-base font-mono font-semibold text-nuffle-anthracite">
                          {formatScore(r)}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                      <span>cas {r.parsed.totals.casualties ?? "?"}</span>
                      <span>to {r.parsed.totals.turnovers ?? "?"}</span>
                      <span>nuffle {r.parsed.totals.nuffle ?? "?"}</span>
                      <span>{r.parsed.totalLines} lignes</span>
                    </div>
                  </button>
                </li>
              );
            })}
            {!loading && filtered.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-gray-500">
                Aucun replay ne matche les filtres courants.
              </li>
            )}
          </ul>
        </section>

        {/* Détail */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <header className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              {selected ? "Replay" : "Sélectionne un replay"}
            </div>
            {selected && (
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(selected)}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
                title="Copier le nom du fichier (utile pour citer dans score-synthesis.md)"
              >
                📋 {selected}
              </button>
            )}
          </header>
          <div className="flex-1 max-h-[60vh] overflow-y-auto">
            {!selected && (
              <p className="px-4 py-8 text-sm text-gray-500 text-center">
                Choisis un replay dans la liste pour afficher son contenu
                narratif complet.
              </p>
            )}
            {selected && detailLoading && (
              <p className="px-4 py-8 text-sm text-gray-500 text-center">
                Chargement…
              </p>
            )}
            {selected && detailError && (
              <p className="px-4 py-8 text-sm text-red-600 text-center">
                ⚠️ {detailError}
              </p>
            )}
            {detail && (
              <pre className="px-4 py-3 text-xs whitespace-pre-wrap font-mono text-gray-800 leading-relaxed">
                {detail.content}
              </pre>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-base font-semibold text-nuffle-anthracite">
        {value}
      </div>
    </div>
  );
}
