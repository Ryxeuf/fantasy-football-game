/**
 * Sprint 1.G.4 — Builder pure des markers de scrub bar pour replays.
 *
 * Extrait les events "key moments" (TD / CASUALTY / NUFFLE) d'un dump
 * de replay et les positionne en pourcentage de la duration totale,
 * pour rendu dans la UI scrub bar.
 *
 * Pure — pas de React, pas de DOM. Testable sans render.
 */

import type { MatchEvent } from "@bb/shared-types";

export type ScrubMarkerType = "TD" | "CASUALTY" | "NUFFLE";

export interface ScrubMarker {
  readonly type: ScrubMarkerType;
  readonly displayAtMs: number;
  /** Position 0..100 sur la scrub bar. */
  readonly percent: number;
  /** Texte tooltip court (ex: "TOUCHDOWN home", "Casualty", "Nuffle: fog_rolls_in"). */
  readonly label: string;
  /** Index dans le tableau d'events (utile pour ticker scroll-to). */
  readonly eventIndex: number;
}

const MARKER_TYPES: ReadonlySet<string> = new Set([
  "TD",
  "CASUALTY",
  "NUFFLE",
]);

function buildLabel(ev: MatchEvent): string {
  const meta = (ev.meta ?? {}) as Record<string, unknown>;
  switch (ev.type) {
    case "TD": {
      const team =
        typeof meta.team === "string" ? meta.team.toUpperCase() : "";
      return team ? `TOUCHDOWN ${team}` : "TOUCHDOWN";
    }
    case "CASUALTY": {
      const cause =
        typeof meta.causedBy === "string" ? ` (${meta.causedBy})` : "";
      return `Casualty${cause}`;
    }
    case "NUFFLE": {
      const id = typeof meta.id === "string" ? meta.id : "?";
      return `Nuffle: ${id}`;
    }
    default:
      return ev.type;
  }
}

export interface BuildScrubMarkersInput {
  readonly events: readonly MatchEvent[];
  readonly durationMs: number;
}

/**
 * Renvoie les markers tries par `displayAtMs` ascending. Clamp `percent`
 * a [0, 100]. durationMs <= 0 renvoie [].
 */
export function buildScrubMarkers(
  input: BuildScrubMarkersInput,
): ScrubMarker[] {
  const { events, durationMs } = input;
  if (durationMs <= 0) return [];
  const out: ScrubMarker[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const ev = events[i];
    if (!MARKER_TYPES.has(ev.type)) continue;
    const ratio = Math.max(0, Math.min(1, ev.displayAtMs / durationMs));
    out.push({
      type: ev.type as ScrubMarkerType,
      displayAtMs: ev.displayAtMs,
      percent: ratio * 100,
      label: buildLabel(ev),
      eventIndex: i,
    });
  }
  return out.sort((a, b) => a.displayAtMs - b.displayAtMs);
}
