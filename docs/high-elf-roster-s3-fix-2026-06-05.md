# Correction roster High Elf (Saison 3) + sync roster prod — 2026-06-05

## Problème

Le builder affichait pour les Hauts Elfes (S3) un roster faux : positions
« White Lion / Phoenix Warrior / Dragon Prince » (noms anglais) avec des
stats/coûts incohérents. Deux causes cumulées :

1. **Fichier généré désynchronisé.** La source de vérité
   `data/saison3/team/Hauts_elfes.md` était correcte (roster thématique :
   Trois-quart, Guerrier Phoenix, Prince Dragon, Lion Blanc), mais le fichier
   généré `packages/game-engine/src/rosters/season3-rosters.ts` était resté
   sur d'anciens noms génériques (Receveur/Lanceur/Blitzer Haut Elfe) avec de
   mauvaises stats. De plus l'**ordre** des positions ne correspondait pas à
   la markdown, ce qui avait inversé les accès Primaire/Secondaire au moment
   de générer `skill-access-season3.ts` (`generate-skill-access-season3.ts`
   aligne les lignes de la markdown aux positions **par ordre**).
2. **Base de prod jamais purgée.** Le seed (`seed.ts`) fait un upsert des
   positions par `(roster, slug)` mais **ne supprime jamais** une position
   présente en base et absente du code. La prod gardait donc des positions
   obsolètes.

## Roster correct (S3) — source : Hauts_elfes.md

| Position | Rôle | Qte | MA | ST | AG | PA | AV | Compétences | Prim. | Sec. | Coût |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Trois-quart Haut Elfe | Trois-quart | 0-16 | 6 | 3 | 2+ | 3+ | 9+ | — | GA | F | 65K |
| Guerrier Phoenix | Lanceur | 0-2 | 6 | 3 | 2+ | 2+ | 9+ | Passe, Passe Assurée, Perce-nuages | GAP | F | 90K |
| Prince Dragon | Receveur | 0-2 | 8 | 3 | 2+ | 4+ | 9+ | Appuis sûrs, Blocage, Ma balle | GA | F | 110K |
| Lion Blanc | Blitzer | 0-2 | 7 | 3 | 2+ | 3+ | 9+ | Griffes, Lutte | GA | FP | 110K |

Slugs de compétences (game-engine `skills/index.ts`) : `pass`, `safe-pass`,
`cloud-burster`, `surefoot` (Appuis Sûrs), `block`, `my-ball` (Ma balle),
`claws` (Griffes), `wrestle` (Lutte).

## Modifications de la source de vérité (code)

- `packages/game-engine/src/rosters/season3-rosters.ts` : bloc `high_elf`
  réécrit dans l'**ordre de la markdown** (Trois-quart, Lanceur, Receveur,
  Blitzer) avec les noms thématiques, stats, coûts et skills corrects. Les
  slugs restent basés sur le rôle (`high_elf_lanceur_haut_elfe`, etc.) — le
  rôle est encodé dans le slug, le nom d'affichage porte le nom thématique.
- `packages/game-engine/src/rosters/skill-access-season3.ts` (généré) : accès
  `high_elf_lanceur_haut_elfe` → `G,A,P / S` et `high_elf_receveur_haut_elfe`
  → `G,A / S` (les deux étaient inversés). À régénérer avec
  `tsx scripts/generate-skill-access-season3.ts --write` (le résultat est
  identique aux valeurs ci-dessus une fois `season3-rosters.ts` réordonné).
- Test de non-régression : `season3-rosters.test.ts` — bloc
  « High Elf roster (S3, themed) » qui fige les 4 positions (ordre, noms,
  stats, coûts, skills) et vérifie l'absence des anciens noms génériques.

> La S2 (`positions.ts`) n'est pas modifiée : le roster thématique est
> spécifique à la Saison 3.

## Mise à jour en PROD

Le seed complet (`pnpm db:seed`) est un seed de **DEV** dangereux en prod
(purge des skills, création de user@example.com + équipes/ligues démo +
overrides de flags). **Ne pas l'utiliser en prod.**

Un script ciblé et idempotent a été ajouté :
`apps/server/src/scripts/sync-rosters.ts` (`pnpm db:sync-rosters`). Il ne
touche que `Roster`/`Position`/`PositionSkill` :

1. upsert des positions du code (stats/coût/accès) ;
2. **purge** des positions orphelines (slug en base ∉ code) — c'est ce qui
   retire White Lion/Phoenix Warrior/Dragon Prince ;
3. relink des compétences de base.

Sûr : `TeamPlayer.position` est une string (pas de FK), `PositionSkill`
cascade — purger une Position ne casse aucune équipe existante.

### Procédure (conteneur serveur)

```bash
# 1. Déployer le code à jour (image rebuild) — season3-rosters.ts +
#    skill-access-season3.ts corrigés sont bakés dans l'image.

# 2. Dry-run ciblé High Elf S3 dans le conteneur serveur :
docker compose exec server pnpm db:sync-rosters --ruleset=season_3 --roster=high_elf

# 3. Vérifier le rapport (4 positions upsert + N purgées), puis appliquer :
docker compose exec server pnpm db:sync-rosters --ruleset=season_3 --roster=high_elf --write

# (Sans filtre : synchronise TOUS les rosters/positions — utile pour un
#  resync complet. Toujours faire un dry-run d'abord.)
```

Le cache de l'API `/api/rosters` est de 5 min : recharger après ~5 min (ou
redémarrer le conteneur serveur) pour voir le roster à jour côté builder.

### Bouton admin (sans SSH) — ajouté 2026-06-16

La même logique est exposée dans **Admin → Utilitaires → « Synchroniser les
rosters »** (`POST /admin/utilities/sync-rosters`, `adminOnly`). C'est le bon
outil quand le code à jour est déjà déployé mais que la base prod garde
l'ancien roster (cas typique : « l'équipe ne semble pas à jour »).

- Le bouton lance d'abord un **dry-run** (`{ write: false }`) qui renvoie le
  diff (positions upsert / purgées) et **liste les positions qui seraient
  supprimées**. Aucun effet de bord.
- Un second bouton **« Appliquer les changements »** (avec confirmation)
  rejoue avec `{ write: true }` et trace un audit log
  (`utility.sync-rosters.run`).
- Body optionnel `ruleset` / `roster` pour cibler (l'UI synchronise tout).

> Complète le bouton « Réimporter les accès Saison 3 » qui, lui, ne réécrit
> **que** `primary/secondarySkills` — il ne renomme rien et ne corrige pas les
> stats/compétences. Pour un renommage (Blitzer Haut Elfe → Lion Blanc), il
> faut ce sync complet.

Code : service `apps/server/src/seeders/sync-rosters.ts` (source unique de la
logique, utilisée par le bouton **et** le CLI `scripts/sync-rosters.ts`).

## ⚠️ Shadows `.js` (CRITIQUE pour que le fix prenne effet)

`packages/game-engine/src/` contient un arbre `.js` compilé (~116 fichiers)
qui **shadow** les `.ts` : Vite/Node/tsx résolvent `.js` avant `.ts` quand
les deux existent (cf. `scripts/check-no-js-shadow.sh`, piège du 2026-05-19).
Les shadows `season3-rosters.js` et `skill-access-season3.js` contenaient
encore l'ancien roster → **le sync prod (tsx) aurait lu les `.js` périmés** et
réécrit les mauvaises données.

Actions :
- Stopgap appliqué : `season3-rosters.js` et `skill-access-season3.js` ont
  été mis à jour à la main pour matcher les `.ts` (runtime correct
  immédiatement, quel que soit l'ordre de résolution).
- **À faire (remédiation propre)** : supprimer TOUS les shadows avant
  build/déploiement :
  ```bash
  bash scripts/check-no-js-shadow.sh --clean   # ou : make check-shadow
  ```
  Les `.ts` redeviennent l'unique source. Cette commande échoue en lint
  (`make lint`) tant que des shadows existent.

## Suivi (hors scope immédiat)

- La règle régionale « Ligue des Royaumes Elfiques » (slug
  `elven_kingdoms_league`) figure dans la markdown mais n'est pas portée par
  `season3-rosters.ts` (aucun roster S3 ne renseigne `regionalRules`
  aujourd'hui ; la hireabilité des Stars passe par `TEAM_REGIONAL_RULES` /
  `star-players.hirableBy`). À traiter globalement si l'on veut afficher les
  règles spéciales par roster en S3.
- Le seed (`seed.ts`) gagnerait à devenir lui aussi prune-aware sur les
  positions pour rester autoritatif (même logique que ce script).
