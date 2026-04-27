# Suivi B0.1 — Skill registry residuels

> Date : 2026-04-27
> Contexte : Phase B0.1 marquee TERMINEE dans la roadmap (`phases.md`),
> `skill-registry.ts` est branche au moteur via `skill-bridge.ts` et
> `collectModifiers` est appele depuis `passing.ts` (commit
> `97e063b`). Cette note liste les hardcodes residuels qui passent
> encore par `player.skills.includes(...)` au lieu du registry, comme
> dette de qualite a traiter au prochain passage qualite.

## Pris en charge dans le sprint en cours

| # | Fichier | Skills | Etat |
|---|---------|--------|------|
| 1 | `mechanics/passing.ts` (calculatePassModifiers) | Accurate / Strong Arm / Cannoneer | DONE — collectModifiers + canApply range-aware |
| 2 | `mechanics/passing.ts` (calculateCatchModifiers) | Extra Arms / Diving Catch | DONE — collectModifiers |
| 3 | `skill-registry.ts` | Nerves of Steel sentinelle 99 | DONE — getModifiers retire (logique TZ reste hardcoded dans passing.ts car non-numerique) |

## Residuels — TODO follow-up

### 1. `mechanics/blocking.ts`

| Ligne | Skill | Action proposee |
|-------|-------|-----------------|
| L141 | Stunty (-1 AV) | Ajouter trigger `on-armor` dans l'entree Stunty + `armorModifier: -1`, mais necessite extension `SkillContext` avec `currentTrigger` pour distinguer les contextes dodge / armor. |
| — | Horns (+ST sur blitz) | Pas de trigger `on-block-attacker` collecte. Ajouter au registry. |
| — | Pile Driver (passif) | Marquer comme `triggers: ['passive']` et lire via `getSkillsForTrigger`. |

### 2. `mechanics/movement.ts`

Aucun import de skill-bridge ou collectModifiers — Sure Feet (relance GFI) et Sprint (+1 PM) ne passent pas par le registry.

| Skill | Action |
|-------|--------|
| Sure Feet | Trigger `on-gfi`, `canReroll: () => true` dans le registry — appeler `canSkillReroll(player, 'on-gfi', state)` depuis movement. |
| Sprint | Trigger `on-movement`, `getModifiers: () => ({ movementModifier: +1 })`. Appeler `collectModifiers(player, 'on-movement', ...)` au start of activation. |
| Big Hand / Extra Arms (pickup) | Deja dans registry, mais `mechanics/ball.ts` ou `mechanics/pickup.ts` ne consomment pas via `getPickupSkillModifiers`. Verifier. |

### 3. `mechanics/foul.ts`

| Skill | Etat |
|-------|------|
| Dirty Player | Utilise `getFoulArmorSkillModifiers` (skill-bridge) — OK |
| Sneaky Git | Mixte : `isSneakyGitActive` (skill-bridge) + check `hasSkill` direct — a unifier |

### 4. Extension necessaire de `SkillContext`

Pour traiter Stunty/Horns proprement, ajouter au type :

```ts
export interface SkillContext {
  // ... existing fields
  /** Trigger en cours d'execution, permet a getModifiers() de discriminer
   *  quand un skill couvre plusieurs triggers (ex: Stunty on-dodge ET on-armor). */
  currentTrigger?: SkillTrigger;
}
```

Et dans `collectModifiers`, passer `currentTrigger: trigger` dans le `fullCtx`.

## Estimation d'effort

| Lot | Fichiers | Effort |
|-----|----------|--------|
| Stunty AV | blocking.ts + skill-registry.ts (+ extension SkillContext) | ~1h |
| Sure Feet/Sprint GFI | movement.ts + skill-registry.ts | ~1h |
| Horns/Pile Driver/Sneaky Git | blocking.ts + foul.ts + registry | ~2h |

Total ~4h, gain : 100 % des modifiers passent par le registry, plus aucun
hardcode `player.skills.includes(...)` dans les mechanics core.

## Tests de non-regression

Apres chaque lot, executer :

```
docker compose -f docker-compose.yml run --rm server pnpm vitest run
docker compose -f docker-compose.yml run --rm web pnpm tsc --noEmit
```

Ou en local (Node 20 sur l'hote) si le container ad-hoc est trop lent.
