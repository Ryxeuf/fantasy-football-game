# Design — Édition d'équipe verrouillée si engagée / libre si brouillon

## Décisions & alternatives

### 1. « Engagée » dérivé plutôt qu'un champ `status`
`Team` n'a pas de cycle de vie. Deux options :

- **(A retenue)** Dériver l'état « engagée » des tables existantes
  (`TeamSelection`, `LocalMatch` non annulé, `LeagueParticipant`,
  `CupParticipant`). Aucune migration, aucune donnée à rétro-remplir, source de
  vérité unique.
- (B) Ajouter `Team.status` (`draft`/`engaged`) + migration + logique de
  transition (marquer engagée au 1er match/inscription). Plus de code, risque de
  désynchronisation entre le flag et la réalité.

Choix A : l'engagement EST un fait observable dans les données ; le calculer à la
volée (`isTeamRosterFrozen`) évite tout drift. Coût : 4 `findFirst` en parallèle
par vérification — négligeable.

### 2. Anti-triche : verrou serveur + redirection UI, pas seulement l'UI
Le verrou 403 est appliqué **côté serveur** sur les endpoints propriétaire
(défense en profondeur), pas uniquement par la redirection front. Les endpoints
commissaire (`/leagues/:id/teams/:id/…`) sont distincts et **non** concernés : un
commissaire garde le droit d'éditer une équipe engagée (édition ex-post
autorisée). Idem pour l'admin.

### 3. Ce qui est verrouillé vs ce qui reste ouvert quand l'équipe est engagée
La règle métier vise la **composition/budget** (triche), pas la **progression
légitime** :

| Action (endpoint propriétaire)                    | Engagée |
|---------------------------------------------------|---------|
| Ajouter / retirer un joueur                       | 403     |
| Staff/inducements (`PUT /:id/info`)               | 403     |
| Renommer équipe/joueurs (`PUT /:id`)              | 403     |
| Sauvegarde batch du roster (`PUT /:id/roster`)    | 403     |
| Acheter avec la trésorerie (`POST /:id/purchase`) | **OK**  |
| Monter un joueur en niveau (PSP)                  | **OK**  |

La trésorerie ne vivant que sur la page d'édition, elle est déplacée sur une page
dédiée `me/teams/[id]/treasury` (accessible même engagée). La PSP a déjà sa page
`me/teams/[id]/level-up`.

### 4. Édition brouillon : batch + validation à la sauvegarde
Pour offrir une édition « comme à la création » (descendre sous 11, remanier,
dépasser transitoirement le budget) sans persister d'état invalide :

- La page passe ajouts/suppressions de joueurs en **état local** (ids temporaires
  `tmp_…` pour les nouveaux). Rien n'est écrit tant qu'on ne sauvegarde pas.
- Un endpoint unique `PUT /team/:id/roster` reçoit l'**état cible complet** et
  valide comme le builder (`POST /team/build`) : bornes de format
  (`getFormatConstraints`), min/max par poste, budget = coût joueurs + staff (DB)
  + Star Players (DB) ≤ `initialBudget`. Puis applique le **diff** en
  transaction : suppression des absents, mise à jour des conservés (nom/numéro),
  création des nouveaux (stats dérivées du poste).
- Alternative écartée : conserver des mutations unitaires immédiates en relâchant
  les contraintes → laisse des équipes invalides en base et n'a pas de point de
  validation clair. Le batch respecte littéralement « validation à la
  sauvegarde ».

Le budget lit staff et Star Players **depuis la DB** : le staff reste édité par
son propre endpoint (immédiat) ; c'est un compromis assumé (l'axe explicite du
besoin porte sur les joueurs). Les joueurs d'un brouillon n'ont ni SPP ni
avancements (gagnés en match), donc supprimer/recréer des `TeamPlayer` est sûr.

### 5. Endpoint dédié plutôt que surcharge de `PUT /:id`
`PUT /:id` (renommage strict) est conservé tel quel (avec ajout du garde 403) pour
ne pas casser son contrat/ses tests. Le batch vit dans `PUT /:id/roster` : deux
segments de chemin, aucun conflit de routage avec `/:id`.

## Risques / suites

- **Star Players (hire/fire)** : endpoints non gardés par l'engagement (aucune UI
  sur la page d'édition). Trou anti-triche théorique à fermer si besoin.
- **Engagement d'une équipe invalide** : rejoindre une ligue/coupe ne valide
  toujours pas 11-16/budget (comportement pré-existant, hors scope). La validation
  naturelle reste le démarrage de match / la sauvegarde du roster.
