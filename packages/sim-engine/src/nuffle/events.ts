/**
 * "Eye of Nuffle" — sprint Pro League 0.C.1.
 *
 * Bibliothèque de 28 events scriptés tirés au début de chaque tour
 * pour ajouter de la variance narrative aux matchs (le ticker affichera
 * la description, la Nuffle Gazette LLM citera l'event dans son article
 * du lendemain, lot 1.E.1). La somme des probabilités est calibrée
 * autour de 0.30 → environ 30% des tours produisent un Nuffle event.
 *
 * Catégories (`kind`)
 * -------------------
 * - `positive` : booste un joueur / une équipe (rookie brilliance, lucky
 *   bounce, fan factor surge, etc.)
 * - `negative` : pénalise un joueur (tantrum star, banana skin, ref
 *   blunder, etc.)
 * - `neutral` : situationnel narratif (nemesis clash, spike magazine
 *   arrives, coach sideline rant)
 * - `weather` : altère le climat de la pelouse (sudden downpour, fog)
 * - `crowd` : effet du public (crowd riot, cheering section)
 *
 * Effets
 * ------
 * Le champ `effect` est un descripteur libre consommé par les hooks de
 * la tâche 0.C.2 (injection dans le state). Ce module ne mute aucun
 * state — il ne fait que lister les events et tirer une instance par
 * appel. Les effets concrets sont câblés en 0.C.2.
 */

import type { MatchEvent } from '@bb/shared-types';

import type { Rng } from '../rng/seeded';

export type NuffleEventKind = 'positive' | 'negative' | 'neutral' | 'weather' | 'crowd';

export interface NuffleEffect {
  /** Free-form effect type — `'+1 confidence'`, `'-1 ag temporary'`, etc. */
  type: string;
  /** Optional magnitude (1, 2, 3 …) for stat-based effects. */
  magnitude?: number;
}

export interface NuffleEvent {
  id: string;
  /** Per-turn trigger probability — sum across the catalogue ≈ 0.30. */
  probability: number;
  kind: NuffleEventKind;
  /** Short ticker-friendly text (BB-flavored). */
  description: string;
  effect?: NuffleEffect;
}

export const NUFFLE_EVENTS: readonly NuffleEvent[] = Object.freeze([
  // Positive — sprint table examples + extras (sum ≈ 0.090)
  {
    id: 'rookie_brilliance',
    probability: 0.03,
    kind: 'positive',
    description: 'A rookie pulls off a play above their stats — Nuffle smiles.',
    effect: { type: 'rookie_confidence', magnitude: 1 },
  },
  {
    id: 'sudden_inspiration',
    probability: 0.02,
    kind: 'positive',
    description: 'A player is struck by sudden inspiration and grows half a foot.',
    effect: { type: 'temporary_skill_grant' },
  },
  {
    id: 'lucky_bounce',
    probability: 0.015,
    kind: 'positive',
    description: 'The ball takes a friendly bounce — fortune favours the bold.',
    effect: { type: 'ball_settles_friendly' },
  },
  {
    id: 'veteran_redemption',
    probability: 0.01,
    kind: 'positive',
    description: 'A grizzled veteran finds one more ounce of glory.',
    effect: { type: 'reroll_grant_self' },
  },
  {
    id: 'star_player_rising',
    probability: 0.01,
    kind: 'positive',
    description: 'The star player ascends — the cameras eat it up.',
    effect: { type: 'star_confidence', magnitude: 2 },
  },

  // Negative — sprint table examples + extras (sum ≈ 0.080)
  {
    id: 'tantrum_star',
    probability: 0.02,
    kind: 'negative',
    description: 'A star player throws a tantrum and refuses to obey instructions.',
    effect: { type: 'star_skip_action' },
  },
  {
    id: 'banana_skin',
    probability: 0.02,
    kind: 'negative',
    description: 'A banana skin appears from nowhere. A player slips spectacularly.',
    effect: { type: 'random_player_prone' },
  },
  {
    id: 'cocky_drop',
    probability: 0.015,
    kind: 'negative',
    description: 'Showboating costs the carrier the ball.',
    effect: { type: 'ball_drop' },
  },
  {
    id: 'ref_blunder',
    probability: 0.015,
    kind: 'negative',
    description: 'The ref makes a baffling call — the crowd boos.',
    effect: { type: 'turnover_chance', magnitude: 1 },
  },
  {
    id: 'equipment_failure',
    probability: 0.005,
    kind: 'negative',
    description: 'A boot strap snaps, leaving a player limping.',
    effect: { type: 'temp_ma_minus_1' },
  },
  {
    id: 'wardrobe_malfunction',
    probability: 0.005,
    kind: 'negative',
    description: 'Wardrobe malfunction. The crowd is, uh, distracted.',
    effect: { type: 'crowd_distraction' },
  },

  // Bombardier-style chaos (sum ≈ 0.020)
  {
    id: 'bombardier_gone_wild',
    probability: 0.01,
    kind: 'negative',
    description: 'The Bombardier mistakes his own teammate for an enemy.',
    effect: { type: 'friendly_fire' },
  },
  {
    id: 'apprentice_wizard_spotted',
    probability: 0.01,
    kind: 'neutral',
    description: 'An apprentice wizard sneaks a Lightning Bolt into play.',
    effect: { type: 'random_lightning' },
  },

  // Neutral / narrative (sum ≈ 0.060)
  {
    id: 'nemesis_clash',
    probability: 0.03,
    kind: 'neutral',
    description: 'Two old rivals lock eyes — the next block will be personal.',
    effect: { type: 'next_block_amplified' },
  },
  {
    id: 'blood_in_water',
    probability: 0.015,
    kind: 'neutral',
    description: "Blood in the water — the crowd's bloodlust is rising.",
    effect: { type: 'foul_chance_up' },
  },
  {
    id: 'spike_magazine_arrives',
    probability: 0.005,
    kind: 'neutral',
    description: 'A Spike Magazine reporter arrives. Players posture for the photo.',
    effect: { type: 'narrative_only' },
  },
  {
    id: 'coach_sideline_rant',
    probability: 0.01,
    kind: 'neutral',
    description: 'A sideline rant electrifies the squad — and the ref.',
    effect: { type: 'temp_morale_swing' },
  },

  // Weather (sum ≈ 0.085 — sprint reference: weather_shift 5%)
  {
    id: 'weather_shift',
    probability: 0.05,
    kind: 'weather',
    description: 'The Nuffle Gods stir the clouds. Weather shifts.',
    effect: { type: 'reroll_weather' },
  },
  {
    id: 'sudden_downpour',
    probability: 0.015,
    kind: 'weather',
    description: 'A sudden downpour soaks the pitch. Pickups get harder.',
    effect: { type: 'set_weather', magnitude: 1 },
  },
  {
    id: 'wind_picks_up',
    probability: 0.01,
    kind: 'weather',
    description: 'A gust catches the ball mid-pass.',
    effect: { type: 'pass_modifier_minus_1' },
  },
  {
    id: 'fog_rolls_in',
    probability: 0.005,
    kind: 'weather',
    description: 'Fog rolls onto the field. Long passes become a prayer.',
    effect: { type: 'long_pass_penalty' },
  },
  {
    id: 'lightning_strike',
    probability: 0.005,
    kind: 'weather',
    description: 'A lightning strike hits the pitch. Nobody is hurt — yet.',
    effect: { type: 'narrative_only' },
  },

  // Crowd (sum ≈ 0.040)
  {
    id: 'crowd_riot',
    probability: 0.01,
    kind: 'crowd',
    description: 'A riot breaks out in the stands. Some fans spill onto the pitch.',
    effect: { type: 'random_player_stunned' },
  },
  {
    id: 'cheering_section',
    probability: 0.01,
    kind: 'crowd',
    description: 'A new cheering section ignites — the home team feels invincible.',
    effect: { type: 'home_morale_plus_1' },
  },
  {
    id: 'unhappy_fans',
    probability: 0.005,
    kind: 'crowd',
    description: 'Unhappy fans throw rotten produce at their own stars.',
    effect: { type: 'home_morale_minus_1' },
  },
  {
    id: 'fan_factor_surge',
    probability: 0.01,
    kind: 'crowd',
    description: 'Fan Factor surges — a roar that can be heard for miles.',
    effect: { type: 'reroll_grant_team' },
  },
  {
    id: 'streaker_invasion',
    probability: 0.005,
    kind: 'crowd',
    description: "A streaker invades the pitch. Players don't know where to look.",
    effect: { type: 'narrative_only' },
  },
] as const) as readonly NuffleEvent[];

/** Lookup helper, keyed by event id. */
export const NUFFLE_EVENT_BY_ID: Readonly<Record<string, NuffleEvent>> = Object.freeze(
  Object.fromEntries(NUFFLE_EVENTS.map((e) => [e.id, e]))
);

const TOTAL_PROBABILITY = NUFFLE_EVENTS.reduce((sum, e) => sum + e.probability, 0);

/**
 * Per-turn Nuffle roll.
 *
 * Implementation : single uniform draw in `[0, 1)` mapped to either
 * `null` (no event, probability `1 - TOTAL_PROBABILITY`) or to one of
 * the catalogue entries (weighted by their `probability`). This keeps
 * "at most one Nuffle event per turn" — the canonical BB ticker
 * convention.
 */
export function rollNuffleEvent(rng: Pick<Rng, 'next'>): NuffleEvent | null {
  const draw = rng.next();
  if (draw >= TOTAL_PROBABILITY) return null;
  let acc = 0;
  for (const ev of NUFFLE_EVENTS) {
    acc += ev.probability;
    if (draw < acc) return ev;
  }
  // Floating-point fallback ; should be unreachable.
  return NUFFLE_EVENTS[NUFFLE_EVENTS.length - 1];
}

export interface NuffleEmitOptions {
  displayAtMs: number;
  engineVer: string;
  seed?: number;
  /** Free-form context propagated in `meta` (turn, drivingTeam, etc.). */
  context?: Readonly<Record<string, unknown>>;
}

/**
 * Wraps a Nuffle event into the wire-level `MatchEvent` format consumed
 * by the broadcaster (lot 1.B) and the Nuffle Gazette (lot 1.E).
 */
export function emitNuffleEvent(
  event: NuffleEvent,
  options: NuffleEmitOptions
): MatchEvent {
  return {
    type: 'NUFFLE',
    displayAtMs: options.displayAtMs,
    engineVer: options.engineVer,
    seed: options.seed,
    meta: {
      id: event.id,
      kind: event.kind,
      description: event.description,
      effect: event.effect,
      ...(options.context ?? {}),
    },
  };
}
