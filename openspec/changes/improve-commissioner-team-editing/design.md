# Design — Réglages d'équipe commissaire + refonte de l'éditeur

## Qui peut toucher quoi, et quand

| Levier | Coach | Commissaire (avant) | Commissaire (après) |
|--------|-------|---------------------|---------------------|
| Joueurs (PSP, compétences, carac, identité) | build seulement | ✔ (FR12/E13-E15/A64) | ✔ |
| Trésorerie | non | ✔ | ✔ |
| Staff (relances, cheerleaders, assistants, apothicaire, fans) | `PUT /team/:id/info`, **bloqué dès l'engagement** (`isTeamRosterFrozen`) | ✘ | **✔** |
| Ligue régionale | **création uniquement**, immuable ensuite | ✘ | **✔** |

L'axe manquant n'était pas un nouvel acteur mais deux champs d'équipe que le
gel de roster rendait définitivement figés en cours de saison.

## Décision 1 — un service frère plutôt qu'un ajout à `commissioner-team-edit`

`commissioner-team-edit.ts` fait déjà 938 lignes (au-dessus du plafond de 800
de nos règles de style). Le staff et la Ligue régionale sont des attributs
d'**équipe**, pas de joueur : ils vont dans
`commissioner-team-settings.ts`. Les briques communes ne sont pas dupliquées —
`appendAudit` était déjà exporté, `ensureTeamInLeague` (garde de périmètre
« cette équipe est bien inscrite dans cette ligue ») le devient. Une seule
implémentation de la garde, comme pour `commissioner-team-removal`.

## Décision 2 — les plafonds viennent de la base, jamais du schéma Zod

Le staff a des bornes qui dépendent du couple roster × format
(`RosterStaffConfig`, éditable en admin : le Sevens plafonne à 6 relances /
6 cheerleaders / 3 assistants, certains rosters n'ont pas droit à
l'apothicaire). Zod ne fait qu'un garde-fou de sanité (entier, positif,
majorant absolu) ; `validateStaff` applique les plafonds résolus et rend un
message qui les cite. C'est exactement la répartition retenue pour
`handlePutTeamInfo` côté coach — deux surfaces, une seule règle.

## Décision 3 — le débit de trésorerie est un choix, pas un effet de bord

Deux situations opposées se présentent au commissaire :

1. *le coach a payé sa relance mais la saisie l'a oubliée* → il faut ajouter la
   relance **sans** re-débiter ;
2. *le coach achète une relance en cours de saison via le commissaire* → il faut
   débiter.

Facturer d'office aurait cassé le cas 1 (le plus fréquent : c'est une
correction). Ne jamais facturer aurait rendu le cas 2 faux en silence. D'où
`chargeTreasury`, décoché par défaut, avec le coût affiché **avant**
l'enregistrement. `staffCostDelta` est pur et existe des deux côtés : le
client annonce, le serveur recalcule et refuse un solde négatif — le client
n'est jamais l'autorité.

## Décision 4 — changer de Ligue n'annule pas les recrutements

La Ligue régionale conditionne les Star Players recrutables. La changer peut
rendre inéligible un Star déjà recruté. Trois options :

- **refuser le changement** s'il y a des Stars → rend l'outil inutile
  précisément quand on en a besoin ;
- **retirer automatiquement** les Stars devenus inéligibles → destructif,
  irréversible, et faux si le commissaire corrige justement une Ligue mal
  saisie alors que le Star, lui, était correct ;
- **avertir et laisser en place** → retenu. `updateTeamRegionalLeague` renvoie
  `orphanedStarPlayers` ; l'UI les liste. Le commissaire arbitre.

Le calcul des Stars orphelins est *best-effort* (`try/catch` → liste vide) :
l'indisponibilité du catalogue ne doit pas faire échouer la correction.

## Décision 5 — les options viennent de `effectiveRegionalRules`, comme partout

Le mémo du repo est explicite : les Ligues d'un roster ont **une** source,
`Roster.regionalRules` avec repli sur le catalogue du moteur. La validation
serveur du choix commissaire passe donc par `effectiveRegionalRules` +
`getRegionalLeagueOptions`, exactement comme la création d'équipe. Sans ça,
l'éditeur aurait proposé un troisième jeu de Ligues divergent du sélecteur de
création et de la fiche publique — le bug déjà observé sur les Halflings.

## Décision 6 (UI) — replier l'effectif plutôt que de le densifier

L'ancienne page affichait tous les contrôles de tous les joueurs. La densité
n'était pas un problème d'espacement mais de **hiérarchie** : rien ne
distinguait « lire l'effectif » de « corriger un joueur ». La ligne montre
donc l'état (numéro, nom, poste, caractéristiques, PSP, compétences) et se
déplie pour l'édition, avec recherche et filtre au-dessus. Corollaire : un
rechargement post-mutation ne démonte plus l'onglet courant (il effacerait les
brouillons et les avertissements affichés) — seul le tout premier chargement
masque le contenu.

## Risques

- **Cohérence VE/VEA** : le staff compte dans la valeur d'équipe.
  `updateTeamStaff` rappelle `updateTeamValues` ; l'échec du recalcul est
  journalisé sans faire échouer la mutation (les valeurs se re-synchronisent au
  prochain passage self-healing de `roster-view`).
- **Rétro-compatibilité web** : `GET .../settings` peut ne pas exister sur un
  serveur plus ancien. Le hook le charge en `catch → null` et valide la forme
  reçue ; l'effectif reste éditable, les deux onglets annoncent
  l'indisponibilité.
