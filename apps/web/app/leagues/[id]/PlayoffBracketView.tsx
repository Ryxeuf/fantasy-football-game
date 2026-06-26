"use client";
/**
 * L2.C.3 — Sprint Ligues v2 PR8 : visualisation du bracket de playoffs.
 *
 * Lit `GET /league/seasons/:sid/playoff-bracket` et rend les rounds
 * (QF / SF / Final) en colonnes, chaque round comme une carte par
 * pairing avec les deux teams + status. Les pairings dont les deux
 * cotes pointent vers le meme participant sont consideres en
 * "TBD" (placeholder cree par advancePlayoffsWithWinner avant
 * l'arrivee du sibling winner).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";

interface BracketTeam {
  id: string;
  name: string;
  roster: string;
  owner: { id: string; coachName: string | null };
}

interface BracketParticipant {
  id: string;
  team: BracketTeam;
}

interface BracketPairing {
  id: string;
  status: string;
  homeParticipant: BracketParticipant;
  awayParticipant: BracketParticipant;
  match: { id: string; status: string } | null;
}

interface BracketRound {
  id: string;
  roundNumber: number;
  bracketSlot: string | null;
  status: string;
  pairings: BracketPairing[];
}

interface BracketResponse {
  seasonId: string;
  playoffSize: number;
  seasonStatus: string;
  rounds: BracketRound[];
}

/** Participant éligible au bracket (équipe active de la saison). */
export interface EligibleParticipant {
  id: string;
  name: string;
}

interface Props {
  seasonId: string;
  /** FR3 — affiche l'édition des participants du bracket (commissaire). */
  isCommissioner?: boolean;
  /** FR3 — participants actifs sélectionnables comme seeds. */
  eligibleParticipants?: EligibleParticipant[];
  /** Rappelé après un override réussi (pour rafraîchir la saison). */
  onChanged?: () => void;
}

/** Aplati les seeds courants du 1er tour du bracket (ordre home, away…). */
export function currentSeedsFromRounds(
  rounds: BracketRound[],
  size: number,
): string[] {
  const firstStage = size === 8 ? "qf" : size === 4 ? "sf" : "final";
  const stageRounds = rounds
    .filter((r) => (r.bracketSlot ?? "").startsWith(firstStage))
    .sort((a, b) => a.roundNumber - b.roundNumber);
  const seeds: string[] = [];
  for (const r of stageRounds) {
    const p = r.pairings[0];
    if (!p) continue;
    seeds.push(p.homeParticipant.id);
    // Évite de dupliquer un placeholder (home === away).
    if (p.awayParticipant.id !== p.homeParticipant.id) {
      seeds.push(p.awayParticipant.id);
    }
  }
  return seeds;
}

export function PlayoffBracketView({
  seasonId,
  isCommissioner = false,
  eligibleParticipants = [],
  onChanged,
}: Props) {
  const [data, setData] = useState<BracketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!seasonId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<BracketResponse>(
        `/leagues/seasons/${seasonId}/playoff-bracket`,
      );
      setData(res);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Erreur chargement bracket",
      );
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    load();
  }, [load]);

  // Group rounds by stage : QFs together, SFs together, Final.
  const stages = useMemo(() => {
    if (!data) return [];
    const buckets = new Map<string, BracketRound[]>();
    for (const round of data.rounds) {
      const slot = round.bracketSlot ?? "";
      const stage = slot.startsWith("qf")
        ? "qf"
        : slot.startsWith("sf")
          ? "sf"
          : slot === "final"
            ? "final"
            : "other";
      const bucket = buckets.get(stage) ?? [];
      bucket.push(round);
      buckets.set(stage, bucket);
    }
    const order = ["qf", "sf", "final"];
    return order
      .filter((stage) => buckets.has(stage))
      .map((stage) => ({
        stage,
        title: stageTitle(stage),
        rounds: (buckets.get(stage) ?? []).sort(
          (a, b) => a.roundNumber - b.roundNumber,
        ),
      }));
  }, [data]);

  if (loading) {
    return (
      <div data-testid="playoff-bracket-loading" className="text-sm text-gray-500">
        Chargement du bracket…
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="playoff-bracket-error"
        className="text-sm text-red-600"
      >
        Erreur : {error}
      </div>
    );
  }

  if (!data || data.rounds.length === 0) {
    // Pas encore de playoffs — soit pas configures (playoffSize=0),
    // soit la saison reguliere n'est pas terminee.
    return null;
  }

  // FR3 — édition possible tant qu'aucun match de playoff n'est lancé/joué.
  const canEditSeeds =
    isCommissioner &&
    data.rounds.length > 0 &&
    data.rounds.every((r) =>
      r.pairings.every((p) => p.status === "scheduled" && !p.match),
    );

  return (
    <section
      data-testid="playoff-bracket"
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
    >
      <h3 className="text-md font-semibold text-nuffle-anthracite">
        Bracket des playoffs
      </h3>
      {canEditSeeds ? (
        <PlayoffParticipantsEditor
          seasonId={seasonId}
          playoffSize={data.playoffSize}
          eligibleParticipants={eligibleParticipants}
          currentSeeds={currentSeedsFromRounds(data.rounds, data.playoffSize)}
          onSaved={() => {
            load();
            onChanged?.();
          }}
        />
      ) : null}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {stages.map((stage) => (
          <div
            key={stage.stage}
            data-testid={`playoff-stage-${stage.stage}`}
            className="flex-shrink-0 w-64 space-y-2"
          >
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              {stage.title}
            </h4>
            {stage.rounds.map((round) => (
              <RoundCard key={round.id} round={round} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

interface EditorProps {
  seasonId: string;
  playoffSize: number;
  eligibleParticipants: EligibleParticipant[];
  currentSeeds: string[];
  onSaved: () => void;
}

/**
 * FR3 — éditeur des participants du bracket. Le commissaire choisit, pour
 * chacun des `playoffSize` seeds, une équipe active de la saison. Le bracket
 * est régénéré côté serveur (`PATCH …/playoff-bracket/participants`).
 */
function PlayoffParticipantsEditor({
  seasonId,
  playoffSize,
  eligibleParticipants,
  currentSeeds,
  onSaved,
}: EditorProps) {
  const [open, setOpen] = useState(false);
  const [seeds, setSeeds] = useState<string[]>(() =>
    Array.from({ length: playoffSize }, (_, i) => currentSeeds[i] ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setSeeds(Array.from({ length: playoffSize }, (_, i) => currentSeeds[i] ?? ""));
    setError(null);
  }, [currentSeeds, playoffSize]);

  const filled = seeds.every((s) => s.length > 0);
  const unique = new Set(seeds).size === seeds.length;

  const submit = useCallback(async () => {
    if (!filled) {
      setError(`Sélectionnez ${playoffSize} équipes.`);
      return;
    }
    if (!unique) {
      setError("Une équipe est sélectionnée plusieurs fois.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest(
        `/leagues/seasons/${seasonId}/playoff-bracket/participants`,
        { method: "PATCH", body: JSON.stringify({ participantIds: seeds }) },
      );
      setOpen(false);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }, [filled, unique, playoffSize, seasonId, seeds, onSaved]);

  if (!open) {
    return (
      <button
        type="button"
        data-testid="playoff-edit-participants"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="self-start px-3 py-1.5 rounded-md bg-white border border-nuffle-gold text-nuffle-bronze text-sm font-medium hover:bg-nuffle-gold/10"
      >
        ✏️ Modifier les participants des playoffs
      </button>
    );
  }

  return (
    <div
      data-testid="playoff-participants-editor"
      className="border border-amber-200 bg-amber-50/40 rounded-md p-3 space-y-2"
    >
      <div className="text-sm font-medium text-amber-900">
        Participants des playoffs ({playoffSize} équipes, dans l'ordre des seeds)
      </div>
      {error ? (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {seeds.map((value, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm">
            <span className="w-12 shrink-0 text-xs text-gray-500">
              Seed {idx + 1}
            </span>
            <select
              data-testid={`playoff-seed-${idx}`}
              value={value}
              disabled={busy}
              onChange={(e) =>
                setSeeds((prev) => {
                  const next = [...prev];
                  next[idx] = e.target.value;
                  return next;
                })
              }
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="">— Choisir —</option>
              {eligibleParticipants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="playoff-save-participants"
          onClick={submit}
          disabled={busy || !filled}
          className="px-3 py-1.5 rounded-md bg-nuffle-gold text-white text-sm font-medium hover:bg-nuffle-gold/90 disabled:opacity-50"
        >
          Enregistrer le bracket
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function stageTitle(stage: string): string {
  switch (stage) {
    case "qf":
      return "Quarts";
    case "sf":
      return "Demi-finales";
    case "final":
      return "Finale";
    default:
      return stage;
  }
}

interface RoundCardProps {
  round: BracketRound;
}

function RoundCard({ round }: RoundCardProps) {
  const pairing = round.pairings[0];
  if (!pairing) {
    return (
      <div
        data-testid={`playoff-round-${round.id}`}
        className="border border-dashed border-gray-300 rounded-md p-2 bg-gray-50 text-xs text-gray-500"
      >
        En attente
      </div>
    );
  }
  const placeholder =
    pairing.homeParticipant.id === pairing.awayParticipant.id;
  const home = pairing.homeParticipant.team;
  const away = pairing.awayParticipant.team;
  return (
    <div
      data-testid={`playoff-round-${round.id}`}
      className={`border rounded-md p-2 text-sm space-y-1 ${
        placeholder
          ? "border-dashed border-gray-300 bg-gray-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-gray-500">
          {round.bracketSlot}
        </span>
        <PairingBadge status={pairing.status} />
      </div>
      <SideRow team={home} side="home" placeholder={placeholder} />
      <div className="text-center text-xs text-gray-400">vs</div>
      <SideRow team={away} side="away" placeholder={placeholder} />
      {pairing.match ? (
        <Link
          href={`/play/${pairing.match.id}`}
          data-testid={`playoff-pairing-match-${pairing.id}`}
          className="block text-center text-xs text-blue-600 hover:underline mt-1"
        >
          {pairing.status === "played" ? "Voir le match" : "Reprendre"}
        </Link>
      ) : null}
    </div>
  );
}

interface SideRowProps {
  team: BracketTeam;
  side: "home" | "away";
  placeholder: boolean;
}

function SideRow({ team, side, placeholder }: SideRowProps) {
  if (placeholder) {
    return (
      <div
        data-testid={`bracket-side-${side}`}
        className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-gray-100 text-gray-400 italic text-xs"
      >
        <span>TBD</span>
      </div>
    );
  }
  return (
    <div
      data-testid={`bracket-side-${side}`}
      className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-gray-50"
    >
      <div className="min-w-0 flex-1 truncate">
        <span className="font-medium text-nuffle-anthracite">{team.name}</span>
        <span className="text-xs text-gray-500 ml-1">
          ({team.owner.coachName ?? "Coach"})
        </span>
      </div>
    </div>
  );
}

interface PairingBadgeProps {
  status: string;
}

function PairingBadge({ status }: PairingBadgeProps) {
  const map: Record<string, { label: string; className: string }> = {
    scheduled: { label: "A jouer", className: "bg-gray-200 text-gray-700" },
    in_progress: {
      label: "En cours",
      className: "bg-amber-100 text-amber-800",
    },
    played: {
      label: "Joue",
      className: "bg-emerald-100 text-emerald-800",
    },
    forfeit_home: {
      label: "Forfait",
      className: "bg-red-100 text-red-800",
    },
    forfeit_away: {
      label: "Forfait",
      className: "bg-red-100 text-red-800",
    },
    cancelled: {
      label: "Annule",
      className: "bg-gray-100 text-gray-500",
    },
  };
  const entry = map[status] ?? { label: status, className: "bg-gray-100" };
  return (
    <span
      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${entry.className}`}
    >
      {entry.label}
    </span>
  );
}
