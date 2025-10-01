import { describe, it, expect } from 'vitest';
import { setupPreMatchWithTeams, TeamPlayerData } from './game-state';

describe('setupPreMatchWithTeams', () => {
  it('devrait créer un état de jeu en phase pré-match avec les joueurs en réserves', () => {
    const teamAData: TeamPlayerData[] = [
      {
        id: 'p1',
        name: 'Player A1',
        position: 'Lineman',
        number: 1,
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: 'Block',
      },
      {
        id: 'p2',
        name: 'Player A2',
        position: 'Blitzer',
        number: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: 'Tackle',
      },
    ];

    const teamBData: TeamPlayerData[] = [
      {
        id: 'p3',
        name: 'Player B1',
        position: 'Runner',
        number: 1,
        ma: 8,
        st: 2,
        ag: 4,
        pa: 3,
        av: 7,
        skills: 'Dodge,Sure Hands',
      },
      {
        id: 'p4',
        name: 'Player B2',
        position: 'Lineman',
        number: 2,
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: '',
      },
    ];

    const gameState = setupPreMatchWithTeams(teamAData, teamBData, 'Team A', 'Team B');

    // Vérifier les propriétés de base
    expect(gameState.width).toBe(26);
    expect(gameState.height).toBe(15);
    expect(gameState.turn).toBe(0); // Pas de tour en phase pré-match
    expect(gameState.half).toBe(0); // Pas de mi-temps en phase pré-match
    expect(gameState.ball).toBeUndefined(); // Pas de ballon en phase pré-match
    expect(gameState.teamNames.teamA).toBe('Team A');
    expect(gameState.teamNames.teamB).toBe('Team B');

    // Vérifier que tous les joueurs sont créés
    expect(gameState.players).toHaveLength(4);

    // Vérifier les joueurs de l'équipe A
    const teamAPlayers = gameState.players.filter(p => p.team === 'A');
    expect(teamAPlayers).toHaveLength(2);
    expect(teamAPlayers[0].id).toBe('A1');
    expect(teamAPlayers[0].name).toBe('Player A1');
    expect(teamAPlayers[0].position).toBe('Lineman');
    expect(teamAPlayers[0].skills).toEqual(['Block']);
    expect(teamAPlayers[0].pos).toEqual({ x: -1, y: -1 }); // Hors terrain

    // Vérifier les joueurs de l'équipe B
    const teamBPlayers = gameState.players.filter(p => p.team === 'B');
    expect(teamBPlayers).toHaveLength(2);
    expect(teamBPlayers[0].id).toBe('B1');
    expect(teamBPlayers[0].name).toBe('Player B1');
    expect(teamBPlayers[0].position).toBe('Runner');
    expect(teamBPlayers[0].skills).toEqual(['Dodge', 'Sure Hands']); // Skills séparées par virgule
    expect(teamBPlayers[0].pos).toEqual({ x: -1, y: -1 }); // Hors terrain

    // Vérifier que tous les joueurs sont en réserves
    expect(gameState.dugouts.teamA.zones.reserves.players).toEqual(['A1', 'A2']);
    expect(gameState.dugouts.teamB.zones.reserves.players).toEqual(['B1', 'B2']);

    // Vérifier le log
    expect(gameState.gameLog).toHaveLength(1);
    expect(gameState.gameLog[0].message).toContain(
      'Phase pré-match - Team A vs Team B - Les joueurs sont en réserves'
    );
  });

  it('devrait gérer les skills vides correctement', () => {
    const teamAData: TeamPlayerData[] = [
      {
        id: 'p1',
        name: 'Player A1',
        position: 'Lineman',
        number: 1,
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: '',
      },
    ];

    const teamBData: TeamPlayerData[] = [
      {
        id: 'p2',
        name: 'Player B1',
        position: 'Lineman',
        number: 1,
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: '',
      },
    ];

    const gameState = setupPreMatchWithTeams(teamAData, teamBData, 'Team A', 'Team B');

    expect(gameState.players[0].skills).toEqual([]);
    expect(gameState.players[1].skills).toEqual([]);
  });
});
