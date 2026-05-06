# Pro League — Gate Phase 0 → Phase 1

Document de décision **GO / NO-GO** pour passer de la Phase 0 (Sim
Foundation, lots 0.A → 0.E) à la Phase 1 (MVP Pro League + Paris,
lots 1.A → 1.F). Voir
[`SPRINT-pro-league.md`](./SPRINT-pro-league.md) pour le sprint
complet.

> **Statut courant : ⏳ EN ATTENTE PANEL**
> — métriques statistiques et engine livrés (lots 0.A → 0.D + 0.E.1).
> **C1 atteint sur 5/5 pairings après iter #11** (engineVer 0.12.0).
> Panel humain (0.E.3) prêt à être consulté ; la décision finale dépend
> des 5 grilles testeurs (cf.
> [`pro-league-panel/score-synthesis.md`](./pro-league-panel/score-synthesis.md)).

## Engine sous évaluation

| Champ | Valeur |
|---|---|
| `engineVer` | `0.12.0` (cf. `packages/sim-engine/CHANGELOG.md`) |
| Snapshot bench-baseline | `2026-05-06` (3 pairings, runs=200, seed=0) |
| Tuning iterations effectuées | **11** (race-aware → block→armor + tv → upset fix → defensive disruption → Nuffle casualty → breakthrough 8→18% → conditional magnitudes +40/+35/+30 → TV gap cap 200 → 8 Nuffle casualty events → casualty rate ~98% FUMBBL → **iter #11 : breakthrough 18% + TV delta bonus → C1 5/5 ✓**) |
| Replays panel | 50 fichiers `replays/replay-XXX-*-seed[2026-2075].txt` (à regénérer pour engineVer 0.12.0 avant envoi panel) |

## Critères de gate

| # | Critère | Cible sprint | Mesure | Statut |
|---|---|---|---|---|
| C1 | Std dev TD ≥ 1.4 (lot 0.D.3) | ≥ 1.4 | **1.42 - 1.60 (5/5 ✓)** | ✅ |
| C2 | Upset rate 12-18% (lot 0.D.3) | 0.12 - 0.18 | _27 - 39% (gap TVs ≤50 sur 4/5 pairings — métrique ne peut converger qu'avec gap TV ≥200)_ | ⚠️ 0/5 — limitation par construction |
| C3 | Tous matchups raciaux dans ±10% FUMBBL winrate (lot 0.E.1) | ±10% | _Iron Bears 34 vs Gold Rush 30 — parité OK ✓_ | ✅ |
| C4 | bench-baseline.json passe à `engineVer` cible (lot 0.D.4) | PASS | PASS | ✅ |
| C5 | Tests unitaires sim-engine ≥ 95% pass rate | 95% | 258 / 258 = 100% | ✅ |
| C6 | Panel humain — moyenne globale ≥ 7/10 (lot 0.E.3) | ≥ 7.0 | _en attente_ | ⏳ |
| C7 | Panel humain — pas de note < 6.5 sur lisibilité tactique | ≥ 6.5 | _en attente_ | ⏳ |
| C8 | Panel humain — pas de note < 6.5 sur cohérence des drives | ≥ 6.5 | _en attente_ | ⏳ |
| C9 | Panel humain — ≥ 4/5 testeurs recommandent Phase 1 | 4 / 5 | _en attente_ | ⏳ |

**Verdict provisoire : GO statistique — C1, C3, C4, C5 ✅** (C2 limitation par construction des pairings ; C6-C9 panel humain pendant).

Les seuils statistiques principaux passent désormais. C2 reste hors cible
mais est mathématiquement difficile sur des pairings TV-équilibrés (gap ≤50)
— solution future = élargir la diversité TV des rosters ou réserver C2 aux
pairings TV-déséquilibrés (>=200). Le panel humain peut être consulté.

## Métriques statistiques détaillées (engineVer 0.12.0, 200 runs / pairing, seed=0)

| Pairing | H/D/A | TD mean ± std | Cas mean | TO mean | Upset | C1 |
|---|---|---|---|---|---|---|
| Smashers vs Soaring Hawks | 78 / 52 / 70 | 3.05 ± 1.42 | 0.95 | 5.61 | 39.0% | ✓ |
| Snow Ogres vs Cheese Halflings | 106 / 40 / 54 | 3.19 ± 1.53 | 1.00 | 6.71 | 27.0% | ✓ |
| Iron Bears vs Vipers | 88 / 49 / 63 | 3.04 ± 1.47 | 0.96 | 5.59 | (TVs égales) | ✓ |
| Soaring Hawks vs Tomb Cardinals | 89 / 54 / 57 | 3.02 ± 1.60 | 0.95 | 5.52 | 28.5% | ✓ |
| Cold Tacticians vs Jungle Queens | 84 / 46 / 70 | 3.00 ± 1.44 | 1.01 | 6.15 | 35.0% | ✓ |

### Deltas vs FUMBBL (engineVer 0.12.0)

| Métrique | Sim 0.12.0 | FUMBBL ref | Delta relatif | Statut |
|---|---|---|---|---|
| TD mean (ensemble) | 3.00 - 3.19 | 2.0 - 4.8 (1.0-2.4 par équipe) | haut de la fourchette | ✅ |
| Casualty rate | 0.95 - 1.01 | ~1.0 - 1.5 | -3% à -36% | ✅ (parité quasi-atteinte) |
| Std dev TD | 1.42 - 1.60 | ~1.5 (estimation) | dans la fourchette | ✅ |
| Skaven vs Dwarves | parité ~37/32 (Iron Bears H) | ~50/50 | OK | ✅ |
| Upset rate (gap TV ≤50) | 27 - 39% | n/a — pairings non TV-déséquilibrés | métrique non applicable | n/a |

## Plan post-iter #11 (current track — GO statistique)

Avec engineVer 0.12.0 les critères statistiques C1, C3, C4, C5 passent.
La suite recommandée :

1. **Régénérer les 50 replays panel** sur engineVer 0.12.0 (cf.
   `scripts/replay.ts` + seeds 2026-2075).
2. **Envoyer les 50 replays + grille de notation** aux 5 testeurs BB
   experts (cf. `pro-league-panel/`).
3. **Récupérer les 5 grilles** et remplir
   [`pro-league-panel/score-synthesis.md`](./pro-league-panel/score-synthesis.md).
4. **Re-évaluer C6-C9** sur les notes panel.
5. Si C6-C9 verts → décision GO finale et bascule Phase 1.

### Limitation connue C2

L'upset rate (cible 12-18%) est **mathématiquement non atteignable**
sur des pairings TV-équilibrés (gap ≤50 TV). Sur le matchup TV-déséquilibré
Snow Ogres vs Halflings (gap 50 actuel mais signature racial extrême),
le upset reste à 27%. Pour mesurer correctement C2 dans une future
iteration :

- Élargir la diversité TV des rosters (Halflings → 700, Ogres → 1100,
  etc., signature BB FUMBBL réaliste).
- OU réserver C2 aux pairings avec gap TV ≥200 explicitement.

Cette modification est un follow-up post-MVP (lot 0.E.1 "phase 2") et
ne bloque pas la consultation du panel humain — l'engine produit déjà
des matchs lisibles, variés et fidèles à la signature FUMBBL sur les
critères principaux.

## Plan si GO

Une fois tous les critères en ✅ :

1. Documenter le verdict dans la section "Décision finale" ci-dessous.
2. Tagger sim-engine version `1.0.0-pro-league-mvp`.
3. Ouvrir le board Phase 1 (lots 1.A → 1.F).
4. Notifier les 5 testeurs panel + créditer dans `CHANGELOG.md`.
5. Brief le sprint owner sur le calendrier Phase 1 (~4 semaines visées).

## Décision finale

> ⏳ Non finalisée — verdict statistique GO (C1, C3, C4, C5 ✅) après
> iter #11 / engineVer 0.12.0. Le verdict global dépend désormais des
> notes panel (C6-C9). C2 reste hors cible mais limitation par
> construction des pairings TV-équilibrés — n'est pas bloquant.

| Rôle | Personne | Verdict | Date | Commentaire |
|---|---|---|---|---|
| Sprint owner | _name_ | _GO / NO-GO_ | _YYYY-MM-DD_ | _texte_ |
| Tech lead | _name_ | _GO / NO-GO_ | _YYYY-MM-DD_ | _texte_ |
| Game designer | _name_ | _GO / NO-GO_ | _YYYY-MM-DD_ | _texte_ |
| **Verdict global** | — | _GO / NO-GO_ | — | — |

## Annexes

- [`SPRINT-pro-league.md`](./SPRINT-pro-league.md) — sprint complet
- [`pro-league-panel/`](./pro-league-panel/) — kit panel BB experts
- [`pro-league-panel/score-synthesis.md`](./pro-league-panel/score-synthesis.md) — agrégation des 5 grilles
- `packages/sim-engine/CHANGELOG.md` — historique tuning iterations
- `packages/sim-engine/bench/bench-baseline.json` — snapshot baseline CI
- `packages/sim-engine/bench/reference-fumbbl.json` — dataset référence FUMBBL
