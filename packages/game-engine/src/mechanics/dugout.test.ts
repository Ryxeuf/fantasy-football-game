/**
 * Tests pour le système de dugout
 */

import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import {
  movePlayerToDugoutZone,
  getPlayersInDugoutZone,
  getActivePlayers,
  getReservePlayers,
  getKnockedOutPlayers,
  getCasualtyPlayers,
  getSentOffPlayers,
  canBringPlayerFromReserves,
  bringPlayerFromReserves,
  recoverKnockedOutPlayers,
} from './dugout';

describe('Système de dugout', () => {
  it('devrait initialiser les dugouts avec les bonnes zones', () => {
    const state = setup();

    expect(state.dugouts.teamA).toBeDefined();
    expect(state.dugouts.teamB).toBeDefined();

    // Vérifier que chaque équipe a les 5 zones
    expect(state.dugouts.teamA.zones.reserves).toBeDefined();
    expect(state.dugouts.teamA.zones.stunned).toBeDefined();
    expect(state.dugouts.teamA.zones.knockedOut).toBeDefined();
    expect(state.dugouts.teamA.zones.casualty).toBeDefined();
    expect(state.dugouts.teamA.zones.sentOff).toBeDefined();
  });

  it('devrait déplacer un joueur vers une zone de dugout', () => {
    const state = setup();
    const player = state.players[0]; // Premier joueur de l'équipe A

    const newState = movePlayerToDugoutZone(state, player.id, 'knockedOut', 'A');

    // Vérifier que le joueur est dans la zone KO
    expect(newState.dugouts.teamA.zones.knockedOut.players).toContain(player.id);
    expect(newState.dugouts.teamA.zones.reserves.players).not.toContain(player.id);

    // Vérifier que l'état du joueur est mis à jour
    const updatedPlayer = newState.players.find(p => p.id === player.id);
    expect(updatedPlayer?.state).toBe('knocked_out');
    expect(updatedPlayer?.pos).toEqual({ x: -1, y: -1 }); // Position hors terrain
  });

  it("devrait récupérer les joueurs d'une zone spécifique", () => {
    const state = setup();
    const player = state.players[0];

    // Déplacer le joueur en zone KO
    const newState = movePlayerToDugoutZone(state, player.id, 'knockedOut', 'A');

    const koPlayers = getPlayersInDugoutZone(newState, 'A', 'knockedOut');
    expect(koPlayers).toHaveLength(1);
    expect(koPlayers[0].id).toBe(player.id);
  });

  it('devrait récupérer les joueurs actifs', () => {
    const state = setup();

    const activePlayers = getActivePlayers(state, 'A');
    expect(activePlayers.length).toBeGreaterThan(0);

    // Tous les joueurs actifs doivent être sur le terrain
    activePlayers.forEach(player => {
      expect(player.pos.x).toBeGreaterThanOrEqual(0);
      expect(player.pos.y).toBeGreaterThanOrEqual(0);
      expect(player.state).toBe('active');
    });
  });

  it('devrait vérifier si un joueur peut être mis en jeu depuis les réserves', () => {
    const state = setup();

    // Mettre un joueur en réserves d'abord
    const player = state.players[0];
    const newState = movePlayerToDugoutZone(state, player.id, 'reserves', 'A');

    // Maintenant il devrait y avoir de la place pour mettre des joueurs en jeu
    expect(canBringPlayerFromReserves(newState, 'A')).toBe(true);
  });

  it('devrait mettre un joueur en jeu depuis les réserves', () => {
    const state = setup();
    const player = state.players[0];

    // Mettre le joueur en réserves d'abord
    let newState = movePlayerToDugoutZone(state, player.id, 'reserves', 'A');

    // Puis le mettre en jeu
    newState = bringPlayerFromReserves(newState, player.id, { x: 5, y: 5 });

    // Vérifier que le joueur est maintenant sur le terrain
    const updatedPlayer = newState.players.find(p => p.id === player.id);
    expect(updatedPlayer?.pos).toEqual({ x: 5, y: 5 });
    expect(updatedPlayer?.state).toBe('active');
    expect(newState.dugouts.teamA.zones.reserves.players).not.toContain(player.id);
  });

  it('devrait gérer la récupération des joueurs KO', () => {
    const state = setup();
    const player = state.players[0];

    // Mettre le joueur KO
    let newState = movePlayerToDugoutZone(state, player.id, 'knockedOut', 'A');

    // Simuler la récupération (4+ sur D6)
    const mockRNG = () => 0.8; // Simule un 5 sur D6 (récupération réussie)
    newState = recoverKnockedOutPlayers(newState, 'A', mockRNG);

    // Vérifier que le joueur est maintenant en réserves
    expect(newState.dugouts.teamA.zones.knockedOut.players).not.toContain(player.id);
    expect(newState.dugouts.teamA.zones.reserves.players).toContain(player.id);

    const updatedPlayer = newState.players.find(p => p.id === player.id);
    expect(updatedPlayer?.state).toBe('active');
  });

  it('devrait gérer la récupération échouée des joueurs KO', () => {
    const state = setup();
    const player = state.players[0];

    // Mettre le joueur KO
    let newState = movePlayerToDugoutZone(state, player.id, 'knockedOut', 'A');

    // Simuler l'échec de récupération (1-3 sur D6)
    const mockRNG = () => 0.2; // Simule un 2 sur D6 (récupération échouée)
    newState = recoverKnockedOutPlayers(newState, 'A', mockRNG);

    // Vérifier que le joueur reste KO
    expect(newState.dugouts.teamA.zones.knockedOut.players).toContain(player.id);
    expect(newState.dugouts.teamA.zones.reserves.players).not.toContain(player.id);
  });
});
