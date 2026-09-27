/**
 * Tables de référence imprimées sur la feuille de rencontre, lues dans le
 * moteur (même source que la liste déroulante de saisie du site) : coup
 * d'envoi 2D6, Prières à Nuffle D16, et météo compactée par plages.
 */

import { KICKOFF_EVENTS, PRAYERS_TABLE } from "@bb/game-engine";

export function kickoffTableRows(): Array<{ roll: string; name: string }> {
  return Object.entries(KICKOFF_EVENTS)
    .map(([roll, ev]) => ({ roll: Number(roll), name: ev.nameFr }))
    .sort((a, b) => a.roll - b.roll)
    .map((r) => ({ roll: String(r.roll), name: r.name }));
}

export function prayersTableRows(): Array<{ roll: string; name: string }> {
  return Object.entries(PRAYERS_TABLE)
    .map(([roll, p]) => ({ roll: Number(roll), name: p.nameFr }))
    .sort((a, b) => a.roll - b.roll)
    .map((r) => ({ roll: String(r.roll), name: r.name }));
}

/**
 * Regroupe les résultats consécutifs identiques d'une table de météo
 * (« 4-10 Conditions parfaites » plutôt que sept lignes).
 */
export function compressWeatherResults(
  results: ReadonlyArray<{ roll: number; condition: string }>,
): Array<{ roll: string; condition: string }> {
  const sorted = [...results].sort((a, b) => a.roll - b.roll);
  const out: Array<{ from: number; to: number; condition: string }> = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && last.condition === r.condition && last.to === r.roll - 1) {
      out[out.length - 1] = { ...last, to: r.roll };
    } else {
      out.push({ from: r.roll, to: r.roll, condition: r.condition });
    }
  }
  return out.map((r) => ({
    roll: r.from === r.to ? String(r.from) : `${r.from}-${r.to}`,
    condition: r.condition,
  }));
}
