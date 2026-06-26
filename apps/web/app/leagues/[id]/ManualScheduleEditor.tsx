"use client";
import { useCallback, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import type { LeagueRoundDetail, LeagueParticipantDetail } from "./types";

// FR4 — saisie manuelle du calendrier : le commissaire crée des journées
// (rounds) et y ajoute/retire des matchs (pairings) à la main, en complément
// (ou à la place) de la génération automatique. Backend : Lot F.

/** Options "extérieur" possibles : tous les participants sauf l'équipe à domicile. */
export function awayOptions(
  participants: ReadonlyArray<{ id: string }>,
  homeId: string,
): Array<{ id: string }> {
  return participants.filter((p) => p.id !== homeId);
}

interface Props {
  seasonId: string;
  rounds: LeagueRoundDetail[];
  participants: LeagueParticipantDetail[];
  onChanged: () => void;
}

export function ManualScheduleEditor({
  seasonId,
  rounds,
  participants,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newRoundName, setNewRoundName] = useState("");

  const active = participants.filter((p) => p.status === "active");
  const nameOf = (participantId: string) =>
    active.find((p) => p.id === participantId)?.team.name ?? "?";

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        onChanged();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const createRound = useCallback(() => {
    run(async () => {
      await apiRequest(`/leagues/seasons/${seasonId}/rounds/manual`, {
        method: "POST",
        body: JSON.stringify(
          newRoundName.trim() ? { name: newRoundName.trim() } : {},
        ),
      });
      setNewRoundName("");
    });
  }, [newRoundName, run, seasonId]);

  if (!open) {
    return (
      <button
        type="button"
        data-testid="open-manual-schedule"
        onClick={() => setOpen(true)}
        className="self-start px-3 py-1.5 rounded-md bg-white border border-nuffle-gold text-nuffle-bronze text-sm font-medium hover:bg-nuffle-gold/10"
      >
        ✏️ Saisie manuelle du calendrier
      </button>
    );
  }

  return (
    <section
      data-testid="manual-schedule-editor"
      className="border border-amber-200 bg-amber-50/40 rounded-lg p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
          Saisie manuelle du calendrier
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-500 hover:text-gray-800"
        >
          Fermer
        </button>
      </div>

      {error ? (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </p>
      ) : null}

      {/* Créer une journée */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-gray-600">
          Nouvelle journée (nom optionnel)
          <input
            type="text"
            value={newRoundName}
            disabled={busy}
            onChange={(e) => setNewRoundName(e.target.value)}
            placeholder="Journée 1"
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          data-testid="manual-create-round"
          onClick={createRound}
          disabled={busy}
          className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          + Créer une journée
        </button>
      </div>

      {/* Journées existantes : ajout / retrait de matchs */}
      {rounds.length === 0 ? (
        <p className="text-xs text-gray-600">
          Aucune journée. Créez-en une pour y ajouter des matchs.
        </p>
      ) : (
        <ul className="space-y-2">
          {rounds.map((round) => (
            <RoundEditor
              key={round.id}
              round={round}
              active={active}
              busy={busy}
              nameOf={nameOf}
              onAddPairing={(homeId, awayId) =>
                run(() =>
                  apiRequest(`/leagues/rounds/${round.id}/pairings`, {
                    method: "POST",
                    body: JSON.stringify({
                      homeParticipantId: homeId,
                      awayParticipantId: awayId,
                    }),
                  }),
                )
              }
              onDeletePairing={(pairingId) =>
                run(() =>
                  apiRequest(`/leagues/pairings/${pairingId}`, {
                    method: "DELETE",
                  }),
                )
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RoundEditor({
  round,
  active,
  busy,
  nameOf,
  onAddPairing,
  onDeletePairing,
}: {
  round: LeagueRoundDetail;
  active: LeagueParticipantDetail[];
  busy: boolean;
  nameOf: (id: string) => string;
  onAddPairing: (homeId: string, awayId: string) => void;
  onDeletePairing: (pairingId: string) => void;
}) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const pairings = round.pairings ?? [];
  const aways = awayOptions(active, home);

  return (
    <li className="bg-white border border-gray-200 rounded p-2 space-y-1.5">
      <div className="text-sm font-medium text-nuffle-anthracite">
        J{round.roundNumber}
        {round.name ? ` — ${round.name}` : ""}
      </div>

      {pairings.length > 0 ? (
        <ul className="space-y-1">
          {pairings.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded px-2 py-1"
            >
              <span>
                {p.homeParticipant.team.name}
                <span className="mx-1 text-gray-400">vs</span>
                {p.awayParticipant.team.name}
              </span>
              <button
                type="button"
                data-testid={`manual-delete-pairing-${p.id}`}
                disabled={busy}
                onClick={() => onDeletePairing(p.id)}
                className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <select
          data-testid={`manual-home-${round.id}`}
          value={home}
          disabled={busy}
          onChange={(e) => {
            setHome(e.target.value);
            if (e.target.value === away) setAway("");
          }}
          className="border border-gray-300 rounded px-1 py-0.5 text-xs"
        >
          <option value="">— Domicile —</option>
          {active.map((p) => (
            <option key={p.id} value={p.id}>
              {p.team.name}
            </option>
          ))}
        </select>
        <span className="text-gray-400 text-xs">vs</span>
        <select
          data-testid={`manual-away-${round.id}`}
          value={away}
          disabled={busy || !home}
          onChange={(e) => setAway(e.target.value)}
          className="border border-gray-300 rounded px-1 py-0.5 text-xs"
        >
          <option value="">— Extérieur —</option>
          {aways.map((p) => (
            <option key={p.id} value={p.id}>
              {nameOf(p.id)}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-testid={`manual-add-pairing-${round.id}`}
          disabled={busy || !home || !away}
          onClick={() => {
            onAddPairing(home, away);
            setHome("");
            setAway("");
          }}
          className="px-2 py-0.5 rounded bg-amber-600 text-white text-xs font-medium disabled:opacity-50"
        >
          + Match
        </button>
      </div>
    </li>
  );
}
