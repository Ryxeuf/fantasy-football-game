"use client";

export interface WeekPickerOption {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  isPlayoffs: boolean;
  /** Total de matchups sur cette (league, week). 0 = pas encore generes. */
  matchupCount: number;
  /** Nb de matchups settles. */
  settledCount: number;
}

interface WeekPickerProps {
  weeks: ReadonlyArray<WeekPickerOption>;
  value: string;
  onChange: (weekId: string) => void;
  /** Label visible (par defaut "Semaine"). */
  label?: string;
}

/**
 * Selecteur de semaine partage par les pages matchups et lineup.
 * Remplace l'ancien input texte (UX 0 — l'utilisateur devait
 * connaitre le format YYYY:W{n}) par un <select> peuple par les
 * NflWeek du cycle, avec marqueur d'etat (en cours, settled, vide).
 */
export function WeekPicker({ weeks, value, onChange, label = "Semaine" }: WeekPickerProps) {
  if (weeks.length === 0) {
    return (
      <p className="text-xs text-nuffle-anthracite/60">
        Aucune semaine — championnat sans cycle adosse.
      </p>
    );
  }
  return (
    <label className="block text-sm">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-nuffle-bronze/30 bg-white px-3 py-1.5 text-sm text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
        data-testid="week-picker"
      >
        {weeks.map((w) => (
          <option key={w.id} value={w.id}>
            {formatWeekOption(w)}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatWeekOption(w: WeekPickerOption): string {
  const head = `W${w.weekNumber}${w.isPlayoffs ? " 🏆" : ""}`;
  const date = new Date(w.startDate).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
  const status = computeStatus(w);
  return `${head} — ${date}${status ? " · " + status : ""}`;
}

function computeStatus(w: WeekPickerOption): string {
  if (w.matchupCount === 0) return "à venir";
  if (w.settledCount === 0) return "en cours";
  if (w.settledCount < w.matchupCount) {
    return `${w.settledCount}/${w.matchupCount} settled`;
  }
  return "settled ✓";
}
