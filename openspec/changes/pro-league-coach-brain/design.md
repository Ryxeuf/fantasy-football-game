# Design — le cerveau du coach

## Où vit chaque pièce

```
packages/sim-engine/src/coach/
  probability.ts          P(esquive, GFI, ramassage, passe, réception), dés et
                          soutiens de blocage (fonctions du moteur), armure
  roles.ts                rôle dérivé du poste et des compétences, aptitude de porteur
  personality.ts          cinq traits par joueur dérivés de son identifiant
  drive-plan.ts           DriveContext, stratégies, choosePlan (softmax), shouldReplan
  evaluate.ts             contexte précalculé (zones de tacle, porteur, case visée),
                          contribution par joueur, gain d'une mise au sol
  activation-planner.ts   cases atteignables (chemin le plus sûr), candidats
                          (déplacement, blocage, blitz, passe, remise, agression,
                          relevé), coût du turnover, relance, libération du porteur
  coach.ts                orchestrateur : choix en attente, file d'activation,
                          plan, ordre canonique, softmax, momentum, trace
packages/sim-engine/src/driver/full-driver.ts   coach.nextMove / onApplied
packages/sim-engine/src/bench/                  runBench({ driverKind }), baseline full
packages/game-engine/src/mechanics/ball.ts      settleLooseBall, remise en jeu, rebond sur prone
```

## Décisions

### Une utility AI pilotée par un plan, pas un arbre codé en dur

Le style d'une équipe est un VECTEUR (les 15 paramètres du profil) qui
déforme les scores : plancher de risque, tempo, politique de relance et
d'agression, réserve du blitz. Le plan de drive est choisi par softmax et
COLLE — il n'est ré-évalué que sur évènement (changement de possession, de
mi-temps, passage en fin de mi-temps, bascule du score). C'est l'inverse du
driver hybride, qui le retirait à chaque « key moment ».

### Des activations entières, scorées en espérance

Le moteur joue case par case ; le coach raisonne en ACTIVATIONS (chemin +
action finale). Pour chaque joueur, les cases atteignables sont calculées
avec leur chemin le plus SÛR (relaxation par couches de pas sur le produit
des réussites : esquives, GFI, ramassage), et chaque candidat vaut
`P × gain − (1 − P) × coût du turnover`, où le coût décroît avec les
joueurs qui ont déjà agi — ce qui place naturellement les actions risquées
en fin de tour. La relance d'équipe est comptée sur le jet le moins sûr du
chemin, avec la même règle que `wantsTeamReroll` appliquera au moment du
jet. Un touchdown vaut TOUJOURS 1000 de plus que rester (le gain est posé
sur la base, pas comparé à elle — sinon un porteur à une case de l'en-but,
dont la progression vaut déjà beaucoup, ne rentrait pas).

### Une fonction de valeur LOCALE

La valeur d'une équipe est la somme de contributions par joueur qui ne
dépendent que de sa case et de ses voisins ; déplacer un joueur ne recalcule
que la sienne, ce qui rend les centaines de cases candidates bon marché
(~1 s par match, contre 6 s pour une première version qui ré-évaluait tout).
Le contexte (zones de tacle en grille, listes des joueurs debout, porteur,
rôles) est précalculé une fois par décision.

### La cage se forme là où le porteur VA

Les coéquipiers ancrent leur escorte sur la case VISÉE par le porteur
(`carrierIntent`, décidée une fois par tour avant les activations), pas sur
sa case actuelle ; et le porteur compte comme soutien potentiel les
coéquipiers qui n'ont pas encore joué et PEUVENT rejoindre sa destination.
Sans ces deux règles, la cage formée autour de la case actuelle RETENAIT le
porteur (chaque pas en avant « perdait » ses gardes). La géométrie compte :
coins (diagonales) pleins, côtés moindres, la case juste devant pénalisée
(elle bouche le couloir), et un porteur dont les trois cases avant sont
occupées est pénalisé.

### Libérer le porteur avant de le faire esquiver

Quand le porteur est marqué, les blocages et blitz sur ses marqueurs
héritent d'une part de ce que son déplacement rapporterait ; quand il est
encerclé, on évalue ce qu'ouvrirait le retrait d'un adversaire proche, puis
de PAIRES d'adversaires. Les candidats étant regénérés à chaque activation,
une fois les marqueurs écartés le porteur se déplace sans jet. Les blocages
à un dé sans Blocage (des paris) ne sont jamais boostés ainsi.

### Le modèle de dés doit être CELUI du moteur

Une première version comptait les soutiens avec sa propre règle : le coach
annonçait deux dés là où le moteur n'en lançait qu'un — 95 blocages à un dé
par six matchs, un tiers d'attaquants au sol. `blockDice` appelle désormais
`calculateOffensiveAssists` / `calculateDefensiveAssists` sur un état où
l'attaquant est virtuellement placé. Règle générale : toute probabilité que
le coach calcule part des fonctions du moteur, jamais d'une transcription.

### Le RNG du coach est séparé des dés

`makeRNG(`${seed}:ai`)` sert le softmax ; les dés d'un coup gardent leur flux
`${seed}:move:${n}` (lot 2). Le journal reste rejouable sans le coach, et
deux coachs différents sur le même journal donnent les mêmes dés.

## Bugs du moteur trouvés par le bench

| Symptôme mesuré | Cause | Correction |
|---|---|---|
| 40 jets de ramassage par match, un turnover sur six | `state.ball` SUIT le porteur et chaque handler testait « atterrit sur le ballon » | `handleBallPickup` ignore un joueur qui porte déjà le ballon |
| Ballon disparu, porteur KO en réserve avec `hasBall` | Les Deux Plaqués ne lâchait le ballon que pour l'attaquant ; le dugout emportait le ballon | lâché sur la case du renversé et à la sortie du terrain |
| Ballon coincé sous un joueur au sol plusieurs tours | les résolutions de blocage posaient le ballon « en attendant le rebond de l'appelant » que personne n'appelait ; un rebond s'arrêtait SOUS un joueur au sol ou sans PM | `settleLooseBall` après chaque coup, rebond sur un joueur au sol, réception pour tout joueur debout |
| Ballon « rebondissant » contre la touche | position bornée au bord | remise en jeu par le public (2D6 vers l'intérieur) |
| Coups à deux dés annoncés, un dé lancé | un soutien exigeait `pm > 0` | soutien = debout, sur le terrain, non marqué (BB2020) |
| Dernier joueur activé coupé après une case | `shouldAutoEndTurn` comptait un déplacement entamé comme « a agi » | une activation ouverte n'a pas fini d'agir |
| 9 tours par mi-temps, 2e mi-temps engagée par le dernier marqueur | le compteur de rounds et l'ordre d'alternance lisaient `kickingTeam`, qui change après chaque TD | `halfKickingTeam` fixe l'ordre pour la mi-temps ; `handlePostTouchdown` avance le round quand le marqueur jouait en second et clôt la mi-temps au dernier tour |

## Ce qui manque encore (mesuré, pour le calibrage)

- Le porteur avance de 2 à 3 cases par tour ; au premier coup du tour il n'a
  aucun déplacement acceptable dans la moitié des cas, presque toujours
  parce que les zones de tacle adverses couvrent toutes ses cases avant
  (défense qui marque le porteur à chaque tour, sans que cela lui coûte
  assez). Pistes : coût de marquage côté défense (être marqué par deux
  bloqueurs vaut un blocage à deux dés subi), tempo plus élevé loin de
  l'en-but, continuer de courir après un ramassage.
- Passes et remises quasi absentes (0,1 à 0,5 par match) : la passe n'est
  proposée qu'en début d'activation (règle du moteur) et son coût de
  turnover reste élevé.
- Turnovers 11 à 12 par match sur les duels agiles (référence 6 à 10) :
  pour moitié des blocages à deux dés sans Blocage (11 % d'attaquant au sol),
  pour le reste des esquives et des relances ratées.
