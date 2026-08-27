# Design — Renommage d'équipe

## Contexte

Trois chemins écrivent aujourd'hui `Team.name`, tous à la mauvaise
granularité pour un simple renommage :

| Route | Payload | Verrou | Verdict |
| --- | --- | --- | --- |
| `POST /team/create-from-roster`, `POST /team/build` | création | — | one-shot |
| `PUT /team/:id` | `players[]` COMPLET requis + `name?` | `isTeamRosterFrozen` ⇒ 403 | inutilisable pour renommer |
| `PUT /team/:id/roster` | roster entier + `name?` | `isTeamRosterFrozen` ⇒ 403 | idem |

## Décision : une route dédiée, hors verrou anti-triche

`PATCH /team/:id/name` `{ name }`, propriétaire uniquement.

**Pourquoi une route dédiée plutôt qu'assouplir `PUT /team/:id`.**
Rendre `players` optionnel sur `PUT /team/:id` mélangerait deux
sémantiques dans un même handler (renommage cosmétique vs sauvegarde de
roster sous verrou) et obligerait à faire dépendre le verrou du contenu du
body — exactement le genre de branche qui se casse à la première
évolution. Une route dédiée porte une seule règle, testable seule.

**Pourquoi hors verrou.** `isTeamRosterFrozen` protège la composition et
le budget (anti-triche). Le nom n'entre dans aucun calcul :
`utils/team-values` ne le lit pas, le budget non plus. Précédent direct
dans le repo : `PATCH /team/:id/players/:playerId/identity` (E12), qui
édite nom + numéro d'un joueur d'une équipe engagée pour cette raison.

**Pourquoi même pendant un match.** `setupPreMatchWithTeams(teamAData,
teamBData, teamA.name, teamB.name, …)` COPIE le nom dans l'état de jeu au
démarrage (`services/match-start.ts`, `routes/local-match.ts`). Un
renommage ultérieur ne peut donc pas réécrire une partie en cours ni un
replay : le match garde le nom qu'il a figé. Bloquer pendant un match
n'achèterait rien et rendrait le comportement imprévisible pour le coach.

## Alternatives écartées

- **Assouplir le verrou de `PUT /team/:id/roster` pour le seul champ
  `name`** — même objection que ci-dessus, plus un effet de bord : la page
  d'édition entière reste inaccessible en ligue, donc l'UI n'aurait
  toujours pas d'endroit où proposer le renommage.
- **Unicité du nom par coach (ou globale)** — non retenue : aucune
  contrainte d'unicité n'existe à la création, l'ajouter au renommage
  seulement produirait une règle asymétrique (« je peux créer deux
  équipes homonymes mais pas renommer »). Hors périmètre.
- **Modération (blocklist) du nom** — `detectBlocklist`
  (`services/pro-gazette-comments.ts`) ne couvre aujourd'hui que les
  commentaires. La création d'équipe n'applique aucun filtre ; en ajouter
  un au seul renommage serait incohérent. À traiter globalement (création
  + renommage) dans un change dédié si le besoin se confirme.
- **Historique dédié des anciens noms** — inutile : le journal d'équipe
  stocke déjà `before`/`after` et `name` fait partie de `DIFFED_FIELDS`,
  donc `GET /team/:id/journal` rend la chronologie des noms sans nouveau
  modèle.

## Validation

Alignée sur la création (`createFromRosterSchema.name`) : requis, trim,
1..100 caractères. Le trim est fait par Zod (`z.string().trim()`) donc le
service reçoit déjà la valeur normalisée ; il re-trim par sécurité pour
les appels directs (tests, futurs jobs).

Renommer avec le nom courant est un **succès no-op** : pas d'écriture,
pas d'étape de journal. Sinon chaque ouverture/fermeture du champ inline
polluerait le journal.

## Conséquences

- Le journal gagne l'action `team.rename` (+ son libellé français). Le
  diff `name: { from, to }` sort gratuitement de `diffTeamState`.
- Aucun cache à invalider : les pages qui affichent le nom (fiche,
  classements, feuille de match) le lisent en base au rendu.
