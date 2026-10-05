# 32 — Saison 2026-27 : point de situation (05/10/2026)

> Reprise du module après le kickoff. Objectif : savoir ce que les sources
> publient, ce que le cron en fera, et ce qu'il faut corriger AVANT de lancer
> le rattrapage du début de saison. Données tirées le lundi 05/10/2026
> ~14h UTC, directement depuis les sources consommées par le code
> (`stats_player_week_2026.csv`, `schedules/games.csv`, `roster_2026.csv`,
> ESPN scoreboard), et recalculées avec le barème du repo
> (`parseRow` + `computeSpp` de `@bb/nfl-mapper`).
>
> État de la base de prod : **non vérifié** depuis cette session (pas
> d'accès). À confirmer avant le rattrapage : présence de `NflSeason 2026`,
> nombre de `NflGameStat` par week 2026, dernières lignes `NflIngestRun`
> (`/admin/nfl-fantasy/ingest-runs?season=2026`).

## 1. Disponibilité des sources (OK)

| Source | URL / endpoint | État au 05/10 |
|---|---|---|
| Stats joueur nflverse | `stats_player/stats_player_week_2026.csv` | ✅ 200, 1,9 Mo — W1 1118 lignes, W2 1107, W3 1114, W4 1040 (15/16 matchs). Colonne `game_id` **présente** (pas besoin du repli `games.csv` de 2024) |
| Calendrier + scores | `schedules/games.csv` | ✅ 272 matchs REG 2026 ; W1-W3 16/16 joués, W4 15/16 (MNF ATL @ NO lun. 05/10 20h15 ET) |
| Rosters | `rosters/roster_2026.csv` | ✅ 965 Ko (post-cutdown) |
| ESPN scoreboard | `scoreboard?dates=2026&seasontype=2&week=4` | ✅ 200 |

**Fraîcheur nflverse** : le CSV de stats a été republié lundi 05/10 à
**12h33 UTC** avec les matchs du dimanche. Les stats d'un match apparaissent
donc le **lendemain vers 12h30 UTC**, et celles du Monday Night le **mardi
vers 12h30 UTC**. Ce délai compte pour le cron (cf. § 4).

## 2. Calendrier réel 2026

| Week | Premier match | Dernier match |
|---|---|---|
| W1 | mer. 09/09 (NE @ SEA, 10-13) | lun. 14/09 |
| W2 | jeu. 17/09 | lun. 21/09 |
| W3 | jeu. 24/09 | lun. 28/09 |
| W4 | jeu. 01/10 | lun. 05/10 |
| W5 | jeu. 08/10 | lun. 12/10 |
| W6 | jeu. 15/10 | lun. 19/10 |

Cycles « Nuffle Coach » (W1-6 / W7-12 / W13-18 / W19-22) : le cycle 1 est en
cours, une ligue créée maintenant est rattachée au cycle 2 (W7-12, à partir
du jeu. 22/10) par le snap-to-next-window.

## 3. Ce qu'il faut savoir côté NFL (après W4)

### Classement (W4 hors MNF)

- **Invaincus** : SF 4-0 (+58), KC 4-0 (+41), MIN 4-0 (+35).
- **À 3-1** : JAX, CHI, SEA, LV, BUF, BAL, NYG, CLE.
- **Sans victoire** : TB, HOU, TEN, LAC, MIA (0-4).

### QB titulaires : écarts avec le plan de juin

La table « QB — changements d'équipe » de
[`09-transitions-2026.md`](./09-transitions-2026.md) listait les
mouvements de l'offseason. Sur le terrain (QB avec le plus de tentatives
par match) :

| Équipe | W1 → W4 | Commentaire |
|---|---|---|
| ATL | Cooper Rush, Rush, Michael Penix Jr., (MNF) | Tua (arrivé de MIA) n'a pas démarré |
| CHI | Caleb Williams, Williams, Case Keenum, Tyson Bagent | Williams absent depuis W3 |
| MIN | Carson Wentz, Wentz, Kyler Murray, Murray | Murray titulaire depuis W3 |
| NYG | Jaxson Dart, Jameis Winston ×3 | Winston depuis W2 |
| SEA | Drew Lock, Lock, Sam Darnold, Darnold | Darnold depuis W3 |
| TB | Baker Mayfield ×3, Jalon Daniels | Changement en W4 |
| WAS | Jayden Daniels ×2, Marcus Mariota, Athan Kaliakmanis | Daniels absent depuis W3 |
| MIA | Malik Willis ×4 | Conforme au plan (GB → MIA) |
| LV | Kirk Cousins ×4 | Conforme (ATL → LV) |
| NYJ | Geno Smith ×4 | Conforme (LV → NYJ) |
| PIT | Aaron Rodgers ×4 | — |

Ces bascules modifient directement la valeur fantasy des Throwers de ces
équipes : la cote dynamique (`nfl-fantasy-player-value`, 40 % de forme sur
4 weeks) les absorbera d'elle-même une fois les stats ingérées.

### Meilleurs joueurs en SPP (barème actuel, W1-W4 hors MNF)

| SPP | Joueur | Équipe | Poste BB | W1/W2/W3/W4 |
|---|---|---|---|---|
| 49 | Josh Allen | BUF | Thrower | 16/19/6/8 |
| 45 | Brock Purdy | SF | Thrower | 10/12/15/8 |
| 42 | Jaxon Smith-Njigba | SEA | Catcher | 9/16/12/5 |
| 40 | Jared Goff | DET | Thrower | 8/16/9/7 |
| 40 | Patrick Mahomes | KC | Thrower | 10/13/8/9 |
| 37 | CeeDee Lamb | DAL | Catcher | 8/13/6/10 |
| 35 | Dak Prescott | DAL | Thrower | 7/15/6/7 |
| 35 | Amon-Ra St. Brown | DET | Catcher | 11/12/7/5 |
| 35 | Jahmyr Gibbs | DET | Ulfwerener | 10/6/13/6 |
| 33 | Kenneth Walker III | KC | Gutter Runner | 11/5/8/9 |

Par poste : RB — Gibbs 35, Walker 33, Henry 31, Javonte Williams 30 ;
TE — Kittle 23, Ferguson 21, Gesicki 20 ; défense — Greg Rousseau (BUF) 21,
T.J. Watt 18, Dallas Turner 16.

Observation de calibrage (cf. statut « À calibrer sur saison entière » du
scoring) : 7 QB dans le top 15. Le barème favorise nettement les Throwers,
à surveiller sur la saison avant d'y toucher.

## 4. Bloquants à corriger AVANT le rattrapage

### 4.1 Les fenêtres de week 2026 sont décalées (bloquant)

`seedNflSeason` ancre la W1 au **5 septembre** et enchaîne des fenêtres de
7 jours. En 2025 (5/09 = vendredi), seuls les TNF tombaient dans la week
d'avant (21/272 matchs). En 2026, le 5/09 est un **samedi** : chaque
fenêtre va de samedi à samedi, alors que les weeks réelles vont du jeudi au
lundi. **247 matchs REG sur 272** tombent dans la mauvaise week du seed.

Effets sur l'orchestrateur (`nfl-fantasy-cron.ts`, `findCurrentNflWeek`) :

- **lock du dimanche 17h UTC** : verrouille la week N+1, et laisse la week
  en cours **ouverte** pendant les matchs du dimanche (on peut modifier son
  lineup en connaissant les premiers résultats) ;
- **ingest nflverse quotidien (03h UTC)** : n'ingère que la week « courante ».
  Dès le samedi, c'est déjà N+1 : les stats du dimanche de la week N
  (publiées lundi 12h30 UTC) ne sont **jamais** ingérées par le cron ;
- **settle du mardi 12h UTC** : vise bien la week N, mais sur des stats
  absentes ⇒ scores à 0, et le settle est idempotent (skip si déjà settlé),
  donc jamais corrigé.

Correctif proposé (pur, testable) : ancrer la W1 sur le **mardi qui suit le
Labor Day** (1er lundi de septembre), le kickoff étant toujours dans la
foulée (2026 : mar. 08/09, kickoff mer. 09/09). Vérifié contre
`games.csv` sur 2021-2026 : **0 match mal placé en 2026**, et sur les
saisons passées seul le Super Bowl sort de sa fenêtre (il se joue deux
semaines après les finales de conférence), plus deux matchs du mardi
reportés pour cause de Covid en 2021. Le Super Bowl reste à traiter à part
(fin de la W22 = fin de saison).

### 4.2 Le settle passe avant les stats du Monday Night (bloquant)

Même avec des fenêtres justes, le settle du **mardi 12h UTC** précède la
publication nflverse des stats du MNF (**mardi ~12h30 UTC**), et l'ingest
quotidien de 03h n'a pas encore les stats du dimanche le lundi. Tout joueur
aligné sur un match du lundi compterait 0, définitivement.

Correctif proposé :
1. l'ingest quotidien traite la week **courante ET la précédente** (les deux
   sont idempotents) ;
2. le settle passe au **mercredi 12h UTC** et rejoue l'ingest nflverse de la
   week visée juste avant de settler.

### 4.3 Saison « 2025 » codée en dur (non bloquant)

| Où | Effet |
|---|---|
| `apps/web/app/nfl-fantasy/leagues/[id]/draft/page.tsx` (`SEASON_ID = "2025"`) | Le catalogue du draft agrège les SPP **2025** même pour une ligue 2026 |
| `apps/web/app/nfl-fantasy/players/page.tsx` | Sélecteur de saison sans option 2026, défaut 2025 |
| `apps/server/src/routes/nfl-fantasy-draft-sessions.ts` (`?? "2025"`) | Prix de base calculés sur 2025 si la ligue n'a pas de saison |
| `apps/web/app/admin/nfl-fantasy/page.tsx` | Valeurs par défaut des formulaires admin sur 2025 / `2025:W10` |

Pour le draft, utiliser 2025 comme référence se défendait AVANT le kickoff
(aucune stat 2026). Maintenant, la saison de la ligue (avec repli sur la
précédente tant qu'elle n'a pas de stats) est la bonne référence.

## 5. Procédure de rattrapage (après les correctifs)

Tout est idempotent ; ordre conseillé :

1. Re-seed de la saison 2026 (`seedNflSeason("2026")`) pour réécrire les
   fenêtres de week avec le nouvel ancrage. Les cycles sont rejoués en upsert.
2. `ingestNflverseRosters({ seasonId: "2026" })` : rosters post-cutdown.
3. `backfillNflSeason("2026")` (W1-W4) puis
   `backfillScoresFromSchedules({ seasonId: "2026" })` : stats, SPP et scores.
4. Contrôle : `NflGameStat` par week ≈ 1 040-1 120, 16 matchs scorés par week.
5. Ligues 2026 `in_progress` existantes : regarder les matchups déjà settlés
   sur des stats vides. Le settle étant « skip si déjà settlé », il faudra un
   re-settle explicite (à décider : remise à zéro du `settledAt` des weeks
   concernées, ou nouvelle option `force`).

Le plus simple en prod reste la cible bootstrap existante avec la saison
2026 complète (sans `--skip-stats`), après le déploiement des correctifs.
