"use client";

/**
 * Page admin NFL Fantasy — wrappers UI des routes `/admin/nfl/ingest/*`
 * et `/admin/nfl-fantasy/*` livrees Phase 2.G.
 *
 * Pas de logique metier : chaque action est un formulaire qui appelle
 * `apiRequest`, affiche la reponse en JSON formate, et catch les
 * erreurs `ApiClientError` (status + message).
 *
 * Pattern fetchMe + redirect "/" si pas admin (aligne sur les autres
 * pages /admin/* du repo).
 */

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { apiRequest, ApiClientError } from "../../lib/api-client";
import { API_BASE } from "../../auth-client";

interface ActionResult {
  ok: boolean;
  status?: number;
  body: unknown;
}

interface MeResponse {
  user?: { id?: string; roles?: string[]; role?: string };
}

async function fetchMe(): Promise<{ isAdmin: boolean }> {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("auth_token")
      : null;
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return { isAdmin: false };
  const data = (await res.json()) as MeResponse;
  const roles = Array.isArray(data.user?.roles)
    ? data.user!.roles!
    : data.user?.role
      ? [data.user.role]
      : [];
  return { isAdmin: roles.includes("admin") };
}

// ────────────────────────────────────────────────────────────────────
// ActionCard
// ────────────────────────────────────────────────────────────────────

interface ActionCardProps {
  title: string;
  description: string;
  endpoint: string;
  method?: "POST" | "GET" | "DELETE";
  children?: ReactNode;
  buildBody?: () => Record<string, unknown> | undefined;
  buttonLabel?: string;
}

function ActionCard({
  title,
  description,
  endpoint,
  method = "POST",
  children,
  buildBody,
  buttonLabel = "Lancer",
}: ActionCardProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function run(e?: FormEvent): Promise<void> {
    if (e) e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const body = buildBody?.();
      const data = await apiRequest<unknown>(endpoint, {
        method,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      setResult({ ok: true, body: data });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setResult({ ok: false, status: err.status, body: { error: err.message } });
      } else {
        setResult({
          ok: false,
          body: { error: err instanceof Error ? err.message : "Erreur" },
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={run}
      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
    >
      <header className="mb-3">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-gray-400">
          {method} {endpoint}
        </p>
      </header>

      {children && <div className="space-y-3">{children}</div>}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-white hover:bg-nuffle-bronze disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "En cours…" : buttonLabel}
        </button>
        {result && (
          <span
            className={`text-xs font-medium ${result.ok ? "text-emerald-600" : "text-red-600"}`}
          >
            {result.ok
              ? "OK"
              : `Erreur${result.status ? ` (HTTP ${result.status})` : ""}`}
          </span>
        )}
      </div>

      {result && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-800">
          {JSON.stringify(result.body, null, 2)}
        </pre>
      )}
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────

export default function AdminNflFantasyPage(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  // States des inputs (groupes par action)
  const [seedSeasonId, setSeedSeasonId] = useState("2025");

  const [weekSeasonId, setWeekSeasonId] = useState("2025");
  const [weekNumber, setWeekNumber] = useState(10);

  const [gamedayDate, setGamedayDate] = useState("20251109");

  const [rostersSeasonId, setRostersSeasonId] = useState("2025");
  const [rostersTeamCodes, setRostersTeamCodes] = useState("KC,MIA");

  const [lockWeekId, setLockWeekId] = useState("2025:W10");

  const [matchupsLeagueId, setMatchupsLeagueId] = useState("");
  const [matchupsWeekId, setMatchupsWeekId] = useState("2025:W10");

  const [settleLeagueId, setSettleLeagueId] = useState("");
  const [settleWeekId, setSettleWeekId] = useState("2025:W10");

  const [seedRerollEntryId, setSeedRerollEntryId] = useState("");
  const [seedRerollCount, setSeedRerollCount] = useState(8);

  const [autoFillLeagueId, setAutoFillLeagueId] = useState("");
  const [autoFillPlayersPerEntry, setAutoFillPlayersPerEntry] = useState(15);

  const [finalizeLeagueId, setFinalizeLeagueId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchMe().then(({ isAdmin }) => {
      if (cancelled) return;
      if (!isAdmin) {
        window.location.href = "/";
        return;
      }
      setAuthorized(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-500">Vérification des droits…</p>;
  }
  if (!authorized) return <></>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-nuffle-anthracite">
          🏈 NFL Fantasy — Admin
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Wrappers UI des endpoints admin Phase 2.G. Toutes les actions sont
          idempotentes (sauf la suppression). Les payloads de reponse sont
          affiches en JSON brut sous chaque carte.
        </p>
      </header>

      {/* ────────── Ingestion ────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          📥 Ingestion (Phase 2.A / 2.B)
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ActionCard
            title="Seed des 32 NflTeam"
            description="Idempotent. Insère/maj les 32 équipes NFL depuis @bb/nfl-mapper."
            endpoint="/admin/nfl/ingest/seed-teams"
          />

          <ActionCard
            title="Seed d'une saison"
            description="Crée la NflSeason + 22 NflWeek (1-18 REG, 19-22 POST). Idempotent."
            endpoint="/admin/nfl/ingest/seed-season"
            buildBody={() => ({ seasonId: seedSeasonId })}
          >
            <label className="block text-xs font-medium text-gray-700">
              Saison
              <input
                type="text"
                pattern="\d{4}"
                required
                value={seedSeasonId}
                onChange={(e) => setSeedSeasonId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
          </ActionCard>

          <ActionCard
            title="Ingest nflverse W{n}"
            description="Pull du CSV nflverse pour la semaine indiquée. Upsert players + stats + games + computedSpp."
            endpoint="/admin/nfl/ingest/week"
            buildBody={() => ({
              seasonId: weekSeasonId,
              weekNumber: Number(weekNumber),
            })}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-gray-700">
                Saison
                <input
                  type="text"
                  pattern="\d{4}"
                  required
                  value={weekSeasonId}
                  onChange={(e) => setWeekSeasonId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
                />
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Semaine (1-22)
                <input
                  type="number"
                  min={1}
                  max={22}
                  required
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
                />
              </label>
            </div>
          </ActionCard>

          <ActionCard
            title="ESPN gameday"
            description="Pull du scoreboard ESPN pour une date YYYYMMDD (ET local). Upsert scores + statuts."
            endpoint="/admin/nfl/ingest/gameday"
            buildBody={() => ({ dateYmd: gamedayDate })}
          >
            <label className="block text-xs font-medium text-gray-700">
              Date (YYYYMMDD)
              <input
                type="text"
                pattern="\d{8}"
                required
                value={gamedayDate}
                onChange={(e) => setGamedayDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
          </ActionCard>

          <ActionCard
            title="ESPN rosters snapshot"
            description="Snapshot des rosters ESPN pour les équipes listées (ou les 32 si vide)."
            endpoint="/admin/nfl/ingest/rosters"
            buildBody={() => {
              const codes = rostersTeamCodes
                .split(",")
                .map((c) => c.trim().toUpperCase())
                .filter(Boolean);
              return {
                seasonId: rostersSeasonId,
                ...(codes.length > 0 ? { teamCodes: codes } : {}),
              };
            }}
          >
            <label className="block text-xs font-medium text-gray-700">
              Saison
              <input
                type="text"
                pattern="\d{4}"
                required
                value={rostersSeasonId}
                onChange={(e) => setRostersSeasonId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Codes équipes (CSV, vide = 32 équipes)
              <input
                type="text"
                value={rostersTeamCodes}
                onChange={(e) => setRostersTeamCodes(e.target.value)}
                placeholder="KC,MIA"
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
          </ActionCard>
        </div>
      </section>

      {/* ────────── Draft (A.1) ────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          🎲 Draft (Phase A.1)
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ActionCard
            title="Auto-fill rosters"
            description="V1 minimum viable : remplit chaque entry avec N joueurs aléatoires deterministes (seed = leagueId). League doit être en status draft."
            endpoint="/admin/nfl-fantasy/auto-fill-rosters"
            buildBody={() => ({
              leagueId: autoFillLeagueId,
              playersPerEntry: Number(autoFillPlayersPerEntry),
            })}
          >
            <label className="block text-xs font-medium text-gray-700">
              leagueId
              <input
                type="text"
                required
                value={autoFillLeagueId}
                onChange={(e) => setAutoFillLeagueId(e.target.value)}
                placeholder="cuid…"
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              playersPerEntry (11-30, default 15)
              <input
                type="number"
                min={11}
                max={30}
                value={autoFillPlayersPerEntry}
                onChange={(e) => setAutoFillPlayersPerEntry(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
          </ActionCard>

          <ActionCard
            title="Finalize league (draft → in_progress)"
            description="Transitionne la league + seed 8 rerolls par entry. Idempotent côté rerolls (skip si déjà seedé)."
            endpoint="/admin/nfl-fantasy/finalize-league"
            buildBody={() => ({ leagueId: finalizeLeagueId })}
          >
            <label className="block text-xs font-medium text-gray-700">
              leagueId
              <input
                type="text"
                required
                value={finalizeLeagueId}
                onChange={(e) => setFinalizeLeagueId(e.target.value)}
                placeholder="cuid…"
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
          </ActionCard>
        </div>
      </section>

      {/* ────────── League ops ────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          🏆 Opérations leagues (Phase 2.D / 2.E / 2.F)
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ActionCard
            title="Lock lineups de la semaine"
            description="Bulk lockedAt = now() sur toutes les lineups non-lockées du weekId. Idempotent."
            endpoint="/admin/nfl-fantasy/lock-lineups"
            buildBody={() => ({ weekId: lockWeekId })}
          >
            <label className="block text-xs font-medium text-gray-700">
              weekId (format YYYY:W{"{n}"})
              <input
                type="text"
                pattern="\d{4}:W\d{1,2}"
                required
                value={lockWeekId}
                onChange={(e) => setLockWeekId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
          </ActionCard>

          <ActionCard
            title="Générer matchups"
            description="Round-robin circle method. Idempotent : skip si matchups existent déjà pour (league, week)."
            endpoint="/admin/nfl-fantasy/generate-matchups"
            buildBody={() => ({
              leagueId: matchupsLeagueId,
              weekId: matchupsWeekId,
            })}
          >
            <label className="block text-xs font-medium text-gray-700">
              leagueId
              <input
                type="text"
                required
                value={matchupsLeagueId}
                onChange={(e) => setMatchupsLeagueId(e.target.value)}
                placeholder="cuid…"
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              weekId
              <input
                type="text"
                pattern="\d{4}:W\d{1,2}"
                required
                value={matchupsWeekId}
                onChange={(e) => setMatchupsWeekId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
          </ActionCard>

          <ActionCard
            title="Settle d'une semaine"
            description="Calcule SPP par starter, applique captain ×1.5 / vice ×1.2, persiste scores + winner. Idempotent."
            endpoint="/admin/nfl-fantasy/settle-week"
            buildBody={() => ({
              leagueId: settleLeagueId,
              weekId: settleWeekId,
            })}
          >
            <label className="block text-xs font-medium text-gray-700">
              leagueId
              <input
                type="text"
                required
                value={settleLeagueId}
                onChange={(e) => setSettleLeagueId(e.target.value)}
                placeholder="cuid…"
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              weekId
              <input
                type="text"
                pattern="\d{4}:W\d{1,2}"
                required
                value={settleWeekId}
                onChange={(e) => setSettleWeekId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
          </ActionCard>

          <ActionCard
            title="Seed rerolls de démarrage"
            description="Crée 8 rerolls source=starter pour une entry (vision V1). Idempotent."
            endpoint="/admin/nfl-fantasy/seed-rerolls"
            buildBody={() => ({
              entryId: seedRerollEntryId,
              count: Number(seedRerollCount),
            })}
          >
            <label className="block text-xs font-medium text-gray-700">
              entryId
              <input
                type="text"
                required
                value={seedRerollEntryId}
                onChange={(e) => setSeedRerollEntryId(e.target.value)}
                placeholder="cuid…"
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              count (1-50)
              <input
                type="number"
                min={1}
                max={50}
                value={seedRerollCount}
                onChange={(e) => setSeedRerollCount(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
          </ActionCard>
        </div>
      </section>

      <footer className="rounded-md border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
        <p>
          Documentation backend :{" "}
          <a
            href="https://github.com/Ryxeuf/nuffle-arena/blob/main/docs/nfl-fantasy/16-routes.md"
            target="_blank"
            rel="noreferrer"
            className="text-nuffle-bronze underline"
          >
            16-routes.md
          </a>
          {" · "}
          <a
            href="https://github.com/Ryxeuf/nuffle-arena/blob/main/docs/nfl-fantasy/17-crons.md"
            target="_blank"
            rel="noreferrer"
            className="text-nuffle-bronze underline"
          >
            17-crons.md
          </a>
          . En production, le cron 5min orchestre automatiquement ces actions
          dans leurs fenêtres respectives (03h UTC nflverse, Sun 17h
          lockLineups, Tue 12h settle). Cette page sert au debug et au
          rattrapage manuel.
        </p>
      </footer>
    </div>
  );
}
