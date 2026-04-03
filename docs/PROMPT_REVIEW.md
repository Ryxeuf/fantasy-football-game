# Review des agents et prompt — Nuffle Arena

> Analyse du 2026-04-03

---

## 1. Bilan des agents specialises

### Pertinents et bien faits (garder tels quels)

| Agent | Verdict | Sprint concerne |
|-------|---------|-----------------|
| `bloodbowl-rules-agent` | **Excellent** | Sprint 1-4 |
| `game-state-integration-agent` | **Excellent** | Sprint 1-2 |
| `testing-quality-agent` | **Bon** | Tous les sprints |
| `prisma-database-agent` | **Bon** | Sprint 3-4 |
| `api-security-agent` | **Bon** | Sprint 1, 3 |
| `websocket-multiplayer-agent` | **Bon** | Sprint 1 |

### A revoir / basse priorite

| Agent | Verdict | Raison |
|-------|---------|--------|
| `pixi-renderer-agent` | OK | Sprint 3+ (animations), pas urgent |
| `ai-opponent-agent` | OK | Phase 7, pas d'implementation prevue avant longtemps |
| `nextjs-frontend-agent` | OK | Redondant avec `/feature` pour le pipeline fullstack |
| `expo-mobile-agent` | OK | Phase 6, 10% complete |
| `devops-infrastructure-agent` | OK | Infra deja en place, utile en maintenance |

### Agents manquants recommandes

#### `turn-sequence-agent` — Flow de match et transitions de phase

**Justification** : Sprint 1 (B1.9 post-TD re-setup) et Sprint 2 (B1.7 mi-temps) touchent
a la machine a etats du match. Aucun agent existant ne couvre :
- Post-TD : re-setup -> re-kickoff -> nouveau drive
- Mi-temps : KO recovery -> swap -> re-setup -> re-kickoff
- Fin de match : resultat -> SPP -> persistence
- Setup validation (3+ sur la ligne, 11 max)

#### `skill-system-agent` — Architecture et implementation des skills

**Justification** : `skill-registry.ts` est du code mort (44 skills non branches).
Sprint 1 (B0.1) et Sprint 2 (Wrestle, Loner, Regeneration) necessitent un agent dedie :
- Architecture du systeme de hooks (on-block-defender, on-dodge, etc.)
- Patterns d'implementation (comment ajouter un skill)
- Interactions entre skills (Dodge vs Tackle, Block + Wrestle)
- Migration des 118 skills restants

---

## 2. Prompt ameliore

### Problemes dans le prompt actuel

1. Chemin critique obsolete (ne correspond plus aux sprints du TODO.md)
2. Selection de tache trop complexe (ratio impact/effort + ordre + filtres)
3. Confusion commandes vs agents (`/bloodbowl-rules-agent` est un command, pas un agent)
4. Bloc de validation bash mal ferme (markdown casse)
5. Creation de PR systematique (pas toujours souhaitable)
6. Exploration & Planification en 5 etapes conditionnelles = trop verbeux

### Version proposee

```markdown
## Identite
Developpeur autonome sur Nuffle Arena, jeu Blood Bowl en TypeScript.
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
```

### Changements cles

| Avant | Apres | Raison |
|-------|-------|--------|
| Chemin critique custom `QW -> A -> B1...` | "Premier sprint non termine" | Le TODO.md a deja des sprints ordonnes |
| Ratio impact/effort + filtres | Ordre du tableau dans le sprint | Plus simple, moins d'ambiguite |
| 5 etapes conditionnelles avant coder | 3 etapes dont une table de dispatch | Rapide a lire et executer |
| `/bloodbowl-rules-agent` presente comme agent | Presente comme commande a invoquer | Reflete la realite (.claude/commands/) |
| Bloc bash mal ferme | Bloc bash ferme correctement | Bug fix markdown |
| Creation PR avec format impose | Conservee, simplifiee | Titre < 70 chars + body structure |
| Pas de mention RNG/immutabilite | Ajout dans Implementation | Contraintes critiques du projet |
| `docs/ROADMAP_DONE.md` a maintenir | Retire | Fichier inexistant, overhead inutile |
