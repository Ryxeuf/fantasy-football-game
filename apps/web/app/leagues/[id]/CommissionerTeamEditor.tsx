"use client";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";

// FR12 — édition de l'équipe d'un coach par le commissaire : trésorerie,
// SPP, compétences (ajout/retrait) et caractéristiques (MA/ST/AG/PA/AV).
// Toutes les actions sont journalisées (AuditLog) côté serveur.

interface EditPlayer {
  id: string;
  name: string;
  position: string;
  number: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  spp: number;
  dead: boolean;
}

interface RosterResponse {
  team: { id: string; name: string; roster: string; treasury: number };
  players: EditPlayer[];
}

const CHARS = ["MA", "ST", "AG", "PA", "AV"] as const;

interface Props {
  leagueId: string;
  teamId: string;
  teamName: string;
  open: boolean;
  /**
   * Autorise la suppression de joueurs (uniquement avant le démarrage de
   * la saison, tant qu'aucun match n'a été joué). Le backend ré-applique
   * cette garde ; ce flag ne fait que masquer le bouton côté UI.
   */
  canRemovePlayers?: boolean;
  onClose: () => void;
  /** Rappelé après une modification (pour rafraîchir la saison au besoin). */
  onChanged?: () => void;
}

export function CommissionerTeamEditor({
  leagueId,
  teamId,
  teamName,
  open,
  canRemovePlayers = false,
  onClose,
  onChanged,
}: Props) {
  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<RosterResponse>(
        `/leagues/${leagueId}/teams/${teamId}/roster`,
      );
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [leagueId, teamId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        await load();
        onChanged?.();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        setBusy(false);
      }
    },
    [load, onChanged],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto p-4">
      <div
        data-testid="commissioner-team-editor"
        className="bg-white rounded-lg shadow-2xl max-w-3xl w-full my-4 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-nuffle-anthracite">
            Édition — {teamName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {error ? (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            {error}
          </p>
        ) : null}

        {loading || !data ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : (
          <>
            <TreasuryControl
              treasury={data.team.treasury}
              disabled={busy}
              onAdjust={(delta) =>
                act(() =>
                  apiRequest(`/leagues/${leagueId}/teams/${teamId}/treasury`, {
                    method: "PATCH",
                    body: JSON.stringify({ delta }),
                  }),
                )
              }
            />

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {data.players.map((p) => (
                <PlayerEditRow
                  key={p.id}
                  leagueId={leagueId}
                  teamId={teamId}
                  player={p}
                  busy={busy}
                  canRemove={canRemovePlayers}
                  act={act}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TreasuryControl({
  treasury,
  disabled,
  onAdjust,
}: {
  treasury: number;
  disabled: boolean;
  onAdjust: (delta: number) => void;
}) {
  const [delta, setDelta] = useState<number>(0);
  return (
    <div className="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm">
      <span className="font-medium">Trésorerie :</span>
      <span className="font-mono">{treasury.toLocaleString("fr-FR")} po</span>
      <input
        type="number"
        step={1000}
        value={delta}
        disabled={disabled}
        onChange={(e) => setDelta(Number(e.target.value))}
        className="w-28 border border-gray-300 rounded px-2 py-1 ml-auto"
        placeholder="delta po"
      />
      <button
        type="button"
        data-testid="treasury-adjust"
        onClick={() => {
          if (delta !== 0) {
            onAdjust(delta);
            setDelta(0);
          }
        }}
        disabled={disabled || delta === 0}
        className="px-2 py-1 rounded bg-nuffle-gold text-white text-xs font-medium disabled:opacity-50"
      >
        Appliquer
      </button>
    </div>
  );
}

function PlayerEditRow({
  leagueId,
  teamId,
  player,
  busy,
  canRemove,
  act,
}: {
  leagueId: string;
  teamId: string;
  player: EditPlayer;
  busy: boolean;
  canRemove: boolean;
  act: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [sppDelta, setSppDelta] = useState<number>(0);
  const [newSkill, setNewSkill] = useState("");
  const [charKind, setCharKind] = useState<(typeof CHARS)[number]>("MA");
  const [charDelta, setCharDelta] = useState<number>(0);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const skills = player.skills
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const base = `/leagues/${leagueId}/teams/${teamId}/players/${player.id}`;

  return (
    <div
      data-testid={`player-edit-${player.id}`}
      className="border border-gray-200 rounded p-2 space-y-1.5 text-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">
          #{player.number} {player.name}
          <span className="ml-2 text-xs text-gray-500">{player.position}</span>
          {player.dead ? (
            <span className="ml-2 text-xs text-red-600">(mort)</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">SPP {player.spp}</span>
          {/* Suppression du joueur (pré-saison, aucun match joué). */}
          {canRemove ? (
            confirmRemove ? (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  data-testid={`confirm-remove-player-${player.id}`}
                  disabled={busy}
                  onClick={() =>
                    act(() =>
                      apiRequest(
                        `/leagues/${leagueId}/teams/${teamId}/players/${player.id}`,
                        { method: "DELETE" },
                      ),
                    ).then(() => setConfirmRemove(false))
                  }
                  className="text-xs px-1.5 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Confirmer
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmRemove(false)}
                  className="text-xs px-1.5 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Annuler
                </button>
              </span>
            ) : (
              <button
                type="button"
                data-testid={`remove-player-${player.id}`}
                disabled={busy}
                onClick={() => setConfirmRemove(true)}
                className="text-xs px-1.5 py-0.5 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                🗑 Supprimer
              </button>
            )
          ) : null}
        </div>
      </div>

      {/* Compétences */}
      <div className="flex flex-wrap items-center gap-1">
        {skills.length === 0 ? (
          <span className="text-xs text-gray-400">Aucune compétence</span>
        ) : (
          skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-800 rounded px-1.5 py-0.5"
            >
              {skill}
              <button
                type="button"
                aria-label={`Retirer ${skill}`}
                disabled={busy}
                onClick={() =>
                  act(() =>
                    apiRequest(`${base}/skills`, {
                      method: "DELETE",
                      body: JSON.stringify({ skill }),
                    }),
                  )
                }
                className="text-blue-500 hover:text-red-600 disabled:opacity-50"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {/* Contrôles : SPP, compétence, caractéristique */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className="inline-flex items-center gap-1">
          SPP
          <input
            type="number"
            value={sppDelta}
            disabled={busy}
            onChange={(e) => setSppDelta(Number(e.target.value))}
            className="w-16 border border-gray-300 rounded px-1 py-0.5"
          />
          <button
            type="button"
            data-testid={`spp-apply-${player.id}`}
            disabled={busy || sppDelta === 0}
            onClick={() =>
              act(() =>
                apiRequest(`${base}/spp`, {
                  method: "POST",
                  body: JSON.stringify({ delta: sppDelta }),
                }),
              ).then(() => setSppDelta(0))
            }
            className="px-1.5 py-0.5 rounded bg-gray-700 text-white disabled:opacity-50"
          >
            OK
          </button>
        </span>

        <span className="inline-flex items-center gap-1">
          + Compétence
          <input
            type="text"
            value={newSkill}
            disabled={busy}
            placeholder="block"
            onChange={(e) => setNewSkill(e.target.value)}
            className="w-24 border border-gray-300 rounded px-1 py-0.5"
          />
          <button
            type="button"
            data-testid={`skill-add-${player.id}`}
            disabled={busy || newSkill.trim().length === 0}
            onClick={() =>
              act(() =>
                apiRequest(`${base}/skills`, {
                  method: "POST",
                  body: JSON.stringify({ skill: newSkill.trim() }),
                }),
              ).then(() => setNewSkill(""))
            }
            className="px-1.5 py-0.5 rounded bg-gray-700 text-white disabled:opacity-50"
          >
            Ajouter
          </button>
        </span>

        <span className="inline-flex items-center gap-1">
          Carac
          <select
            value={charKind}
            disabled={busy}
            onChange={(e) =>
              setCharKind(e.target.value as (typeof CHARS)[number])
            }
            className="border border-gray-300 rounded px-1 py-0.5"
          >
            {CHARS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={charDelta}
            disabled={busy}
            onChange={(e) => setCharDelta(Number(e.target.value))}
            className="w-14 border border-gray-300 rounded px-1 py-0.5"
          />
          <button
            type="button"
            data-testid={`char-apply-${player.id}`}
            disabled={busy || charDelta === 0}
            onClick={() =>
              act(() =>
                apiRequest(`${base}/characteristic`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    characteristic: charKind,
                    delta: charDelta,
                  }),
                }),
              ).then(() => setCharDelta(0))
            }
            className="px-1.5 py-0.5 rounded bg-gray-700 text-white disabled:opacity-50"
          >
            OK
          </button>
        </span>
      </div>
    </div>
  );
}
