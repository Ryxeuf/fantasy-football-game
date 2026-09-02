# Design — Règle « Capitaine »

## Décisions

### Flag sur `TeamPlayer` plutôt que FK sur `Team`
`isCaptain Boolean` sur le joueur (comme `NflFantasyLineupSlot.isCaptain`)
plutôt que `Team.captainPlayerId`. Un capitaine mort/licencié GARDE son flag
jusqu'à la désignation du successeur : l'UI peut afficher « votre capitaine
est mort, désignez un successeur » sans table d'historique. L'unicité est
garantie côté service (updateMany de nettoyage dans la transaction de
désignation), pas par contrainte DB (une contrainte partielle unique n'est
pas portable sqlite/PG via Prisma).

### Pro dans `skills`, jamais dans `advancements`
Le calcul de VE (`utils/team-values.ts`) = coût de poste +
`calculateAdvancementsSurcharge(advancements)`. Le CSV `skills` n'entre pas
dans la VE : injecter `pro` dedans donne « Pro sans augmenter la valeur »
par construction, sans cas spécial dans le calculateur. En brouillon, un
changement de capitaine retire `pro` à l'ancien SEULEMENT si elle ne vient
ni des compétences de base du poste ni d'un advancement acheté.

### Re-désignation : brouillon libre, ligue verrouillée
- Équipe non engagée (`isTeamRosterFrozen` = false) : désignation et
  changement libres — la liste n'est pas finale.
- Équipe engagée : désignation possible UNIQUEMENT s'il n'y a pas de
  capitaine actif (jamais désigné, mort, ou licencié). Sinon
  `captain_already_active` (409).

### D6 gratuit : jet conditionné à la présence d'un capitaine
`consumeTeamReroll(state, team, rng)` ne consomme un tirage rng QUE si
`findCaptainOnPitch` trouve un capitaine (flag optionnel absent des états
legacy) → la séquence de dés des replays existants est inchangée, pas de
bump `ENGINE_VER`. « Sur le terrain » = case valide + état actif/sonné
(KO/blessé/expulsé exclus).

### Placement obligatoire : même convention que la validation existante
`validatePlayerPlacement` refuse déjà silencieusement un mauvais compte de
joueurs. Le check capitaine suit la même convention (state inchangé) mais
ajoute une entrée `gameLog` explicite. `autoSetupAITeam` trie le capitaine
en tête de réserve pour ne jamais bloquer un match vs IA.

### Garde licenciement : filtre silencieux + log
`applyOfflineFirings` filtre déjà silencieusement les ids invalides
(mauvaise équipe, déjà licencié). Le capitaine non licenciable suit la même
convention (filtré + `serverLog.warn`) plutôt qu'un rejet de toute la
feuille de match.

## Alternatives écartées

- **`Team.captainPlayerId`** : perd l'historique « capitaine perdu » sans
  table dédiée, et complique les includes existants (`players: true`).
- **Pro en advancement à coût 0** : demanderait un cas spécial dans
  `calculateAdvancementsSurcharge` et polluerait l'historique de level-up.
- **Rejet dur de la feuille de match sur licenciement du capitaine** :
  casserait la saisie complète pour une erreur d'un seul checkbox ; le
  filtre + log suit la convention existante des ids invalides.

## Hors périmètre (suites possibles)

- Sim-engine Pro League (`full-driver`) : pas de capitaine dans la ligue
  simulée (rosters générés sans désignation).
- Placement obligatoire côté UI de setup online (le moteur refuse déjà ;
  l'UI n'affiche pas encore de hint dédié).
