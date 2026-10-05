# Pro League — un match complet (lot 1)

## Pourquoi

Le full driver de `@bb/sim-engine` joue une partie IA contre IA sur le vrai
moteur `@bb/game-engine`, mais le match qu'il produit n'est pas un match de
Blood Bowl. Mesuré sur `ENGINE_VER 0.26.0` avec des rosters de 13 joueurs
(exploration
[`docs/roadmap/explorations/2026-10-05-pro-league-match-integral.md`](../../../docs/roadmap/explorations/2026-10-05-pro-league-match-integral.md)) :

| Constat | Mesure | Cause dans le code |
|---|---|---|
| Blocages sans effet | 85 % des blocages et blitz restent en `pendingBlock`, effacés par `END_TURN` | `getLegalMoves` ne génère jamais `BLOCK_CHOOSE`, `PUSH_CHOOSE`, `FOLLOW_UP_CHOOSE`, `DUMP_OFF_CHOOSE` |
| Joueurs perdus pour le drive | 0 relevé sur 96 mises à terre | `stunned` n'est remis à `false` qu'au TD et à la récupération KO ; pas de Prone, pas d'action « se relever » |
| Mi-temps vide après un TD | 6 à 11 % des états sans joueur sur le terrain | `handlePostTouchdown` renvoie tout le monde en réserve avec `preMatch.phase = 'setup'` ; le driver ne remet en jeu qu'à la mi-temps |
| Tours asymétriques | 25 tours d'équipe joués sur 32 | `kickingTeam` jamais posé en 1re mi-temps |
| Coup d'envoi appauvri | évènements interactifs ignorés | `full-driver-kickoff.ts` ne les applique pas |
| Aucune activation lisible | coups d'une case entremêlés entre joueurs | `handlePlayerSwitch` ne clôt pas l'activation précédente |
| Relance et apothicaire automatiques | les deux options valent −50 | `scoreMove` par défaut |

Résultat : 0,5 TD par match contre 3 à 4,8 en référence FUMBBL, 72 % des
tours terminés sur turnover. Tant que ces manques subsistent, ni l'IA (lot 3)
ni le replay rejouable (lot 2) ne sont mesurables. Les deux premiers manques
touchent aussi l'entraînement contre l'IA du jeu en ligne, qui passe par les
mêmes `getLegalMoves` et `pickAIMove`.

## Quoi

Rendre un match du full driver **structurellement complet**, sans encore
toucher à la qualité tactique de l'IA :

1. **Remise en jeu après un touchdown**, headless, par la même séquence que
   la mi-temps (placement des deux équipes, validation, coup d'envoi 2D6).
2. **Prone et Stunned distingués** dans l'état du joueur ; passage Stunned →
   Prone en fin de tour de son équipe ; action « se relever » pour 3 PM (ou
   toute l'allocation si MA < 3), gratuite avec *Jump Up* ; lecture tolérante
   des états déjà stockés (`stunned: true` ancien).
3. **Les choix en attente sont des coups légaux obligatoires** : dès qu'un
   `pending*` est posé, `getLegalMoves` ne renvoie que les coups qui le
   résolvent ; l'IA les scorera avec des règles simples (dé de blocage selon
   le choisisseur, poussée vers la touche et loin du ballon, suivi au contact
   du porteur, relance selon la valeur de l'action, apothicaire selon la
   gravité et la valeur du joueur, remise `DUMP_OFF`).
4. **Évènements de coup d'envoi interactifs** appliqués headless (Défense
   solide, Coup haut, Vif comme l'éclair, Blitz) avec un placement IA simple.
5. **`kickingTeam` posé** dès la construction de l'état et recalculé en
   2e mi-temps.
6. **Activation contiguë** : un joueur activé joue sa séquence complète avant
   qu'un autre soit activé (`END_PLAYER_TURN` implicite au changement de
   joueur), au plus une activation par joueur et par tour.
7. **Invariants testés sur 100 graines** (test d'intégration du full driver
   avec rosters de 13 joueurs) : 16 tours d'équipe par mi-temps, aucun
   `pending*` après un `END_TURN`, 100 % des blocages résolus, chaque TD suivi
   d'un coup d'envoi, les joueurs à terre se relèvent, un joueur activé au
   plus une fois par tour.
8. **Bench et perf sur de vrais matchs** : `sim:perf`, `sim:compare` et le
   smoke de perf passent des rosters de 13 joueurs au lieu du `setup()` à
   2 contre 2.

`ENGINE_VER` est bumpé : les issues de match changent à graine constante,
`bench/bench-baseline.json` est re-snapshoté.

## Décisions cadres (2026-10-05)

Prises sur l'exploration et applicables à ce lot : le full driver devient le
**seul** driver de production (l'hybride ne sert plus qu'aux cotes jusqu'à un
estimateur) ; un lot = une PR, en séquence, le bench de ce lot servant de gate
au lot 2 ; budget de calcul ≤ 30 s par match (la perf de ce lot vise p95 < 5 s
avant l'IA du lot 3) ; le replay rejouable (RNG forké par coup + dés
enregistrés) est le lot 2, ce lot garde le RNG unique.

## Hors périmètre

- Plan de drive, planificateur d'activations, probabilités, personnalités,
  softmax (lot 3 de l'exploration).
- Replay en journal d'actions, RNG forké par coup, feuille de match papier,
  viewer pas-à-pas (lot 2).
- Profil tactique persisté et adaptation (lot 4).
- Coups spéciaux scorés à −50 (Lancer de coéquipier, Regard hypnotique,
  Tronçonneuse…) : restent non joués par l'IA.
- Dégel de la Pro League en prod : tout se teste via `/admin/sim/test-match`
  et la CI.
