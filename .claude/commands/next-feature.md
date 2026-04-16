---
description: Identifie et implemente la prochaine tache non cochee du premier sprint non termine dans TODO.md. Workflow autonome TDD complet avec agents specialises, execution progressive et garde-fous fichiers.
allowed_tools: ["Bash", "Read", "Write", "Edit", "Grep", "Glob", "Agent", "AskUserQuestion", "TodoWrite", "Skill"]
---

# Next Feature — Workflow progressif

## Identite

Developpeur autonome sur Nuffle Arena, jeu Blood Bowl 3 en TypeScript.
Monorepo pnpm + Turborepo : `apps/web` (Next.js 14), `apps/server` (Express + socket.io),
`packages/game-engine` (logique deterministe), `packages/ui` (Pixi.js).

## Garde-fous critiques

### Limite de taille des fichiers
- **300-500 lignes max** par fichier cree ou modifie.
- Si un fichier depasse 300 lignes apres tes modifications, refactorise en extrayant
  dans des sous-modules AVANT de continuer.
- Si un fichier existant depasse deja 500 lignes et que ta modification l'allongerait
  davantage, **demande confirmation a l'utilisateur** via `AskUserQuestion` avant de proceder.

### Execution progressive (anti-timeout)
- **Jamais plus d'une phase a la fois.** Termine et valide chaque phase avant la suivante.
- **Tests incrementaux** : lance `pnpm test` apres chaque bloc de code (~50 lignes),
  pas uniquement a la fin.
- **Commits intermediaires** : si une phase est substantielle (>100 lignes de changement),
  fais un commit intermediaire avant de passer a la suivante.
- **Si un build ou test depasse 2 min**, diagnostique immediatement au lieu de relancer.

---

## Phase 0 — Verification des outils (< 30 sec)

Verifie la disponibilite des outils critiques avant tout travail :

1. **Outils MCP GitHub** : tente un appel simple (`list_issues` ou `list_pull_requests`)
2. **CLI gh** : `gh --version` en fallback si MCP indisponible
3. **pnpm** : `pnpm --version`

> Si aucun outil GitHub n'est disponible, **previens l'utilisateur immediatement**
> et propose de continuer sans la partie PR.

---

## Phase 1 — Selection de la tache (lecture seule)

1. Lis `TODO.md`, identifie le **premier sprint** ayant des `- [ ]`
2. Dans ce sprint, prends la **premiere tache non cochee** dans l'ordre du tableau
3. Si la tache a des dependances non resolues (`[ ]` anterieures), passe a la suivante
4. Si la tache semble > 1h de code, decoupe en sous-taches et n'implemente que la premiere
5. **Affiche clairement** la tache selectionnee a l'utilisateur

---

## Phase 2 — Detection de travail existant (< 2 min)

Avant de coder quoi que ce soit :

1. **Verifie les PR ouvertes** sur le repository (via MCP ou `gh pr list`)
2. **Si une PR traite la meme tache** :
   - Ne la re-implemente PAS
   - Branche-toi sur la branche de la PR
   - Analyse ce qui bloque (CI, conflits, review)
   - Corrige les erreurs CI ou conflits de merge
   - Verifie que la CI passe et que la PR est mergeable
   - **Arrete-toi la** — la tache est traitee
3. **Si aucune PR existante** : passe a la Phase 3

---

## Phase 3 — Exploration et planification (< 3 min)

1. **Explore le code existant** lie a la tache :
   - Fichiers source concernes (types, interfaces, implementations)
   - Tests existants qui touchent au meme domaine
   - Patterns utilises dans le code adjacent
2. **Planifie l'approche technique** en **max 5 lignes**
3. **Identifie le domaine** et invoque l'agent specialise si necessaire :

| Domaine touche | Commande a invoquer |
|----------------|---------------------|
| Game engine (regles, mecaniques) | `/bloodbowl-rules-agent` |
| Pipeline etat/actions, GameState | `/game-state-integration-agent` |
| WebSocket / multijoueur | `/websocket-multiplayer-agent` |
| Systeme de skills | `/skill-system-agent` |
| Sequences de match (TD, mi-temps) | `/turn-sequence-agent` |
| Schema Prisma, migrations | `/prisma-database-agent` |
| Securite, anti-triche | `/api-security-agent` |
| Frontend Next.js | `/nextjs-frontend-agent` |
| Rendu Pixi.js | `/pixi-renderer-agent` |
| Tests et qualite | `/testing-quality-agent` |
| IA adversaire | `/ai-opponent-agent` |
| DevOps / infra | `/devops-infrastructure-agent` |

---

## Phase 4 — Implementation TDD (progressive)

### Principe : RED -> GREEN -> REFACTOR, un test a la fois

**Etape 4a — Ecrire les tests (RED)**
- Ecris les tests AVANT le code d'implementation
- Emplacement : adjacent au source (`*.test.ts` a cote du `*.ts`)
- Tests integration : `tests/integration/`
- Framework : Vitest, convention : `describe('Regle: [nom]')`
- Lance `pnpm test` — les nouveaux tests doivent **echouer** (RED)

**Etape 4b — Implementer le minimum (GREEN)**
- Ecris le code minimal pour faire passer les tests
- **Increment de ~30-50 lignes max** entre chaque execution de tests
- Lance `pnpm test` apres chaque increment — verifie que les tests passent
- Si un test echoue, corrige AVANT d'ecrire plus de code

**Etape 4c — Refactoriser (REFACTOR)**
- Ameliore le code sans casser les tests
- Verifie la taille des fichiers (< 300 lignes pour les nouveaux, < 500 pour les existants)
- Si un fichier depasse la limite, extrait dans un sous-module maintenant

### Contraintes techniques
- **RNG** : utilise UNIQUEMENT `utils/rng.ts`, jamais `Math.random()`
- **Immutabilite** : retourne un nouveau GameState, ne mute jamais l'existant
- **Pas de fichier > 500 lignes** sans validation utilisateur

---

## Phase 5 — Validation complete (sequentielle)

Execute ces commandes **une par une**, corrige toute erreur avant la suivante :

```
1. pnpm test          — Tests unitaires + integration
2. pnpm lint          — ESLint
3. pnpm typecheck     — Verification TypeScript
4. pnpm build         — Build de production
```

> **Si une commande echoue** : diagnostique, corrige, relance uniquement
> cette commande. Ne relance PAS toute la chaine.

---

## Phase 6 — Finalisation

### 6a. Mise a jour TODO.md
- Coche la tache terminee (`- [x]`)

### 6b. Commit et push
- Commit avec message conventionnel (`feat:`, `fix:`, `refactor:`, `test:`, etc.)
- Push : `git push -u origin <branch>`

### 6c. Creation de Pull Request

**Verification prealable des outils GitHub :**

1. **Outils MCP GitHub** (prioritaire) : `mcp__github__create_pull_request`
2. **Fallback CLI `gh`** : `gh pr create --title "<titre>" --body "<body>" --base main`
3. **Dernier recours** : affiche la commande manuelle a l'utilisateur

**Format PR (quel que soit l'outil) :**
- Titre court et descriptif (< 70 caracteres)
- Body structure :
  ```
  ## Resume
  - <changements principaux>

  ## Tache roadmap
  - <reference TODO.md : Sprint X, tache Y>

  ## Plan de test
  - [ ] <tests ajoutes/modifies>
  ```

---

## Arguments supplementaires

$ARGUMENTS
