"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest, ApiClientError } from "../../../../lib/api-client";

// Lot G.3 (minimal) — Feuille de match v2 : saisie d'evenements,
// soumission par coach, validation par commissaire. Le score et les
// blesses sont derives cote serveur (summary).

type EventKind =
  | "kickoff"
  | "touchdown"
  | "casualty"
  | "pass_complete"
  | "interception"
  | "aggression"
  | "expulsion"
  | "crowd_surge"
  | "stalling"
  | "other_elim";

interface MatchEvent {
  id: string;
  kind: EventKind;
  team: "home" | "away" | null;
  actorPlayerId: string | null;
  targetPlayerId: string | null;
  causeDetail: string | null;
  injurySeverity: string | null;
}

interface InjuredPlayer {
  playerId: string;
  severity: string;
  side: "home" | "away";
  cause: string | null;
}

interface Summary {
  scoreHome: number;
  scoreAway: number;
  casualtiesHome: number;
  casualtiesAway: number;
  injuries: InjuredPlayer[];
}

interface SheetResponse {
  sheet: {
    id: string;
    status: string;
    events?: MatchEvent[];
  };
  summary: Summary;
  viewerRole: "home" | "away" | "commissioner" | "none";
}

const EVENT_KINDS: EventKind[] = [
  "kickoff",
  "touchdown",
  "casualty",
  "pass_complete",
  "interception",
  "aggression",
  "expulsion",
  "crowd_surge",
  "stalling",
  "other_elim",
];

const INJURY_SEVERITIES = ["", "badly_hurt", "mng", "niggling", "stat_loss", "dead"];

export default function MatchSheetPage() {
  const params = useParams<{ id: string }>();
  const pairingId = params?.id ?? "";

  const [data, setData] = useState<SheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form pour ajouter un event.
  const [kind, setKind] = useState<EventKind>("touchdown");
  const [team, setTeam] = useState<"home" | "away">("home");
  const [actorPlayerId, setActorPlayerId] = useState("");
  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [injurySeverity, setInjurySeverity] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<SheetResponse>(
        `/leagues/pairings/${pairingId}/sheet`,
      );
      setData(res);
    } catch (e: unknown) {
      // 404 -> la feuille n'existe pas encore : on propose de l'ouvrir.
      if (e instanceof ApiClientError && e.status === 404) {
        setData(null);
      } else {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    } finally {
      setLoading(false);
    }
  }, [pairingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        await load();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const createSheet = () =>
    run(() =>
      apiRequest(`/leagues/pairings/${pairingId}/sheet`, { method: "POST" }),
    );

  const addEvent = () =>
    run(() =>
      apiRequest(`/leagues/pairings/${pairingId}/sheet/events`, {
        method: "POST",
        body: JSON.stringify({
          kind,
          team,
          actorPlayerId: actorPlayerId.trim() || undefined,
          targetPlayerId: targetPlayerId.trim() || undefined,
          injurySeverity: injurySeverity || undefined,
        }),
      }),
    );

  const removeEvent = (eventId: string) =>
    run(() =>
      apiRequest(
        `/leagues/pairings/${pairingId}/sheet/events/${eventId}`,
        { method: "DELETE" },
      ),
    );

  const submit = () =>
    run(() =>
      apiRequest(`/leagues/pairings/${pairingId}/sheet/submit`, {
        method: "POST",
      }),
    );
  const unsubmit = () =>
    run(() =>
      apiRequest(`/leagues/pairings/${pairingId}/sheet/unsubmit`, {
        method: "POST",
      }),
    );
  const validate = () =>
    run(() =>
      apiRequest(`/leagues/pairings/${pairingId}/sheet/validate`, {
        method: "POST",
      }),
    );

  const events = useMemo(() => data?.sheet.events ?? [], [data]);
  const role = data?.viewerRole ?? "none";
  const status = data?.sheet.status ?? "";
  const isCoach = role === "home" || role === "away";
  const isCommissioner = role === "commissioner";
  const editable = status !== "validated";

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p>Chargement de la feuille...</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-3 text-2xl font-bold">Feuille de match</h1>
        <p className="mb-4 text-slate-600">
          Aucune feuille ouverte pour ce match.
        </p>
        {error && (
          <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="button"
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          onClick={createSheet}
          disabled={busy}
          data-testid="open-sheet"
        >
          Ouvrir la feuille
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6" data-testid="match-sheet">
      <h1 className="mb-1 text-2xl font-bold">Feuille de match</h1>
      <p className="mb-4 text-sm text-slate-600">
        Statut : <strong data-testid="sheet-status">{status}</strong> · vous
        etes <strong>{role}</strong>
      </p>

      {error && (
        <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Score derive */}
      <section className="mb-4 rounded border bg-slate-50 p-4">
        <h2 className="mb-2 font-semibold">Score (calcule)</h2>
        <p className="text-2xl font-bold" data-testid="derived-score">
          {data.summary.scoreHome} – {data.summary.scoreAway}
        </p>
        <p className="text-xs text-slate-500">
          Sorties : {data.summary.casualtiesHome} / {data.summary.casualtiesAway}{" "}
          · Blesses : {data.summary.injuries.length}
        </p>
      </section>

      {/* Journal d'evenements */}
      <section className="mb-4">
        <h2 className="mb-2 font-semibold">Evenements</h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun evenement saisi.</p>
        ) : (
          <ul className="space-y-1" data-testid="events-list">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex items-center justify-between rounded border px-2 py-1 text-sm"
              >
                <span>
                  <strong>{ev.kind}</strong>
                  {ev.team ? ` (${ev.team})` : ""}
                  {ev.actorPlayerId ? ` — par ${ev.actorPlayerId}` : ""}
                  {ev.targetPlayerId ? ` → ${ev.targetPlayerId}` : ""}
                  {ev.injurySeverity ? ` [${ev.injurySeverity}]` : ""}
                </span>
                {editable && (isCoach || isCommissioner) && (
                  <button
                    type="button"
                    className="ml-2 text-xs text-red-600"
                    onClick={() => removeEvent(ev.id)}
                    disabled={busy}
                  >
                    retirer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Saisie d'un evenement */}
      {editable && (isCoach || isCommissioner) && (
        <section className="mb-4 rounded border p-3">
          <h3 className="mb-2 text-sm font-semibold">Ajouter un evenement</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              Type
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as EventKind)}
                className="block rounded border px-2 py-1"
                data-testid="event-kind"
              >
                {EVENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Equipe
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value as "home" | "away")}
                className="block rounded border px-2 py-1"
              >
                <option value="home">home</option>
                <option value="away">away</option>
              </select>
            </label>
            <label className="text-xs">
              Acteur (id)
              <input
                value={actorPlayerId}
                onChange={(e) => setActorPlayerId(e.target.value)}
                className="block w-28 rounded border px-2 py-1"
              />
            </label>
            <label className="text-xs">
              Cible (id)
              <input
                value={targetPlayerId}
                onChange={(e) => setTargetPlayerId(e.target.value)}
                className="block w-28 rounded border px-2 py-1"
              />
            </label>
            <label className="text-xs">
              Blessure
              <select
                value={injurySeverity}
                onChange={(e) => setInjurySeverity(e.target.value)}
                className="block rounded border px-2 py-1"
              >
                {INJURY_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s || "—"}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              onClick={addEvent}
              disabled={busy}
              data-testid="add-event"
            >
              Ajouter
            </button>
          </div>
        </section>
      )}

      {/* Actions de workflow */}
      <section className="flex flex-wrap gap-2">
        {isCoach && status !== "validated" && (
          <>
            <button
              type="button"
              className="rounded bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              onClick={submit}
              disabled={busy}
              data-testid="submit-sheet"
            >
              Valider ma saisie
            </button>
            <button
              type="button"
              className="rounded bg-slate-300 px-4 py-2 text-sm disabled:opacity-50"
              onClick={unsubmit}
              disabled={busy}
            >
              Retirer ma validation
            </button>
          </>
        )}
        {isCommissioner && status !== "validated" && (
          <button
            type="button"
            className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={validate}
            disabled={busy}
            data-testid="validate-sheet"
          >
            Valider le match (commissaire)
          </button>
        )}
        {status === "validated" && (
          <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
            Match valide ✓
          </p>
        )}
      </section>
    </main>
  );
}
