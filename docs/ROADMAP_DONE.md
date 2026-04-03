# Roadmap — Tâches terminées

## Sprint 0 — Bugfixes critiques & sécurité

- [x] **BUG-1** : Fix `armorSuccess = true` hardcodé dans actions.ts — les dodges ratés causent maintenant des blessures
- [x] **BUG-2** : Remplacer `Math.random()` par RNG seedé dans game-state.ts — résultats reproductibles
- [x] **BUG-3** : Câbler `handleInjuryByCrowd()` dans blocking.ts — surf fonctionnel
- [x] **SEC-1** : Auth middleware déjà présent sur `/admin/data/*`
- [x] **SEC-2** : Validation participant match dans socket room join

## Sprint 1 — Match online jouable

- [x] **B0.1** (partiel) : Brancher `skill-registry.ts` dans le moteur — skill-bridge créé, modifiers intégrés dans dodge/pickup/GFI (15+ skills activés : Two Heads, Break Tackle, Stunty, Very Long Legs, Prehensile Tail, Diving Tackle, Big Hand, Extra Arms, Pro, Pass, Catch, etc.)
- [x] **A.4** : Émettre gameState via WebSocket après chaque action — `broadcastGameState()` et `broadcastMatchEnd()` câblés dans POST /match/:id/move, émettent `game:state-updated` et `game:match-ended` sur le namespace /game
- [x] **A.5** : Hook client `useGameSocket(matchId)` — connexion socket.io au namespace /game avec auth JWT, join/leave match room, listeners typés pour state-updated/player-connected/player-disconnected/match-ended, intégré dans useGameState (remplace le polling 3-10s par WebSocket temps réel + fallback polling 30s)
