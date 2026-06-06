"use client";

import { useState } from "react";

// Polish — panneaux pre/post-match + invalidation pour la feuille de
// match. Composants presentational : ils recoivent les valeurs + des
// callbacks de sauvegarde (la page parent gere les appels API).

const WEATHER_OPTIONS = [
  "",
  "sweltering_heat",
  "very_sunny",
  "perfect",
  "pouring_rain",
  "blizzard",
];

export interface PreMatchValues {
  weather: string;
  popularityHome: number | null;
  popularityAway: number | null;
}

export function PreMatchPanel({
  initial,
  computedWinningsHome,
  computedWinningsAway,
  disabled,
  onSave,
}: {
  initial: PreMatchValues;
  computedWinningsHome: number;
  computedWinningsAway: number;
  disabled?: boolean;
  onSave: (v: PreMatchValues) => Promise<void>;
}) {
  const [weather, setWeather] = useState(initial.weather);
  const [popH, setPopH] = useState<string>(
    initial.popularityHome?.toString() ?? "",
  );
  const [popA, setPopA] = useState<string>(
    initial.popularityAway?.toString() ?? "",
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        weather,
        popularityHome: popH === "" ? null : Number(popH),
        popularityAway: popA === "" ? null : Number(popA),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-4 rounded border p-3" data-testid="pre-match-panel">
      <h2 className="mb-2 font-semibold">Avant-match</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          Meteo
          <select
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            disabled={disabled}
            className="block rounded border px-2 py-1"
          >
            {WEATHER_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w || "—"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Facteur pop. domicile
          <input
            type="number"
            min={0}
            max={20}
            value={popH}
            onChange={(e) => setPopH(e.target.value)}
            disabled={disabled}
            className="block w-24 rounded border px-2 py-1"
            data-testid="popularity-home"
          />
          <span className="text-[10px] text-slate-500">
            → {computedWinningsHome.toLocaleString("fr-FR")} po
          </span>
        </label>
        <label className="text-xs">
          Facteur pop. exterieur
          <input
            type="number"
            min={0}
            max={20}
            value={popA}
            onChange={(e) => setPopA(e.target.value)}
            disabled={disabled}
            className="block w-24 rounded border px-2 py-1"
            data-testid="popularity-away"
          />
          <span className="text-[10px] text-slate-500">
            → {computedWinningsAway.toLocaleString("fr-FR")} po
          </span>
        </label>
        {!disabled && (
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
            onClick={save}
            disabled={busy}
            data-testid="save-pre-match"
          >
            Enregistrer
          </button>
        )}
      </div>
    </section>
  );
}

export interface PostMatchValues {
  winningsHomeManual: number | null;
  winningsAwayManual: number | null;
  dedicatedFansDeltaHome: number;
  dedicatedFansDeltaAway: number;
  motmPlayerIds: string[];
}

export function PostMatchPanel({
  initial,
  disabled,
  onSave,
}: {
  initial: PostMatchValues;
  disabled?: boolean;
  onSave: (v: PostMatchValues) => Promise<void>;
}) {
  const [winH, setWinH] = useState<string>(
    initial.winningsHomeManual?.toString() ?? "",
  );
  const [winA, setWinA] = useState<string>(
    initial.winningsAwayManual?.toString() ?? "",
  );
  const [fansH, setFansH] = useState(initial.dedicatedFansDeltaHome);
  const [fansA, setFansA] = useState(initial.dedicatedFansDeltaAway);
  const [motm, setMotm] = useState(initial.motmPlayerIds.join(", "));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        winningsHomeManual: winH === "" ? null : Number(winH),
        winningsAwayManual: winA === "" ? null : Number(winA),
        dedicatedFansDeltaHome: fansH,
        dedicatedFansDeltaAway: fansA,
        motmPlayerIds: motm
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-4 rounded border p-3" data-testid="post-match-panel">
      <h2 className="mb-2 font-semibold">Apres-match</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          Tresorerie domicile (override)
          <input
            type="number"
            min={0}
            value={winH}
            onChange={(e) => setWinH(e.target.value)}
            disabled={disabled}
            placeholder="auto"
            className="block w-28 rounded border px-2 py-1"
            data-testid="winnings-home"
          />
        </label>
        <label className="text-xs">
          Tresorerie exterieur (override)
          <input
            type="number"
            min={0}
            value={winA}
            onChange={(e) => setWinA(e.target.value)}
            disabled={disabled}
            placeholder="auto"
            className="block w-28 rounded border px-2 py-1"
            data-testid="winnings-away"
          />
        </label>
        <label className="text-xs">
          Fans devoues dom.
          <select
            value={fansH}
            onChange={(e) => setFansH(Number(e.target.value))}
            disabled={disabled}
            className="block rounded border px-2 py-1"
          >
            <option value={-1}>-1</option>
            <option value={0}>0</option>
            <option value={1}>+1</option>
          </select>
        </label>
        <label className="text-xs">
          Fans devoues ext.
          <select
            value={fansA}
            onChange={(e) => setFansA(Number(e.target.value))}
            disabled={disabled}
            className="block rounded border px-2 py-1"
          >
            <option value={-1}>-1</option>
            <option value={0}>0</option>
            <option value={1}>+1</option>
          </select>
        </label>
        <label className="text-xs">
          Joueur(s) du match (ids, virgule)
          <input
            value={motm}
            onChange={(e) => setMotm(e.target.value)}
            disabled={disabled}
            className="block w-48 rounded border px-2 py-1"
            data-testid="motm-ids"
          />
        </label>
        {!disabled && (
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
            onClick={save}
            disabled={busy}
            data-testid="save-post-match"
          >
            Enregistrer
          </button>
        )}
      </div>
    </section>
  );
}

export function InvalidateControl({
  canInvalidate,
  reasonClosed,
  onInvalidate,
}: {
  canInvalidate: boolean;
  reasonClosed?: string;
  onInvalidate: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!canInvalidate) {
    return (
      <p className="text-xs text-slate-500" data-testid="invalidate-closed">
        Invalidation impossible
        {reasonClosed === "both_teams_played_later"
          ? " : les 2 equipes ont deja rejoue."
          : "."}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2" data-testid="invalidate-control">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motif (optionnel)"
        className="rounded border px-2 py-1 text-sm"
      />
      <button
        type="button"
        className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onInvalidate(reason);
          } finally {
            setBusy(false);
          }
        }}
        data-testid="invalidate-sheet"
      >
        Invalider le match
      </button>
    </div>
  );
}
