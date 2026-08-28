"use client";

/**
 * Édition de la LISTE DES POSITIONS d'une équipe par un admin.
 *
 * Deux colonnes : les postes du roster (avec compteur `n/max` et coût) d'un
 * côté, la composition courante de l'autre. Tout se travaille en brouillon
 * local puis part en un seul `PUT /team/:id/roster` — l'endpoint applique
 * l'état cible complet (ajout, retrait, renommage) dans une transaction, ce
 * qui évite les états intermédiaires invalides d'une suite d'appels unitaires.
 *
 * Les joueurs morts ou licenciés sont affichés VERROUILLÉS : ils ne font plus
 * partie du roster actif, et les retirer du payload les supprimerait de
 * l'historique de l'équipe.
 */

import { useMemo } from "react";

import {
  addPlayer,
  removePlayer,
  updatePlayer,
  validateDraft,
  type AvailablePosition,
  type DraftPlayer,
} from "./roster-positions";

interface PositionsEditorProps {
  readonly positions: readonly AvailablePosition[];
  readonly players: readonly DraftPlayer[];
  readonly onChange: (players: DraftPlayer[]) => void;
  readonly maxPlayers: number;
  readonly disabled?: boolean;
}

/** Coût d'un poste en po (l'API sert des kpo pour les postes du roster). */
function positionCostPo(position: AvailablePosition): number {
  return position.cost * 1000;
}

export default function PositionsEditor({
  positions,
  players,
  onChange,
  maxPlayers,
  disabled = false,
}: PositionsEditorProps) {
  // Les compteurs de l'API décrivent l'état PERSISTÉ : recompter sur le
  // brouillon, sinon le « n/max » ment dès le premier ajout non enregistré.
  const countByPosition = useMemo(() => {
    const counts = new Map<string, number>();
    for (const player of players) {
      counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
    }
    return counts;
  }, [players]);

  const errors = useMemo(() => validateDraft(players), [players]);
  const sorted = useMemo(
    () => [...players].sort((a, b) => a.number - b.number),
    [players],
  );
  const positionNames = useMemo(
    () => new Map(positions.map((p) => [p.key, p.name])),
    [positions],
  );

  const totalCostPo = useMemo(() => {
    const costByKey = new Map(
      positions.map((p) => [p.key, positionCostPo(p)] as const),
    );
    return players.reduce((sum, p) => sum + (costByKey.get(p.position) ?? 0), 0);
  }, [players, positions]);

  return (
    <div className="space-y-4" data-testid="admin-positions-editor">
      {errors.length > 0 && (
        <div
          data-testid="admin-positions-errors"
          className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm space-y-1"
        >
          {errors.map((error) => (
            <div key={error}>⚠️ {error}</div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Postes du roster */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b text-sm font-semibold">
            Postes disponibles
          </div>
          <ul className="divide-y divide-gray-100">
            {positions.map((position) => {
              const count = countByPosition.get(position.key) ?? 0;
              const atMax = count >= position.maxCount;
              const rosterFull = players.length >= maxPlayers;
              return (
                <li
                  key={position.key}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {position.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {count}/{position.maxCount} · {position.cost}k po
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid={`admin-position-add-${position.key}`}
                    disabled={disabled || atMax || rosterFull}
                    title={
                      atMax
                        ? "Plafond du poste atteint"
                        : rosterFull
                          ? `Plafond de ${maxPlayers} joueurs atteint`
                          : "Ajouter"
                    }
                    onClick={() => onChange(addPlayer(players, position))}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                  >
                    + Ajouter
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Composition courante */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b text-sm font-semibold flex items-center justify-between">
            <span>
              Composition ({players.length}/{maxPlayers})
            </span>
            <span className="text-xs font-normal text-gray-500">
              {Math.round(totalCostPo / 1000).toLocaleString("fr-FR")}k po
            </span>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
            {sorted.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gray-400">
                Aucun joueur
              </li>
            )}
            {sorted.map((player) => (
              <li
                key={player.key}
                data-testid={`admin-player-row-${player.key}`}
                className={`flex items-center gap-2 px-3 py-2 text-sm ${
                  player.locked ? "bg-gray-50 opacity-70" : ""
                }`}
              >
                <input
                  type="number"
                  min={1}
                  max={99}
                  aria-label={`Numéro de ${player.name}`}
                  value={player.number}
                  disabled={disabled || player.locked}
                  onChange={(e) =>
                    onChange(
                      updatePlayer(players, player.key, {
                        number: Number(e.target.value) || 0,
                      }),
                    )
                  }
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center disabled:bg-gray-100"
                />
                <input
                  type="text"
                  maxLength={100}
                  aria-label={`Nom du joueur ${player.number}`}
                  value={player.name}
                  disabled={disabled || player.locked}
                  onChange={(e) =>
                    onChange(
                      updatePlayer(players, player.key, {
                        name: e.target.value,
                      }),
                    )
                  }
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded disabled:bg-gray-100"
                />
                <span className="shrink-0 text-xs text-gray-500 w-32 truncate hidden sm:block">
                  {positionNames.get(player.position) ?? player.position}
                </span>
                {player.locked ? (
                  <span
                    className="shrink-0 text-xs text-gray-400 px-2"
                    title="Joueur mort ou licencié : conservé pour l'historique"
                  >
                    🔒
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid={`admin-player-remove-${player.key}`}
                    disabled={disabled}
                    onClick={() => onChange(removePlayer(players, player.key))}
                    className="shrink-0 px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 text-xs font-medium"
                    title="Retirer"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
