# Star Players « Legends 2025 » — alignement sur le PDF GW

> Lot de correction des 50 Star Players du PDF gratuit Games Workshop
> *Blood Bowl — Star Players! (Legends)* (2025), qui regroupe les stars
> absentes du livre Third Season Edition. Saison 3 uniquement.

## Ce que le lot corrige

40 des 50 fiches comportaient au moins une erreur. Toutes les valeurs
applicables vivent dans `SEASON_THREE_STAR_PLAYER_OVERRIDES`
(`packages/game-engine/src/rosters/star-players.ts`) : la base Saison 2
(BB2020) n'est pas touchée.

| Lot | Objet | Volume |
| --- | --- | --- |
| A | Compétence `hate-dwarf` (Haine (Nain)) créée | 1 |
| B | Coûts | 21 |
| C | Caractéristiques MA/ST/AG/PA/AV | 27 |
| D | Listes de compétences | 22 |
| E | Fausses compétences retirées | 3 |
| F | Ligues + véhicule de sync vers la base | 1 (+ outillage) |
| G | Paires obligatoires (prix, partenaire, source unique) | 6 |
| H | Règles spéciales réécrites | 50 |
| I | Libellés de compétences divergents | diagnostic, cf. plus bas |

## Le code n'est pas la base

Depuis la PR #957, la table `StarPlayer` est la source de vérité du
recrutement **et** des pages publiques, et le seed est volontairement
non destructif (create-if-missing) pour protéger les édits admin.
**Corriger le catalogue du game-engine ne change donc rien en production.**

Le véhicule est `apps/server/src/seeders/sync-star-players.ts`, exposé par
le CLI `apps/server/src/scripts/sync-star-players.ts` :

```bash
# 1. Prévisualiser (aucune écriture) — c'est aussi le script de contrôle
pnpm --filter server db:sync-star-players

# 2. Appliquer, en gardant un instantané de rollback
pnpm --filter server db:sync-star-players -- --write --snapshot=/tmp/star-players-before.json

# 3. Re-contrôler : doit afficher « 0 écart »
pnpm --filter server db:sync-star-players
```

Garanties :

- dry-run par défaut, diff champ par champ ;
- `--ruleset` vaut `season_3` (la Saison 2 ne bouge pas) ;
- upsert par slug, **aucun DELETE de fiche** ; les liens compétences et
  ligues sont remplacés intégralement, donc l'opération est idempotente ;
- `displayName`, `imageUrl` et `isMegaStar` ne sont jamais réécrits sur une
  ligne existante ; `keywords` n'est complété que s'il est vide. Un édit
  admin de cosmétique survit au sync ;
- les lignes `Skill` manquantes référencées par une fiche sont créées
  (sinon le lien saute silencieusement — cas `hate-dwarf`), avec
  `excludedFromSelection` quand aucune Position du code ne porte le slug.

### Slugs historiques

La base porte `grombrindal_the_white_dwarf` et
`gretchen_wachter_the_blood_bowl_widow` là où le code utilise
`grombrindal` / `gretchen_wachter`. Le sync résout ces alias et **corrige
la ligne existante au lieu d'en créer une seconde** : les URLs publiques
ne changent pas.

## Contrôle (« 0 écart »)

Deux contrôles, un par source :

- **code** — `packages/game-engine/src/rosters/star-players-legends-2025.test.ts`
  compare le catalogue Saison 3, champ par champ, à la référence figée
  `star-players-legends-2025.reference.json` (50 cartes). 303 assertions,
  0 écart. La référence n'est lue par aucun code applicatif.
- **base** — le dry-run du CLI ci-dessus, qui doit afficher « 0 écart »
  après application.

## Lot I — libellés de compétences : diagnostic

Le constat de départ : six compétences s'affichent sur les fiches star
players sous un libellé absent du référentiel `/skills`.

**Cause confirmée, et elle est structurelle.** Il existe deux tables de
libellés qui ont divergé :

| slug | `skills/index.ts` (game-engine) | ligne `Skill` en base (seed S3) |
| --- | --- | --- |
| `juggernaut` | Boulet de Canon | Juggernaut |
| `mighty-blow-1` | Coup Puissant (+1) | Châtaigne (+1) |
| `throw-team-mate` | Lancer d'Équipier | Lancer de Coéquipier |
| `plague-ridden` | Porteur de Peste* | Contagieux |
| `diving-catch` | Réception Plongée | Réception Plongeante |
| `dirty-player-1` | Joueur Déloyal (+1) | Joueur Déloyal (+1) |

Au seed, `nameFr` vient de `STATIC_SKILLS_DATA[nameEn]` (puis de
`SEASON_3_RENAMED_SKILLS`) et **écrase** le `nameFr` du game-engine. La
page `/skills` lit la base : elle montre la colonne de droite.

Côté star players, les deux surfaces ne résolvent pas pareil :

- la **fiche de détail** passe par `SkillTooltip`, qui interroge
  `/api/skills` (donc la base) et ne retombe sur le game-engine qu'en cas
  d'échec — libellés du référentiel ;
- la **carte de liste** (`StarPlayerCard`) appelle
  `getStarPlayerSkillDisplayNames()`, qui lit **directement** le
  game-engine, sans jamais consulter le référentiel — libellés de gauche.

Ce ne sont donc pas des libellés stockés en dur sur les fiches : c'est un
chemin de résolution qui court-circuite le référentiel. Deux corrections
possibles, à trancher avec Remy :

1. **Réparer la source** : aligner les `nameFr` du game-engine sur ceux du
   référentiel (6 valeurs). Touche le catalogue moteur, donc toutes les
   surfaces d'un coup, mais peut casser les tests qui matchent des noms FR.
2. **Réparer le chemin** : faire passer `StarPlayerCard` par le catalogue
   API comme la fiche de détail. Plus propre à long terme (une seule
   source), mais rend la carte dépendante d'un chargement asynchrone.

Rien n'a été refactoré ici : le brief demandait le diagnostic, pas le
correctif. Deux nuances relevées au passage : `mighty-blow-1` et
`dirty-player-1` s'affichent « Châtaigne » / « Joueur Déloyal » sur le
référentiel en ligne alors que le seed écrit « (+1) » — ces deux-là ont
probablement été édités en admin ; et `plague-ridden` porte en base le
libellé « Contagieux », qui est aussi le libellé d'un **autre** slug
(`contagieux`), d'où l'ambiguïté visuelle.

## Décisions ouvertes

- **Lot A — slug de la compétence.** Créée en `hate-dwarf` (kebab-case),
  pas `hate_dwarf` : tous les slugs du catalogue sont en kebab-case,
  `hate-troll` compris. À valider.
- **Doublons du référentiel.** La base contient des paires de slugs qui
  semblent désigner la même compétence : `hate-troll` / `hate_troll` et
  `plague-ridden` (Contagieux) / `contagieux` (Contagious). Hors périmètre,
  mais à nettoyer.
- **Ligues manquantes.** Grombrindal est réparé par le sync. Comte Luthor
  von Drakenborg et Lord Borak Le Destructeur n'ont eux non plus aucune
  ligue renseignée — ils sont hors périmètre (livre de règles), donc non
  traités.
- **Josef Bugman.** Il figure dans la liste des 19 stars du livre de règles
  mais **pas** dans le catalogue, où il est modélisé comme coup de pouce
  « Staff Célèbre » (`core/inducements.ts`) — la règle interdit d'ailleurs
  de l'engager aussi en Star Player. Si le site en affiche 69, c'est
  qu'une ligne existe en base pour lui : à trancher (le sync ne supprime
  jamais rien).
- **Renommages.** 11 fiches portent un nom qui diverge de la carte
  (« Skorg » vs « Skrorg Snowpelt », « Guffle Pussmaw » vs « Guffle
  Pusmaw »…). Rien n'a été renommé : un réalignement changerait les URLs
  et imposerait des redirections.
- **Règles spéciales EN.** `specialRuleEn` est corrigé dans le code, mais
  la table `StarPlayer` n'a pas de colonne EN : l'API ne le sert pas
  encore.
- **`excludedFromSelection`.** Le champ n'est alimenté par aucun seed, seul
  l'admin l'écrit. Le sync le pose à la création de `hate-dwarf` ; si la
  ligne existe déjà en base, il faudra la cocher à la main.
