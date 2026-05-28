# 06 — Scoring : stats NFL → SPP Blood Bowl

> Conversion des stats NFL réelles en SPP (Star Player Points) Blood Bowl
> pour alimenter la progression des joueurs et le scoring des matchs
> fantasy.

## Rappel barème SPP (BB2020)

| Action BB | SPP |
|---|---|
| Completion (CP) | 1 |
| Pass Deflection (PD) | 1 |
| Defensive Play (DP) — Interception, Strip Ball, Fumble Recovery | 2 |
| Touchdown (TD) | 3 |
| Casualty (CAS) | 2 |
| MVP (random) | 4 |

**Ordre de grandeur typique BB** :
- Joueur lambda : 0-2 SPP/match
- Bon joueur : 3-5 SPP/match
- Star match : 8+ SPP

**Saison BB (16 matches)** :
- Titulaire régulier : 30-60 SPP
- Star : 60-100 SPP
- Level-ups BB2020 : 6, 16, 31, 51, 76, 176 SPP

## Problème de calibration

Un match NFL = ~60-80 plays par équipe, donc beaucoup plus d'actions
qu'un match BB (16 turns max). Si on fait "1 completion = 1 SPP", un QB
gagnerait 25 SPP/match — break le système.

**Solution : threshold-based mapping (recommandé)**.

Seuls les **moments NFL "BB-worthy"** comptent (TD, big play, sack,
INT, etc.). Préserve la narrative BB : chaque SPP = un "moment".

Alternative : **continuous scaled** (`SPP_match = round(fantasy_points / 5)`),
plus simple mais moins narratif.

## Table de mapping par poste NFL

### Thrower (QB) — race équipe

| NFL stat | BB event | SPP |
|---|---|---|
| 1 passing TD | 1× TD | 3 |
| Passing yards par tranche de 75 (cap à 4) | 1× CP | 1 |
| Completion >25 yards | 1× CP (long bomb) | 1 |
| 1 interception thrown | -1× CP (annulé) | -1 |
| Rating > 110 | bonus MVP candidate | +1 |
| 1 rushing TD (QB run) | 1× TD | 3 |
| 1 rushing yards >50 | bonus CP | 1 |
| 1 sack subi | malus narratif, no SPP | 0 |

**Exemple : Mahomes 31/45, 350 yds, 3 TD, 1 INT**
= 3 TD ×3 + (350/75 = 4) CP + (-1) malus
= 9 + 4 - 1 = **12 SPP** (gros match)

### Runner / Blitzer / Gutter Runner (RB)

| NFL stat | BB event | SPP |
|---|---|---|
| 1 rushing TD | 1× TD | 3 |
| 1 receiving TD | 1× TD | 3 |
| 75+ rushing yards | 1× CP-equivalent (handoff carried) | 1 |
| 100+ rushing yards | bonus +1× CP | 1 |
| 100+ receiving yards | bonus +1× CP | 1 |
| 1 reception (max 3 capped) | 1× CP | 1 |
| 1 fumble lost | malus narratif | -1 |

**Exemple : Henry 24/175, 2 TD, 1 fumble**
= 2 TD ×3 + 1 CP (100+ yards) + 1 CP (75+) + (-1) malus
= 6 + 1 + 1 - 1 = **7 SPP**

### Catcher (WR / TE)

| NFL stat | BB event | SPP |
|---|---|---|
| 1 reception (max 5/match capped) | 1× CP | 1 |
| 1 receiving TD | 1× TD | 3 |
| 100+ receiving yards | bonus +1× CP | 1 |
| 150+ receiving yards | bonus +1× CP | 1 |
| 1 drop | -1× CP | -1 |

**Exemple : Jefferson 8/142, 1 TD**
= 5 CP (capped) + 1 TD ×3 + 1 CP (100+)
= 5 + 3 + 1 = **9 SPP** (star match)

### Big Guy (DT / NT)

| NFL stat | BB event | SPP |
|---|---|---|
| 1 sack | 1× CAS (knocked QB down hard) | 2 |
| 3 QB hits | 1× CAS | 2 |
| 1 TFL | narrative, no SPP | 0 |
| 1 forced fumble | 1× DP (strip ball) | 2 |
| 1 fumble recovery | 1× DP | 2 |
| 1 defensive TD | 1× TD | 3 |

**Exemple : Aaron Donald 2 sacks, 1 forced fumble**
= 2 sacks ×2 + 1 FF ×2 = **6 SPP** (star match)

### Blitzer (DE / EDGE / LB)

| NFL stat | BB event | SPP |
|---|---|---|
| Tackles ≥10 | 1× CAS-equivalent | 2 |
| 1 sack | 1× CAS | 2 |
| 1 INT | 1× DP | 2 |
| 1 forced fumble | 1× DP | 2 |
| Tackles for loss ≥2 | bonus +1× CP | 1 |
| 1 defensive TD | 1× TD | 3 |

**Exemple : TJ Watt 8 tackles, 2 sacks, 1 FF**
= 2 sacks ×2 + 1 FF ×2 = **6 SPP**

### Catcher défensif / Runner (CB / S)

| NFL stat | BB event | SPP |
|---|---|---|
| 1 INT | 1× DP | 2 |
| 1 pass breakup (PBU) | 1× PD | 1 |
| 1 defensive TD (pick-six / fumble return) | 1× TD + 1× DP | 5 |
| Tackles ≥8 | bonus narratif | 0 |
| 1 forced fumble | 1× DP | 2 |

**Exemple : Sauce Gardner 1 INT, 3 PBU, 6 tackles**
= 1 INT ×2 + 3 PD ×1 = **5 SPP**

### Lineman OL (Black Orc, Lineman)

Le plus difficile à scorer car les OL ne sont pas trackés directement
dans les stats NFL standard. Trois approches :

**Approche 1 : PFF-based** (best, requiert PFF data)
- Pancake blocks : 1 SPP par pancake
- Run blocks réussis (par snap) : composite
- Sacks alloués : -1 SPP chacun

**Approche 2 : QB-derived** (cheap, sans PFF)
Chaque OL gagne SPP en fonction du succès collectif du backfield :
- QB rating de l'équipe >100 : +1 SPP pour chaque OL starter
- Rushing yards équipe >150 : +1 SPP pour chaque OL starter
- Sacks alloués équipe <2 : +1 SPP pour chaque OL starter
- Sacks alloués équipe >4 : -1 SPP pour chaque OL starter

**Approche 3 : participation-based** (minimal)
- 1 SPP par match disputé en titulaire (slow progression, mais ça progresse)

**Recommandation** : approche 2 (QB-derived) en MVP, upgrade vers PFF en V2.

## Variantes scoring optionnelles

### Captain bonus

Désigner 1 joueur Captain par lineup hebdo :
- Multiplier ×1.5 sur ses SPP (cf. Sorare classique)
- Ou ×2 si format "Captain Mode"

### Vice-captain bonus

Si compétition le permet : ×1.2 sur un 2e joueur.

### Bonus skills BB (V1 — actif)

Implémenté dans `apps/server/src/services/nfl-fantasy-skill-bonus.ts`,
appliqué dans `settleNflFantasyWeek` **avant** le multiplier captain.

Chaque skill BB du joueur (dérivé via `nfl-bb-derivation`) regarde les
events SPP générés par `computeSpp()` et ajoute un bonus thématique
capé. Persisté dans `NflFantasyLineupStarter.sppBreakdown.skillBonuses`
pour audit Gazette.

| Skill                 | Bonus                                       | Cap |
| --------------------- | ------------------------------------------- | --- |
| `pass`                | +1 SPP par TD passing                       | 3   |
| `catch`               | +1 SPP si au moins 1 TD receiving           | 1   |
| `sure-hands`          | +1 SPP par MALUS fumble compensé            | 2   |
| `safe-pair-of-hands`  | +1 SPP par MALUS drop compensé              | 2   |
| `block`               | +1 SPP par event CAS                        | 3   |
| `mighty-blow-*`       | +1 SPP par event CAS (toutes variantes)     | 3   |
| `dodge`               | +1 SPP par INT (DP)                         | 2   |
| `tackle`              | +1 SPP si au moins 1 forced fumble          | 1   |
| `frenzy`              | +1 SPP si au moins 2 CAS sur le match       | 1   |

`rawSpp` persisté = `computedSpp + totalBonusSpp`. Le multiplier
captain s'applique sur ce raw enrichi (la base multipliée inclut donc
le bonus skill). Skill dupliqué = compté une seule fois ; skill
inconnu = ignoré silencieusement.

### Specialist competitions

Pour ajouter de la variété (cf. Sorare Single Game Week) :
- **Defensive Specialist** : seuls les SPP défensifs comptent ×2
- **Offensive Showdown** : seuls SPP offensifs comptent ×2
- **Underdog** : limité aux joueurs TV <50k (rookies + role players)
- **Captain Captain** : Captain ×2.5 mais reste de l'équipe ×0.5

## Implémentation pure (testable)

```ts
// packages/nfl-mapper/src/stats-to-spp.ts

interface NflPlayerStatLine {
  position: NflPosition;
  bbPosition: BbPosition;

  // offensive
  passYards?: number;
  passTd?: number;
  passInt?: number;
  passComp?: number;
  passAtt?: number;
  rushYards?: number;
  rushTd?: number;
  rushAtt?: number;
  fumbleLost?: number;
  recYards?: number;
  receptions?: number;
  recTd?: number;
  drops?: number;

  // defensive
  tackles?: number;
  sacks?: number;
  tfl?: number;
  qbHits?: number;
  defInt?: number;
  passDefended?: number;
  forcedFumble?: number;
  fumbleRecovery?: number;
  defTd?: number;

  // team context (for OL)
  teamPassRating?: number;
  teamRushYards?: number;
  teamSacksAllowed?: number;
}

interface SppBreakdown {
  events: ReadonlyArray<{ type: BbEventType; count: number; spp: number; reason: string }>;
  totalSpp: number;
  mvpEligible: boolean;
}

export function computeSpp(stat: NflPlayerStatLine): SppBreakdown {
  // Pure function — replay-friendly
  // No side effects, deterministic
}
```

## Tests à écrire (Vitest)

Suivre les patterns du repo (`apps/server/src/services/*.test.ts`) :

```ts
describe("computeSpp - Thrower", () => {
  it("computes Mahomes-style elite game", () => {
    const result = computeSpp({
      position: "QB", bbPosition: "Thrower",
      passYards: 350, passTd: 3, passInt: 1,
      passComp: 31, passAtt: 45,
    });
    expect(result.totalSpp).toBe(12);
    expect(result.events).toHaveLength(4); // 3 TD + 4 CP + 1 INT malus
  });

  it("caps passing yards at 4 CP", () => {
    const result = computeSpp({
      position: "QB", bbPosition: "Thrower",
      passYards: 500, passTd: 0, passInt: 0,
      passComp: 30, passAtt: 40,
    });
    // 500/75 = 6.67, capped at 4
    expect(result.totalSpp).toBe(4);
  });

  it("handles negative INT correctly", () => {
    const result = computeSpp({
      position: "QB", bbPosition: "Thrower",
      passYards: 75, passTd: 0, passInt: 3,
      passComp: 5, passAtt: 25,
    });
    expect(result.totalSpp).toBe(-2); // 1 CP - 3 malus
  });
});
```

## MVP attribution (4 SPP bonus)

Sélection du MVP par algo, pas par vote (au moins en V1) :

1. Liste des joueurs avec `totalSpp > 0` de l'équipe gagnante (côté
   matchup fantasy, pas équipe NFL)
2. Tri descending par SPP
3. Top 3 ⇒ tirage aléatoire avec seed déterministe `${matchupId}:mvp`
4. MVP gagne **+4 SPP** bonus

Pattern existant : suit la convention BB officielle (random parmi
top performers, pas auto-attribué au best).

## Calibration empirique

Sur la saison 2024 NFL complète, estimation des SPP totaux par joueur :

| Tier joueur | Saison NFL 17 matches | SPP cumulés estimés |
|---|---|---|
| Star QB (Mahomes) | 4500 yds, 30 TD, 12 INT | ~100 SPP |
| Star WR (Jefferson) | 100 rec, 1500 yds, 10 TD | ~70 SPP |
| Star RB (Henry) | 1500 yds, 13 TD, 3 fumbles | ~50 SPP |
| Star Edge (Watt) | 80 tackles, 15 sacks, 3 FF | ~40 SPP |
| Star DT (Donald-tier) | 60 tackles, 10 sacks, 5 FF | ~30 SPP |
| Star CB (Sauce) | 60 tackles, 4 INT, 12 PBU | ~25 SPP |
| Role player | varies | 10-20 SPP |

**Implication progression BB** :
- Level 2 (6 SPP) atteint en ~1-2 matches pour les stars
- Level 3 (16 SPP) en ~3-4 matches
- Level 4 (31 SPP) en ~6-8 matches
- Level 5 (51 SPP) en mi-saison ou fin saison
- Level 6 (76 SPP) atteignable seulement pour les ALL-PRO

Cohérent avec la progression BB d'un Pro League. À ajuster en V1 selon
le feedback playtest (si trop lent ⇒ diviser seuils par 2, si trop
rapide ⇒ augmenter).

## Pattern d'application

Réutilise `attributeSpp` du `sim-engine` :

```ts
// apps/server/src/services/nfl-fantasy-scoring.ts

export async function settleNflFantasyWeek(weekId: string): Promise<void> {
  const matchups = await prisma.nflFantasyMatchup.findMany({
    where: { weekId, status: "pending" },
    include: { entries: { include: { lineup: true } } },
  });

  for (const matchup of matchups) {
    const entryScores = await Promise.all(
      matchup.entries.map(async (entry) => {
        const playerScores = await Promise.all(
          entry.lineup.players.map(async (lp) => {
            const stat = await prisma.nflGameStat.findUnique({
              where: { gameId_playerId: { gameId: lp.gameId, playerId: lp.playerId } },
            });
            if (!stat) return { playerId: lp.playerId, spp: 0 };

            const breakdown = computeSpp(stat); // pure
            const captainMultiplier = lp.isCaptain ? 1.5 : 1;
            return {
              playerId: lp.playerId,
              spp: Math.round(breakdown.totalSpp * captainMultiplier),
              breakdown,
            };
          }),
        );
        return { entryId: entry.id, total: playerScores.reduce((a, p) => a + p.spp, 0), playerScores };
      }),
    );

    // Update matchup result
    // Persist breakdown for transparency (user sees per-player SPP)
    // Apply rerolls/inducements/prayers via hooks (cf. mechanics.md)
  }
}
```

Pattern Q.D.1 : settle isolé en try/catch pour ne pas casser un matchup
suite à l'autre.
