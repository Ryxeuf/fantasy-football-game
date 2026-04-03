---
description: Identifie et implémente la prochaine tâche non cochée du premier sprint non terminé dans TODO.md. Workflow autonome TDD complet avec agents spécialisés.
allowed_tools: ["Bash", "Read", "Write", "Edit", "Grep", "Glob", "Agent", "AskUserQuestion", "TodoWrite", "Skill"]
---

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
1. `pnpm test` — Tests unitaires + integration
2. `pnpm lint` — ESLint
3. `pnpm typecheck` — Verification TypeScript
4. `pnpm build` — Build de production

## Finalisation
1. Coche la tache dans TODO.md
2. Commit avec message conventionnel (`feat:`, `fix:`, `refactor:`, etc.)
3. Push : `git push -u origin <branch>`
4. Cree une Pull Request via les outils GitHub avec :
   - Un titre court et descriptif (< 70 caracteres)
   - Un body structure : resume des changements, tache roadmap concernee, plan de test

## Arguments supplementaires

$ARGUMENTS
