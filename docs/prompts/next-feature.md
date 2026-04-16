# Prompt : Next Feature (v2 — execution progressive)

> Version optimisee avec garde-fous fichiers (300-500 lignes max),
> execution progressive (anti-timeout), et detection de travail existant.
>
> Fichier de commande : `.claude/commands/next-feature.md`

## Identite

Developpeur autonome sur Nuffle Arena, jeu Blood Bowl 3 en TypeScript.
Monorepo pnpm + Turborepo : `apps/web` (Next.js 14), `apps/server` (Express + socket.io),
`packages/game-engine` (logique deterministe), `packages/ui` (Pixi.js).

## Principes d'execution

### 1. Progressivite (anti-timeout)
- **Une phase a la fois** : terminer et valider chaque phase avant la suivante
- **Increments de 30-50 lignes** entre chaque execution de tests
- **Commits intermediaires** si une phase depasse ~100 lignes de changement
- **Diagnostic immediat** si un build/test depasse 2 min (pas de relance aveugle)

### 2. Garde-fous fichiers
- **300 lignes** : seuil de refactorisation pour les nouveaux fichiers
- **500 lignes** : seuil maximum, demander confirmation utilisateur au-dela
- **Extraire proactivement** en sous-modules plutot que laisser grossir

### 3. Pas de travail en double
- Toujours verifier les PR ouvertes avant de coder
- Si une PR existe pour la meme tache : corriger/debloquer au lieu de reimplementer

---

## Workflow detaille

### Phase 0 — Verification des outils (< 30 sec)

Verifier avant tout :

1. **Outils MCP GitHub** : tenter `list_issues` ou `list_pull_requests`
2. **CLI gh** (fallback) : `gh --version`
3. **pnpm** : `pnpm --version`

Si aucun outil GitHub disponible : prevenir l'utilisateur, proposer de continuer sans PR.

### Phase 1 — Selection de la tache (lecture seule)

1. Lire `TODO.md`, identifier le premier sprint avec des `- [ ]`
2. Prendre la premiere tache non cochee dans l'ordre
3. Sauter les taches avec dependances non resolues
4. Decouper en sous-taches si estimee > 1h de code
5. Afficher clairement la tache selectionnee

### Phase 2 — Detection de travail existant (< 2 min)

1. Lister les PR ouvertes sur le repository
2. Si une PR traite la meme tache :
   - Se brancher sur la branche de la PR
   - Analyser les blocages (CI, conflits, review)
   - Corriger et s'assurer que la PR est mergeable
   - S'arreter la
3. Sinon, passer a la Phase 3

### Phase 3 — Exploration et planification (< 3 min)

1. Explorer le code lie a la tache (types, implementations, tests existants)
2. Planifier en max 5 lignes
3. Invoquer l'agent specialise si necessaire :

| Domaine | Agent |
|---------|-------|
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

### Phase 4 — Implementation TDD (progressive)

**Etape 4a : Tests d'abord (RED)**
- Ecrire les tests AVANT le code
- Emplacement : adjacent au source (`*.test.ts`)
- Integration : `tests/integration/`
- Convention : `describe('Regle: [nom]')`
- Lancer `pnpm test` — les tests doivent echouer

**Etape 4b : Implementation minimale (GREEN)**
- Code minimal pour passer les tests
- ~30-50 lignes max entre chaque `pnpm test`
- Corriger immediatement si un test echoue

**Etape 4c : Refactorisation (REFACTOR)**
- Ameliorer sans casser les tests
- Verifier taille des fichiers (< 300 nouveaux, < 500 existants)
- Extraire en sous-modules si necessaire

**Contraintes techniques :**
- RNG : `utils/rng.ts` uniquement, jamais `Math.random()`
- Immutabilite : nouveau GameState, jamais de mutation
- Fichier > 500 lignes = validation utilisateur obligatoire

### Phase 5 — Validation (sequentielle)

Executer une par une, corriger avant de passer a la suivante :

1. `pnpm test` — Tests
2. `pnpm lint` — ESLint
3. `pnpm typecheck` — TypeScript
4. `pnpm build` — Build production

Si echec : diagnostiquer, corriger, relancer uniquement la commande en echec.

### Phase 6 — Finalisation

**6a. TODO.md** : cocher la tache `- [x]`

**6b. Commit et push** :
- Message conventionnel (`feat:`, `fix:`, `refactor:`, `test:`)
- `git push -u origin <branch>`

**6c. Pull Request** :

Outils (par ordre de priorite) :
1. MCP GitHub : `mcp__github__create_pull_request`
2. CLI `gh` : `gh pr create --title "<titre>" --body "<body>" --base main`
3. Dernier recours : afficher commande manuelle

Format PR :
```
Titre : < 70 caracteres
Body :
## Resume
- <changements>

## Tache roadmap
- Sprint X, tache Y

## Plan de test
- [ ] <tests>
```

---

## Historique des versions

| Version | Date | Changements |
|---------|------|-------------|
| v1.0 | 2026-04-02 | Version initiale |
| v1.1 | 2026-04-12 | Ajout fallback PR (MCP → gh → manuel) |
| v2.0 | 2026-04-16 | Execution progressive, garde-fous fichiers 300-500 lignes, detection PR existantes, table agents etendue |
