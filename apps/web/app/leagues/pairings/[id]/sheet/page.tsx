"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest, ApiClientError } from "../../../../lib/api-client";
import { AdvancementEditor } from "../../../../components/AdvancementEditor";
import { KICKOFF_EVENTS } from "@bb/game-engine";
import {
  PreMatchPanel,
  PostMatchPanel,
  PlayerSelect,
  InvalidateControl,
  TeamIdentityBadges,
  TeamValueStrip,
  type PreMatchValues,
  type PostMatchValues,
  type SheetTeam,
  type Inducement,
  type CostlyError,
  type Purchase,
  type SppBonusEntry,
  type MatchSheetReference,
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
  | "team_throw"
  | "other_elim";

const EVENT_KINDS: ReadonlyArray<{ value: EventKind; label: string }> = [
  { value: "kickoff", label: "Coup d'envoi" },
  { value: "touchdown", label: "Touchdown" },
  { value: "casualty", label: "Élimination sur Blocage" },
  { value: "pass_complete", label: "Passe réussie" },
  { value: "interception", label: "Interception" },
  { value: "aggression", label: "Agression" },
  { value: "expulsion", label: "Expulsion" },
  { value: "crowd_surge", label: "Sortie (Public)" },
  { value: "stalling", label: "Temporisation" },
  { value: "team_throw", label: "Lancer de coéquipier" },
  { value: "other_elim", label: "Autre élimination" },
];

// A58 — libellés officiels du livre de règles (les valeurs internes
// badly_hurt/mng/niggling/stat_loss/dead restent inchangées côté API).
const INJURY_SEVERITIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "badly_hurt", label: "Commotion" },
  { value: "mng", label: "Amoché" },
  { value: "niggling", label: "Blessure Sérieuse" },
  { value: "stat_loss", label: "Séquelle" },
  { value: "dead", label: "Mort" },
];

// A62 — seuls ces types d'évènement portent une cible (joueur adverse
// touché). Pour les autres (TD, passe, interception, lancer de
// coéquipier, expulsion, temporisation, autre élimination), le champ
// Cible est masqué.
const TARGET_BEARING_KINDS: ReadonlySet<EventKind> = new Set([
  "casualty",
  "aggression",
  "crowd_surge",
]);

// A59/A61 — types pouvant porter une blessure : élimination sur blocage,
// agression, sortie public, autre élimination.
const INJURY_BEARING_KINDS: ReadonlySet<EventKind> = new Set([
  "casualty",
  "aggression",
  "crowd_surge",
  "other_elim",
]);

// A68 — caractéristique affectée par une Séquelle (stat_loss). Codes
// internes ma/st/ag/pa/av, abréviations FR affichées.
const INJURY_STAT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "ma", label: "M (Mouvement)" },
  { value: "st", label: "F (Force)" },
  { value: "ag", label: "AG (Agilité)" },
  { value: "pa", label: "CP (Capacité de Passe)" },
  { value: "av", label: "AR (Armure)" },
];

// A56 — résultats de la table de coup d'envoi (2D6), source game-engine.
const KICKOFF_EVENT_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  Object.entries(KICKOFF_EVENTS).map(([roll, ev]) => ({
    value: ev.id,
    label: `${roll} — ${ev.nameFr}`,
  }));

function kickoffEventLabel(id: string): string {
  const found = Object.values(KICKOFF_EVENTS).find((ev) => ev.id === id);
  return found?.nameFr ?? id;
}

// A60 — jamais d'enum brut (anglais) dans la timeline : tout passe par
// les tables de libellés FR ci-dessus.
function injurySeverityLabel(value: string): string {
  return INJURY_SEVERITIES.find((s) => s.value === value)?.label ?? value;
}

function injuryStatLabel(value: string): string {
  return (
    INJURY_STAT_OPTIONS.find((s) => s.value === value)?.label.split(" ")[0] ??
    value
  );
}

function eventCauseLabel(value: string): string {
  return EVENT_KINDS.find((k) => k.value === value)?.label ?? value;
}

interface MatchEvent {
  id: string;
  kind: EventKind;
  team: "home" | "away" | null;
  actorPlayerId: string | null;
  targetPlayerId: string | null;
  causeDetail: string | null;
  injurySeverity: string | null;
  meta?: {
    half?: number;
    turn?: number;
    stat?: string;
    kickoffEvent?: string;
  } | null;
}

/**
 * Trie les évènements de manière chronologique : mi-temps puis tour, en
 * conservant l'ordre de saisie initial comme départage stable. Pur,
 * exporté pour test. Renvoie chaque évènement accompagné de son `meta`
 * résolu une seule fois.
 */
export function chronologicalTimeline<
  T extends { meta?: { half?: number; turn?: number } | null },
>(events: readonly T[]): Array<{ ev: T; m: { half?: number; turn?: number } }> {
  const items = events.map((ev, i) => ({ ev, i, m: parseEventMeta(ev.meta) }));
  items.sort((a, b) => {
    const ha = a.m.half ?? 1;
    const hb = b.m.half ?? 1;
    if (ha !== hb) return ha - hb;
    const ta = a.m.turn ?? 0;
    const tb = b.m.turn ?? 0;
    if (ta !== tb) return ta - tb;
    return a.i - b.i;
  });
  return items.map(({ ev, m }) => ({ ev, m }));
}

/** Lit half/turn depuis le meta (tolérant : objet natif ou string JSON). */
function parseEventMeta(raw: unknown): { half?: number; turn?: number } {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== "object") return {};
  const o = obj as Record<string, unknown>;
  const half = typeof o.half === "number" ? o.half : undefined;
  const turn = typeof o.turn === "number" ? o.turn : undefined;
  return { half, turn };
}

interface InjuredPlayer {
  playerId: string;
  severity: string;
  side: "home" | "away";
  cause: string | null;
}

interface PlayerStatLine {
  playerId: string;
  side: "home" | "away";
  touchdowns: number;
  casualtiesInflicted: number;
  completions: number;
  interceptions: number;
}

interface Summary {
  scoreHome: number;
  scoreAway: number;
  casualtiesHome: number;
  casualtiesAway: number;
  injuries: InjuredPlayer[];
  playerStats: PlayerStatLine[];
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
    winningsHome?: number | null;
    winningsAway?: number | null;
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
    firedPlayerIds?: unknown;
  };
  summary: Summary;
  viewerRole: "home" | "away" | "commissioner" | "none";
  /**
   * Équipe du viewer parmi les deux du match, indépendante de `viewerRole`.
   * Renseignée même pour un commissaire qui participe avec sa propre équipe.
   * Optionnel : rétro-compat avec un serveur pré-fix (repli sur `viewerRole`).
   */
  viewerTeamId?: string | null;
  teams: { home: SheetTeam | null; away: SheetTeam | null };
  reference: MatchSheetReference;
  computedSpp: Record<string, number>;
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
    slug: typeof i.slug === "string" ? i.slug : "other",
    name: typeof i.name === "string" ? i.name : "",
    cost: typeof i.cost === "number" ? i.cost : 0,
    qty: typeof i.qty === "number" && i.qty > 0 ? i.qty : 1,
    ...(typeof i.starPlayerSlug === "string"
      ? { starPlayerSlug: i.starPlayerSlug }
      : {}),
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
  // A68 — caractéristique affectée quand la gravité est « Séquelle ».
  const [injuryStat, setInjuryStat] = useState("");
  // A56 — résultat de la table de coup d'envoi (événement kickoff).
  const [kickoffEvent, setKickoffEvent] = useState("");
  const [eventHalf, setEventHalf] = useState<1 | 2>(1);
  const [eventTurn, setEventTurn] = useState<string>("");

  // Onglet actif : Avant-match / En cours / Fin de match / Évolutions.
  const [tab, setTab] = useState<
    "before" | "during" | "after" | "advancements"
  >("before");

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
          // A62 — pas de cible pour les évènements qui n'en portent pas.
          targetPlayerId: TARGET_BEARING_KINDS.has(kind)
            ? targetPlayerId || undefined
            : undefined,
          injurySeverity: INJURY_BEARING_KINDS.has(kind)
            ? injurySeverity || undefined
            : undefined,
          half: eventHalf,
          turn: eventTurn ? Number(eventTurn) : undefined,
          // A68 — la Séquelle porte la caractéristique affectée.
          // A56 — le coup d'envoi porte le résultat de la table 2D6.
          meta:
            injurySeverity === "stat_loss" && injuryStat
              ? { stat: injuryStat }
              : kind === "kickoff" && kickoffEvent
                ? { kickoffEvent }
                : undefined,
        }),
      }),
    ).then(() => {
      setActorPlayerId("");
      setTargetPlayerId("");
      setInjurySeverity("");
      setInjuryStat("");
      setKickoffEvent("");
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
          firedPlayerIds: v.firedPlayerIds,
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
  // Timeline chronologique : tri par mi-temps puis tour, en conservant
  // l'ordre de saisie (occurredAt) comme départage stable. Le meta est
  // résolu une seule fois ici.
  const timeline = useMemo(() => chronologicalTimeline(events), [events]);
  // FR — nb de joueurs tués dans ce match : invalider la feuille les
  // ressuscite (dead:false). On en avertit le commissaire avant de confirmer.
  const deadCount = useMemo(
    () => events.filter((e) => e.injurySeverity === "dead").length,
    [events],
  );
  // SPP autoritaire par joueur, calculé côté serveur (calcul officiel +
  // modificateur d'équipe). Informatif : appliqué au roster à la validation.
  const computedSpp = data?.computedSpp ?? {};
  const home = data?.teams.home ?? null;
  const away = data?.teams.away ?? null;
  const eventTeam = team === "home" ? home : away;
  const role = data?.viewerRole ?? "none";
  // `myTeamId` doit refléter l'équipe possédée par le viewer, y compris quand
  // il est commissaire ET participant (viewerRole="commissioner"). On lit
  // `viewerTeamId` (dérivé de l'ownerId côté serveur) ; repli role-based pour
  // rétro-compat avec un serveur pré-fix.
  const myTeamId =
    data?.viewerTeamId ??
    (role === "home" ? home?.teamId : role === "away" ? away?.teamId : null);
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-right">
            <div className="truncate font-semibold text-nuffle-anthracite">
              {home?.name ?? "Domicile"}
            </div>
            <span
              className="ml-auto mt-1 block h-1 w-12 rounded-full"
              style={{ backgroundColor: data.reference.colors.home.primary }}
            />
            <TeamIdentityBadges team={home} align="right" />
            <TeamValueStrip team={home} align="right" />
          </div>
          <div
            className="mt-1 shrink-0 rounded border-y-2 bg-nuffle-anthracite px-3 py-1.5 text-lg font-bold text-white"
            data-testid="derived-score"
            style={{
              borderTopColor: data.reference.colors.home.primary,
              borderBottomColor: data.reference.colors.away.primary,
            }}
          >
            {data.summary.scoreHome} – {data.summary.scoreAway}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-nuffle-anthracite">
              {away?.name ?? "Extérieur"}
            </div>
            <span
              className="mt-1 block h-1 w-12 rounded-full"
              style={{ backgroundColor: data.reference.colors.away.primary }}
            />
            <TeamIdentityBadges team={away} align="left" />
            <TeamValueStrip team={away} align="left" />
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

      {/* Navigation par phase (onglets). */}
      <nav
        role="tablist"
        aria-label="Phases du match"
        className="flex gap-1 rounded-lg border bg-white p-1"
      >
        {(
          [
            { id: "before", label: "Avant-match" },
            { id: "during", label: "En cours" },
            { id: "after", label: "Fin du match" },
            { id: "advancements", label: "Évolutions" },
          ] as const
        ).map((t) => {
          const activeTab = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab}
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-semibold transition ${
                activeTab
                  ? "bg-nuffle-anthracite text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
              {t.id === "during" && events.length > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                    activeTab
                      ? "bg-white/20 text-white"
                      : "bg-nuffle-anthracite/10 text-nuffle-anthracite"
                  }`}
                >
                  {events.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* AVANT-MATCH */}
      {tab === "before" &&
        ((isCoach || isCommissioner) ? (
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
          reference={data.reference}
        />
        ) : (
          <p className="rounded-lg border bg-white p-4 text-sm text-slate-500">
            L&apos;avant-match est réservé aux coachs et au commissaire.
          </p>
        ))}

      {/* AU COURS DU MATCH */}
      {tab === "during" && (
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-nuffle-bronze">
          Au cours du match
        </h2>

        {/* Bloc de saisie EN PREMIER : éviter de scroller toute la timeline. */}
        {canEdit && (
          <div className="space-y-2 rounded border bg-slate-50/60 p-3">
            <h3 className="text-xs font-semibold text-slate-600">
              Ajouter un évènement
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
              <label className="text-xs">
                Mi-temps
                <select
                  value={eventHalf}
                  onChange={(e) =>
                    setEventHalf(Number(e.target.value) === 2 ? 2 : 1)
                  }
                  data-testid="event-half"
                  className="mt-1 block w-full rounded border px-2 py-2 text-sm"
                >
                  <option value={1}>1re mi-temps</option>
                  <option value={2}>2e mi-temps</option>
                </select>
              </label>
              <label className="text-xs">
                Tour
                <select
                  value={eventTurn}
                  onChange={(e) => setEventTurn(e.target.value)}
                  data-testid="event-turn"
                  className="mt-1 block w-full rounded border px-2 py-2 text-sm"
                >
                  <option value="">—</option>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((t) => (
                    <option key={t} value={t}>
                      Tour {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Type
                <select
                  value={kind}
                  onChange={(e) => {
                    const next = e.target.value as EventKind;
                    setKind(next);
                    // A62 — purge les champs qui ne s'appliquent plus.
                    if (!TARGET_BEARING_KINDS.has(next)) setTargetPlayerId("");
                    if (!INJURY_BEARING_KINDS.has(next)) {
                      setInjurySeverity("");
                      setInjuryStat("");
                    }
                  }}
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
                {kind === "other_elim" ? "Joueur éliminé" : "Acteur"}
                <PlayerSelect
                  team={eventTeam}
                  value={actorPlayerId}
                  onChange={setActorPlayerId}
                  testId="event-actor"
                />
              </label>
              {/* A62 — cible uniquement pour les évènements qui en portent une. */}
              {TARGET_BEARING_KINDS.has(kind) && (
                <label className="text-xs">
                  {kind === "crowd_surge"
                    ? "Joueur sorti (équipe adverse)"
                    : "Cible (équipe adverse)"}
                  <PlayerSelect
                    team={team === "home" ? away : home}
                    value={targetPlayerId}
                    onChange={setTargetPlayerId}
                    testId="event-target"
                  />
                </label>
              )}
              {/* A56 — résultat de la table de coup d'envoi (2D6). */}
              {kind === "kickoff" && (
                <label className="text-xs">
                  Évènement de coup d'envoi
                  <select
                    value={kickoffEvent}
                    onChange={(e) => setKickoffEvent(e.target.value)}
                    data-testid="event-kickoff-event"
                    className="mt-1 block w-full rounded border px-2 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {KICKOFF_EVENT_OPTIONS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {/* A59/A61 — blessure saisissable aussi sur Sortie Public et Agression. */}
              {INJURY_BEARING_KINDS.has(kind) && (
                <label className="text-xs">
                  Gravité de la blessure
                  <select
                    value={injurySeverity}
                    onChange={(e) => {
                      setInjurySeverity(e.target.value);
                      if (e.target.value !== "stat_loss") setInjuryStat("");
                    }}
                    data-testid="event-injury-severity"
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
              {/* A68 — Séquelle : choisir la caractéristique affectée. */}
              {INJURY_BEARING_KINDS.has(kind) &&
                injurySeverity === "stat_loss" && (
                  <label className="text-xs">
                    Caractéristique affectée
                    <select
                      value={injuryStat}
                      onChange={(e) => setInjuryStat(e.target.value)}
                      data-testid="event-injury-stat"
                      className="mt-1 block w-full rounded border px-2 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {INJURY_STAT_OPTIONS.map((s) => (
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
              disabled={
                busy || (injurySeverity === "stat_loss" && !injuryStat)
              }
              data-testid="add-event"
            >
              Ajouter l&apos;évènement
            </button>
          </div>
        )}

        {/* Timeline chronologique (colorée par équipe). */}
        <div className={canEdit ? "mt-4" : ""}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Timeline
          </h3>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun évènement saisi.</p>
          ) : (
            <ol
              className="relative space-y-1 border-l-2 border-slate-200 pl-3"
              data-testid="events-list"
            >
              {timeline.map(({ ev, m }, idx) => {
                const evTeam = ev.team === "home" ? home : away;
                const kindLabel =
                  EVENT_KINDS.find((k) => k.value === ev.kind)?.label ??
                  ev.kind;
                const accent =
                  ev.team === "home"
                    ? data.reference.colors.home.primary
                    : ev.team === "away"
                      ? data.reference.colors.away.primary
                      : "#94a3b8";
                const prevHalf =
                  idx > 0 ? (timeline[idx - 1].m.half ?? 1) : null;
                const curHalf = m.half ?? 1;
                const showHalfDivider = curHalf !== prevHalf;
                return (
                  <li key={ev.id} className="space-y-1">
                    {showHalfDivider && (
                      <div className="-ml-3 flex items-center gap-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-nuffle-bronze">
                        <span className="h-2 w-2 rounded-full bg-nuffle-bronze" />
                        {curHalf === 2 ? "2e mi-temps" : "1re mi-temps"}
                      </div>
                    )}
                    <div
                      className="flex items-center justify-between gap-2 rounded border border-l-4 bg-white px-2 py-1.5 text-sm"
                      style={{ borderLeftColor: accent }}
                    >
                      <span className="min-w-0">
                        {m.turn ? (
                          <span
                            className="mr-1.5 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white"
                            style={{ backgroundColor: accent }}
                          >
                            T{m.turn}
                          </span>
                        ) : null}
                        <strong>{kindLabel}</strong>
                        {/* A56 — affiche le résultat du coup d'envoi. */}
                        {ev.kind === "kickoff" && ev.meta?.kickoffEvent
                          ? ` : ${kickoffEventLabel(ev.meta.kickoffEvent)}`
                          : ""}
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
                        {ev.injurySeverity
                          ? ` [${injurySeverityLabel(ev.injurySeverity)}${
                              ev.injurySeverity === "stat_loss" &&
                              ev.meta?.stat
                                ? ` ${injuryStatLabel(ev.meta.stat)}`
                                : ""
                            }]`
                          : ""}
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
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

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
                  — {injurySeverityLabel(inj.severity)}
                  {inj.cause ? ` (${eventCauseLabel(inj.cause)})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      )}

      {/* FIN DU MATCH */}
      {tab === "after" &&
        ((isCoach || isCommissioner) ? (
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
            firedPlayerIds: parseArray<unknown>(
              data.sheet.firedPlayerIds,
            ).filter((s): s is string => typeof s === "string"),
          }}
          home={home}
          away={away}
          disabled={!editable}
          onSave={savePostMatch}
          computedSpp={computedSpp}
          autoWinnings={{
            home: data.sheet.winningsHome ?? 0,
            away: data.sheet.winningsAway ?? 0,
          }}
        />
        ) : (
          <p className="rounded-lg border bg-white p-4 text-sm text-slate-500">
            La fin de match est réservée aux coachs et au commissaire.
          </p>
        ))}

      {/* ÉVOLUTIONS DES JOUEURS */}
      {tab === "advancements" && (
        <section
          className="space-y-3 rounded-lg border bg-white p-4"
          data-testid="advancements-panel"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-nuffle-bronze">
            Évolutions des joueurs
          </h2>

          {/* Règle de staging (item : appliqué seulement après validation). */}
          <div className="flex gap-2 rounded border-l-4 border-nuffle-gold bg-nuffle-gold/5 px-3 py-2 text-xs text-slate-700">
            <span aria-hidden>🛡️</span>
            <p>
              Les évolutions (montées de niveau, compétences, améliorations de
              caractéristique) ne sont <strong>jamais appliquées aux rosters
              avant la validation du match par le commissaire</strong>. Le SPP
              et les avancements en attente sont créés au moment de la
              validation.
            </p>
          </div>

          {status === "validated" ? (
            myTeamId ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Le match est validé : choisis et applique les évolutions des
                  joueurs de ton équipe ayant assez de SPP.
                </p>
                {/* Édition inline (composant partagé avec la page level-up). */}
                <AdvancementEditor
                  teamId={myTeamId}
                  emptyLabel="Aucun joueur de ton équipe n'a d'évolution en attente."
                />
                <a
                  href={`/me/teams/${myTeamId}/level-up`}
                  data-testid="goto-advancements"
                  className="inline-flex items-center gap-1 text-xs font-medium text-nuffle-bronze hover:text-nuffle-gold"
                >
                  Voir toutes les évolutions de mon équipe →
                </a>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Les évolutions concernent les coachs des deux équipes, sur la
                page de leur équipe.
              </p>
            )
          ) : (
            <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
              Disponible une fois le match validé par le commissaire.
            </p>
          )}
        </section>
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
            deadCount={deadCount}
            onInvalidate={invalidate}
          />
        </section>
      )}
    </main>
  );
}
