# Ligue — consultation des rosters & polish saisie de match (2026-06-30)

Deux chantiers liés à la ligue physique, dans la continuité de la
refonte de la feuille de match
([league-match-sheet-ux-2026-06-26.md](./league-match-sheet-ux-2026-06-26.md)) :

1. **Consultation des rosters** : un coach inscrit voit le roster de
   tous les autres participants de sa ligue, sur une **page dédiée**.
2. **Polish de la saisie de match** (avant + fin) : positions lisibles,
   champ « Nom » contextuel, « Dépense diverse », forfait par équipe.

---

## 1. Consultation des rosters de la ligue

### Besoin
Chaque coach participant doit pouvoir voir les rosters (équipes +
joueurs) des autres participants de la **même ligue** — sans partage
opt-in : c'est automatique entre inscrits (le partage public par
`shareToken` reste un mécanisme indépendant).

### Serveur
- **`isLeagueParticipant(userId, leagueId)`**
  (`services/league.ts`) : vrai si le coach possède une équipe inscrite
  dans **au moins une saison** de la ligue (count sur
  `leagueParticipant where team.ownerId & season.leagueId`).
- **Route** `GET /leagues/:leagueId/teams/:teamId/roster-view`
  (`routes/league.ts`) — roster en **lecture seule**, distincte de la
  route `/roster` réservée au commissaire.
  - Autorisation `ensureLeagueViewer` : **commissaire OU participant**.
    Sinon `403`.
  - Réutilise `getTeamForEdit` (garde « équipe ∈ ligue » + chargement
    des joueurs), enrichit chaque joueur d'un **`positionName`** lisible
    (`getPositionBySlug(slug)?.displayName`).
  - Renvoie aussi les **méta d'équipe** pour une page riche :
    `raceName` (via `TEAM_ROSTERS[roster].name`), `coachName`,
    `teamValue`, `currentValue`, `treasury`, et les compteurs staff
    (`rerolls`, `cheerleaders`, `assistants`, `apothecary`,
    `dedicatedFans`).

```ts
// Réponse roster-view
{
  team: {
    id, name, roster, raceName, coachName,
    treasury, teamValue, currentValue,
    rerolls, cheerleaders, assistants, apothecary, dedicatedFans
  },
  players: { id, number, name, position, positionName,
             ma, st, ag, pa, av, skills, spp, dead }[]
}
```

### Web — page dédiée (pas de modale)
- **`/leagues/[id]/teams/[teamId]`** (`page.tsx`) : page cliente sous le
  layout ligue (hérite de `LeagueGate`).
  - En-tête : `TeamLogo` (SVG programmatique) + nom + race + coach.
  - Bandeau de stats : Valeur d'Équipe, VEA, Trésorerie, nb de joueurs.
  - Pastilles staff : relances / pom-pom / assistants / apothicaire /
    fans dévoués.
  - Tableau roster : N°, nom, **poste en clair**, MA/ST/AG/PA/AV
    (`+`/`–`), **compétences nommées avec description** (réutilise
    `SkillTooltip` comme une fiche de roster : nom + catégorie colorée +
    tooltip de règle, base vs acquise via la position), SPP ; joueurs
    morts grisés/barrés.
  - États chargement / erreur (ex. `403` si non inscrit).
- **`SeasonParticipants`** : bouton « 👥 Voir le roster » → **lien**
  (`next/link`) vers la page, gaté par `canViewRosters` (commissaire OU
  participant) + `leagueId`. La page passe
  `canViewRosters = isCreator || !!myParticipant`.

> Itération : une première version utilisait une modale
> (`LeagueRosterModal`), remplacée par la page dédiée à la demande
> (design propre + infos complètes). Le composant modale a été supprimé.

---

## 2. Polish de la saisie de match (avant + fin)

### Avant-match
- **Forfait par équipe** : une **case « Déclarer forfait »** dans la
  colonne de chaque équipe (exclusion mutuelle : un seul `forfeitSide`),
  au lieu du menu unique perdu dans la ligne météo.

### Fin de match
- **Positions lisibles** : le slug technique
  (`gnome_belluaire_gnome`) est remplacé par le **nom d'affichage**
  (« Belluaire Gnome ») dans le select de poste **et** les pickers de
  joueur (SPP bonus, joueur du match…). Branché via un nouveau champ
  **`positionName`** sur les joueurs de la feuille (résolu serveur
  depuis `TEAM_ROSTERS[roster].positions`).
- **Champ « Nom » contextuel** : masqué pour les achats **Relance** et
  **Staff** (sans effet : la relance ignore le nom côté serveur, le
  staff prend son sous-type via le select « type… »). Conservé pour
  **Joueur** (« Nom du joueur ») et **Dépense diverse** (« Libellé »).
- **« Autre » → « Dépense diverse »** + note : ce type **ne crée rien**
  sur le roster (`case "other": break`), il **débite seulement la
  trésorerie**.

---

## Fichiers

### Serveur
- `services/league.ts` — `isLeagueParticipant`.
- `routes/league.ts` — `ensureLeagueViewer`, `handleGetLeagueTeamRoster`
  (+ route `roster-view`), enrichissement méta + `positionName`.
- `services/league-match-sheet.ts` — `positionName` sur
  `MatchSheetPlayer` (résolu via `positionNamesForRoster`).

### Web
- `app/leagues/[id]/teams/[teamId]/page.tsx` — page roster dédiée.
- `app/leagues/[id]/SeasonParticipants.tsx` — lien « Voir le roster ».
- `app/leagues/[id]/page.tsx` — wiring `leagueId` + `canViewRosters`.
- `app/leagues/pairings/[id]/sheet/_components/MatchSheetPanels.tsx` —
  positions lisibles, champ Nom contextuel, « Dépense diverse »,
  forfait par équipe.

## Tests
- `services/league.test.ts` — `isLeagueParticipant` (true/false).
- `app/leagues/[id]/teams/[teamId]/page.test.tsx` — rendu (stats + poste
  lisible + erreur 403).
- `app/leagues/[id]/SeasonParticipants.test.tsx` — lien roster (présence/
  href, masqué sans droit / sans `leagueId`).
- `MatchSheetPanels.test.tsx` — forfait par équipe (exclusion + save),
  positions lisibles, champ Nom contextuel.
