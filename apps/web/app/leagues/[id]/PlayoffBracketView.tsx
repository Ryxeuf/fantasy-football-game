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

interface Props {
  seasonId: string;
}

export function PlayoffBracketView({ seasonId }: Props) {
  const [data, setData] = useState<BracketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!seasonId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<BracketResponse>(
        `/league/seasons/${seasonId}/playoff-bracket`,
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

  return (
    <section
      data-testid="playoff-bracket"
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
    >
      <h3 className="text-md font-semibold text-nuffle-anthracite">
        Bracket des playoffs
      </h3>
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
