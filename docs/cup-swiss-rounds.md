# Rondes suisses des coupes

> Comment une coupe enchaîne des rondes appariées selon le classement, et
> comment un match local matérialise une rencontre. Décision détaillée dans
> `openspec/changes/swiss-cups-and-matchday-calendar/`.

## Principe

Une coupe validée (`status = en_cours`) se joue en **rondes**. À chaque
ronde, le commissaire (créateur de la coupe, ou un admin) appelle
`POST /cup/:id/rounds/swiss` : les équipes inscrites sont appariées dans
l'ordre du **classement courant** (`computeCupStandings`, exempts compris),
chacune contre l'adversaire le plus proche qu'elle n'a **pas encore
rencontré**. Nombre impair : la dernière équipe non encore exemptée est
**exempte** (`bye`) et marque les points d'une victoire.

Le moteur (`services/swiss-pairing.ts`) est **pur** : classement + historique
en entrée, rencontres + exempt en sortie, sans I/O. Zéro rematch tant qu'un
appariement complet sans rematch existe (retour arrière) ; sinon repli au
plus proche avec rematch (`rematchForced`, journalisé). Domicile à l'équipe
qui a le moins reçu, à égalité au mieux classé. Déterministe.

## Données

| Modèle | Rôle |
|---|---|
| `CupRound` | ronde numérotée d'une coupe (`system = swiss`, `status` pending / in_progress / completed) |
| `CupPairing` | rencontre d'une ronde : `homeTeamId`, `awayTeamId` (null = exempt), `tableNumber`, `status`, `scheduledAt` |
| `LocalMatch.cupPairingId` | **unique** — le match local qui matérialise la rencontre (`onDelete: SetNull`) |

La FK vit sur `LocalMatch` (comme `Match.leaguePairingId`) : l'unicité empêche
deux coachs de créer deux matchs pour la même rencontre (P2002 → 409), et
supprimer une ronde ne supprime pas un match joué. Le classement reste
**dérivé** des matchs terminés ; les exempts sont injectés à la lecture
(`cupByesByTeamId` → `computeCupStandings(cup, matches, { byesByTeamId })`).

## Cycle d'une rencontre

```
scheduled ──POST /local-match { cupPairingId }──▶ in_progress ──/complete──▶ played
    ▲                                                 │
    └──────── match annulé (admin) ou supprimé ───────┘        commissaire : cancelled
```

- `POST /local-match` avec `cupPairingId` : la coupe est déduite, les deux
  équipes doivent être celles de la rencontre (`400`), la rencontre doit être
  `scheduled` sans match (`409`).
- `POST /local-match/:id/complete` : rencontre `played` ; la ronde passe
  `completed` quand toutes ses rencontres sont terminales (played / bye /
  cancelled). La ronde suivante ne se génère qu'à ce moment-là (`409` sinon).
- `PATCH /cup/pairings/:id/schedule` : date prévisionnelle (coachs de la
  rencontre ou commissaire), même schéma que la ligue.
- `POST /cup/pairings/:id/cancel` : annulation par le commissaire (sans match).
- `DELETE /cup/:id/rounds/last` : supprime la dernière ronde tant qu'aucun
  match n'y existe.

`GET /cup/:id` sert `rounds` (rondes, rencontres, équipes, match local avec
score) et `standings[].byes`. Les coachs appariés reçoivent une notification
interne `cup.round_pairing`.

## Web

`apps/web/app/cups/[id]/CupRoundsView.tsx` : génération / suppression pour le
commissaire, cartes de rencontre (`components/competition/MatchCard`, les
mêmes que les journées de ligue), « Créer le match » pour un coach de la
rencontre, « Voir le match », date prévisionnelle (`ScheduleEditor` commun),
annulation. Colonne « Ex. » au classement dès qu'une équipe a été exempte.

## Tests

- `services/swiss-pairing.test.ts` — moteur (rematch, exempt tournant, retour
  arrière, 24 équipes × 5 rondes).
- `services/cup-rounds.test.ts`, `routes/cup-rounds.test.ts`,
  `cupScoring.byes.test.ts`, `CupRoundsView.test.tsx`.
- `tests/e2e-api/specs/cup-swiss-rounds.spec.ts` — flux complet sur base
  SQLite (deux rondes sans rematch, exempt, doublon refusé, suppression).
