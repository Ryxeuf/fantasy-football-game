"use client";
import { useState } from "react";
import { apiRequest } from "../../../lib/api-client";

// E12 — édition inline du nom + numéro d'un joueur par son coach, y
// compris quand l'équipe est ENGAGÉE (ligue/coupe) : c'est cosmétique,
// la route PATCH /team/:id/players/:playerId/identity ne passe pas par
// le verrou anti-triche du roster (composition/budget inchangés).

interface Props {
  teamId: string;
  player: { id: string; name: string; number: number };
  onSaved: (playerId: string, name: string, number: number) => void;
}

export function PlayerIdentityInlineEdit({ teamId, player, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.name);
  const [number, setNumber] = useState<string>(String(player.number));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span>{player.name}</span>
        <button
          type="button"
          aria-label={`Modifier ${player.name}`}
          data-testid={`player-identity-edit-${player.id}`}
          onClick={() => {
            setName(player.name);
            setNumber(String(player.number));
            setError(null);
            setEditing(true);
          }}
          className="text-gray-400 hover:text-nuffle-bronze text-xs"
          title="Modifier le nom / numéro"
        >
          ✎
        </button>
      </span>
    );
  }

  const numberValid =
    Number.isInteger(Number(number)) &&
    Number(number) >= 1 &&
    Number(number) <= 99;
  const nameValid = name.trim().length > 0 && name.trim().length <= 60;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/team/${teamId}/players/${player.id}/identity`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          number: Number(number),
        }),
      });
      onSaved(player.id, name.trim(), Number(number));
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <input
        type="number"
        min={1}
        max={99}
        value={number}
        disabled={busy}
        onChange={(e) => setNumber(e.target.value)}
        data-testid={`player-identity-number-${player.id}`}
        className="w-14 rounded border border-gray-300 px-1 py-0.5 text-sm"
      />
      <input
        type="text"
        value={name}
        maxLength={60}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
        data-testid={`player-identity-name-${player.id}`}
        className="w-36 rounded border border-gray-300 px-1 py-0.5 text-sm"
        placeholder="Prénom Nom"
      />
      <button
        type="button"
        data-testid={`player-identity-save-${player.id}`}
        disabled={busy || !numberValid || !nameValid}
        onClick={save}
        className="rounded bg-nuffle-gold px-1.5 py-0.5 text-xs text-white disabled:opacity-50"
      >
        OK
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setEditing(false)}
        className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600"
      >
        Annuler
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
