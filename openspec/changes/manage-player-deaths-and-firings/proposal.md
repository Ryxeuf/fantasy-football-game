# Morts & licenciements : statut tracé et réversible

## Why

Un match peut être annulé (invalidation d'une feuille de match ligue,
annulation/suppression d'un match en ligne par un admin). Les morts et les
licenciements qu'il a provoqués doivent alors être **rétablis**. Aujourd'hui :

- Le soft delete existe déjà (`TeamPlayer.dead` / `diedAt` / `firedAt` :
  la ligne n'est jamais supprimée), mais **sans provenance**. Impossible de
  savoir quel match a tué ou licencié un joueur.
- Seul le flux ligue offline est réversible, et uniquement parce que la
  provenance est portée par le snapshot du match
  (`Match.offlineResultInput` → `injuries[]`, `firedApplied[]`) que
  `reverseOfflineLeagueResult` relit.
- Les morts des matchs **en ligne** (`persistPlayerDeaths` appelé par
  `move-processor`) sont posées sans lien vers le match : irréversibles.
- Le revert est **inconditionnel** (`dead:false`, `firedAt:null` en aveugle).
  Si le statut courant vient d'une autre source que celle qu'on annule
  (mort re-posée à la main, autre match), on ressuscite à tort.
- Les filtres « joueur au roster actif » sont incohérents à travers le
  site : `firedAt: null` seul ici (`cup-registration`, `cup-roster-snapshot`,
  `commissioner-team-edit`), `dead: false` seul là (`league-player-stats`,
  `post-match-league-sequence`). Un mort peut être inscrit en coupe, un
  licencié peut prendre un level-up.

## What Changes

- **Données.** Provenance sur `TeamPlayer` (`status`, `statusAt`,
  `statusSource`, `statusSourceId`) + journal `TeamPlayerStatusEvent`
  (kind `death`/`firing`, sourceType, sourceId, actorUserId, reason,
  revertedAt). `dead`/`firedAt` sont conservés et écrits en **dual-write**
  pour ne pas casser la cinquantaine de call-sites existants.
- **Service `player-status.ts`.** API unique d'application et de reversion :
  `applyPlayerStatus` / `applyPlayerStatuses` / `revertPlayerStatus` /
  `revertPlayerStatusesBySource`. Idempotent (un joueur déjà inactif est
  skippé), transactionnel (update joueur + event dans la même transaction).
- **Revert vérifié.** On ne revert que si l'événement actif du joueur est
  bien celui de la source annulée, et l'update est **conditionnel**
  (`updateMany where { statusSource, statusSourceId }` + vérification du
  `count`). Sinon → skip `status-superseded`, jamais de résurrection à tort.
  Un événement `legacy` (backfill) est accepté : le caller a sa propre
  preuve (snapshot du match), ce qui préserve le comportement actuel sur
  les données existantes.
- **Branchements.** Feuille de match ligue (morts + licenciements),
  invalidation de feuille (revert vérifié), match en ligne
  (`persistPlayerDeaths` reçoit le `matchId`), annulation/suppression
  admin d'un match en ligne (revert des morts de ce match).
- **Filtres uniformes.** `ACTIVE_PLAYER_WHERE` / `isActivePlayer` exportés
  par le service, utilisés partout, + test CI garde-fou interdisant les
  filtres partiels (`dead: false` seul / `firedAt: null` seul) dans
  `services/` et `routes/` (sur le modèle de `no-raw-body-cast.test.ts`).
- **UI.** Le roster ligue et la fiche carrière affichent la cause et la
  source du statut (« mort — match J3 », « licencié — feuille de match »),
  et l'écran d'invalidation de feuille annonce les joueurs ressuscités /
  réintégrés.

## Impact

- Prisma : 4 colonnes additives sur `TeamPlayer` (défauts non
  destructifs) + 1 table. Backfill des lignes existantes en `legacy`.
- Aucun changement de comportement pour les données existantes :
  l'invalidation d'une feuille saisie avant le déploiement continue de
  fonctionner via le fallback `legacy`.
- Les filtres corrigés changent des résultats visibles : un licencié ne
  peut plus prendre de level-up et un mort n'est plus inscriptible en
  coupe. C'est l'intention.
