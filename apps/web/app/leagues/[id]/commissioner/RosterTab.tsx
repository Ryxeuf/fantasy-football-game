"use client";

/**
 * Onglet « Effectif » : barre d'outils (recherche + filtre de statut) et
 * liste des joueurs. Sans recherche, un roster de 16 joueurs obligeait le
 * commissaire a scruter la page pour retrouver celui a corriger.
 */

import { useMemo, useState } from "react";
import { PlayerRow } from "./PlayerRow";
import { filterPlayers, type RosterFilter } from "./roster-helpers";
import type { EditPlayer, PositionAccess, SkillCatalogItem } from "./types";

const FILTERS: ReadonlyArray<{ key: RosterFilter; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "alive", label: "Actifs" },
  { key: "dead", label: "Morts" },
];

interface Props {
  leagueId: string;
  teamId: string;
  players: readonly EditPlayer[];
  accessByPosition: Record<string, PositionAccess>;
  catalog: readonly SkillCatalogItem[];
  busy: boolean;
  canRemovePlayers: boolean;
  run: <T>(call: () => Promise<T>, successMessage: string) => Promise<T | null>;
}

export function RosterTab({
  leagueId,
  teamId,
  players,
  accessByPosition,
  catalog,
  busy,
  canRemovePlayers,
  run,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RosterFilter>("all");

  const positionLabel = useMemo(
    () => (slug: string) => accessByPosition[slug]?.displayName ?? slug,
    [accessByPosition],
  );
  const skillName = useMemo(() => {
    const bySlug = new Map(catalog.map((c) => [c.slug, c.nameFr]));
    return (slug: string) => bySlug.get(slug) ?? slug;
  }, [catalog]);

  const visible = useMemo(
    () => filterPlayers(players, filter, query, positionLabel),
    [players, filter, query, positionLabel],
  );
  const deadCount = players.filter((p) => p.dead).length;

  return (
    <div className="space-y-2">
      <div
        data-testid="roster-toolbar"
        className="flex flex-wrap items-center gap-2 sticky top-0 z-10 bg-white/95 backdrop-blur py-1"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un joueur, un numéro, un poste…"
          aria-label="Rechercher un joueur"
          data-testid="roster-search"
          className="flex-1 min-w-[12rem] border border-gray-300 rounded px-2 py-1 text-sm"
        />
        <div className="inline-flex rounded border border-gray-300 overflow-hidden text-xs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              data-testid={`roster-filter-${f.key}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2 py-1 ${
                filter === f.key
                  ? "bg-nuffle-anthracite text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
              {f.key === "dead" && deadCount > 0 ? ` (${deadCount})` : null}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500" data-testid="roster-count">
          {visible.length} / {players.length} joueurs
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          Aucun joueur ne correspond à cette recherche.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((p) => (
            <PlayerRow
              key={p.id}
              leagueId={leagueId}
              teamId={teamId}
              player={p}
              busy={busy}
              canRemove={canRemovePlayers || p.dead}
              access={accessByPosition[p.position]}
              catalog={catalog}
              skillName={skillName}
              run={run}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
