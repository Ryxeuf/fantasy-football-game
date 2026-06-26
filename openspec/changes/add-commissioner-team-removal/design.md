# Design — Suppression d'équipes/joueurs par le commissaire

## Contexte : trois opérations voisines, trois sémantiques distinctes

| Opération | Service | Acteur | Effet | Fenêtre |
|-----------|---------|--------|-------|---------|
| Retrait d'équipe | `withdrawParticipant` ([`league.ts`](../../../apps/server/src/services/league.ts)) | Coach (propriétaire) | *soft* : `status="withdrawn"` | saison `draft`/`scheduled` |
| Édition ex-post | `commissioner-team-edit` (FR12) | Commissaire | mutation in-place (SPP, skills, carac, trésorerie) | toute la saison |
| **Suppression (ce change)** | **`commissioner-team-removal`** | **Commissaire** | **hard delete** (participant / joueur) | **pré-saison, aucun match joué** |

La nouveauté n'est pas un quatrième acteur mais une **sémantique de suppression
dure** sous une garde temporelle stricte. On réutilise les briques de FR12
(autorisation `ensureLeagueCommissioner`, journalisation `appendAudit`) plutôt
que de les redupliquer.

## Le cœur : la garde « a participé à un match »

Le besoin se résume à un invariant : *on ne supprime que ce qui n'a pas encore
servi*. Un participant a « joué » dès qu'un pairing le concernant est **engagé**.
Le modèle `LeaguePairing` décrit ce cycle
([`schema.prisma`](../../../prisma/schema.prisma)) :

```
scheduled ──▶ in_progress ──▶ played
   │                          ▲
   └────▶ cancelled           └─ forfeit_home / forfeit_away
```

- `scheduled` / `cancelled` → **n'a pas joué** (planifié ou annulé sans effet).
- `in_progress` / `played` / `forfeit_home` / `forfeit_away` → **a participé**.

```ts
const ENGAGED = ["in_progress", "played", "forfeit_home", "forfeit_away"];
export async function hasTeamPlayedInLeague(leagueId, teamId) {
  const engaged = await prisma.leaguePairing.findFirst({
    where: {
      status: { in: ENGAGED },
      round: { season: { leagueId } },           // scope ligue
      OR: [{ homeParticipant: { teamId } },
           { awayParticipant: { teamId } }],
    },
    select: { id: true },
  });
  return engaged !== null;
}
```

Cette garde est **partagée** entre les deux suppressions. Pour la suppression
d'équipe elle est largement redondante avec la garde de statut de saison
(`draft`/`scheduled` ⇒ pas de pairing engagé), mais on la garde **défensivement**
et comme source de vérité unique : c'est elle qui exprime l'intention métier.

## Suppression d'équipe : pourquoi hard delete et non withdraw

`withdrawParticipant` existait déjà mais ne répond pas au besoin :

- il est **réservé au coach** (propriété de l'équipe) ; ici c'est le commissaire ;
- il fait un **soft withdraw** : le slot reste occupé (`maxParticipants`),
  l'équipe apparaît encore « Retirée ». Pour *défaire* une inscription erronée,
  on veut libérer le slot et permettre une ré-invitation propre.

En `draft`/`scheduled`, **aucun pairing ne référence encore le participant**
(le calendrier n'est généré qu'au `startSeason`). Le `LeagueParticipant.delete`
est donc sans cascade problématique. On exige `draft`/`scheduled` explicitement
(`season_started` sinon) pour ne jamais hard-delete un participant qu'un pairing
pourrait référencer — cas qui relève du forfait.

## Suppression de joueur : hard delete sûr en pré-saison

`TeamPlayer` n'a **aucune FK entrante** dans le schéma (les events de match
stockent un `playerId` libre, pas une relation). Combiné à la garde « aucun
match joué » (donc `matchesPlayed`/SPP/stats à 0), le `delete` est sûr et ne
détruit aucun historique. On choisit le hard delete plutôt que le `firedAt`
(soft *licenciement* de FR12) car la sémantique est « ce joueur n'aurait jamais
dû être là », pas « il quitte l'effectif ».

> Volontairement non recalculé : la TV cachée (`team.teamValue`) n'est pas
> recomputée ici, **comme les autres opérations commissaire** (FR12 ajuste
> carac/skills sans recompute). On reste cohérent avec l'existant plutôt que
> d'introduire un recompute partiel.

## Erreurs typées → status HTTP

Classe dédiée `CommissionerRemovalError` (calque du pattern par-lot du repo),
mappée dans `domainError` de [`routes/league.ts`](../../../apps/server/src/routes/league.ts) :

| Code | Status | Sens |
|------|--------|------|
| `season_not_found`, `team_not_found`, `team_not_in_league`, `player_not_found` | 404 | cible absente |
| `season_started`, `team_has_played`, `player_not_in_team` | 409 | conflit d'état |

Les handlers typent le corps via le schéma (`const body: CommissionerRemovalBody
= req.body`) — pas de `req.body as`, conforme au garde-fou
`routes/no-raw-body-cast.test.ts`.

## API

- `DELETE /leagues/:leagueId/seasons/:seasonId/teams/:teamId` — supprime une
  équipe d'une **saison** précise (le `seasonId` désambiguïse une équipe inscrite
  sur plusieurs saisons).
- `DELETE /leagues/:leagueId/teams/:teamId/players/:playerId` — supprime un
  joueur (garde « aucun match joué » à l'échelle de la ligue).

Corps optionnel `{ reason?: string }` (≤ 500), journalisé. Les deux routes sont
gardées par `authUser` + `ensureLeagueCommissioner` + `validate`.

## UI : confirmation inline, gating pré-saison

- `SeasonParticipants` reçoit `seasonId` + `seasonStatus`. Bouton « Supprimer »
  visible seulement si commissaire **et** `draft`/`scheduled`. Confirmation
  inline (clic → « Confirmer / Annuler ») plutôt que `window.confirm` (testable
  en jsdom, pas de "Not implemented").
- `CommissionerTeamEditor` reçoit `canRemovePlayers` (même garde) et affiche un
  « Supprimer » par joueur. Le backend ré-applique toutes les gardes : le flag
  UI ne fait que masquer, il ne décide rien.

## Alternatives écartées

- **Étendre `withdrawParticipant` (soft) au commissaire** : ne libère pas le
  slot et ne supprime pas — ne répond pas à « supprimer une inscription erronée ».
- **Soft delete du joueur via `firedAt`** : sémantiquement faux ici (erreur de
  saisie ≠ licenciement) et polluerait la carrière. Rejeté.
- **Autoriser la suppression d'équipe `in_progress` avec cascade des pairings** :
  détruirait un calendrier en cours et l'historique partiel. C'est exactement le
  rôle du **forfait** — on y renvoie via `season_started`.

## Tests

- **Unité service** (`commissioner-team-removal.test.ts`) : garde
  `hasTeamPlayedInLeague` (statuts + scope), refus `season_not_found` /
  `team_not_in_league` / `season_started` / `team_has_played` /
  `player_not_found` / `player_not_in_team`, happy paths équipe & joueur avec
  appel `AuditLog`.
- **UI** (`SeasonParticipants.test.tsx`) : bouton absent hors commissaire,
  présent en `scheduled`, masqué en `in_progress`, flux confirmation → `DELETE`
  + `onChanged`, affichage de l'erreur API.
