/**
 * Briques partagées par les adaptateurs ligue et coupe : dates, équipes,
 * tours de bracket. Toutes PURES.
 */

import { getRosterName } from "@bb/game-engine";
import type { PdfTeamRef } from "../types";

export type RosterNameResolver = (slug: string) => string;

export const defaultRosterName: RosterNameResolver = (slug) => getRosterName(slug);

/** « 04/10/2026 20:30 » (heure omise à minuit pile), `null` si illisible. */
export function formatPdfDate(iso: string | null | undefined, withTime = true): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  if (!withTime || (d.getHours() === 0 && d.getMinutes() === 0)) return date;
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** « du 06/09/2026 au 13/09/2026 », « du 06/09/2026 », ou `null`. */
export function formatPdfPeriod(start: string | null | undefined, end: string | null | undefined): string | null {
  const s = formatPdfDate(start, false);
  const e = formatPdfDate(end, false);
  if (s && e && s !== e) return `du ${s} au ${e}`;
  if (s) return `du ${s}`;
  if (e) return `jusqu'au ${e}`;
  return null;
}

export function teamRef(
  team: { name: string; roster?: string | null },
  coach: string | null | undefined,
  rosterName: RosterNameResolver = defaultRosterName,
): PdfTeamRef {
  return {
    name: team.name,
    coach: coach ?? null,
    rosterName: team.roster ? rosterName(team.roster) : null,
  };
}

/** Libellé d'un tour de bracket depuis son slot (`qf2`, `sf1`, `final`). */
export function bracketStageLabel(stage: "qf" | "sf" | "final"): string {
  if (stage === "qf") return "Quarts de finale";
  if (stage === "sf") return "Demi-finales";
  return "Finale";
}

export function stageOfSlot(slot: string | null | undefined): "qf" | "sf" | "final" | null {
  if (!slot) return null;
  if (slot.startsWith("qf")) return "qf";
  if (slot.startsWith("sf")) return "sf";
  if (slot === "final") return "final";
  return null;
}

export const STAGE_ORDER = ["qf", "sf", "final"] as const;

/** « +3 », « -2 », 0 — pour les colonnes de différence. */
export function diffCell(n: number): string | number {
  return n > 0 ? `+${n}` : n;
}

/** Décimale à la française (« 2,9 »). */
export function decimalFr(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}
