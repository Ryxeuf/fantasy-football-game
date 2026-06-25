"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest, ApiClientError } from "../../../../lib/api-client";
import {
  PreMatchPanel,
  PostMatchPanel,
  PlayerSelect,
  InvalidateControl,
  type PreMatchValues,
  type PostMatchValues,
  type SheetTeam,
  type Inducement,
  type CostlyError,
  type Purchase,
  type SppBonusEntry,
} from "./_components/MatchSheetPanels";

// Feuille de match v2 (ligue physique) — saisie mobile-first.
// Sections RÉSUMÉ / AVANT-MATCH / AU COURS DU MATCH / FIN DU MATCH.
// Le score et les blessés sont dérivés des events côté serveur. Le flux :
// les 2 coachs valident leur saisie -> notif commissaire -> validation
// (applique classement + trésorerie + SPP + progression).

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

const EVENT_KINDS: ReadonlyArray<{ value: EventKind; label: string }> = [
  { value: "kickoff", label: "Coup d'envoi" },
  { value: "touchdown", label: "Touchdown" },
  { value: "casualty", label: "Blessure" },
  { value: "pass_complete", label: "Passe réussie" },
  { value: "interception", label: "Interception" },
  { value: "aggression", label: "Agression" },
  { value: "expulsion", label: "Expulsion" },
  { value: "crowd_surge", label: "Sortie (foule)" },
  { value: "stalling", label: "Temporisation" },
  { value: "other_elim", label: "Autre élimination" },
];

const INJURY_SEVERITIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "badly_hurt", label: "Sonné" },
  { value: "mng", label: "Manque le prochain match" },
  { value: "niggling", label: "Séquelle" },
  { value: "stat_loss", label: "Perte de caractéristique" },
  { value: "dead", label: "Mort" },
];

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
    weatherTable?: string | null;
    weather?: string | null;
    forfeitSide?: "home" | "away" | null;
    popularityHome?: number | null;
    popularityAway?: number | null;
    winningsHomeManual?: number | null;
    winningsAwayManual?: number | null;
    dedicatedFansDeltaHome?: number | null;
    dedicatedFansDeltaAway?: number | null;
    rankingBonusHome?: number | null;
    rankingBonusAway?: number | null;
    sppBonus?: unknown;
    motmPlayerIds?: string[] | string | null;
    inducementsHome?: unknown;
    inducementsAway?: unknown;
    costlyErrorsHome?: unknown;
    costlyErrorsAway?: unknown;
    purchasesHome?: unknown;
    purchasesAway?: unknown;
  };
  summary: Summary;
  viewerRole: "home" | "away" | "commissioner" | "none";
  teams: { home: SheetTeam | null; away: SheetTeam | null };
}

function parseArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? (p as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseInducements(raw: unknown): Inducement[] {
  return parseArray<Record<string, unknown>>(raw).map((i) => ({
    name: typeof i.name === "string" ? i.name : "",
    cost: typeof i.cost === "number" ? i.cost : 0,
    qty: typeof i.qty === "number" && i.qty > 0 ? i.qty : 1,
  }));
}

function parseCostlyErrors(raw: unknown): CostlyError[] {
  return parseArray<Record<string, unknown>>(raw).map((i) => ({
    cost: typeof i.cost === "number" ? i.cost : 0,
    reason: typeof i.reason === "string" ? i.reason : "",
  }));
}

function parsePurchases(raw: unknown): Purchase[] {
  return parseArray<Record<string, unknown>>(raw).map((i) => ({
    kind:
      i.kind === "reroll" || i.kind === "staff" || i.kind === "other"
        ? i.kind
        : "player",
    name: typeof i.name === "string" ? i.name : "",
    cost: typeof i.cost === "number" ? i.cost : 0,
    position: typeof i.position === "string" ? i.position : undefined,
    staff:
      i.staff === "assistant" ||
      i.staff === "cheerleader" ||
      i.staff === "apothecary" ||
      i.staff === "dedicated_fan"
        ? i.staff
        : undefined,
  }));
}

function parseSppBonus(raw: unknown): SppBonusEntry[] {
  return parseArray<Record<string, unknown>>(raw)
    .map((i) => ({
      playerId: typeof i.playerId === "string" ? i.playerId : "",
      spp: typeof i.spp === "number" ? i.spp : 0,
    }))
    .filter((b) => b.playerId);
}

function parseMotm(raw: string[] | string | null | undefined): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  submitted_home: "Validé par le domicile",
  submitted_away: "Validé par l'extérieur",
  both_submitted: "Validé par les 2 joueurs — en attente du commissaire",
  validated: "Validé par le commissaire ✓",
  invalidated: "Invalidé",
};

function playerName(team: SheetTeam | null, id: string | null): string {
  if (!id) return "";
  const p = team?.players.find((pl) => pl.id === id);
  return p ? `N°${p.number} ${p.name}` : id;
}

export default function MatchSheetPage() {
  const params = useParams<{ id: string }>();
  const pairingId = params?.id ?? "";

  const [data, setData] = useState<SheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Formulaire d'ajout d'event.
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
          actorPlayerId: actorPlayerId || undefined,
          targetPlayerId: targetPlayerId || undefined,
          injurySeverity: injurySeverity || undefined,
        }),
      }),
    ).then(() => {
      setActorPlayerId("");
      setTargetPlayerId("");
      setInjurySeverity("");
    });

  const removeEvent = (eventId: string) =>
    run(() =>
      apiRequest(`/leagues/pairings/${pairingId}/sheet/events/${eventId}`, {
        method: "DELETE",
      }),
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

  const savePreMatch = (v: PreMatchValues) =>
    run(() =>
      apiRequest(`/leagues/pairings/${pairingId}/sheet/pre-match`, {
        method: "PATCH",
        body: JSON.stringify({
          weatherTable: v.weatherTable || null,
          weather: v.weather || null,
          forfeitSide: v.forfeitSide,
          popularityHome: v.popularityHome,
          popularityAway: v.popularityAway,
          inducementsHome: v.inducementsHome,
          inducementsAway: v.inducementsAway,
        }),
      }),
    );

  const savePostMatch = (v: PostMatchValues) =>
    run(() =>
      apiRequest(`/leagues/pairings/${pairingId}/sheet/post-match`, {
        method: "PATCH",
        body: JSON.stringify({
          winningsHomeManual: v.winningsHomeManual,
          winningsAwayManual: v.winningsAwayManual,
          dedicatedFansDeltaHome: v.dedicatedFansDeltaHome,
          dedicatedFansDeltaAway: v.dedicatedFansDeltaAway,
          rankingBonusHome: v.rankingBonusHome,
          rankingBonusAway: v.rankingBonusAway,
          sppBonus: v.sppBonus,
          motmPlayerIds: v.motmPlayerIds,
          costlyErrorsHome: v.costlyErrorsHome,
          costlyErrorsAway: v.costlyErrorsAway,
          purchasesHome: v.purchasesHome,
          purchasesAway: v.purchasesAway,
        }),
      }),
    );

  const invalidate = (reason: string) =>
    run(() =>
      apiRequest(`/leagues/pairings/${pairingId}/sheet/invalidate`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || undefined }),
      }),
    );

  const [canInval, setCanInval] = useState<{ ok: boolean; reason?: string }>({
    ok: false,
  });
  useEffect(() => {
    if (
      data?.sheet.status !== "validated" ||
      data?.viewerRole !== "commissioner"
    ) {
      return;
    }
    let cancelled = false;
    void apiRequest<{ ok: boolean; reason?: string }>(
      `/leagues/pairings/${pairingId}/sheet/can-invalidate`,
    )
      .then((r) => {
        if (!cancelled) setCanInval(r);
      })
      .catch(() => {
        if (!cancelled) setCanInval({ ok: false });
      });
    return () => {
      cancelled = true;
    };
  }, [data?.sheet.status, data?.viewerRole, pairingId]);

  const events = useMemo(() => data?.sheet.events ?? [], [data]);
  const home = data?.teams.home ?? null;
  const away = data?.teams.away ?? null;
  const eventTeam = team === "home" ? home : away;
  const role = data?.viewerRole ?? "none";
  const myTeamId =
    role === "home" ? home?.teamId : role === "away" ? away?.teamId : null;
  const status = data?.sheet.status ?? "";
  const isCoach = role === "home" || role === "away";
  const isCommissioner = role === "commissioner";
  const editable = status !== "validated";
  const canEdit = editable && (isCoach || isCommissioner);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <p>Chargement de la feuille…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl p-4">
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
    <main className="mx-auto max-w-3xl space-y-4 p-4" data-testid="match-sheet">
      {/* RÉSUMÉ */}
      <section className="rounded-lg border bg-white p-4">
        <h1 className="mb-2 text-sm font-bold uppercase tracking-wide text-nuffle-bronze">
          Résumé du match
        </h1>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 text-right">
            <div className="truncate font-semibold text-nuffle-anthracite">
              {home?.name ?? "Domicile"}
            </div>
            <div className="truncate text-xs text-slate-500">
              {home?.roster ?? ""}
            </div>
          </div>
          <div
            className="rounded bg-nuffle-anthracite px-3 py-1.5 text-lg font-bold text-white"
            data-testid="derived-score"
          >
            {data.summary.scoreHome} – {data.summary.scoreAway}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-nuffle-anthracite">
              {away?.name ?? "Extérieur"}
            </div>
            <div className="truncate text-xs text-slate-500">
              {away?.roster ?? ""}
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          Sorties : {data.summary.casualtiesHome} / {data.summary.casualtiesAway}{" "}
          · Statut :{" "}
          <strong data-testid="sheet-status">
            {STATUS_LABELS[status] ?? status}
          </strong>
        </p>
      </section>

      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}

      {/* AVANT-MATCH */}
      {(isCoach || isCommissioner) && (
        <PreMatchPanel
          initial={{
            weatherTable: data.sheet.weatherTable ?? "",
            weather: data.sheet.weather ?? "",
            forfeitSide: data.sheet.forfeitSide ?? null,
            popularityHome: data.sheet.popularityHome ?? null,
            popularityAway: data.sheet.popularityAway ?? null,
            inducementsHome: parseInducements(data.sheet.inducementsHome),
            inducementsAway: parseInducements(data.sheet.inducementsAway),
          }}
          homeName={home?.name ?? "Domicile"}
          awayName={away?.name ?? "Extérieur"}
          disabled={!editable}
          onSave={savePreMatch}
        />
      )}

      {/* AU COURS DU MATCH */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-nuffle-bronze">
          Au cours du match
        </h2>

        {events.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun évènement saisi.</p>
        ) : (
          <ul className="space-y-1" data-testid="events-list">
            {events.map((ev) => {
              const evTeam = ev.team === "home" ? home : away;
              const kindLabel =
                EVENT_KINDS.find((k) => k.value === ev.kind)?.label ?? ev.kind;
              return (
                <li
                  key={ev.id}
                  className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-sm"
                >
                  <span className="min-w-0">
                    <strong>{kindLabel}</strong>
                    {ev.team ? ` · ${evTeam?.name ?? ev.team}` : ""}
                    {ev.actorPlayerId
                      ? ` — ${playerName(evTeam, ev.actorPlayerId)}`
                      : ""}
                    {ev.targetPlayerId
                      ? ` → ${playerName(
                          ev.team === "home" ? away : home,
                          ev.targetPlayerId,
                        )}`
                      : ""}
                    {ev.injurySeverity ? ` [${ev.injurySeverity}]` : ""}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      className="shrink-0 text-xs text-red-600"
                      onClick={() => removeEvent(ev.id)}
                      disabled={busy}
                    >
                      retirer
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canEdit && (
          <div className="mt-3 space-y-2 rounded border bg-slate-50/60 p-3">
            <h3 className="text-xs font-semibold text-slate-600">
              Ajouter un évènement
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-xs">
                Type
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as EventKind)}
                  data-testid="event-kind"
                  className="mt-1 block w-full rounded border px-2 py-2 text-sm"
                >
                  {EVENT_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Équipe
                <select
                  value={team}
                  onChange={(e) => {
                    setTeam(e.target.value as "home" | "away");
                    setActorPlayerId("");
                    setTargetPlayerId("");
                  }}
                  className="mt-1 block w-full rounded border px-2 py-2 text-sm"
                >
                  <option value="home">{home?.name ?? "Domicile"}</option>
                  <option value="away">{away?.name ?? "Extérieur"}</option>
                </select>
              </label>
              <label className="text-xs">
                Acteur
                <PlayerSelect
                  team={eventTeam}
                  value={actorPlayerId}
                  onChange={setActorPlayerId}
                  testId="event-actor"
                />
              </label>
              <label className="text-xs">
                Cible (équipe adverse)
                <PlayerSelect
                  team={team === "home" ? away : home}
                  value={targetPlayerId}
                  onChange={setTargetPlayerId}
                  testId="event-target"
                />
              </label>
              {(kind === "casualty" || kind === "other_elim") && (
                <label className="text-xs">
                  Gravité de la blessure
                  <select
                    value={injurySeverity}
                    onChange={(e) => setInjurySeverity(e.target.value)}
                    className="mt-1 block w-full rounded border px-2 py-2 text-sm"
                  >
                    {INJURY_SEVERITIES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              onClick={addEvent}
              disabled={busy}
              data-testid="add-event"
            >
              Ajouter l&apos;évènement
            </button>
          </div>
        )}

        {data.summary.injuries.length > 0 && (
          <div className="mt-3 text-xs text-slate-600">
            <div className="mb-1 font-semibold">Blessures</div>
            <ul className="space-y-0.5">
              {data.summary.injuries.map((inj, i) => (
                <li key={i}>
                  {playerName(
                    inj.side === "home" ? home : away,
                    inj.playerId,
                  )}{" "}
                  — {inj.severity}
                  {inj.cause ? ` (${inj.cause})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* FIN DU MATCH */}
      {(isCoach || isCommissioner) && (
        <PostMatchPanel
          initial={{
            winningsHomeManual: data.sheet.winningsHomeManual ?? null,
            winningsAwayManual: data.sheet.winningsAwayManual ?? null,
            dedicatedFansDeltaHome: data.sheet.dedicatedFansDeltaHome ?? 0,
            dedicatedFansDeltaAway: data.sheet.dedicatedFansDeltaAway ?? 0,
            rankingBonusHome: data.sheet.rankingBonusHome ?? null,
            rankingBonusAway: data.sheet.rankingBonusAway ?? null,
            sppBonus: parseSppBonus(data.sheet.sppBonus),
            motmPlayerIds: parseMotm(data.sheet.motmPlayerIds),
            costlyErrorsHome: parseCostlyErrors(data.sheet.costlyErrorsHome),
            costlyErrorsAway: parseCostlyErrors(data.sheet.costlyErrorsAway),
            purchasesHome: parsePurchases(data.sheet.purchasesHome),
            purchasesAway: parsePurchases(data.sheet.purchasesAway),
          }}
          home={home}
          away={away}
          disabled={!editable}
          onSave={savePostMatch}
        />
      )}

      {/* Actions de workflow */}
      <section className="flex flex-wrap gap-2">
        {isCoach && status !== "validated" && (
          <>
            <button
              type="button"
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
              data-testid="unsubmit-sheet"
            >
              Reprendre la saisie
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
              Match validé ✓ — classement et équipes mis à jour.
            </p>
            {myTeamId && (
              <a
                href={`/me/teams/${myTeamId}/level-up`}
                data-testid="goto-progressions"
                className="rounded border border-nuffle-gold px-3 py-2 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/10"
              >
                Progressions de mon équipe →
              </a>
            )}
          </div>
        )}
      </section>

      {/* Invalidation post-validation (commissaire). */}
      {isCommissioner && status === "validated" && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-3">
          <h2 className="mb-2 text-sm font-semibold">Corriger ce match</h2>
          <InvalidateControl
            canInvalidate={canInval.ok}
            reasonClosed={canInval.reason}
            onInvalidate={invalidate}
          />
        </section>
      )}
    </main>
  );
}
