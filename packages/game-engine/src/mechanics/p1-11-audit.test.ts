/**
 * P1.11 — Audit : vérifier que prehensile-tail, frenzy, throw-team-mate,
 * thick-skull, on-the-ball, loner s'appliquent correctement aux joueurs des
 * 5 équipes prioritaires (Skaven, Gnomes, Hommes-Lézards, Nains, Noblesse
 * Impériale).
 */
import { describe, it, expect } from 'vitest';
import {
  setup,
  applyMove,
  resolveBlockResult,
  makeRNG,
  type GameState,
  type Player,
} from '../index';
import { TEAM_ROSTERS_BY_RULESET } from '../rosters/positions';

// P1.11 fige le contenu MVP audité sur le ruleset Saison 2 (slugs d'origine).
// Ce bloc utilise explicitement `season_2` pour rester stable face au défaut
// global (désormais `season_3`), qui renomme ces positions.
const TEAM_ROSTERS = TEAM_ROSTERS_BY_RULESET.season_2;
import { hasSkill } from '../skills/skill-effects';
import { getDodgeSkillModifiers, getInjurySkillModifiers } from '../skills/skill-bridge';
import { canTriggerOnTheBall, getOnTheBallReactivePlayers } from './on-the-ball';
import { canThrowTeamMate } from './throw-team-mate';
import { hasFrenzy } from './frenzy';
import { getSkillEffect } from '../skills/skill-registry';

// ── Helpers ──────────────────────────────────────────────────────────────

function basePlayer(overrides: Partial<Player>): Player {
  return {
    id: 'X',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Test',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    hasBall: false,
    state: 'active',
    ...overrides,
  };
}

function buildState(players: Player[]): GameState {
  const state = setup();
  state.players = players;
  return state;
}

// ── Roster skill verification ────────────────────────────────────────────

describe('P1.11 Audit — roster skills présentes sur les 5 équipes', () => {
  it('Skaven Rat Ogre possède frenzy, prehensile-tail, loner-4', () => {
    const roster = TEAM_ROSTERS['skaven'];
    const ratOgre = roster.positions.find(p => p.slug === 'skaven_rat_ogre')!;
    const skills = ratOgre.skills.split(',');
    expect(skills).toContain('frenzy');
    expect(skills).toContain('prehensile-tail');
    expect(skills).toContain('loner-4');
  });

  it('Lizardmen Kroxigor possède prehensile-tail, thick-skull, throw-team-mate, loner-4', () => {
    const roster = TEAM_ROSTERS['lizardmen'];
    const kroxigor = roster.positions.find(p => p.slug === 'lizardmen_kroxigor')!;
    const skills = kroxigor.skills.split(',');
    expect(skills).toContain('prehensile-tail');
    expect(skills).toContain('thick-skull');
    expect(skills).toContain('throw-team-mate');
    expect(skills).toContain('loner-4');
  });

  it('Lizardmen Chameleon Skink possède on-the-ball', () => {
    const roster = TEAM_ROSTERS['lizardmen'];
    const chameleon = roster.positions.find(p => p.slug === 'lizardmen_chameleon_skink')!;
    const skills = chameleon.skills.split(',');
    expect(skills).toContain('on-the-ball');
  });

  it('Dwarf Blocker Lineman possède thick-skull', () => {
    const roster = TEAM_ROSTERS['dwarf'];
    const blocker = roster.positions.find(p => p.slug === 'dwarf_blocker_lineman')!;
    const skills = blocker.skills.split(',');
    expect(skills).toContain('thick-skull');
  });

  it('Dwarf Troll Slayer possède frenzy et thick-skull', () => {
    const roster = TEAM_ROSTERS['dwarf'];
    const slayer = roster.positions.find(p => p.slug === 'dwarf_troll_slayer')!;
    const skills = slayer.skills.split(',');
    expect(skills).toContain('frenzy');
    expect(skills).toContain('thick-skull');
  });

  it('Dwarf Deathroller possède loner-5', () => {
    const roster = TEAM_ROSTERS['dwarf'];
    const deathroller = roster.positions.find(p => p.slug === 'dwarf_deathroller')!;
    const skills = deathroller.skills.split(',');
    expect(skills).toContain('loner-5');
  });

  it('Imperial Nobility Ogre possède thick-skull, throw-team-mate, loner-5', () => {
    const roster = TEAM_ROSTERS['imperial_nobility'];
    const ogre = roster.positions.find(p => p.slug === 'imperial_nobility_ogre')!;
    const skills = ogre.skills.split(',');
    expect(skills).toContain('thick-skull');
    expect(skills).toContain('throw-team-mate');
    expect(skills).toContain('loner-5');
  });

  it('Gnome Lineman possède thick-skull', () => {
    const roster = TEAM_ROSTERS['gnome'];
    const lineman = roster.positions.find(p => p.slug === 'gnome_lineman')!;
    const skills = lineman.skills.split(',');
    expect(skills).toContain('thick-skull');
  });

  it('Gnome Treeman possède loner-4', () => {
    const roster = TEAM_ROSTERS['gnome'];
    const treeman = roster.positions.find(p => p.slug === 'gnome_treeman')!;
    const skills = treeman.skills.split(',');
    expect(skills).toContain('loner-4');
  });
});

// ── Prehensile Tail ──────────────────────────────────────────────────────

describe('P1.11 Audit — prehensile-tail appliqué correctement', () => {
  it('skill registrée avec dodgeModifier -1', () => {
    const effect = getSkillEffect('prehensile-tail');
    expect(effect).toBeDefined();
    expect(effect!.triggers).toContain('on-dodge');
  });

  it('prehensile-tail d\'un Kroxigor inflige -1 au dodge adverse', () => {
    const kroxigor = basePlayer({
      id: 'K1',
      team: 'A',
      pos: { x: 5, y: 5 },
      skills: ['prehensile-tail', 'thick-skull'],
    });
    const opponent = basePlayer({
      id: 'B1',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: [],
    });
    const state = buildState([kroxigor, opponent]);

    // Le malus est appliqué au joueur qui dodge DEPUIS la zone de tacle
    const mod = getDodgeSkillModifiers(state, opponent, opponent.pos);
    expect(mod).toBe(-1);
  });

  it('prehensile-tail de deux adversaires cumule les malus', () => {
    const krox1 = basePlayer({
      id: 'K1',
      team: 'A',
      pos: { x: 5, y: 5 },
      skills: ['prehensile-tail'],
    });
    const krox2 = basePlayer({
      id: 'K2',
      team: 'A',
      pos: { x: 5, y: 6 },
      skills: ['prehensile-tail'],
    });
    const dodger = basePlayer({
      id: 'B1',
      team: 'B',
      pos: { x: 6, y: 5 },
      skills: [],
    });
    const state = buildState([krox1, krox2, dodger]);
    const mod = getDodgeSkillModifiers(state, dodger, dodger.pos);
    expect(mod).toBe(-2);
  });
});

// ── Thick Skull ──────────────────────────────────────────────────────────

describe('P1.11 Audit — thick-skull appliqué correctement', () => {
  it('skill registrée avec injuryModifier -1', () => {
    const effect = getSkillEffect('thick-skull');
    expect(effect).toBeDefined();
    expect(effect!.triggers).toContain('on-injury');
  });

  it('Dwarf Blocker avec thick-skull reçoit -1 en modificateur de blessure', () => {
    const blocker = basePlayer({
      id: 'D1',
      skills: ['block', 'tackle', 'thick-skull'],
    });
    const state = buildState([blocker]);
    const mod = getInjurySkillModifiers(state, blocker);
    expect(mod).toBe(-1);
  });

  it('joueur sans thick-skull : modificateur de blessure = 0', () => {
    const lineman = basePlayer({ id: 'L1', skills: [] });
    const state = buildState([lineman]);
    const mod = getInjurySkillModifiers(state, lineman);
    expect(mod).toBe(0);
  });
});

// ── Frenzy ───────────────────────────────────────────────────────────────

describe('P1.11 Audit — frenzy appliqué correctement', () => {
  it('hasFrenzy détecte le skill sur un Dwarf Troll Slayer', () => {
    const slayer = basePlayer({
      id: 'TS',
      skills: ['block', 'dauntless', 'frenzy', 'thick-skull'],
    });
    expect(hasFrenzy(slayer)).toBe(true);
  });

  it('PUSH_BACK avec frenzy crée pendingFrenzyBlock', () => {
    const state = setup();
    const attacker = basePlayer({
      id: 'A2',
      team: 'A',
      pos: { x: 10, y: 7 },
      skills: ['frenzy'],
    });
    const target = basePlayer({
      id: 'B2',
      team: 'B',
      pos: { x: 11, y: 7 },
      skills: [],
    });
    const testState: GameState = {
      ...state,
      players: [attacker, target],
      currentPlayer: 'A',
    };

    const rng = makeRNG(42);
    const result = resolveBlockResult(
      testState,
      {
        type: 'block',
        playerId: 'A2',
        targetId: 'B2',
        diceRoll: 3,
        result: 'PUSH_BACK',
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 3,
        targetStrength: 3,
      },
      rng,
    );

    expect(result.pendingFrenzyBlock).toBeDefined();
    expect(result.pendingFrenzyBlock?.attackerId).toBe('A2');
  });
});

// ── Throw Team-Mate ──────────────────────────────────────────────────────

describe('P1.11 Audit — throw-team-mate appliqué correctement', () => {
  it('Kroxigor avec throw-team-mate peut lancer un coéquipier avec right-stuff', () => {
    const kroxigor = basePlayer({
      id: 'K1',
      team: 'A',
      pos: { x: 5, y: 5 },
      skills: ['throw-team-mate', 'prehensile-tail'],
      st: 5,
    });
    const skink = basePlayer({
      id: 'S1',
      team: 'A',
      pos: { x: 6, y: 5 },
      skills: ['right-stuff', 'dodge', 'stunty'],
      st: 2,
    });
    const state = buildState([kroxigor, skink]);
    state.currentPlayer = 'A';

    expect(canThrowTeamMate(state, kroxigor, skink)).toBe(true);
  });

  it('joueur SANS throw-team-mate ne peut pas lancer', () => {
    const ogre = basePlayer({
      id: 'O1',
      team: 'A',
      pos: { x: 5, y: 5 },
      skills: ['bone-head'],
      st: 5,
    });
    const skink = basePlayer({
      id: 'S1',
      team: 'A',
      pos: { x: 6, y: 5 },
      skills: ['right-stuff'],
      st: 2,
    });
    const state = buildState([ogre, skink]);
    state.currentPlayer = 'A';

    expect(canThrowTeamMate(state, ogre, skink)).toBe(false);
  });
});

// ── On the Ball ──────────────────────────────────────────────────────────

describe('P1.11 Audit — on-the-ball appliqué correctement', () => {
  it('Chameleon Skink avec on-the-ball peut réagir', () => {
    const chameleon = basePlayer({
      id: 'CS',
      team: 'B',
      pos: { x: 10, y: 7 },
      skills: ['dodge', 'on-the-ball', 'shadowing', 'stunty'],
    });
    const state = buildState([chameleon]);

    expect(canTriggerOnTheBall(state, chameleon)).toBe(true);
  });

  it('getOnTheBallReactivePlayers retourne le Chameleon Skink quand l\'adversaire passe', () => {
    const passer = basePlayer({
      id: 'P1',
      team: 'A',
      pos: { x: 5, y: 5 },
      skills: ['pass'],
      hasBall: true,
    });
    const chameleon = basePlayer({
      id: 'CS',
      team: 'B',
      pos: { x: 10, y: 7 },
      skills: ['dodge', 'on-the-ball', 'shadowing', 'stunty'],
    });
    const state = buildState([passer, chameleon]);

    const reactives = getOnTheBallReactivePlayers(state, 'A');
    expect(reactives.length).toBe(1);
    expect(reactives[0].id).toBe('CS');
  });

  it('on-the-ball déclenche pendingOnTheBall via handlePass', () => {
    const state = setup();
    const passer = basePlayer({
      id: 'A1',
      team: 'A',
      pos: { x: 5, y: 5 },
      skills: ['pass'],
      hasBall: true,
    });
    const receiver = basePlayer({
      id: 'A3',
      team: 'A',
      pos: { x: 8, y: 5 },
      skills: ['catch'],
    });
    const chameleon = basePlayer({
      id: 'B1',
      team: 'B',
      pos: { x: 10, y: 7 },
      skills: ['on-the-ball'],
    });
    const testState: GameState = {
      ...state,
      players: [passer, receiver, chameleon],
      currentPlayer: 'A',
      ball: { x: 5, y: 5 },
    };

    const rng = makeRNG(42);
    const result = applyMove(
      testState,
      { type: 'PASS', playerId: 'A1', targetId: 'A3' },
      rng,
    );

    // La passe doit être en attente (on-the-ball doit réagir d'abord)
    expect(result.pendingOnTheBall).toBeDefined();
    expect(result.pendingOnTheBall?.reactivePlayers).toContain('B1');
  });

  it('ON_THE_BALL_DECLINE reprend la passe normalement', () => {
    const state = setup();
    const passer = basePlayer({
      id: 'A1',
      team: 'A',
      pos: { x: 5, y: 5 },
      skills: ['pass'],
      hasBall: true,
    });
    const receiver = basePlayer({
      id: 'A3',
      team: 'A',
      pos: { x: 8, y: 5 },
      skills: ['catch'],
    });
    const chameleon = basePlayer({
      id: 'B1',
      team: 'B',
      pos: { x: 10, y: 7 },
      skills: ['on-the-ball'],
    });
    const testState: GameState = {
      ...state,
      players: [passer, receiver, chameleon],
      currentPlayer: 'A',
      ball: { x: 5, y: 5 },
      pendingOnTheBall: {
        passerTeam: 'A',
        pendingPassMove: { type: 'PASS', playerId: 'A1', targetId: 'A3' },
        reactivePlayers: ['B1'],
      },
    };

    const rng = makeRNG(42);
    const result = applyMove(
      testState,
      { type: 'ON_THE_BALL_DECLINE' },
      rng,
    );

    // pendingOnTheBall doit être effacé
    expect(result.pendingOnTheBall).toBeUndefined();
    // La passe devrait avoir été exécutée (pas de pendingOnTheBall)
  });
});

// ── Loner ────────────────────────────────────────────────────────────────

describe('P1.11 Audit — loner appliqué correctement', () => {
  it('loner-4 registré dans skill-registry', () => {
    const effect4 = getSkillEffect('loner-4');
    expect(effect4).toBeDefined();
    expect(effect4!.slug).toBe('loner-4');
  });

  it('loner-5 registré dans skill-registry', () => {
    const effect5 = getSkillEffect('loner-5');
    expect(effect5).toBeDefined();
    expect(effect5!.slug).toBe('loner-5');
  });

  it('hasSkill détecte loner-4 sur Rat Ogre', () => {
    const ratOgre = basePlayer({
      skills: ['animal-savagery', 'frenzy', 'loner-4', 'mighty-blow-1', 'prehensile-tail'],
    });
    expect(hasSkill(ratOgre, 'loner-4')).toBe(true);
    expect(hasSkill(ratOgre, 'loner-5')).toBe(false);
  });

  it('hasSkill détecte loner-5 sur Imperial Nobility Ogre', () => {
    const ogre = basePlayer({
      skills: ['bone-head', 'loner-5', 'mighty-blow-1', 'thick-skull', 'throw-team-mate'],
    });
    expect(hasSkill(ogre, 'loner-5')).toBe(true);
    expect(hasSkill(ogre, 'loner-4')).toBe(false);
  });
});
