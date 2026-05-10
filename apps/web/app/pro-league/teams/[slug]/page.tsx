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

interface RosterStatBonuses {
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number;
  readonly av: number;
}

interface RosterCareer {
  readonly tdCount: number;
  readonly casCount: number;
  readonly compCount: number;
  readonly mvpCount: number;
}

interface RosterProgression {
  readonly level: number;
  readonly spp: number;
  readonly nextLevelSpp: number | null;
  /** Lot K — l'applier est en retard. Le badge ⬆ ready se base dessus. */
  readonly readyToLevelUp?: boolean;
  readonly tv: number;
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
  readonly progression: RosterProgression;
  readonly statBonuses: RosterStatBonuses;
  readonly career: RosterCareer;
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

interface TopEarner {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly level: number;
  readonly tv: number;
  readonly status: string;
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
  /** Lot M — top 5 actifs par TV. */
  readonly topEarners?: readonly TopEarner[];
  readonly totalRosterTv?: number;
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

/**
 * Lot M — carte "Top earner" (top 5 par TV). Cliquable vers la fiche
 * joueur. Affiche rank + nom + position + level + TV.
 */
function TopEarnerCard({
  rank,
  player,
  teamSlug,
}: {
  rank: number;
  player: TopEarner;
  teamSlug: string;
}): JSX.Element {
  return (
    <li
      data-testid={`top-earner-${rank}`}
      className="rounded border border-slate-800 bg-slate-900 hover:bg-slate-800"
    >
      <Link
        href={`/pro-league/teams/${teamSlug}/players/${player.id}`}
        className="flex items-center gap-3 px-3 py-2 text-sm"
      >
        <span className="w-6 font-mono text-xs text-slate-500">
          #{rank}
        </span>
        <div className="flex-1">
          <div className="font-medium text-slate-100">{player.name}</div>
          <div className="text-xs text-slate-500">
            {player.position} · Lv {player.level}
          </div>
        </div>
        <span className="font-mono text-base text-amber-300">
          {formatTv(player.tv)}
        </span>
      </Link>
    </li>
  );
}

/** Lot E — formate "+1MA" / "+2ST" si bonuses non-zéro, sinon "—". */
function formatStatBonuses(b: RosterStatBonuses): string {
  const parts: string[] = [];
  if (b.ma > 0) parts.push(`+${b.ma}MA`);
  if (b.st > 0) parts.push(`+${b.st}ST`);
  if (b.ag > 0) parts.push(`+${b.ag}AG`);
  if (b.pa > 0) parts.push(`+${b.pa}PA`);
  if (b.av > 0) parts.push(`+${b.av}AV`);
  return parts.length === 0 ? "—" : parts.join(" ");
}

/** Formatte 90000 → "90k". */
function formatTv(gp: number): string {
  return `${Math.round(gp / 1000)}k`;
}

/**
 * Lot K — un joueur est "ready to level-up" quand l'applier
 * `sweepLevelUps` (tick 30 min) est en retard sur le level computed
 * depuis le SPP courant. Le serveur expose le flag dans
 * `progression.readyToLevelUp`.
 *
 * Avant Lot K, ce check faisait `spp >= nextLevelSpp`, mais
 * `nextLevelSpp(spp)` retourne le seuil **strictement supérieur** à
 * spp — donc la condition était mathématiquement impossible et le
 * badge ne se déclenchait jamais. Le payload pré-K (sans flag) est
 * traité comme "pas ready" pour rester rétrocompat.
 */
function isReadyToLevelUp(p: RosterProgression): boolean {
  return p.readyToLevelUp === true;
}

/**
 * Lot E — barre de progression SPP. Affiche `cur / next` avec une barre
 * qui montre l'avancement entre le seuil précédent (= cur du level
 * actuel) et le prochain seuil. `null` next ⇒ legend (level 7).
 *
 * Lot H — badge ⬆ "ready" si `spp >= nextLevelSpp`.
 */
function SppProgressBadge({
  spp,
  nextLevelSpp,
  level,
  readyToLevelUp,
}: RosterProgression): JSX.Element {
  if (nextLevelSpp === null) {
    return (
      <span className="text-xs text-amber-300" title="Legend (level 7)">
        ⭐ {spp} SPP
      </span>
    );
  }
  const ready = readyToLevelUp === true;
  // Seuils précédents pour calculer le pct entre (prev, next).
  const THRESHOLDS = [0, 6, 16, 31, 51, 76, 176];
  const prev = THRESHOLDS[level - 1] ?? 0;
  const range = Math.max(1, nextLevelSpp - prev);
  const pct = Math.max(0, Math.min(100, ((spp - prev) / range) * 100));
  return (
    <div
      className="flex flex-col gap-0.5 text-[10px] text-slate-400"
      title={`SPP ${spp} / ${nextLevelSpp} pour level ${level + 1}`}
    >
      <div className="flex items-center justify-between font-mono">
        <span>
          {spp}/{nextLevelSpp}
        </span>
        {ready && (
          <span
            data-testid="ready-badge"
            className="rounded bg-emerald-700 px-1 text-[9px] font-bold text-emerald-50"
            title="SPP atteint le seuil du prochain level — advancement en attente"
          >
            ⬆ ready
          </span>
        )}
      </div>
      <div className="h-1 w-full rounded bg-slate-800">
        <div
          className={`h-full rounded ${ready ? "bg-amber-400" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

type StatusFilter = "all" | "active" | "injured";
type SortKey = "name" | "position" | "level" | "spp" | "tv";

const STATUS_FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "injured", label: "Blessés / nigglés" },
];

const SORT_KEYS: readonly { value: SortKey; label: string }[] = [
  { value: "name", label: "Nom" },
  { value: "position", label: "Position" },
  { value: "level", label: "Level" },
  { value: "spp", label: "SPP" },
  { value: "tv", label: "TV" },
];

function applyRosterFilter(
  rows: readonly RosterEntry[],
  filter: StatusFilter,
): readonly RosterEntry[] {
  if (filter === "all") return rows;
  if (filter === "active") {
    return rows.filter((r) => r.status === "active" && r.niggling === 0);
  }
  // injured = status injured/dead/retired OU niggling > 0 OU status reductions
  return rows.filter(
    (r) => r.status !== "active" || r.niggling > 0,
  );
}

function applyRosterSort(
  rows: readonly RosterEntry[],
  key: SortKey,
  desc: boolean,
): RosterEntry[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "position":
        cmp = a.position.localeCompare(b.position);
        break;
      case "level":
        cmp = a.progression.level - b.progression.level;
        break;
      case "spp":
        cmp = a.progression.spp - b.progression.spp;
        break;
      case "tv":
        cmp = a.progression.tv - b.progression.tv;
        break;
    }
    return desc ? -cmp : cmp;
  });
  return sorted;
}

function RosterTable({
  rows,
  teamSlug,
}: {
  rows: readonly RosterEntry[];
  teamSlug: string;
}): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDesc, setSortDesc] = useState<boolean>(false);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Roster non encore peuplé. Les joueurs sont générés à la création
        de la saison (lot 1.E.6).
      </p>
    );
  }
  const filtered = applyRosterFilter(rows, statusFilter);
  const sorted = applyRosterSort(filtered, sortKey, sortDesc);
  const readyCount = rows.filter((r) => isReadyToLevelUp(r.progression)).length;
  const injuredCount = rows.filter(
    (r) => r.status !== "active" || r.niggling > 0,
  ).length;
  return (
    <div className="space-y-2">
      <div
        data-testid="roster-toolbar"
        className="flex flex-wrap items-center gap-3 text-xs"
      >
        <span className="text-slate-400">
          <strong className="text-slate-200">{rows.length}</strong> joueurs
        </span>
        {readyCount > 0 && (
          <span
            data-testid="roster-ready-summary"
            className="rounded bg-emerald-900/40 px-2 py-0.5 text-emerald-300"
            title="Joueurs avec spp ≥ nextLevelSpp"
          >
            ⬆ {readyCount} prêt{readyCount > 1 ? "s" : ""} à level-up
          </span>
        )}
        {injuredCount > 0 && (
          <span className="rounded bg-amber-900/40 px-2 py-0.5 text-amber-300">
            🤕 {injuredCount} blessé{injuredCount > 1 ? "s" : ""} / niggled
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1">
            <span className="text-slate-500">Filtre :</span>
            <select
              data-testid="roster-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-slate-500">Tri :</span>
            <select
              data-testid="roster-sort-key"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5"
            >
              {SORT_KEYS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <button
            data-testid="roster-sort-direction"
            onClick={() => setSortDesc((d) => !d)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 hover:bg-slate-800"
            title={sortDesc ? "Tri descendant" : "Tri ascendant"}
          >
            {sortDesc ? "↓ desc" : "↑ asc"}
          </button>
        </div>
      </div>

      {sorted.length === 0 && (
        <p
          data-testid="roster-empty-filter"
          className="rounded border border-slate-800 bg-slate-900 p-4 text-sm text-slate-500"
        >
          Aucun joueur ne correspond au filtre.
        </p>
      )}

      {sorted.length > 0 && (
    <div className="overflow-x-auto rounded border border-slate-800">
      <table data-testid="roster-table" className="w-full text-sm">
        <thead className="bg-slate-900 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-2 py-2 text-left">Nom</th>
            <th className="px-2 py-2 text-left">Position</th>
            <th className="w-10 px-2 py-2 text-center" title="Niveau (1=rookie, 7=legend)">
              Lvl
            </th>
            <th className="w-24 px-2 py-2 text-center" title="Star Player Points">
              SPP
            </th>
            <th className="w-12 px-2 py-2 text-center">TV</th>
            <th className="w-10 px-2 py-2 text-center">MA</th>
            <th className="w-10 px-2 py-2 text-center">ST</th>
            <th className="w-10 px-2 py-2 text-center">AG</th>
            <th className="w-10 px-2 py-2 text-center">PA</th>
            <th className="w-10 px-2 py-2 text-center">AV</th>
            <th className="w-20 px-2 py-2 text-left" title="Stat increases gagnés via doubles roll">
              Bonus
            </th>
            <th className="px-2 py-2 text-left">Skills</th>
            <th className="w-24 px-2 py-2 text-left" title="TD / CAS / COMP / MVP carriere">
              Carrière
            </th>
            <th className="w-20 px-2 py-2 text-center">Status</th>
            <th className="w-12 px-2 py-2 text-center">Forme</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.id}
              className="border-t border-slate-800 hover:bg-slate-900"
            >
              <td className="px-2 py-2 font-medium text-slate-100">
                <Link
                  data-testid={`player-link-${r.id}`}
                  href={`/pro-league/teams/${teamSlug}/players/${r.id}`}
                  className="hover:text-emerald-300 hover:underline"
                >
                  {r.name}
                </Link>
              </td>
              <td className="px-2 py-2 text-slate-300">{r.position}</td>
              <td
                data-testid="roster-level"
                className="px-2 py-2 text-center font-mono text-slate-100"
              >
                {r.progression.level}
              </td>
              <td className="px-2 py-2">
                <SppProgressBadge {...r.progression} />
              </td>
              <td
                data-testid="roster-tv"
                className="px-2 py-2 text-center font-mono text-slate-300"
              >
                {formatTv(r.progression.tv)}
              </td>
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
              <td
                data-testid="roster-bonuses"
                className="px-2 py-2 font-mono text-xs text-amber-300"
              >
                {formatStatBonuses(r.statBonuses)}
              </td>
              <td className="px-2 py-2 text-xs text-slate-400">
                {r.skills.length === 0 ? "—" : r.skills.join(", ")}
              </td>
              <td className="px-2 py-2 text-xs text-slate-400">
                <span className="font-mono">
                  {r.career.tdCount}/{r.career.casCount}/{r.career.compCount}/
                  {r.career.mvpCount}
                </span>
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
      )}
    </div>
  );
}

interface TeamPageProps {
  readonly params: { slug: string };
}

function FollowButton({
  slug,
  initiallyFollowing,
  onChange,
}: {
  slug: string;
  initiallyFollowing: boolean;
  onChange: (next: boolean) => void;
}): JSX.Element {
  const [following, setFollowing] = useState(initiallyFollowing);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFollowing(initiallyFollowing);
  }, [initiallyFollowing]);

  const toggle = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setError(null);
    const next = !following;
    try {
      await apiRequest(
        `/pro-league/teams/${encodeURIComponent(slug)}/follow`,
        { method: next ? "POST" : "DELETE" },
      );
      setFollowing(next);
      onChange(next);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "fetch error";
      setError(msg);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        data-testid="follow-button"
        onClick={() => {
          void toggle();
        }}
        disabled={pending}
        className={`rounded px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
          following
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-white text-slate-900 hover:bg-slate-100"
        }`}
      >
        {pending
          ? "..."
          : following
            ? "✓ Suivi"
            : "+ Suivre"}
      </button>
      {error ? (
        <span className="text-xs text-rose-200" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

interface FollowState {
  readonly authChecked: boolean;
  readonly authed: boolean;
  readonly following: boolean;
}

const INITIAL_FOLLOW: FollowState = {
  authChecked: false,
  authed: false,
  following: false,
};

export default function ProLeagueTeamPage({
  params,
}: TeamPageProps): JSX.Element {
  const [data, setData] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followState, setFollowState] = useState<FollowState>(INITIAL_FOLLOW);

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

  // Charge le statut de follow (auth-required ; 401 silencieux pour
  // les visiteurs anonymes — le bouton ne s'affichera pas).
  useEffect(() => {
    let cancelled = false;
    apiRequest<{ following: boolean }>(
      `/pro-league/teams/${encodeURIComponent(params.slug)}/follow`,
    )
      .then((r) => {
        if (cancelled) return;
        setFollowState({
          authChecked: true,
          authed: true,
          following: !!r.following,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setFollowState({
          authChecked: true,
          authed: false,
          following: false,
        });
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
              <div className="flex items-center gap-3">
                {followState.authChecked && followState.authed ? (
                  <FollowButton
                    slug={data.slug}
                    initiallyFollowing={followState.following}
                    onChange={(next) =>
                      setFollowState((s) => ({ ...s, following: next }))
                    }
                  />
                ) : null}
                <span className="font-mono text-xs text-white/70">
                  {data.race} · TV {data.baseTv}
                </span>
              </div>
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

            {data.topEarners && data.topEarners.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-2 text-lg font-semibold text-slate-100">
                  Top earners{" "}
                  {typeof data.totalRosterTv === "number" && (
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      (roster total :{" "}
                      <span className="font-mono text-slate-300">
                        {formatTv(data.totalRosterTv)}
                      </span>
                      )
                    </span>
                  )}
                </h2>
                <ol
                  data-testid="top-earners"
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {data.topEarners.map((p, idx) => (
                    <TopEarnerCard
                      key={p.id}
                      rank={idx + 1}
                      player={p}
                      teamSlug={params.slug}
                    />
                  ))}
                </ol>
              </section>
            )}

            <section className="mb-6">
              <h2 className="mb-2 text-lg font-semibold text-slate-100">
                Roster
              </h2>
              <RosterTable rows={data.roster} teamSlug={params.slug} />
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
