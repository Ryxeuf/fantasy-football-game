# Design — Morts & licenciements réversibles

## Contexte

Deux représentations du statut coexistent dans le repo :

| Modèle | Représentation | Réversible ? |
|---|---|---|
| `TeamPlayer` (ligue / équipes coachs) | `dead: Boolean` + `diedAt`, `firedAt: DateTime?` | Oui, mais seulement via le snapshot du match offline |
| `ProTeamRoster` (Pro League simulée) | `status: String` (`active`/`injured`/`dead`/`retired`) | Non |

Ce change traite `TeamPlayer` (le périmètre « ligues + site »). La
Pro League est simulée et ses matchs ne s'annulent pas ; l'alignement de
`ProTeamRoster` est laissé en suite possible.

## Décision : statut matérialisé + journal de provenance

On garde le **soft delete** (la ligne `TeamPlayer` n'est jamais supprimée)
et on lui ajoute deux choses :

1. **La provenance dénormalisée sur le joueur** — `status`, `statusAt`,
   `statusSource`, `statusSourceId`. Lecture triviale (affichage roster,
   filtre) sans jointure.
2. **Un journal append-only** — `TeamPlayerStatusEvent`. C'est lui qui
   porte l'historique (un joueur peut mourir, être ressuscité par
   invalidation, remourir) et qui autorise la vérification du revert.

### Pourquoi pas...

- **Hard delete + table d'archive** : casse les FK (`LeagueMatchEvent`
  référence `actorPlayerId`/`targetPlayerId`), perd l'historique de
  carrière, et la restauration doit recréer un id → tous les snapshots de
  roster deviennent faux.
- **Event sourcing pur** (statut recalculé à la lecture) : chaque liste de
  roster devrait rejouer le journal. Trop coûteux pour la valeur.
- **Provenance uniquement dans le snapshot du match** (l'existant) : marche
  tant qu'il y a un snapshot. Les morts en ligne n'en ont pas, et deux
  sources concurrentes ne peuvent pas s'arbitrer.

## Invariants

1. **Au plus un statut inactif actif à la fois.** `applyPlayerStatus` skippe
   (`already-inactive`) si le joueur est déjà mort ou licencié. Corollaire :
   au plus **un** `TeamPlayerStatusEvent` avec `revertedAt = null` par joueur.
2. **Dual-write.** `status` est toujours cohérent avec `dead`/`firedAt` :
   `dead` ⇒ `status = "dead"`, `firedAt != null` ⇒ `status = "fired"`,
   sinon `"active"`.
3. **Revert vérifié.** Un revert n'aboutit que si l'événement actif du
   joueur provient de la source annulée (ou est `legacy`), ET que l'update
   conditionnel touche exactement 1 ligne.

## Algorithme de revert

```ts
const active = await prisma.teamPlayerStatusEvent.findFirst({
  where: { playerId, revertedAt: null },
  orderBy: { createdAt: "desc" },
});
if (!active) return { skipped: true, reason: "no-status-to-revert" };
if (active.kind !== kind) return { skipped: true, reason: "status-superseded" };
if (active.sourceType !== LEGACY && (active.sourceType !== sourceType || active.sourceId !== sourceId))
  return { skipped: true, reason: "status-superseded" };

// Update CONDITIONNEL : si quelqu'un est passé entre-temps, count === 0.
const { count } = await tx.teamPlayer.updateMany({
  where: { id: playerId, ...(kind === "death" ? { dead: true } : { firedAt: { not: null } }) },
  data: { dead: false, firedAt: null, status: "active", statusSource: null, ... },
});
if (count !== 1) return { skipped: true, reason: "status-superseded" };
await tx.teamPlayerStatusEvent.update({ where: { id: active.id }, data: { revertedAt: now } });
```

Le fallback `legacy` est volontaire : les joueurs déjà morts/licenciés au
moment du déploiement reçoivent un événement `legacy` au backfill, et
l'invalidation d'une feuille saisie **avant** le déploiement doit continuer
de fonctionner — le caller (`reverseOfflineLeagueResult`) a sa propre preuve
dans le snapshot du match.

## Effets en cascade

Ce que le revert doit rétablir en plus du flag :

| Effet | Traitement |
|---|---|
| Valeur d'équipe (TV) | `updateTeamValues` après la transaction (déjà fait dans le flux offline) |
| Capitaine | `team-captain` re-désigne après mort/licenciement ; la résurrection ne dé-désigne pas le successeur. L'invariant « au plus 1 capitaine » est maintenu parce que le ressuscité garde `isCaptain: false` — il a perdu le brassard, c'est le comportement voulu |
| Numéro de maillot | Un achat post-match a pu reprendre le numéro d'un licencié. Le revert ne renumérote pas : le doublon est possible et signalé côté UI plutôt que bloquant (le renommage/renumérotation reste disponible) |
| Hall of Fame (Pro League) | Hors périmètre (`ProTeamRoster`) |

## Filtre canonique

`ACTIVE_PLAYER_WHERE = { dead: false, firedAt: null }` et
`isActivePlayer(p)`. Un test CI (`services/player-status-filters.test.ts`)
scanne `services/` + `routes/` et échoue si un `where` filtre `dead: false`
sans `firedAt` (ou l'inverse) hors denylist explicite. Les exceptions
légitimes (statistiques de carrière, qui doivent inclure les morts) sont
listées dans la denylist avec un commentaire.
