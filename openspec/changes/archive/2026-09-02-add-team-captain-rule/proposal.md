# Règle spéciale d'équipe « Capitaine » (Saison 3)

## Why

Les rosters Humains et Orques (Saison 3) portent la règle spéciale
`capitaine` dans le catalogue (`packages/game-engine/src/rosters/
team-special-rules.ts`), mais la règle n'était **pas implémentée** : aucune
désignation à la création d'équipe, pas de compétence Pro offerte, pas
d'effet en match, et aucun moyen en ligue de désigner un successeur quand
le capitaine meurt ou est licencié.

Règle officielle : à la création de la liste, le coach peut désigner
n'importe quel joueur (sauf un Gros Bras) capitaine. Le capitaine gagne
immédiatement Pro sans augmenter sa valeur. S'il est sur le terrain, chaque
relance d'équipe déclenche un D6 — sur un 6 naturel elle est gratuite. Au
placement, le capitaine doit être aligné si possible. Il ne peut être
renvoyé que s'il a subi une blessure réduisant une caractéristique ; s'il
est tué, un nouveau capitaine peut être désigné après le match.

## What Changes

- **Données.** `TeamPlayer.isCaptain Boolean @default(false)` (PG + mirror
  sqlite + migration). Invariant service : au plus un capitaine par équipe.
- **Désignation (serveur).** Service `team-captain.ts` + endpoints
  `GET/POST /team/:id/captain` : désignation à la création (équipe
  brouillon, changement libre), re-désignation en ligue UNIQUEMENT si le
  capitaine est mort ou licencié. Gros Bras (Solitaire) exclus. Pro est
  injectée dans `skills` (jamais dans `advancements`) → aucune hausse de
  VE, par construction du calcul de valeur.
- **Licenciement gardé.** La feuille de match ligue (`applyOfflineFirings`)
  refuse le licenciement d'un capitaine sans blessure réduisant une
  caractéristique (`canFirePlayer`).
- **Effets en match (game-engine).** Flag `Player.isCaptain` propagé depuis
  la DB ; relance d'équipe gratuite sur 6 naturel si le capitaine est sur
  le terrain (`consumeTeamReroll`) ; placement refusé si le capitaine
  disponible est laissé en réserve (`validatePlayerPlacement`) ; l'IA de
  placement aligne le capitaine en priorité.
- **UI web.** Panneau « Capitaine d'équipe » sur `/me/teams/[id]` (rendu
  seulement si le roster a la règle) : badge du capitaine actif, alerte +
  sélecteur de successeur si mort/licencié, désignation à la création.
  Badge « C » dans le tableau des joueurs.

## Impact

- Prisma : 1 colonne additive (défaut `false`), migration triviale.
- Déterminisme replays : le D6 capitaine n'est jeté QUE si un capitaine est
  présent dans l'état — les états antérieurs (sans `isCaptain`) rejouent
  à l'identique.
- Équipes existantes humaines/orques déjà engagées : pas de capitaine →
  le panneau propose la désignation (même règle que « capitaine perdu »).
