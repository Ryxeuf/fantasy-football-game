# Blocage : appliquer le Repoussé AVANT le Plaquage, jusque dans le choix de direction

## Why

Le livre 2025 décrit **Défenseur Plaqué** en deux temps ordonnés : « Appliquez
le résultat Repoussé au joueur. De plus, **après avoir appliqué le résultat
Repoussé**, le joueur cible est immédiatement Plaqué […] **sur la case où il se
trouve à présent**. » **Bousculé** sans Esquive se lit Défenseur Plaqué, donc
même séquence.

Le moteur fait l'inverse : `handlePow` et `handleStumble`
(`packages/game-engine/src/mechanics/blocking.ts`) passent la cible à `stunned`,
roulent l'armure et la blessure, **puis** appellent `handlePushWithChoice`.

La PR #1005 a corrigé les deux conséquences les plus visibles de cette
inversion, mais seulement sur les chemins où la case d'arrivée est connue
immédiatement :

- poussée hors du terrain → la cible encaissait le jet de blessure du blocage
  **puis** la Blessure par le Public (deux jets, deux « morts » sur un blocage) ;
- porteur du ballon → le ballon était lâché sur la case de **départ**.

**Il reste trois divergences, toutes sur le même axe :**

1. **Chemin `pendingPushChoice`.** Quand plusieurs cases de poussée sont
   libres, `handlePushWithChoice` rend la main au coach et la poussée n'est
   résolue qu'au `PUSH_CHOOSE` suivant (`actions/choice-handlers.ts`). Le jet
   d'armure a donc déjà eu lieu, et `dropBallFromCurrentSquare` lâche le ballon
   sur la case de départ faute de connaître la destination. C'est le cas le
   plus **fréquent** en jeu réel — un blocage en milieu de terrain offre
   presque toujours plusieurs directions.
2. **Stabilité (Stand Firm).** La règle laisse la cible refuser le Repoussé ;
   comme le Repoussé précède le Plaquage, elle est **debout** au moment du
   choix. Le moteur la marque `stunned` avant, et `handlePushWithChoice`
   exige un joueur debout : Stabilité est donc silencieusement refusée sur
   Défenseur Plaqué et Bousculé. Un commentaire du code assume aujourd'hui ce
   comportement comme un correctif, alors qu'il découle de l'inversion.
3. **Parade (Fend).** Même mécanique : `isFendActiveForFollowUp` rend `false`
   parce que la cible est déjà tombée. Parade ne peut donc jamais empêcher la
   Poursuite après un Défenseur Plaqué.

## What Changes

- **Différer le Plaquage** (mise à terre + jet d'armure/blessure + lâcher du
  ballon) jusqu'à ce que la case d'arrivée soit connue, sur **les trois**
  chemins de `handlePushWithChoice` : poussée immédiate, sortie de terrain,
  et choix de direction différé.
- **Porter l'intention dans l'état** : `pendingPushChoice` gagne de quoi dire
  « après cette poussée, la cible est Plaquée par l'attaquant » (le résultat
  `POW` / `STUMBLE` y est déjà stocké — c'est le point d'accroche naturel).
  `PUSH_CHOOSE` applique le Plaquage après `applyChainPush`.
- **Rétablir Stabilité et Parade** sur Défenseur Plaqué et Bousculé, la cible
  étant debout au moment du Repoussé. Retirer le commentaire « BUG fix » de
  `handlePushWithChoice` devenu faux.
- **Lâcher le ballon depuis la case d'arrivée** sur tous les chemins, le rebond
  partant de là.
- **Re-snapshoter le bench** `@bb/sim-engine` et bumper `ENGINE_VER`
  (cf. Impact) — la procédure est celle qu'a suivie #1005.

## Out of scope (suivi)

- L'ordre à l'intérieur de **Les Deux Plaqués** (les deux joueurs tombent sur
  leur propre case, aucune poussée) : non concerné.
- **Multiple Block** et **Frénésie** : ces flux réutilisent
  `handlePushWithChoice` et doivent rester verts, mais leur logique propre
  n'est pas revue ici.
- La table des faces du dé, ses libellés et le compendium : livrés par #1005.

## Impact

- **Capability** : `block-resolution` (nouvelle).
- **Code** : `mechanics/blocking.ts` (`handlePow`, `handleStumble`,
  `handlePushWithChoice`, `willBePushedOffPitch`, `dropBallFromCurrentSquare`),
  `actions/choice-handlers.ts` (`PUSH_CHOOSE`), `core/types.ts`
  (`pendingPushChoice`).
- **Schéma** : aucun. Rien n'est persisté ; `pendingPushChoice` vit dans le
  `GameState` d'un match en cours.
- **Ordre de consommation du RNG** : c'est le vrai coût, et la raison pour
  laquelle #1005 s'est arrêtée avant. Déplacer `armorAndInjuryWithMightyBlow`
  après la poussée décale les tirages de tout blocage POW/Bousculé. Attendu :
  - `sim-bench` dérivera au-delà des 5 % de tolérance ⇒ bump `ENGINE_VER` +
    `pnpm --filter @bb/sim-engine sim:bench:snapshot --apply` (vérifier le
    déterminisme par deux runs identiques **avant** d'appliquer) ;
  - les tests à seed fixe portant sur un blocage devront être relus un par un.
    Ordre de grandeur : ~18 fichiers de test `game-engine` appellent
    `resolveBlockResult`, ~16 mentionnent POW/Bousculé. Beaucoup passent un RNG
    constant et survivront ; c'est le chiffrage haut, pas une prévision d'échec.
- **Matchs en cours** au moment du déploiement : un `GameState` porteur d'un
  `pendingPushChoice` créé par l'ancien code n'aura pas le marqueur de
  Plaquage différé. Le lire avec un repli (absent ⇒ comportement actuel) évite
  de perdre le blocage en cours.
- **Replays archivés : NON concernés.** `Replay.payload` stocke le flux
  d'évènements (CBOR+gzip) relu par `decompressEvents` ; aucun replay n'est
  rejoué en re-simulant depuis un seed. Seules les simulations **futures**
  changent.
- **Tests** : les cas ajoutés par #1005
  (`mechanics/block-defender-down-order.test.ts`) couvrent déjà la sortie de
  terrain et le ballon sur poussée immédiate ; ils doivent rester verts et
  s'étendre au chemin différé, à Stabilité et à Parade.
