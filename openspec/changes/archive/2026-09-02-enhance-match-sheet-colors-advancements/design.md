# Design — Couleurs, accès coups de pouce, auto-calculs & évolutions inline

## Coups de pouce par équipe

Le moteur expose `INDUCEMENT_CATALOGUE` (avec `canPurchase(ctx)` et
`discountRule`), `getInducementCost(slug, ctx)`, `getRegionalRulesForTeam`,
`APOTHECARY_FORBIDDEN_ROSTERS`. On construit la liste **par roster** :

```
ctx = { teamId, regionalRules: getRegionalRulesForTeam(roster),
        hasApothecary: !APOTHECARY_FORBIDDEN_ROSTERS.has(roster), rosterSlug }
inducements = CATALOGUE.filter(d => d.slug !== 'star_player')
                       .filter(d => !d.canPurchase || d.canPurchase(ctx))
                       .map(d => ({ ..., cost: getInducementCost(d.slug, ctx) }))
```

→ apothicaire itinérant pour les rosters avec accès apothicaire, Igor pour
les autres ; coût avec rabais régional. `reference.inducements` devient
`{ home, away }`.

## Couleurs de roster

`getTeamColors(roster)` renvoie des entiers 24 bits ; on les convertit en
hex CSS (`#rrggbb`) et on expose `reference.colors { home, away }`. La
timeline applique la couleur en bordure gauche + pastille de tour ;
l'en-tête de récap en barres sous les noms et en liserés du score.

## SPP : estimation client vs calcul autoritaire serveur

Le SPP réellement appliqué dépend du modificateur d'équipe (ex. Bagarreurs
Brutaux) via `calculatePlayerSPP` (`spp-tracking.ts`). Pour éviter une
divergence affichage/réalité, le **serveur** calcule le SPP par joueur (avec
le modificateur) et l'expose dans la réponse ; l'UI l'affiche en read-only.
Le calcul reste **appliqué uniquement à la validation** (inchangé).

## Extraction de `AdvancementEditor`

La page `/me/teams/[id]/level-up` contenait toute la logique (chargement des
`pending-advancements`, catalogue de skills, `PlayerRow` avec picker
type/skill/caractéristique + jet D8, POST `.../advancement`). On l'extrait
en composant client partagé `components/AdvancementEditor.tsx` :

```
<AdvancementEditor teamId={...} />   // self-contained : fetch + liste + apply
```

- La page level-up devient une enveloppe (gate flag, en-tête, retour).
- L'onglet « Évolutions » de la feuille monte le même composant pour
  l'équipe du coach, une fois le match validé (gate flag `league`).

Aucun changement d'API : on réutilise `GET /team/:id/pending-advancements`
et `POST /team/:id/players/:playerId/advancement`. Les avancements n'existent
qu'après validation (création des `LeaguePostMatchSequence`), ce qui garantit
le staging.

## Moteur post-match « plus poussé »

Déterministe depuis les évènements/règles : score, sorties, **SPP par
joueur**, **gains** (popularité). Non déterministe (jet de dé) : fans
dévoués, MVP aléatoire → laissés à la saisie. L'objectif est de
**pré-calculer tout le calculable** et de ne demander que les choix/jets.
