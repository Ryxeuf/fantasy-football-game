# Prompt : Next Feature (version resiliente)

## Identite
Developpeur autonome sur Nuffle Arena, jeu Blood Bowl 3 en TypeScript.
Monorepo pnpm + Turborepo : `apps/web` (Next.js 14), `apps/server` (Express + socket.io),
`packages/game-engine` (logique deterministe), `packages/ui` (Pixi.js).

## Objectif
Implemente UNE tache non cochee (`- [ ]`) du **premier sprint non termine** dans TODO.md.

## Selection de la tache
1. Lis TODO.md, identifie le premier sprint ayant des `- [ ]`
2. Dans ce sprint, prends la tache suivante dans l'ordre du tableau
3. Si la tache a des dependances non resolues (`[ ]` anterieures), passe a la suivante
4. Si la tache estimee > 1h de code, decoupe en sous-taches et n'implemente que la premiere

## Avant de coder
1. Explore le code existant lie a la tache (fichiers, types, tests)
2. Planifie l'approche technique (max 5 lignes)
3. Invoque le bon agent specialise selon le domaine :

| Domaine touche | Commande a invoquer |
|----------------|---------------------|
| Game engine (regles, mecaniques) | `/bloodbowl-rules-agent` |
| Pipeline etat/actions, GameState | `/game-state-integration-agent` |
| WebSocket / multijoueur | `/websocket-multiplayer-agent` |
| Systeme de skills | `/skill-system-agent` |
| Sequences de match (TD, mi-temps) | `/turn-sequence-agent` |
| Schema Prisma, migrations | `/prisma-database-agent` |
| Securite, anti-triche | `/api-security-agent` |

## Implementation
- TDD : ecris les tests AVANT le code (RED -> GREEN -> REFACTOR)
- Tests unitaires : `packages/game-engine/src/**/*.test.ts` (adjacent au source)
- Tests integration : `tests/integration/`
- Framework : Vitest, convention : `describe('Regle: [nom]')`
- RNG : utilise UNIQUEMENT `utils/rng.ts`, jamais `Math.random()`
- Immutabilite : retourne un nouveau GameState, ne mute jamais l'existant

## Validation (obligatoire avant commit)
Execute ces 4 commandes et corrige toute erreur avant de continuer :
1. `pnpm test` -- Tests unitaires + integration
2. `pnpm lint` -- ESLint
3. `pnpm typecheck` -- Verification TypeScript
4. `pnpm build` -- Build de production

## Finalisation

### 1. Coche la tache dans TODO.md

### 2. Commit et push
- Commit avec message conventionnel (`feat:`, `fix:`, `refactor:`, etc.)
- Push : `git push -u origin <branch>`

### 3. Creation de Pull Request (avec fallback)

**Verification prealable des outils GitHub :**
Avant de creer la PR, verifie la disponibilite des outils dans cet ordre :

1. **Outils MCP GitHub (`mcp__github__*`)** : utilise `mcp__github__create_pull_request`
   si les outils `mcp__github__` sont disponibles dans la session.

2. **Fallback CLI `gh`** : si les outils MCP ne sont pas disponibles, utilise :
   ```bash
   gh pr create --title "<titre>" --body "<body>" --base main
   ```

3. **Dernier recours** : si ni MCP ni `gh` ne fonctionnent, affiche a l'utilisateur
   la commande exacte a executer manuellement :
   ```
   [MANUAL PR REQUIRED]
   Branche : <branch>
   Titre : <titre court < 70 chars>
   Base : main
   Body :
   ## Resume
   - <changements>

   ## Tache roadmap
   - <reference TODO.md>

   ## Plan de test
   - [ ] <tests>
   ```

**Format PR (quel que soit l'outil) :**
- Titre court et descriptif (< 70 caracteres)
- Body structure : resume des changements, tache roadmap concernee, plan de test
