"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../../lib/api-client";

/**
 * Page détail d'une équipe Pro League — sprint Pro League lot 1.C.2.
 *
 * Affiche :
 * - Banner branding (couleur primaire, ville + race + NFL flavor + motto)
 * - Record + form (badges 5 derniers résultats)
 * - Roster (table compacte avec stats BB)
 * - Calendrier : prochains matchs + derniers matchs joués
 *
 * Public, pas d'auth.
 */

type FormChar = "W" | "D" | "L";

interface Opponent {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly primaryColor: string | null;
}

interface DetailMatch {
  readonly id: string;
  readonly roundNumber: number;
  readonly status: string;
  readonly scheduledAt: string;
  readonly homeTeamSlug: string;
  readonly awayTeamSlug: string;
  readonly opponent: Opponent;
  readonly isHome: boolean;
  readonly scoreHome: number | null;
  readonly scoreAway: number | null;
  readonly outcome: string | null;
}

interface RosterEntry {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly skills: readonly string[];
  readonly status: string;
  readonly form: number;
  readonly niggling: number;
}

interface DetailRecord {
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly points: number;
  readonly tdFor: number;
  readonly tdAgainst: number;
  readonly form: readonly FormChar[];
}

interface TeamDetail {
  readonly slug: string;
  readonly city: string;
  readonly name: string;
  readonly race: string;
  readonly nflFlavor: string | null;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
  readonly baseTv: number;
  readonly motto: string | null;
  readonly seasonId: string | null;
  readonly seasonYear: number | null;
  readonly record: DetailRecord | null;
  readonly roster: readonly RosterEntry[];
  readonly upcomingMatches: readonly DetailMatch[];
  readonly recentMatches: readonly DetailMatch[];
}

const FORM_BADGE_STYLES: Record<FormChar, string> = {
  W: "bg-emerald-700 text-emerald-50",
  D: "bg-slate-600 text-slate-50",
  L: "bg-rose-700 text-rose-50",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-700/30 text-emerald-200",
  injured: "bg-amber-700/30 text-amber-200",
  dead: "bg-rose-900/40 text-rose-200",
  retired: "bg-slate-700/30 text-slate-300",
};

function FormBadges({ form }: { form: readonly FormChar[] }): JSX.Element {
  if (form.length === 0) {
    return <span className="text-xs text-slate-600">—</span>;
  }
  return (
    <div className="flex gap-0.5" data-testid="form-badges">
      {form.map((c, i) => (
        <span
          key={i}
          className={`flex h-5 w-5 items-center justify-center rounded text-xs font-bold font-mono ${FORM_BADGE_STYLES[c]}`}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function MatchRow({ match }: { match: DetailMatch }): JSX.Element {
  const at = new Date(match.scheduledAt);
  const formattedDate = at.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const finished = match.status === "completed";
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
    : "text-slate-400";

  return (
    <Link
      href={`/pro-league/matches/${match.id}/live`}
      className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800"
      data-testid="match-row"
    >
      <div className="flex flex-col">
        <span className="text-xs uppercase text-slate-500">
          R{match.roundNumber} · {match.isHome ? "Home" : "Away"}
        </span>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-full ring-1 ring-slate-700"
            style={{ background: match.opponent.primaryColor ?? "#475569" }}
          />
          <span className="font-medium text-slate-100">
            {match.opponent.name}
          </span>
          <span className="text-xs text-slate-500">{match.opponent.city}</span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        {finished ? (
          <span className={`font-mono ${resultClass}`}>
            {match.scoreHome}–{match.scoreAway}
          </span>
        ) : (
          <span className="font-mono text-xs text-slate-500">{match.status}</span>
        )}
        <span className="text-xs text-slate-500">{formattedDate}</span>
      </div>
    </Link>
  );
}

function RosterTable({
  rows,
}: {
  rows: readonly RosterEntry[];
}): JSX.Element {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Roster non encore peuplé. Les joueurs sont générés à la création
        de la saison (lot 1.E.6).
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded border border-slate-800">
      <table data-testid="roster-table" className="w-full text-sm">
        <thead className="bg-slate-900 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-2 py-2 text-left">Nom</th>
            <th className="px-2 py-2 text-left">Position</th>
            <th className="w-10 px-2 py-2 text-center">MA</th>
            <th className="w-10 px-2 py-2 text-center">ST</th>
            <th className="w-10 px-2 py-2 text-center">AG</th>
            <th className="w-10 px-2 py-2 text-center">PA</th>
            <th className="w-10 px-2 py-2 text-center">AV</th>
            <th className="px-2 py-2 text-left">Skills</th>
            <th className="w-20 px-2 py-2 text-center">Status</th>
            <th className="w-12 px-2 py-2 text-center">Forme</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-t border-slate-800 hover:bg-slate-900"
            >
              <td className="px-2 py-2 font-medium text-slate-100">
                {r.name}
              </td>
              <td className="px-2 py-2 text-slate-300">{r.position}</td>
              <td className="px-2 py-2 text-center font-mono text-slate-300">
                {r.ma}
              </td>
              <td className="px-2 py-2 text-center font-mono text-slate-300">
                {r.st}
              </td>
              <td className="px-2 py-2 text-center font-mono text-slate-300">
                {r.ag}
              </td>
              <td className="px-2 py-2 text-center font-mono text-slate-300">
                {r.pa ?? "—"}
              </td>
              <td className="px-2 py-2 text-center font-mono text-slate-300">
                {r.av}
              </td>
              <td className="px-2 py-2 text-xs text-slate-400">
                {r.skills.length === 0 ? "—" : r.skills.join(", ")}
              </td>
              <td className="px-2 py-2 text-center">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_STYLES[r.status] ?? STATUS_STYLES.active}`}
                >
                  {r.status}
                </span>
              </td>
              <td className="px-2 py-2 text-center font-mono text-slate-400">
                {r.form}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TeamPageProps {
  readonly params: { slug: string };
}

export default function ProLeagueTeamPage({
  params,
}: TeamPageProps): JSX.Element {
  const [data, setData] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<TeamDetail>(
      `/pro-league/teams/${encodeURIComponent(params.slug)}`,
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
  }, [params.slug]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col bg-slate-950 text-slate-100">
      {loading ? (
        <p className="px-4 py-6 text-sm text-slate-400">Chargement…</p>
      ) : error ? (
        <p
          role="alert"
          className="m-4 rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : !data ? (
        <p className="px-4 py-6 text-sm text-slate-400">Équipe inconnue.</p>
      ) : (
        <>
          <header
            data-testid="team-banner"
            className="flex flex-col gap-1 border-b-4 px-4 py-6"
            style={{
              background: `linear-gradient(135deg, ${data.primaryColor ?? "#1e293b"} 0%, ${data.secondaryColor ?? "#0f172a"} 100%)`,
              borderBottomColor: data.secondaryColor ?? "#0f172a",
            }}
          >
            <div className="flex items-center justify-between">
              <Link
                href="/pro-league"
                className="rounded border border-white/30 px-2 py-1 text-xs text-white/90 hover:bg-white/10"
              >
                ← Hub
              </Link>
              <span className="font-mono text-xs text-white/70">
                {data.race} · TV {data.baseTv}
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-wide text-white drop-shadow-md">
              {data.name}
            </h1>
            <p className="text-sm text-white/80">{data.city}</p>
            {data.motto ? (
              <p className="mt-1 text-sm italic text-white/70">
                "{data.motto}"
              </p>
            ) : null}
            {data.nflFlavor ? (
              <p className="mt-2 text-xs text-white/60">{data.nflFlavor}</p>
            ) : null}
          </header>

          <div className="px-4 py-6">
            {data.record ? (
              <section
                data-testid="team-record"
                className="mb-6 flex flex-wrap items-center gap-4 rounded border border-slate-800 bg-slate-900 px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-xs uppercase text-slate-500">
                    Record
                  </span>
                  <span className="font-mono text-lg font-bold text-slate-100">
                    {data.record.wins}V {data.record.draws}N {data.record.losses}D
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase text-slate-500">
                    Points
                  </span>
                  <span className="font-mono text-lg font-bold text-slate-100">
                    {data.record.points}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase text-slate-500">TD</span>
                  <span className="font-mono text-lg font-bold text-slate-100">
                    {data.record.tdFor}–{data.record.tdAgainst}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase text-slate-500">
                    Forme
                  </span>
                  <FormBadges form={data.record.form} />
                </div>
              </section>
            ) : null}

            <section className="mb-6">
              <h2 className="mb-2 text-lg font-semibold text-slate-100">
                Roster
              </h2>
              <RosterTable rows={data.roster} />
            </section>

            <section className="mb-6">
              <h2 className="mb-2 text-lg font-semibold text-slate-100">
                Prochains matchs
              </h2>
              {data.upcomingMatches.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aucun match programmé.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.upcomingMatches.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-slate-100">
                Derniers matchs
              </h2>
              {data.recentMatches.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aucun match joué.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.recentMatches.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
