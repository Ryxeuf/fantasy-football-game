# Tasks — Repoussé avant Plaquage

> Séquence conseillée : 2 et 3 ne touchent pas au RNG et peuvent être validés
> seuls. Le 4 décale les tirages : le garder pour la fin isole ses échecs.

## 1. Cadrage
- [ ] 1.1 Relire les trois sorties de `handlePushWithChoice` et lister, pour chacune, ce qui doit se produire APRÈS la poussée (mise à terre, armure/blessure, lâcher du ballon, Poursuite).
- [ ] 1.2 Confirmer sur le compendium `/compendium/des-de-blocage` et `BLOCK_DIE_FACE_INFO` que l'ordre visé est bien « Repoussé puis Plaqué sur la case d'arrivée ».

## 2. Stabilité et Parade (sans impact RNG)
- [ ] 2.1 Évaluer Stabilité sur la cible DEBOUT pour Défenseur Plaqué et Bousculé ; retirer le commentaire « BUG fix » de `handlePushWithChoice` devenu faux.
- [ ] 2.2 Idem Parade (`isFendActiveForFollowUp`) : la cible est debout au moment du Repoussé.
- [ ] 2.3 Tests : Stabilité refuse le Repoussé sur un Défenseur Plaqué ; Parade empêche la Poursuite. Vérifier que le test échoue AVANT le correctif.

## 3. Plaquage différé sur le chemin `pendingPushChoice`
- [ ] 3.1 Porter l'intention de Plaquage dans `pendingPushChoice` (`core/types.ts`), avec repli pour un état créé par l'ancien code.
- [ ] 3.2 `PUSH_CHOOSE` : appliquer la mise à terre après `applyChainPush`, sur la case d'arrivée.
- [ ] 3.3 Lâcher le ballon depuis la case d'arrivée sur ce chemin (`dropBallFromCurrentSquare` y lit aujourd'hui la case de départ).
- [ ] 3.4 Tests : blocage avec plusieurs directions libres ⇒ la cible tombe sur sa case d'arrivée, le ballon rebondit de là.

## 4. Déplacement du jet d'armure (impact RNG)
- [ ] 4.1 Déplacer `armorAndInjuryWithMightyBlow` après la poussée sur les trois chemins ; `willBePushedOffPitch` devient inutile sur le chemin « sortie » (la foule reste seule) — le retirer s'il n'a plus d'appelant.
- [ ] 4.2 Relire un par un les tests à seed fixe touchant POW/Bousculé. Ne corriger une attente que si le NOUVEAU comportement est le bon ; un test qui casse pour une autre raison est un vrai échec.
- [ ] 4.3 `pnpm --filter @bb/sim-engine sim:bench:ci` : constater la dérive attendue.
- [ ] 4.4 Bumper `ENGINE_VER` (`sim-engine/src/types.ts`) en documentant la raison, puis `sim:bench:snapshot --apply`. Vérifier le déterminisme par DEUX runs identiques avant d'appliquer.
- [ ] 4.5 Contrôler que les métriques bougent peu (une hausse nette de `casualtyMean` signalerait un double jet, pas un décalage de seed).

## 5. Validation
- [ ] 5.1 `vitest run` sur `game-engine`, `sim-engine`, `ui`, `web`, `server`.
- [ ] 5.2 `tsc --noEmit` sur les paquets touchés + `pnpm lint`.
- [ ] 5.3 Vérifier Multiple Block et Frénésie, qui réutilisent `handlePushWithChoice`.
- [ ] 5.4 Changeset + PR. Signaler explicitement le bump `ENGINE_VER` dans la description.

## 6. Suivi
- [ ] 6.1 `/opsx:sync` puis `/opsx:archive` après merge.
