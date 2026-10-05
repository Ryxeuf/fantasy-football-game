# Session 2026-10-05 — Pro League lot 1 : un match complet

> Change OpenSpec `pro-league-full-match`. Premier des cinq lots de
> l'exploration
> [`2026-10-05-pro-league-match-integral.md`](../explorations/2026-10-05-pro-league-match-integral.md).
> Objectif : qu'un match du full driver soit STRUCTURELLEMENT un match de
> Blood Bowl, avant de toucher à la qualité tactique (lot 3).

## Ce qui a changé

### Moteur (`@bb/game-engine`) — profite aussi à l'entraînement contre l'IA

| Manque mesuré | Correction |
|---|---|
| 0 joueur relevé sur 96 mises à terre | Coup `STAND_UP` (3 PM, gratuit avec Jump Up). Prone = `stunned` sans `state: 'stunned'` ; un joueur sonné est retourné face visible à la fin du tour de son équipe. Aucun nouveau champ : les états stockés restent lisibles. |
| 85 % des blocages jamais résolus | Un `pending*` ferme la liste des coups légaux (`BLOCK_CHOOSE`, `PUSH_CHOOSE`, `FOLLOW_UP_CHOOSE`, `DUMP_OFF_CHOOSE`, `ON_THE_BALL_DECLINE`) et `applyMove` refuse les autres coups. `END_TURN` reste un nettoyage de secours, journalisé (`warning: 'pending-cleared'`). |
| Choix non scorés (−50 pour tous) | L'évaluateur décide : dé de blocage dans l'intérêt du choisisseur, poussée vers la foule et loin du ballon, suivi sauf pour le porteur, relance sur ramassage / esquive du porteur / fin de mi-temps, apothicaire sur blessure, remise vers un receveur. |
| Coups d'une case entremêlés | Activation contiguë : tant qu'un joueur a une activation ouverte, seuls ses coups sont légaux. `END_PLAYER_TURN` vaut −0,5 (au-dessus d'END_TURN), une case coûte 1,25, un GFI porte son coût attendu. `END_PLAYER_TURN` porte `gfiUsed` au cap réel (Sprint) — sinon l'IA bouclait. |
| Charge (coup d'envoi 10) | Seuls les joueurs désignés sont proposés, sans Action de Blocage simple. |

### Sim-engine (`@bb/sim-engine`, `ENGINE_VER` 0.27.0)

- Remise en jeu headless après **chaque** touchdown : `executeHeadlessDrive`
  (ex-`executeHeadlessHalftime`), une seule séquence pour la mi-temps et
  l'après-TD ; `kickingTeam` posé dès l'état initial.
- Évènements de coup d'envoi interactifs appliqués et résolus
  (`full-driver-kickoff-ai`) : Solide défense, Chandelle, Surprise, Charge.
- Un coup refusé par le moteur n'est plus rejoué jusqu'au plafond de 1 500 :
  clôture de l'activation, sinon fin de tour.
- Toutes les mesures sur de vrais rosters (`engine-roster-fixture`,
  `buildEngineSimInput`) : smoke de perf (p95 < 5 s), `sim:perf`,
  `sim:compare`, comparaison serveur, et le test d'invariants
  `full-match.invariants.test.ts` (20 graines, `FULL_MATCH_SEEDS=100`).

## Mesuré (Orques vs Elfes sylvains, 10 graines, rosters de 13)

| | Avant (0.26.0) | Après (0.27.0) |
|---|---|---|
| Blocages résolus | 15 % | 100 % |
| Joueurs relevés pendant un drive | 0 | ~23 par match |
| États vides persistants après un TD | 6 à 11 % | 0 |
| Tours d'équipe joués | 25 sur 32 | 32 (± « Temps mort ») |
| Coups par match | 439 | 566 |
| Calcul par match | 0,9 s | 0,8 s |
| TD par match | 0,5 | 0,5 |

Le TD/match ne bouge pas : c'est l'IA (plan de drive, probabilités) qui
manque, objet du lot 3. Le replay reste en snapshots (2 Mo) : lot 2.

## Pièges rencontrés

- **Deux cas de boucle infinie** révélés par les invariants : un BLITZ refusé
  par le dispatcher pendant « Charge » (joueur non désigné) était rejoué sans
  fin ; un joueur avec Sprint gardait une activation ouverte après
  `END_PLAYER_TURN` (`gfiUsed: 2` < cap 3). D'où la garde « coup refusé » du
  driver et le cap réel dans `handleEndPlayerTurn`.
- **Sans ballon sur le terrain**, toutes les cases valaient 0 et l'IA errait
  jusqu'à épuiser ses PM (test `ai-vs-ai-loop` à 200 coups) : le coût d'une
  case règle ça.
- **Les évènements `TURN_START` ne comptent pas les tours** : ils sont aussi
  émis aux remises en jeu. Les invariants comptent les `END_TURN` par
  mi-temps et par équipe, bornés 6-10 (deux « Temps mort » possibles).
- **Le snapshot de baseline** s'écrit en redirigeant `tsx scripts/...`, pas
  `pnpm run` (qui préfixe stdout).

## Suites (lots suivants)

Lot 2 journal d'actions rejouable, lot 3 cerveau du coach, lot 4 évolution
persistée, lot 5 exploitation — cf. exploration §6 et décisions §8.
