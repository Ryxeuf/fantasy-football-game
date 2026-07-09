/**
 * Prayers to Nuffle — BB2020/BB3 Season 2
 * 16 prayers (D16) granted to the underdog team based on CTV difference.
 * Each prayer applies a real mechanical effect to the game state.
 */

import { GameState, TeamId, Player, RNG } from '../core/types';
import { createLogEntry } from '../utils/logging';
import { rollD6, roll2D6 } from '../utils/dice';
import { hasSkill } from '../skills/skill-effects';
import { isApothecaryAvailable as isApothecaryAvailableFn } from './apothecary';
import { hasRegeneration as hasRegenerationFn, tryRegeneration as tryRegenerationFn } from './regeneration';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrayerDefinition {
  id: string;
  name: string;
  nameFr: string;
  /** Effet (EN) — reformulé d'après la table officielle S2025. */
  description: string;
  /** Effet (FR) — reformulé d'après la table officielle S2025. */
  descriptionFr: string;
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
  // Table officielle Blood Bowl 2025 (S3) — transcription interne :
  // docs/regles-bb-2025/page-25.md. Libellés/effets reformulés (PI GW).
  // NB : `applyPrayerEffect` ci-dessous implémente encore les effets
  // simplifiés S2 du match online — alignement mécanique à traiter dans
  // le chantier online play (les textes ci-dessous font foi côté ligue).
  1: {
    id: 'treacherous-trapdoor',
    name: 'Treacherous Trapdoor',
    nameFr: 'Trappe Traîtresse',
    description: 'Whenever any player (either team) enters a Trapdoor square for any reason, roll a D6: on a 1 the trapdoor opens and the player falls through — make an Injury roll as if they had been pushed into the crowd. If they carried the ball, it bounces from the trapdoor square.',
    descriptionFr: "Dès qu'un joueur (des deux équipes) pénètre sur une case de Trappe, pour quelque raison que ce soit, jetez un D6 : sur 1, la Trappe cède et le joueur tombe — faites un Jet de Blessure comme s'il avait été Poussé dans le Public. S'il portait le ballon, celui-ci Rebondit depuis la case de la Trappe.",
  },
  2: {
    id: 'friends-with-the-ref',
    name: 'Friends with the Ref',
    nameFr: "Potes avec l'Arbitre",
    description: 'Each time you Argue the Call, treat any roll of 5 or 6 as "Well, When You Put It Like That…".',
    descriptionFr: "À chaque fois que vous Contestez la Décision de l'arbitre, tout jet de 5 ou 6 est traité comme « Ah oui, présenté comme ça… ».",
  },
  3: {
    id: 'stiletto',
    name: 'Stiletto',
    nameFr: 'Stylet',
    description: 'Randomly select one of your players playing this match: they gain the Stab trait until the end of the match.',
    descriptionFr: "Désignez au hasard un joueur de votre équipe présent pour ce match : il gagne le Trait Poignard jusqu'à la fin du match.",
  },
  4: {
    id: 'iron-man',
    name: 'Iron Man',
    nameFr: 'Homme de Fer',
    description: 'Choose one of your players playing this match: they improve their Armour Value by 1 (to a maximum of 11+) until the end of the match.',
    descriptionFr: "Choisissez un joueur de votre équipe présent pour ce match : son Armure s'améliore de 1 (maximum 11+) jusqu'à la fin du match.",
  },
  5: {
    id: 'knuckle-dusters',
    name: 'Knuckle Dusters',
    nameFr: 'Gants Cloutés',
    description: 'Choose one of your players playing this match: they gain the Mighty Blow skill until the end of the match.',
    descriptionFr: "Choisissez un joueur de votre équipe présent pour ce match : il gagne la Compétence Châtaigne jusqu'à la fin du match.",
  },
  6: {
    id: 'bad-habits',
    name: 'Bad Habits',
    nameFr: 'Mauvaises Habitudes',
    description: 'Randomly select D3 opposing players playing this match: they gain the Loner (2+) trait until the end of the match.',
    descriptionFr: "Désignez au hasard D3 joueurs adverses présents pour ce match : ils gagnent le Trait Solitaire (2+) jusqu'à la fin du match.",
  },
  7: {
    id: 'greasy-cleats',
    name: 'Greasy Cleats',
    nameFr: 'Crampons Graisseux',
    description: 'Randomly select one opposing player playing this match: their Movement Allowance is reduced by 1 (minimum 1) until the end of the match.',
    descriptionFr: "Désignez au hasard un joueur adverse présent pour ce match : son Mouvement est réduit de 1 (minimum 1) jusqu'à la fin du match.",
  },
  8: {
    id: 'blessed-statue-of-nuffle',
    name: 'Blessed Statue of Nuffle',
    nameFr: 'Bénédiction de Nuffle',
    description: 'Randomly select one of your players playing this match: they gain the Pro skill until the end of the match.',
    descriptionFr: "Désignez au hasard un joueur de votre équipe présent pour ce match : il gagne la Compétence Pro jusqu'à la fin du match.",
  },
  9: {
    id: 'moles-under-the-pitch',
    name: 'Moles Under the Pitch',
    nameFr: 'Des Taupes sous le Terrain',
    description: 'Opposing players suffer a -1 modifier when they attempt to Rush.',
    descriptionFr: 'Les joueurs adverses subissent un modificateur de -1 à leurs jets quand ils tentent de Foncer.',
  },
  10: {
    id: 'perfect-passing',
    name: 'Perfect Passing',
    nameFr: 'Passe Parfaite',
    description: 'Any player on your team who earns a Completion gains 2 SPP instead of 1.',
    descriptionFr: 'Tout joueur de votre équipe qui accomplit une Réussite gagne 2 PSP au lieu de 1 PSP.',
  },
  11: {
    id: 'stunning-catch',
    name: 'Stunning Catch',
    nameFr: 'Réception Étourdissante',
    description: 'Any player on your team who successfully catches the ball following a Pass action gains 1 SPP.',
    descriptionFr: "Tout joueur de votre équipe qui Réceptionne le ballon avec succès à la suite d'une Action de Passe gagne 1 PSP.",
  },
  12: {
    id: 'fan-interaction',
    name: 'Fan Interaction',
    nameFr: 'Interaction avec les Fans',
    description: 'When an opposing player suffers a Casualty as a result of being pushed into the crowd, the player who pushed them gains 2 SPP.',
    descriptionFr: "Quand un joueur adverse subit une Élimination après avoir été Poussé dans le Public, le joueur qui l'y a poussé gagne 2 PSP.",
  },
  13: {
    id: 'fouling-frenzy',
    name: 'Fouling Frenzy',
    nameFr: "Frénésie d'Agression",
    description: 'Any player on your team who inflicts a Casualty with a Foul action gains 2 SPP.',
    descriptionFr: "Tout joueur de votre équipe qui inflige une Élimination lors d'une Action d'Agression gagne 2 PSP.",
  },
  14: {
    id: 'throw-a-rock',
    name: 'Throw a Rock',
    nameFr: 'Lancer de Pierre',
    description: 'Once per match, at the start of any of your turns and before activating any player, randomly select an opposing player on the pitch and roll a D6: on 4+, an angry fan throws a rock and that player is immediately Knocked Down.',
    descriptionFr: "Une fois par match, au début d'un de vos Tours et avant toute activation, désignez au hasard un joueur adverse sur le terrain et jetez un D6 : sur 4+, un fan en colère lui jette une pierre et il est immédiatement Plaqué.",
  },
  15: {
    id: 'under-scrutiny',
    name: 'Under Scrutiny',
    nameFr: 'Sous Surveillance',
    description: 'Any opposing player who performs a Foul action is automatically Sent Off if the armour is broken, whether or not a natural double was rolled.',
    descriptionFr: "Tout joueur adverse qui effectue une Action d'Agression est automatiquement Expulsé si l'armure est pénétrée, qu'un double naturel ait été obtenu ou non.",
  },
  16: {
    id: 'intensive-training',
    name: 'Intensive Training',
    nameFr: 'Entraînement Intensif',
    description: 'Randomly select one of your players playing this match: they gain a single Primary skill of your choice until the end of the match.',
    descriptionFr: "Désignez au hasard un joueur de votre équipe présent pour ce match : il gagne une unique Compétence Principale de votre choix jusqu'à la fin du match.",
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

function performPrayerInjuryRoll(
  rng: RNG,
  target?: Player,
): 'stunned' | 'knocked_out' | 'casualty' {
  // BUG fix : aligner le jet de Prayer 14 (Throw a Rock!) avec
  // `performInjuryRoll` :
  //  - Stunty cible : -1 a l'injury (le caillou les fait moins de
  //    degats par rapport a la table de blessure standard) — non,
  //    Stunty s'applique au jet de CASUALTY, pas au jet de blessure.
  //  - Armored Skull : -1 a tout injury roll (BB3 S2/S3).
  // Avant le fix, le jet de Prayer 14 etait nu (pas de modificateurs
  // de skill defensifs), ce qui surevaluait les KOs / casualties sur
  // les cibles armored.
  const armoredSkullMod = target && hasSkill(target, 'armored-skull') ? -1 : 0;
  const injuryRoll = roll2D6(rng) + armoredSkullMod;
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

      const injuryOutcome = performPrayerInjuryRoll(rng, target);
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
          // BUG fix : avant, on forçait `state='casualty'` directement
          // sans set `casualtyResults`, ni proposer apothecaire/regen.
          // Maintenant on enregistre une casualty 'badly_hurt' (par
          // défaut Prayer 14 — pas de D16 spécifié dans la règle) ET
          // on offre les sauvegardes (apothecary/regen) comme tout
          // jet de casualty normal.
          newState = updatePlayer(state, target.id, (p) => ({
            ...p,
            state: 'casualty',
            pos: { x: -1, y: -1 },
          }));
          newState = {
            ...newState,
            casualtyResults: {
              ...(newState.casualtyResults ?? {}),
              [target.id]: 'badly_hurt',
            },
          };
          // Apothecary check (cf. injury.ts:handleCasualty pattern).
          if (isApothecaryAvailableFn(newState, target.id)) {
            newState = {
              ...newState,
              pendingApothecary: {
                playerId: target.id,
                team: target.team,
                injuryType: 'casualty',
                originalCasualtyOutcome: 'badly_hurt',
                fallbackToRegeneration: hasRegenerationFn(newState, target.id),
              },
            };
          } else if (hasRegenerationFn(newState, target.id)) {
            const regenResult = tryRegenerationFn(newState, target.id, rng, 'casualty');
            if (regenResult) newState = regenResult;
          }
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
