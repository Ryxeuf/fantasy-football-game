/**
 * Cross-match `PlayerForm` — sprint Pro League 0.C.4.
 *
 * Persiste un état "hot / normal / cold" entre matchs avec un decay sur
 * 3 matchs sans renforcement (sprint table). Visible sur la fiche
 * joueur publique (lot 1.C.2) et alimente la Nuffle Gazette LLM
 * (lot 1.E.1) + le calcul des cotes (lot 1.D.3).
 *
 * Architecture
 * ------------
 * Le sim-engine n'a pas de couche de persistence : ces helpers sont
 * purs et travaillent sur des `readonly PlayerForm[]` que le serveur
 * (apps/server) lit depuis sa table Prisma `PlayerForm`, applique a
 * chaque match termine via `applyMatchToForms`, puis re-persiste.
 *
 * Le pont avec lot 0.B.4 : `applyMatchToForms` consomme le snapshot
 * `MomentumTracker` du SimResult (`summary.momentum`).
 */

import type { PlayerMomentum } from './momentum';

export type FormState = 'hot' | 'normal' | 'cold';

export interface PlayerForm {
  playerId: string;
  state: FormState;
  /** Number of consecutive matches without state-reinforcement. Reset
   *  to 0 each time the match-end momentum confirms the current state. */
  matchesSinceReinforcement: number;
}

export interface FormUpdateInput {
  /** Per-player momentum snapshot at end of match (lot 0.B.4). */
  momentumSnapshot: readonly PlayerMomentum[];
  /** Existing forms entering the match (server DB). */
  prior: readonly PlayerForm[];
}

/** Decay window — sprint table: "decay sur 3 matchs". After 3 consecutive
 *  matches with no reinforcing match-end momentum, the form returns to
 *  `normal`. */
export const FORM_DECAY_MATCHES = 3;

/**
 * Convenience helper : age a single form by one match without taking
 * any reinforcement signal. Returns a fresh object (no mutation).
 */
export function decayForm(form: PlayerForm): PlayerForm {
  if (form.state === 'normal') {
    return { ...form, matchesSinceReinforcement: 0 };
  }
  const next = form.matchesSinceReinforcement + 1;
  if (next >= FORM_DECAY_MATCHES) {
    return { ...form, state: 'normal', matchesSinceReinforcement: 0 };
  }
  return { ...form, matchesSinceReinforcement: next };
}

/**
 * Folds the end-of-match momentum into the persisted forms.
 *
 * For each player listed in the momentum snapshot :
 * - `state === 'hot'` or `'cold'` overrides the persisted form (most-recent
 *   match wins) and resets `matchesSinceReinforcement` to 0.
 * - `state === 'normal'` ages the existing form by one match.
 *
 * For each player in `prior` who did NOT appear in the momentum snapshot
 * (didn't play this match), their form is also aged by one match — the
 * decay window represents calendar matches, not personal participation.
 */
export function applyMatchToForms(input: FormUpdateInput): readonly PlayerForm[] {
  const out = new Map<string, PlayerForm>();
  // Seed with priors so we don't drop entries for non-playing veterans.
  for (const f of input.prior) {
    out.set(f.playerId, { ...f });
  }

  const seenInMatch = new Set<string>();
  for (const m of input.momentumSnapshot) {
    seenInMatch.add(m.playerId);
    if (m.state === 'hot' || m.state === 'cold') {
      out.set(m.playerId, {
        playerId: m.playerId,
        state: m.state,
        matchesSinceReinforcement: 0,
      });
    } else {
      const existing = out.get(m.playerId);
      if (!existing) {
        // Fresh player with normal momentum — record at normal so the
        // Gazette can list them (avoids "ghost" players never persisted).
        out.set(m.playerId, {
          playerId: m.playerId,
          state: 'normal',
          matchesSinceReinforcement: 0,
        });
      } else {
        out.set(m.playerId, decayForm(existing));
      }
    }
  }

  // Age players who did not appear in this match (calendar-time decay).
  for (const [id, form] of out) {
    if (!seenInMatch.has(id)) {
      out.set(id, decayForm(form));
    }
  }

  return Array.from(out.values());
}

/** Read-only lookup. Returns `'normal'` for unknown players. */
export function getPlayerForm(forms: readonly PlayerForm[], playerId: string): FormState {
  const f = forms.find((x) => x.playerId === playerId);
  return f ? f.state : 'normal';
}
