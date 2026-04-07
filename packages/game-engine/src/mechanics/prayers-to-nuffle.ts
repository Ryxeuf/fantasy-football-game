/**
 * Prayers to Nuffle — BB2020/BB3 Season 2
 * 16 prayers (D16) granted to the underdog team based on CTV difference.
 * Each prayer applies a real mechanical effect to the game state.
 */

import { GameState, TeamId, Player, RNG } from '../core/types';
import { createLogEntry } from '../utils/logging';
import { rollD6, roll2D6 } from '../utils/dice';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrayerDefinition {
  id: string;
  name: string;
  nameFr: string;
  description: string;
}

/** Persistent prayer effect tracked during the match */
export interface PrayerEffect {
  type: 'bribe' | 'foul-penalty' | 'skill-granted' | 'stat-mod';
  team: TeamId;
  prayerId: string;
  playerId?: string;
  details?: Record<string, unknown>;
}

export interface PrayerEffectResult {
  state: GameState;
  description: string;
  prayerEffect?: PrayerEffect;
}

// ---------------------------------------------------------------------------
// Primary skill pool for Intensive Training (Prayer 16)
// ---------------------------------------------------------------------------

const PRIMARY_SKILLS: readonly string[] = [
  'block', 'dodge', 'sure-hands', 'sure-feet', 'pass',
  'catch', 'fend', 'kick', 'strip-ball', 'tackle',
  'wrestle', 'diving-tackle', 'shadowing', 'side-step',
] as const;

// ---------------------------------------------------------------------------
// Prayer Table (D16)
// ---------------------------------------------------------------------------

export const PRAYERS_TABLE: Record<number, PrayerDefinition> = {
  1: {
    id: 'treacherous-trapdoor',
    name: 'Treacherous Trapdoor',
    nameFr: 'Trappe traîtresse',
    description: 'Randomly select one opposition player — that player is immediately removed from play and placed in the Reserves box.',
  },
  2: {
    id: 'friends-with-the-ref',
    name: 'Friends with the Ref',
    nameFr: 'Ami avec l\'arbitre',
    description: 'The team gains one free Bribe inducement for this match.',
  },
  3: {
    id: 'stiletto',
    name: 'Stiletto',
    nameFr: 'Stiletto',
    description: 'Randomly select one player on the team — that player gains the Stab trait for this match.',
  },
  4: {
    id: 'iron-man',
    name: 'Iron Man',
    nameFr: 'Homme de fer',
    description: 'Randomly select one player on the team — that player gains Iron Hard Skin for this match.',
  },
  5: {
    id: 'knuckle-dusters',
    name: 'Knuckle Dusters',
    nameFr: 'Coups de poing américains',
    description: 'Randomly select one player on the team — that player gains Mighty Blow (+1) for this match.',
  },
  6: {
    id: 'bad-habits',
    name: 'Bad Habits',
    nameFr: 'Mauvaises habitudes',
    description: 'Randomly select one opposition player — that player gains Loner (4+) for this match.',
  },
  7: {
    id: 'greasy-cleats',
    name: 'Greasy Cleats',
    nameFr: 'Crampons graissés',
    description: 'Randomly select one opposition player — that player suffers -1 MA for this match (minimum 1).',
  },
  8: {
    id: 'blessed-statue-of-nuffle',
    name: 'Blessed Statue of Nuffle',
    nameFr: 'Statue bénie de Nuffle',
    description: 'The team gains +1 team re-roll for this match.',
  },
  9: {
    id: 'moles-under-the-pitch',
    name: 'Moles Under the Pitch',
    nameFr: 'Taupes sous le terrain',
    description: 'Randomly select one opposition player — that player is placed prone. No Armour roll is made.',
  },
  10: {
    id: 'perfect-passing',
    name: 'Perfect Passing',
    nameFr: 'Passe parfaite',
    description: 'Randomly select one player on the team — that player gains +1 PA for this match (minimum 1+).',
  },
  11: {
    id: 'fan-interaction',
    name: 'Fan Interaction',
    nameFr: 'Interaction avec les fans',
    description: 'Randomly select one opposition player — that player is immediately Stunned.',
  },
  12: {
    id: 'necessary-violence',
    name: 'Necessary Violence',
    nameFr: 'Violence nécessaire',
    description: 'Randomly select one player on the team — that player gains Mighty Blow (+1) and Piling On for this match.',
  },
  13: {
    id: 'fouling-frenzy',
    name: 'Fouling Frenzy',
    nameFr: 'Frénésie de fautes',
    description: 'The team gains one free Bribe inducement for this match.',
  },
  14: {
    id: 'throw-a-rock',
    name: 'Throw a Rock',
    nameFr: 'Lancer de pierre',
    description: 'Randomly select one opposition player — an Injury roll is immediately made against them (no Armour roll).',
  },
  15: {
    id: 'under-scrutiny',
    name: 'Under Scrutiny',
    nameFr: 'Sous surveillance',
    description: 'All opposition players suffer a -1 modifier on Armour rolls made as part of Foul actions for this match.',
  },
  16: {
    id: 'intensive-training',
    name: 'Intensive Training',
    nameFr: 'Entraînement intensif',
    description: 'Randomly select one player on the team — that player gains a randomly selected Primary skill for this match.',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActivePlayers(state: GameState, team: TeamId): Player[] {
  return state.players.filter(
    (p) => p.team === team && p.state === 'active' && !p.stunned
  );
}

function pickRandomPlayer(players: Player[], rng: RNG): Player | undefined {
  if (players.length === 0) return undefined;
  const index = Math.floor(rng() * players.length);
  return players[index];
}

function updatePlayer(state: GameState, playerId: string, updater: (p: Player) => Player): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? updater(p) : p)),
  };
}

function addSkillToPlayer(state: GameState, playerId: string, skill: string): GameState {
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    skills: p.skills.includes(skill) ? p.skills : [...p.skills, skill],
  }));
}

function getOpponentTeam(team: TeamId): TeamId {
  return team === 'A' ? 'B' : 'A';
}

// ---------------------------------------------------------------------------
// Injury roll helper (simplified for pre-match prayer context)
// ---------------------------------------------------------------------------

function performPrayerInjuryRoll(rng: RNG): 'stunned' | 'knocked_out' | 'casualty' {
  const injuryRoll = roll2D6(rng);
  if (injuryRoll <= 7) return 'stunned';
  if (injuryRoll <= 9) return 'knocked_out';
  return 'casualty';
}

// ---------------------------------------------------------------------------
// Apply Prayer Effect
// ---------------------------------------------------------------------------

/**
 * Applies the mechanical effect of a prayer to the game state.
 * @param state - Current game state
 * @param prayerNumber - D16 result (1-16)
 * @param underdogTeam - Team receiving the prayer
 * @param rng - Seeded RNG
 * @returns Updated state + description + optional persistent effect
 */
export function applyPrayerEffect(
  state: GameState,
  prayerNumber: number,
  underdogTeam: TeamId,
  rng: RNG
): PrayerEffectResult {
  const prayer = PRAYERS_TABLE[prayerNumber];
  if (!prayer) {
    return { state, description: `Prière inconnue (${prayerNumber})` };
  }

  const opponentTeam = getOpponentTeam(underdogTeam);
  const friendlyPlayers = getActivePlayers(state, underdogTeam);
  const opponentPlayers = getActivePlayers(state, opponentTeam);

  switch (prayerNumber) {
    // ----- 1. Treacherous Trapdoor -----
    case 1: {
      // Also consider non-stunned active players on opponent side (broader: any on-pitch)
      const allOpponents = state.players.filter(
        (p) => p.team === opponentTeam && p.state === 'active'
      );
      const target = pickRandomPlayer(allOpponents, rng);
      if (!target) {
        return { state, description: `${prayer.nameFr} — Aucun joueur adverse disponible.` };
      }
      const newState = updatePlayer(state, target.id, (p) => ({
        ...p,
        state: 'active',
        pos: { x: -1, y: -1 }, // Off-pitch
      }));
      // Move to reserves dugout
      const stateWithDugout = {
        ...newState,
        dugouts: {
          ...newState.dugouts,
          [opponentTeam === 'A' ? 'teamA' : 'teamB']: {
            ...newState.dugouts[opponentTeam === 'A' ? 'teamA' : 'teamB'],
            zones: {
              ...newState.dugouts[opponentTeam === 'A' ? 'teamA' : 'teamB'].zones,
              reserves: {
                ...newState.dugouts[opponentTeam === 'A' ? 'teamA' : 'teamB'].zones.reserves,
                players: [
                  ...newState.dugouts[opponentTeam === 'A' ? 'teamA' : 'teamB'].zones.reserves.players,
                  target.id,
                ],
              },
            },
          },
        },
      };
      // Remove from active players on pitch
      const finalState = updatePlayer(stateWithDugout, target.id, (p) => ({
        ...p,
        state: 'active', // Still "active" but in reserves (will be available next drive)
        pos: { x: -1, y: -1 },
      }));
      return {
        state: finalState,
        description: `${prayer.nameFr} — Treacherous Trapdoor ! ${target.name} (#${target.number}) tombe dans une trappe et rejoint les réserves.`,
      };
    }

    // ----- 2. Friends with the Ref -----
    case 2: {
      return {
        state,
        description: `${prayer.nameFr} — L'équipe reçoit un Pot-de-vin gratuit.`,
        prayerEffect: {
          type: 'bribe',
          team: underdogTeam,
          prayerId: prayer.id,
        },
      };
    }

    // ----- 3. Stiletto -----
    case 3: {
      const target = pickRandomPlayer(friendlyPlayers, rng);
      if (!target) {
        return { state, description: `${prayer.nameFr} — Aucun joueur disponible.` };
      }
      const newState = addSkillToPlayer(state, target.id, 'stab');
      return {
        state: newState,
        description: `${prayer.nameFr} — ${target.name} (#${target.number}) obtient la compétence Stab.`,
        prayerEffect: {
          type: 'skill-granted',
          team: underdogTeam,
          prayerId: prayer.id,
          playerId: target.id,
          details: { skill: 'stab' },
        },
      };
    }

    // ----- 4. Iron Man -----
    case 4: {
      const target = pickRandomPlayer(friendlyPlayers, rng);
      if (!target) {
        return { state, description: `${prayer.nameFr} — Aucun joueur disponible.` };
      }
      const newState = addSkillToPlayer(state, target.id, 'iron-hard-skin');
      return {
        state: newState,
        description: `${prayer.nameFr} — ${target.name} (#${target.number}) obtient Iron Hard Skin.`,
        prayerEffect: {
          type: 'skill-granted',
          team: underdogTeam,
          prayerId: prayer.id,
          playerId: target.id,
          details: { skill: 'iron-hard-skin' },
        },
      };
    }

    // ----- 5. Knuckle Dusters -----
    case 5: {
      const target = pickRandomPlayer(friendlyPlayers, rng);
      if (!target) {
        return { state, description: `${prayer.nameFr} — Aucun joueur disponible.` };
      }
      const newState = addSkillToPlayer(state, target.id, 'mighty-blow');
      return {
        state: newState,
        description: `${prayer.nameFr} — ${target.name} (#${target.number}) obtient Mighty Blow (+1).`,
        prayerEffect: {
          type: 'skill-granted',
          team: underdogTeam,
          prayerId: prayer.id,
          playerId: target.id,
          details: { skill: 'mighty-blow' },
        },
      };
    }

    // ----- 6. Bad Habits -----
    case 6: {
      const target = pickRandomPlayer(opponentPlayers, rng);
      if (!target) {
        return { state, description: `${prayer.nameFr} — Aucun joueur adverse disponible.` };
      }
      const newState = addSkillToPlayer(state, target.id, 'loner');
      return {
        state: newState,
        description: `${prayer.nameFr} — ${target.name} (#${target.number}) reçoit Loner (4+).`,
        prayerEffect: {
          type: 'skill-granted',
          team: opponentTeam,
          prayerId: prayer.id,
          playerId: target.id,
          details: { skill: 'loner' },
        },
      };
    }

    // ----- 7. Greasy Cleats -----
    case 7: {
      const target = pickRandomPlayer(opponentPlayers, rng);
      if (!target) {
        return { state, description: `${prayer.nameFr} — Aucun joueur adverse disponible.` };
      }
      const newState = updatePlayer(state, target.id, (p) => ({
        ...p,
        ma: Math.max(1, p.ma - 1),
      }));
      return {
        state: newState,
        description: `${prayer.nameFr} — ${target.name} (#${target.number}) perd 1 MA (maintenant ${Math.max(1, target.ma - 1)}).`,
        prayerEffect: {
          type: 'stat-mod',
          team: opponentTeam,
          prayerId: prayer.id,
          playerId: target.id,
          details: { stat: 'ma', modifier: -1 },
        },
      };
    }

    // ----- 8. Blessed Statue of Nuffle -----
    case 8: {
      const rerollKey = underdogTeam === 'A' ? 'teamA' : 'teamB';
      const newState: GameState = {
        ...state,
        teamRerolls: {
          ...state.teamRerolls,
          [rerollKey]: state.teamRerolls[rerollKey] + 1,
        },
      };
      return {
        state: newState,
        description: `${prayer.nameFr} — L'équipe reçoit +1 relance d'équipe.`,
      };
    }

    // ----- 9. Moles Under the Pitch -----
    case 9: {
      const target = pickRandomPlayer(opponentPlayers, rng);
      if (!target) {
        return { state, description: `${prayer.nameFr} — Aucun joueur adverse disponible.` };
      }
      // Place prone = stunned (no armor roll)
      const newState = updatePlayer(state, target.id, (p) => ({
        ...p,
        stunned: true,
      }));
      return {
        state: newState,
        description: `${prayer.nameFr} — ${target.name} (#${target.number}) est mis au sol (pas de jet d'armure).`,
      };
    }

    // ----- 10. Perfect Passing -----
    case 10: {
      const target = pickRandomPlayer(friendlyPlayers, rng);
      if (!target) {
        return { state, description: `${prayer.nameFr} — Aucun joueur disponible.` };
      }
      // In BB, lower PA is better (target number)
      const newState = updatePlayer(state, target.id, (p) => ({
        ...p,
        pa: Math.max(1, p.pa - 1),
      }));
      return {
        state: newState,
        description: `${prayer.nameFr} — ${target.name} (#${target.number}) gagne +1 PA (maintenant ${Math.max(1, target.pa - 1)}+).`,
        prayerEffect: {
          type: 'stat-mod',
          team: underdogTeam,
          prayerId: prayer.id,
          playerId: target.id,
          details: { stat: 'pa', modifier: -1 },
        },
      };
    }

    // ----- 11. Fan Interaction -----
    case 11: {
      const target = pickRandomPlayer(opponentPlayers, rng);
      if (!target) {
        return { state, description: `${prayer.nameFr} — Aucun joueur adverse disponible.` };
      }
      const newState = updatePlayer(state, target.id, (p) => ({
        ...p,
        stunned: true,
      }));
      return {
        state: newState,
        description: `${prayer.nameFr} — ${target.name} (#${target.number}) est sonné par les fans !`,
      };
    }

    // ----- 12. Necessary Violence -----
    case 12: {
      const target = pickRandomPlayer(friendlyPlayers, rng);
      if (!target) {
        return { state, description: `${prayer.nameFr} — Aucun joueur disponible.` };
      }
      let newState = addSkillToPlayer(state, target.id, 'mighty-blow');
      newState = addSkillToPlayer(newState, target.id, 'piling-on');
      return {
        state: newState,
        description: `${prayer.nameFr} — ${target.name} (#${target.number}) obtient Mighty Blow (+1) et Piling On.`,
        prayerEffect: {
          type: 'skill-granted',
          team: underdogTeam,
          prayerId: prayer.id,
          playerId: target.id,
          details: { skills: ['mighty-blow', 'piling-on'] },
        },
      };
    }

    // ----- 13. Fouling Frenzy -----
    case 13: {
      return {
        state,
        description: `${prayer.nameFr} — L'équipe reçoit un Pot-de-vin gratuit.`,
        prayerEffect: {
          type: 'bribe',
          team: underdogTeam,
          prayerId: prayer.id,
        },
      };
    }

    // ----- 14. Throw a Rock -----
    case 14: {
      const allOpponents = state.players.filter(
        (p) => p.team === opponentTeam && p.state === 'active'
      );
      const target = pickRandomPlayer(allOpponents, rng);
      if (!target) {
        return { state, description: `${prayer.nameFr} — Aucun joueur adverse disponible.` };
      }

      const injuryOutcome = performPrayerInjuryRoll(rng);
      let newState: GameState;

      switch (injuryOutcome) {
        case 'stunned':
          newState = updatePlayer(state, target.id, (p) => ({
            ...p,
            stunned: true,
          }));
          break;
        case 'knocked_out':
          newState = updatePlayer(state, target.id, (p) => ({
            ...p,
            state: 'knocked_out',
            pos: { x: -1, y: -1 },
          }));
          break;
        case 'casualty':
          newState = updatePlayer(state, target.id, (p) => ({
            ...p,
            state: 'casualty',
            pos: { x: -1, y: -1 },
          }));
          break;
      }

      return {
        state: newState!,
        description: `${prayer.nameFr} — Throw a Rock ! ${target.name} (#${target.number}) subit un jet de blessure : ${injuryOutcome}.`,
      };
    }

    // ----- 15. Under Scrutiny -----
    case 15: {
      return {
        state,
        description: `${prayer.nameFr} — Les joueurs adverses subissent -1 aux jets d'armure lors des fautes.`,
        prayerEffect: {
          type: 'foul-penalty',
          team: opponentTeam,
          prayerId: prayer.id,
          details: { modifier: -1, scope: 'foul-armor' },
        },
      };
    }

    // ----- 16. Intensive Training -----
    case 16: {
      const target = pickRandomPlayer(friendlyPlayers, rng);
      if (!target) {
        return { state, description: `${prayer.nameFr} — Aucun joueur disponible.` };
      }

      // Pick a random primary skill the player doesn't already have
      const availableSkills = PRIMARY_SKILLS.filter((s) => !target.skills.includes(s));
      if (availableSkills.length === 0) {
        return { state, description: `${prayer.nameFr} — ${target.name} possède déjà toutes les compétences primaires.` };
      }
      const skillIndex = Math.floor(rng() * availableSkills.length);
      const chosenSkill = availableSkills[skillIndex];

      const newState = addSkillToPlayer(state, target.id, chosenSkill);
      return {
        state: newState,
        description: `${prayer.nameFr} — ${target.name} (#${target.number}) obtient ${chosenSkill} (entraînement intensif).`,
        prayerEffect: {
          type: 'skill-granted',
          team: underdogTeam,
          prayerId: prayer.id,
          playerId: target.id,
          details: { skill: chosenSkill },
        },
      };
    }

    default:
      return { state, description: `Prière inconnue (${prayerNumber})` };
  }
}
