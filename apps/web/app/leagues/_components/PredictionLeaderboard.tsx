"use client";
import { useState } from "react";
import {
  GROUP_LABELS,
  type LeaderboardEntryView,
  type PredictionGroup,
  type SeasonPredictionLeaderboardView,
} from "./predictions";

/**
 * Classement des pronostics d'une saison, en DEUX onglets : Coachs (équipe
 * active, N-1 rencontres par journée) et Tribunes (tous les autres, N
 * rencontres). Une seule implémentation pour les deux : le serveur a déjà
 * rangé chaque pronostiqueur dans son groupe et calculé les rangs.
 */

interface PredictionLeaderboardProps {
  board: SeasonPredictionLeaderboardView;
  /** Onglet ouvert au départ — celui du lecteur quand il en a un. */
  initialTab?: PredictionGroup;
  /** Lignes montrées ; celle du lecteur s'ajoute si elle est plus bas. */
  limit?: number;
}

const TABS: readonly PredictionGroup[] = ["coach", "stands"];

function visibleRows(
  entries: readonly LeaderboardEntryView[],
  limit: number | undefined,
): { rows: readonly LeaderboardEntryView[]; viewerBelow: LeaderboardEntryView | null } {
  if (limit === undefined || entries.length <= limit) {
    return { rows: entries, viewerBelow: null };
  }
  const rows = entries.slice(0, limit);
  const viewer = entries.find((e) => e.isViewer) ?? null;
  return {
    rows,
    viewerBelow: viewer && !rows.includes(viewer) ? viewer : null,
  };
}

function Row({ entry }: { entry: LeaderboardEntryView }) {
  return (
    <tr
      data-testid={`prediction-board-row-${entry.userId}`}
      className={entry.isViewer ? "bg-nuffle-gold/10 font-medium" : undefined}
    >
      <td className="py-1 pr-2 text-gray-500">{entry.rank}</td>
      <td className="py-1 pr-2">{entry.displayName}</td>
      <td className="py-1 pr-2 text-right font-semibold">{entry.points}</td>
      <td className="py-1 pr-2 text-right">
        {entry.correct}/{entry.settled}
      </td>
      <td className="py-1 text-right">{entry.exact}</td>
    </tr>
  );
}

export function PredictionLeaderboard({
  board,
  initialTab = "coach",
  limit,
}: PredictionLeaderboardProps) {
  const [tab, setTab] = useState<PredictionGroup>(initialTab);
  const entries = tab === "coach" ? board.coach : board.stands;
  const { rows, viewerBelow } = visibleRows(entries, limit);

  return (
    <div data-testid="prediction-board" className="space-y-2">
      <div role="tablist" className="flex gap-2">
        {TABS.map((group) => {
          const count = (group === "coach" ? board.coach : board.stands).length;
          const active = group === tab;
          return (
            <button
              key={group}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`prediction-board-tab-${group}`}
              onClick={() => setTab(group)}
              className={`px-3 py-1 rounded-md text-sm border ${
                active
                  ? "border-nuffle-gold bg-nuffle-gold/15 font-medium"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
            >
              {GROUP_LABELS[group]} ({count})
            </button>
          );
        })}
      </div>
      {entries.length === 0 ? (
        <p
          data-testid={`prediction-board-empty-${tab}`}
          className="text-sm text-gray-500"
        >
          Aucun pronostic réglé pour l&apos;instant.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 text-left">
              <th className="font-normal pr-2">#</th>
              <th className="font-normal pr-2">Pronostiqueur</th>
              <th className="font-normal pr-2 text-right">Pts</th>
              <th className="font-normal pr-2 text-right" title="Bons résultats / pronostics réglés">
                Justes
              </th>
              <th className="font-normal text-right" title="Scores exacts">
                Exacts
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <Row key={entry.userId} entry={entry} />
            ))}
            {viewerBelow ? (
              <>
                <tr aria-hidden>
                  <td colSpan={5} className="text-center text-gray-400">
                    …
                  </td>
                </tr>
                <Row entry={viewerBelow} />
              </>
            ) : null}
          </tbody>
        </table>
      )}
    </div>
  );
}
