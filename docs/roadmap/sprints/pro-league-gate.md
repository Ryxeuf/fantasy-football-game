# Pro League — Gate Phase 0 → Phase 1

Document de décision **GO / NO-GO** pour passer de la Phase 0 (Sim
Foundation, lots 0.A → 0.E) à la Phase 1 (MVP Pro League + Paris,
lots 1.A → 1.F). Voir
[`SPRINT-pro-league.md`](./SPRINT-pro-league.md) pour le sprint
complet.

> **Statut courant : ⏳ EN ATTENTE**
> — métriques statistiques et engine livrés (lots 0.A → 0.D + 0.E.1).
> Panel humain (0.E.3) recruté mais pas encore noté.
> La décision finale ne pourra être prise qu'après réception des 5
> grilles testeurs (cf.
> [`pro-league-panel/score-synthesis.md`](./pro-league-panel/score-synthesis.md)).

## Engine sous évaluation

| Champ | Valeur |
|---|---|
| `engineVer` | `0.6.0` (cf. `packages/sim-engine/CHANGELOG.md`) |
| Snapshot bench-baseline | `2026-05-06` (3 pairings, runs=200, seed=0) |
| Tuning iterations effectuées | 5 (race-aware LOS → block→armor + tv → upset metric fix + bash recalib → defensive disruption → bash /28 + breakthrough 6% + Nuffle casualty injection) |
| Replays panel | 50 fichiers `replays/replay-XXX-*-seed[2026-2075].txt` (à regénérer pour engineVer 0.5.0) |

## Critères de gate

| # | Critère | Cible sprint | Mesure | Statut |
|---|---|---|---|---|
| C1 | Std dev TD ≥ 1.4 (lot 0.D.3) | ≥ 1.4 | _0.86 - 0.93_ | ❌ FAIL (progrès, iter #6 needed) |
| C2 | Upset rate 12-18% (lot 0.D.3) | 0.12 - 0.18 | _14.5 - 32.5% (Halflings vs Ogres 14.5% ✓ cible)_ | ⚠️ 1/5 pairings DANS cible |
| C3 | Tous matchups raciaux dans ±10% FUMBBL winrate (lot 0.E.1) | ±10% | _Iron Bears 30 vs Gold Rush 28 — parité OK ✓_ | ⚠️ partial RESOLU |
| C4 | bench-baseline.json passe à `engineVer` cible (lot 0.D.4) | PASS | PASS | ✅ |
| C5 | Tests unitaires sim-engine ≥ 95% pass rate | 95% | 258 / 258 = 100% | ✅ |
| C6 | Panel humain — moyenne globale ≥ 7/10 (lot 0.E.3) | ≥ 7.0 | _en attente_ | ⏳ |
| C7 | Panel humain — pas de note < 6.5 sur lisibilité tactique | ≥ 6.5 | _en attente_ | ⏳ |
| C8 | Panel humain — pas de note < 6.5 sur cohérence des drives | ≥ 6.5 | _en attente_ | ⏳ |
| C9 | Panel humain — ≥ 4/5 testeurs recommandent Phase 1 | 4 / 5 | _en attente_ | ⏳ |

**Verdict provisoire : NO-GO** (C1, C3 en échec).

Le panel humain reste à compléter, mais les seuils statistiques
imposent déjà un retour en lot 0.E.1 pour une seconde itération de
tuning. Le panel pourra être consulté une fois ces deltas réduits.

## Métriques statistiques détaillées (engineVer 0.2.0, 200 runs / pairing, seed=0)

| Pairing | H/D/A | TD mean ± std | Cas mean | TO mean | Diagnostic |
|---|---|---|---|---|---|
| Smashers vs Soaring Hawks | 82 / 47 / 71 | 2.29 ± 0.88 | 0.04 | 5.00 | Orcs > Wood Elves, ratio plausible |
| Snow Ogres vs Cheese Halflings | 93 / 58 / 49 | 1.57 ± 0.85 | 0.04 | 5.36 | Ogres > Halflings (✓ FUMBBL signature) |
| Soaring Hawks vs Tomb Cardinals | 70 / 62 / 68 | 1.88 ± 0.97 | 0.04 | 5.03 | Parité — étonnant, FUMBBL donne Wood Elf > Khemri ~58/42 |
| Iron Bears vs Gold Rush | 57 / 46 / 97 | 2.25 ± 0.94 | 0.04 | 4.72 | **Skaven dominent Dwarves** (✗ FUMBBL ~50/50, voir CHANGELOG known gaps) |
| Cold Tacticians vs Jungle Queens | 120 / 45 / 35 | 1.89 ± 0.88 | 0.04 | 5.41 | Lizardmen >> Amazons (signature plausible) |

### Deltas vs FUMBBL

| Métrique | Sim 0.2.0 | FUMBBL ref | Delta relatif | Statut |
|---|---|---|---|---|
| TD mean (ensemble) | 1.5 - 2.3 | 1.0 - 2.4 | dans la fourchette | ✅ |
| Casualty rate | ~0.04 | ~1.0 - 1.5 | **-95%** | ❌ |
| Std dev TD | ~0.9 | ~1.5 (estimation) | **-40%** | ❌ |
| Halflings winrate | ~25% | ~32% | -22% | ⚠️ |
| Ogres winrate | ~52% | ~36% | **+44%** | ❌ |
| Dwarves winrate vs Skaven | ~32% | ~50% | **-36%** | ❌ |

## Plan si NO-GO (current track)

Retour en **lot 0.E.1** (tuning iteration #2, target `engineVer 0.3.0`)
avec les changements suivants :

### Priorité haute (résout C1, C3)

1. **Casualty rate** : actuellement 0.04 / match (vs FUMBBL ~1.0-1.5).
   Maintenant que ST varie, vérifier que les blocks ST6 vs ST2
   produisent bien des POW + armor breaks. Si non, débugger le
   resolver block. Possible cause : la synthèse 1v1 ne capture pas
   les multi-blocks par turn.
2. **Std dev TD** : trop bas (0.9 vs 1.4 cible). Probable cause :
   les drives convergent tous vers ~7 yards/turn, donc 8 turns ×
   2 drives ≈ ~1-2 TDs très consistant. Augmenter la variance via
   plus de fat-tails events Nuffle (boost low-prob upset).
3. **Dwarves vs Skaven winrate** : modèle sur-récompense `pace`. Ajouter
   un terme `bashIndex` à la résilience underdog (bash teams encaissent
   mieux les turnovers).
4. **TV gap pre-match** : populer `tv` sur `PRO_LEAGUE_TEAMS` (lot 0.B.3
   addition) pour permettre de mesurer C2 (upset rate).

### Priorité moyenne (qualité narrative pour panel)

5. **Tactical headers** dans le narrator : afficher au début du replay
   les profils tactiques (`bashIndex`, `passingFrequency`, etc.) pour
   aider le panel à juger la cohérence race ↔ comportement.
6. **Storyline detection** : marquer dans le narrator les patterns
   (cage-build, breakaway) choisis par l'IA à chaque turn.

### Une fois ces fixes livrés (engine 0.3.0)

1. Re-snapshot baseline.
2. Re-bench les 5 pairings ci-dessus + un sample matrix de 20.
3. Vérifier C1, C3 dans le tableau.
4. Si verts → re-générer les 50 replays panel et envoyer aux 5
   testeurs.
5. Récupérer les grilles, remplir
   [`pro-league-panel/score-synthesis.md`](./pro-league-panel/score-synthesis.md),
   re-évaluer ce gate.

## Plan si GO

Une fois tous les critères en ✅ :

1. Documenter le verdict dans la section "Décision finale" ci-dessous.
2. Tagger sim-engine version `1.0.0-pro-league-mvp`.
3. Ouvrir le board Phase 1 (lots 1.A → 1.F).
4. Notifier les 5 testeurs panel + créditer dans `CHANGELOG.md`.
5. Brief le sprint owner sur le calendrier Phase 1 (~4 semaines visées).

## Décision finale

> ⏳ Non finalisée — les critères C1, C3 doivent passer avant de
> consulter le panel humain. Plan ci-dessus à exécuter pour atteindre
> `engineVer 0.3.0`.

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
