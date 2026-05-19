/**
 * Foul resolver — sprint Pro League 0.A.5.
 *
 * BB rule (BB2020 / BB3) :
 * - Once per turn the active team may foul a `prone` or `stunned` opposing
 *   player adjacent to a fouler.
 * - Armour roll : 2d6 + assists (offensive − defensive) ≥ AV +1 to break.
 * - Skill `dirty_player` : `+1` to armour AND injury roll.
 * - On break, injury roll 2d6 + bonuses :
 *   - 2-7 → stunned, 8-9 → KO, 10+ → casualty.
 * - Skill `mighty_blow` : NOT applicable to fouls (BB2020 skill text).
 * - Referee : doubles on the armour roll → fouler sent off, turnover.
 */

import type { MatchEvent } from '@bb/shared-types';

import { rollD6 } from '../rng/seeded';

import {
  hasSkill,
  isAdjacent,
  requirePlayer,
  updatePlayer,
  type ResolverResult,
  type ResolverRng,
  type ResolverState,
} from './types';

export interface FoulInput {
  foulerId: string;
  victimId: string;
  displayAtMs: number;
}

export type FoulInjuryOutcome = 'stunned' | 'ko' | 'casualty';

export interface FoulResult extends ResolverResult {
  readonly trace: {
    armorRoll: [number, number];
    armorAssists: number;
    armorTarget: number;
    armorBroken: boolean;
    injuryRoll?: [number, number];
    injuryOutcome?: FoulInjuryOutcome;
    sentOff: boolean;
  };
}

function countFoulAssists(
  state: ResolverState,
  fouler: ResolverState['players'][number],
  victim: ResolverState['players'][number]
): { offense: number; defense: number } {
  let offense = 0;
  let defense = 0;
  for (const p of state.players) {
    if (p.id === fouler.id || p.id === victim.id) continue;
    if (p.state !== 'standing') continue;
    if (p.team === fouler.team && isAdjacent(p.position, victim.position)) {
      offense += 1;
    } else if (p.team === victim.team && isAdjacent(p.position, fouler.position)) {
      defense += 1;
    }
  }
  return { offense, defense };
}

export function resolveFoul(
  state: ResolverState,
  input: FoulInput,
  rng: ResolverRng
): FoulResult {
  const fouler = requirePlayer(state, input.foulerId);
  const victim = requirePlayer(state, input.victimId);

  if (fouler.team === victim.team) {
    throw new Error('resolveFoul: cannot foul own teammate');
  }
  if (fouler.state !== 'standing') {
    throw new Error('resolveFoul: fouler must be standing');
  }
  if (victim.state !== 'prone' && victim.state !== 'stunned') {
    throw new Error('resolveFoul: victim must be prone or stunned');
  }
  if (!isAdjacent(fouler.position, victim.position)) {
    throw new Error('resolveFoul: fouler and victim must be adjacent');
  }

  const { offense, defense } = countFoulAssists(state, fouler, victim);
  const assistDelta = offense - defense;
  // BUG fix audit round 6 (HIGH) : avant, Dirty Player ajoutait +1
  // SIMULTANEMENT a l'armor roll ET a l'injury roll. BB2020/BB3 rule :
  // Dirty Player donne +1 sur **armor OR injury**, le fouler choisit ;
  // jamais les deux. Doublait l'efficacite du skill.
  // Politique deterministe : si armor casse → apply DP a l'injury
  // (le fouler veut maximiser les degats). Sinon → on l'a deja applique
  // a l'armor (best chance de casser). Cf. plus bas.
  const hasDirtyPlayer = hasSkill(fouler, 'dirty_player');
  const armorRoll: [number, number] = [
    rollD6(rng as Parameters<typeof rollD6>[0]),
    rollD6(rng as Parameters<typeof rollD6>[0]),
  ];
  // BUG fix audit round 6 (HIGH/Stunty) : avant, `armorTarget = victim.av + 1`
  // ignorait Stunty (-1 AV). Halfling/Goblin/Skink foul utilisait AV=7+1=8
  // au lieu de 6+1=7. Aligne avec game-engine foul.ts via meme decremement.
  const stuntyMod = hasSkill(victim, 'stunty') ? -1 : 0;
  // On applique DP a l'armor uniquement si on n'a pas encore casse — on ne
  // peut pas savoir avant le roll, donc on applique a l'armor ; si l'armor
  // casse, on REMET le bonus sur l'injury (cf. injuryTotal plus bas).
  const dirtyPlayerOnArmor = hasDirtyPlayer ? 1 : 0;
  const armorTotal = armorRoll[0] + armorRoll[1] + assistDelta + dirtyPlayerOnArmor;
  const armorTarget = victim.av + 1 + stuntyMod;
  const armorBroken = armorTotal >= armorTarget;
  const armorDoubles = armorRoll[0] === armorRoll[1];

  const events: MatchEvent[] = [];
  let newState: ResolverState = state;
  let injuryRoll: [number, number] | undefined;
  let injuryOutcome: FoulInjuryOutcome | undefined;
  let injuryDoubles = false;

  if (armorBroken) {
    injuryRoll = [
      rollD6(rng as Parameters<typeof rollD6>[0]),
      rollD6(rng as Parameters<typeof rollD6>[0]),
    ];
    injuryDoubles = injuryRoll[0] === injuryRoll[1];
    // Audit round 6 : DP applique a l'armor (deja), donc PAS a l'injury.
    // BB rule = armor OR injury, jamais les deux. Si on voulait optimiser
    // (DP only on injury si armor casse de toute facon), on ne peut pas
    // savoir avant. Choix pragmatique : armor d'abord, injury sans DP.
    const injuryTotal = injuryRoll[0] + injuryRoll[1];
    if (injuryTotal >= 10) injuryOutcome = 'casualty';
    else if (injuryTotal >= 8) injuryOutcome = 'ko';
    else injuryOutcome = 'stunned';

    newState = updatePlayer(newState, victim.id, { state: injuryOutcome });
    if (injuryOutcome === 'ko') {
      events.push({
        type: 'KO',
        displayAtMs: input.displayAtMs,
        engineVer: state.engineVer,
        meta: { playerId: victim.id, causedBy: fouler.id, via: 'foul' },
      });
    } else if (injuryOutcome === 'casualty') {
      events.push({
        type: 'CASUALTY',
        displayAtMs: input.displayAtMs,
        engineVer: state.engineVer,
        meta: { playerId: victim.id, causedBy: fouler.id, via: 'foul' },
      });
    }
  }

  // BB2020/BB3 : doubles sur Armour OR Injury roll → fouleur expulsé. Avant
  // ce fix, seul le double armor déclenchait — sous-estimation des
  // expulsions sur foul. Skill `sneaky_git` permettrait d'ignorer le double
  // armor si l'armure ne casse pas, mais on garde le simplification BB2020
  // base : tout double sur l'un des deux rolls envoie au vestiaire.
  const sentOff = armorDoubles || injuryDoubles;

  if (sentOff) {
    // BUG fix : utiliser `sent_off` (BB2020 expulsion) au lieu de
    // `casualty`. Le joueur expulsé n'est PAS blessé — il sort
    // définitivement pour la mi-temps en cours sans jet apothecary.
    // Avant le fix, le `casualty` faussait les stats de victimes et
    // ouvrait la voie à un apothecary erroné côté driver.
    newState = updatePlayer(newState, fouler.id, { state: 'sent_off' });
  }

  events.unshift({
    type: 'BLOCK', // No `FOUL` slot in 0.A.3 catalogue ; foul is logged as a BLOCK
    // event with `meta.kind = 'foul'` (broadcaster filters on meta.kind).
    displayAtMs: input.displayAtMs,
    engineVer: state.engineVer,
    meta: {
      kind: 'foul',
      foulerId: fouler.id,
      victimId: victim.id,
      armorRoll,
      assists: { offense, defense },
      armorTarget,
      armorTotal,
      armorBroken,
      injuryRoll,
      injuryOutcome,
      sentOff,
      dirtyPlayer: hasDirtyPlayer,
    },
  });

  if (sentOff) {
    events.push({
      type: 'TURNOVER',
      displayAtMs: input.displayAtMs,
      engineVer: state.engineVer,
      meta: { cause: 'foul_sent_off', foulerId: fouler.id },
    });
  }

  return {
    // A foul itself is not a "success/fail" action ; we mark `success`
    // as `armorBroken` for ticker semantics, and `turnover` on send-off.
    success: armorBroken,
    turnover: sentOff,
    newState,
    events,
    trace: {
      armorRoll,
      armorAssists: assistDelta,
      armorTarget,
      armorBroken,
      injuryRoll,
      injuryOutcome,
      sentOff,
    },
  };
}
