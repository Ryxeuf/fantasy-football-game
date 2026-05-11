# Suivi B0.1 — Skill registry residuels

> **CLOTURE 2026-05-11** — Lot O.A.2-4 du Sprint O resolve l'ensemble
> des residuels listes ici. Verification effectuee par les tests de
> regression `registry-wiring.test.ts` (17 tests). Tous les skills
> mentionnes sont confirmes wires via le skill-registry.

> Historique : Phase B0.1 marquee TERMINEE dans la roadmap
> (`phases.md`), `skill-registry.ts` branche au moteur via
> `skill-bridge.ts` et `collectModifiers` appele depuis `passing.ts`
> (commit `97e063b`). Cette note listait les hardcodes residuels au
> 2026-04-27.

## Pris en charge dans le sprint d'origine

| # | Fichier | Skills | Etat |
|---|---------|--------|------|
| 1 | `mechanics/passing.ts` (calculatePassModifiers) | Accurate / Strong Arm / Cannoneer | DONE — collectModifiers + canApply range-aware |
| 2 | `mechanics/passing.ts` (calculateCatchModifiers) | Extra Arms / Diving Catch | DONE — collectModifiers |
| 3 | `skill-registry.ts` | Nerves of Steel sentinelle 99 | DONE — getModifiers retire |

## Residuels — TOUS CLOTURES (verifies 2026-05-11)

### 1. `mechanics/blocking.ts`

| Skill | Etat | Verification |
|-------|------|--------------|
| Stunty (-1 AV) | ✅ **DONE** (S27.7) | `blocking.ts:138-146` consomme `collectModifiers(victim, 'on-armor')` ; registry expose `armorModifier: -1`. Test : `registry-wiring.test.ts` "Stunty armor". |
| Horns (+ST sur blitz) | ✅ **DONE** | `block-handler.ts:149-159` consomme `collectModifiers(attacker, 'on-block-attacker', { isBlitz })` ; registry expose `strengthModifier: 1` avec `canApply: ctx.isBlitz === true`. Test : `registry-wiring.test.ts` "Horns Blitz". |
| Pile Driver | ⏸️ **Differé** | Registre OK (`triggers: ['passive']`) mais consumer "foul gratuit apres knockdown" pas implemente. Hors scope Lot O.A.2-4 — special action complexe (nouveau pendingAction flow). A traiter en lot dedie si demande utilisateur. |

### 2. `mechanics/movement.ts` (en realite `actions/move-handlers.ts`)

| Skill | Etat | Verification |
|-------|------|--------------|
| Sure Feet | ✅ **DONE** | `move-handlers.ts:171, 283` consomme `canSkillReroll(player, 'on-gfi', state)` ; registry expose `canReroll: () => true`. Test : `registry-wiring.test.ts` "Sure Feet GFI reroll". |
| Sprint | ✅ **DONE** (S27.7.2) | `core/game-state.ts:933` expose `getGfiCap(state, player)` qui agrege `gfiCapBonus` via `collectModifiers(_, 'on-gfi', _)`. 3 call-sites (`tactical-indicators.ts:38`, `core/game-state.ts:935, 959`) consomment. Test : `sprint-gfi-cap.test.ts` + `registry-wiring.test.ts` "Sprint". |
| Big Hand / Extra Arms (pickup) | ✅ **DONE** | `getPickupSkillModifiers` (`skill-bridge.ts:41`) consomme `collectModifiers(_, 'on-pickup')` ; ball pickup l'appelle. |

### 3. `mechanics/foul.ts`

| Skill | Etat | Verification |
|-------|------|--------------|
| Dirty Player | ✅ **DONE** | Utilise `getFoulArmorSkillModifiers` (skill-bridge). |
| Sneaky Git | ✅ **DONE** | `foul.ts:118` consomme `isSneakyGitActive(state, attacker)` (skill-bridge) uniquement ; pas de check `hasSkill` direct redondant. Confirmation : `grep -n "sneaky" foul.ts` retourne 1 site unique. Test : `registry-wiring.test.ts` "Sneaky Git". |

### 4. `mechanics/movement.ts` (dodge)

| Skill | Etat | Verification |
|-------|------|--------------|
| Diving Tackle | ✅ **DONE** | `move-handlers.ts:60-62` consomme `getDodgeSkillModifiers(state, player, from)` ; le bridge itere les adversaires adjacents et collecte leur `on-dodge` modifiers (`-2` pour Diving Tackle). Test : `registry-wiring.test.ts` "Diving Tackle adjacent". |
| Prehensile Tail | ✅ **DONE** | Meme path que Diving Tackle (adversaire adjacent, `on-dodge` modifier). |

### 5. Extension SkillContext

L'extension `currentTrigger` proposee dans l'audit n'a pas ete necessaire :
chaque skill qui couvre plusieurs triggers utilise des canApply distincts
via `ctx.isBlitz`, `ctx.opponent`, etc. Le contexte fourni est suffisant.

## Tests de regression

`packages/game-engine/src/skills/registry-wiring.test.ts` verrouille
17 assertions qui verifient que :

- Chaque skill du follow-up est enregistre avec le bon trigger.
- `collectModifiers` retourne les bonus attendus pour les contexts
  pertinents (blitz vs block standard, dodge avec/sans adversaire).
- `canSkillReroll` matche les variantes de slug (`sure-feet`, `sure_feet`,
  `sure feet`).
- Diving Tackle ignore les adversaires non-adjacents.

Ce fichier sert de **regression net** : si un futur refactor casse une
wiring, le test echoue immediatement.

## Status final

✅ **Lot O.A.2-4 du Sprint O = CLOTURE.** Tous les skills mentionnes
sont correctement wires via le registry. Le seul item differe est
Pile Driver (action speciale complexe, hors scope wiring).
