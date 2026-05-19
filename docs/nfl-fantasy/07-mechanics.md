# 07 — Mécaniques BB intégrées : relances, inducements, prières

> Intégration des mécaniques iconiques de Blood Bowl dans le scoring
> fantasy NFL. Trois mécaniques, trois rôles dans l'économie.

## Aperçu des rôles

| Mécanique | Rôle | Économie |
|---|---|---|
| **Relances** | Mitigation (annuler un échec) | Inventaire de saison (acheté + skill) |
| **Inducements** | Upside ponctuel (booster un coup) | Marketplace + slots hebdo |
| **Prières à Nuffle** | Catch-up anti-snowball | Auto-roll si underdog |

## 1. Relances (Re-rolls)

### Sémantique NFL

Une relance = **annuler un échec narratif** d'un joueur sur un événement
précis :
- QB lance 2 INT → use 1 reroll → 1 INT "n'est jamais arrivée" pour le scoring
- WR drop une passe critique → reroll → drop annulé (juste annulation, pas conversion en CP)
- DL rate un sack (QB hit only) → reroll → upgrade en sack

### Modèle hybride recommandé

**Pool de saison (acheté)** :
- Démarre la saison avec **8 team rerolls** (cf. roster Skaven full reroll)
- Coût mercato : 50k-100k gp / reroll selon stade saison
- Persistent ⇒ thésauriser pour les playoffs

**Pool de match (gagné)** :
- Joueurs avec le skill BB **Pro** ⇒ 1 reroll personnel par match auto
- Joueurs **Loner (4+)** ⇒ reroll échoue 50% du temps (random)
- Skill obtenu via SPP levelups (cf. `attributeSpp` existant)

### Limites

- Max **2 rerolls par joueur** par match (sinon dégénère)
- Décision pré-match : "auto-use sur 1ère INT" / "manuel" / "stack for playoffs"
- **Idempotent** : un reroll appliqué fige le résultat, pas de re-reroll en cascade

### Implémentation

```ts
// packages/nfl-mapper/src/rerolls.ts
interface RerollDecision {
  type: "auto-mitigate-worst" | "manual-targeted" | "skill-pro";
  playerId: string;
  triggerStat: "INT" | "FUMBLE" | "DROP" | "MISSED_SACK";
}

interface RerollPool {
  team: number;
  skill: number;
}

interface RerollApplication {
  result: NflPlayerStatLine;
  consumed: RerollPool;
  log: ReadonlyArray<{ playerId: string; type: string; before: number; after: number }>;
}

// Pure function — replay-friendly
export function applyRerolls(
  statLine: NflPlayerStatLine,
  decisions: readonly RerollDecision[],
  pool: RerollPool,
): RerollApplication {
  // 1. Sort decisions by priority (auto-mitigate from worst)
  // 2. For each, attempt to apply (check pool, check stat exists)
  // 3. Modify stat line + deduct pool
  // 4. Return audit log
}
```

### UX

Page **Pre-match** (avant lock Sunday 1pm ET) :
- "Rerolls disponibles : 5 team / 2 skill"
- "Auto-use sur 1ère INT du QB ?" (toggle)
- "Auto-use sur 1ère fumble du RB ?" (toggle)
- "Save for playoffs (no auto)" (option)

Page **Post-match** (Mardi review) :
- "Reroll utilisé sur INT #2 de [QB pseudonyme]"
- "Effet : -1 SPP malus annulé"
- "Pool restant : 4 team / 2 skill"

## 2. Inducements (Coups de pouce)

### Sémantique NFL

Chaque inducement BB a une transposition naturelle :

| BB Inducement | NFL Fantasy version | Coût gp | Effet |
|---|---|---|---|
| **Bribe** | "Hidden ball trick" | 100k | Annule 1 turnover (INT ou fumble lost) |
| **Wandering Apothecary** | "Team trainer" | 100k | Annule 1 malus injury / IR pour la semaine |
| **Bloodweiser Keg** | "Energy drink" | 50k | Joueur en concussion protocol revient actif |
| **Halfling Master Chef** | "Disruptive coach" | 300k | Vole 1 reroll à l'opposant (H2H league) |
| **Cheerleader** | "Crowd boost" | 10k | +5% SPP pour les joueurs en home game cette semaine |
| **Assistant Coach** | "Coordinator boost" | 20k | +1 reroll one-shot |
| **Wizard (Fireball)** | "Trick play designer" | 150k | ×2 sur 1 stat ciblée (1 TD, 1 sack, 1 INT défensif) |
| **Star Player rental** | "Free agent ringer" | 150-500k | Add 1 NFL player hors roster pour 1 match |
| **Mercenary** | "Practice squad call-up" | 30k + skill | Idem star, tier inférieur, skill aléatoire |
| **Riotous Rookies** | "Surprise rookie" | 80k | Wildcard joueur rookie aléatoire boost +50% |

### Modèle d'intégration : slots hebdomadaires

User dispose de **3 slots inducement par match** :
- 1 slot **Defensive** (apothecary, bribe, keg, fan favors)
- 1 slot **Offensive** (wizard, star player, cheerleader)
- 1 slot **Wildcard** (n'importe quoi)

Slots non utilisés ⇒ perdus (sinon overflow ingérable). Inducements
achetés au mercato ou gagnés par achievements ⇒ stock persistent.
Activation pre-match avant lock Sunday.

### Star Player rental — mécanique riche

Tu peux "louer" un joueur (ex: WR alpha d'une autre équipe) **une semaine**
même s'il n'est pas dans ton roster ⇒ il rapporte des SPP **temporaires**
non-cumulables sur le levelup. Permet de jouer les matchups (rent Jefferson
la semaine où il joue contre une défense faible). Coût ~contrat NFL hebdo / 100.

### Implémentation

```ts
// packages/nfl-mapper/src/inducements.ts

type InducementId =
  | "BRIBE" | "APOTHECARY" | "KEG" | "MASTER_CHEF"
  | "CHEERLEADER" | "ASSISTANT_COACH" | "WIZARD"
  | "STAR_PLAYER" | "MERCENARY" | "RIOTOUS_ROOKIES";

interface InducementActivation {
  id: InducementId;
  slot: "defensive" | "offensive" | "wildcard";
  targetPlayerId?: string; // si l'inducement cible un joueur
  meta?: Record<string, unknown>; // ex: starPlayer rental → joueur ID
}

// Pure
export function applyInducements(
  statLines: NflPlayerStatLine[],
  activations: readonly InducementActivation[],
  context: { weekId: string; matchupId: string },
): {
  modifiedStats: NflPlayerStatLine[];
  starPlayerStats?: NflPlayerStatLine;
  log: ReadonlyArray<{ id: string; effect: string }>;
} {
  // Apply each activation in deterministic order
  // Wildcard slot last (can override defensive/offensive)
}
```

## 3. Prières à Nuffle

### Sémantique NFL

C'est le mécanisme **anti-rich-gets-richer** crucial pour la longévité
d'une league. En BB officiel : déclenché si TV < opponent TV par 50k+
⇒ tu rolls 1 prière (ou 2 si écart >150k).

**Adaptation NFL fantasy** : Si ton roster TV est inférieur d'au moins
**20%** à ton matchup adverse (H2H league) ou à la **médiane de la
league** (rotisserie), tu rolls **1 Prière** automatique chaque semaine.
Si écart >40% ⇒ 2 Prières.

### Table d'adaptation

Roll d12 (ou d16 BB2020) sur :

| Roll | BB Prayer | NFL Fantasy adaptée | Effet |
|---|---|---|---|
| 1 | Treacherous Trapdoor | "Field hazard" | Annule le meilleur événement SPP d'un opponent au hasard |
| 2 | Friends with the Ref | "Ref bias" | Tes malus INT/fumble divisés par 2 cette semaine |
| 3 | Stiletto | "Targeted hit" | 1 DL/LB désigné : sacks comptent ×2 |
| 4 | Iron Man | "Iron body" | 1 joueur désigné : immune aux malus |
| 5 | Greasy Cleats | "Slippery turf" | 1 opponent désigné : SPP × 0.5 |
| 6 | Blessed Statue | "Lucky bounce" | Tous tes joueurs : +0.5 SPP par CP |
| 7 | Moles Under Pitch | "Sideline chaos" | 1 opponent aléatoire : score 0 |
| 8 | Perfect Passing | "Passing clinic" | Tes QBs : INTs ne pénalisent pas |
| 9 | Fan Interaction | "Crowd interferes" | 1 opponent aléatoire : désactivé |
| 10 | Necessary Violence | "No flag thrown" | Tes flags 15-yd n'appliquent pas malus |
| 11 | Fouling Frenzy | "Bounty hunter" | 1 LB désigné : +1 SPP par tackle |
| 12 | Throw a Rock | "Object from stands" | 1 opponent aléatoire : -1 SPP sur son best play |

Roll fait **automatiquement** au lock pre-match (Sunday 1pm ET en NFL).
Notif au user : "Nuffle smiles upon you: *Friends with the Ref* activée
cette semaine". User désigne joueur ciblé si la prière le demande
(avant kickoff).

### Implémentation

```ts
// packages/nfl-mapper/src/prayers.ts

type PrayerId =
  | "TREACHEROUS_TRAPDOOR" | "FRIENDS_REF" | "STILETTO" | "IRON_MAN"
  | "GREASY_CLEATS" | "BLESSED_STATUE" | "MOLES" | "PERFECT_PASSING"
  | "FAN_INTERACTION" | "NECESSARY_VIOLENCE" | "FOULING_FRENZY" | "ROCK";

interface PrayerRoll {
  id: PrayerId;
  rolledAt: Date;
  targetPlayerId?: string; // si user a dû désigner (sélection user dans UI)
  weekId: string;
  seed: string; // pour replay déterministe
}

// Pure
export function rollPrayers(
  seed: string,
  count: 1 | 2,
): PrayerRoll[] {
  // Use seeded PRNG (e.g., seedrandom)
  // Roll d12 count times
  // Return PrayerRoll[]
}

// Pure
export function applyPrayer(
  prayer: PrayerRoll,
  ownStats: NflPlayerStatLine[],
  opponentStats: NflPlayerStatLine[],
): {
  ownModified: NflPlayerStatLine[];
  opponentModified: NflPlayerStatLine[];
  log: string;
} {
  // Apply prayer effect, return modified stats + audit log
}
```

Seed déterministe = `${userId}:${weekId}` ⇒ replay reproductible (cf.
pattern `attributeSpp` pure).

### Détection underdog

```ts
// packages/nfl-mapper/src/underdog.ts

interface MatchupContext {
  ownTV: number;
  opponentTV: number;
  leagueMedianTV?: number;
}

export function shouldRollPrayers(ctx: MatchupContext): { rollCount: 0 | 1 | 2 } {
  const referenceTV = ctx.opponentTV ?? ctx.leagueMedianTV ?? 0;
  const diff = referenceTV - ctx.ownTV;
  const percent = diff / referenceTV;

  if (percent >= 0.40) return { rollCount: 2 };
  if (percent >= 0.20) return { rollCount: 1 };
  return { rollCount: 0 };
}
```

## Architecture économique globale

```
SAISON
├── Mercato : achète inducements + rerolls (gold persistent)
├── Achievements : earn rerolls bonus, inducements gratuits
└── Inventory persistent

CHAQUE SEMAINE NFL
├── Avant lock (Dimanche 12h ET)
│   ├── Set lineup (11 titulaires)
│   ├── Set captain (×1.5)
│   ├── Allocate inducements (3 slots max)
│   ├── Pre-stage rerolls (auto-use rules)
│   └── Auto-roll prayers si underdog
├── Pendant matches NFL (Dimanche-Lundi)
│   └── Stats live ingérées via API
└── Settlement (Mardi)
    ├── Apply prayers
    ├── Apply rerolls (manual ou auto)
    ├── Apply inducements
    ├── Compute final SPP par joueur
    └── Update standings + level-ups
```

## Schéma Prisma proposé

```prisma
// prisma/schema.prisma additions

model NflFantasyReroll {
  id        String   @id @default(cuid())
  entryId   String   // ref NflFantasyEntry (user's team in league)
  type      String   // "team" | "skill" | "assistant_coach"
  source    String   // "starter" | "purchased" | "achievement" | "skill_pro"
  used      Boolean  @default(false)
  usedAt    DateTime?
  weekId    String?  // si used, lié à la semaine
  matchupId String?
  appliedTo String?  // playerId targeted

  entry NflFantasyEntry @relation(fields: [entryId], references: [id])

  @@index([entryId, used])
}

model NflFantasyInducement {
  id        String   @id @default(cuid())
  entryId   String
  type      String   // InducementId
  slot      String   // "defensive" | "offensive" | "wildcard" | null si non-utilisé
  used      Boolean  @default(false)
  usedAt    DateTime?
  weekId    String?
  matchupId String?
  targetId  String?  // playerId targeted
  meta      Json?    // ex: rental player ID

  entry NflFantasyEntry @relation(fields: [entryId], references: [id])

  @@index([entryId, used])
}

model NflFantasyPrayer {
  id          String   @id @default(cuid())
  entryId     String
  weekId      String
  matchupId   String
  prayerId    String   // PrayerId
  rolledAt    DateTime @default(now())
  seed        String   // for replay
  targetId    String?  // playerId if prayer requires target
  applied     Boolean  @default(false)
  appliedAt   DateTime?
  effectLog   String?  // audit log of effect applied

  entry NflFantasyEntry @relation(fields: [entryId], references: [id])

  @@unique([entryId, weekId, prayerId])
}
```

## 3 variantes selon l'audience

### Casual mode
- Pas d'inducements complexes
- +3 rerolls/saison forfaitaires
- Prayers auto-roll silently
- UX minimale, focus sur la lineup
- MPG-feel

### Standard mode (recommandé)
- Full hybrid décrit ci-dessus
- ~10 min de gestion pre-match
- Sweet spot engagement vs friction

### Hardcore mode
- Ajoute les **conditions de saison** (météo, niggling injuries, fan factor)
- Mode draft auction live MPG-style
- Pour les BB veterans qui veulent toute la profondeur

## Bonus narratif : Gazette flavor

Le moteur Gazette existant consomme bien ces événements :

> "Mahomes lance une INT critique... mais Krak'Skar le coach orc soudoie
> l'arbitre ! La passe est rejouée, complétée pour 47 yards !"
> *(bribe + reroll narratif)*

> "Nuffle sourit aux Underdogs : un trou s'ouvre dans la pelouse de
> Lambeau Field, engloutissant un Norse adverse !"
> *(Moles Under Pitch)*

> "L'apothicaire vagabond bande la blessure du Catcher de Kansas City
> en marge du terrain. Il revient au jeu, déterminé."
> *(Wandering Apothecary)*

Plus narratif et marrant que les notifs fantasy classiques. C'est
**exactement le différenciateur BB** ⇒ vrai moat narratif vs MPG/Sleeper.

## Tests à écrire

```ts
// packages/nfl-mapper/src/__tests__/prayers.test.ts

describe("rollPrayers", () => {
  it("is deterministic for the same seed", () => {
    const a = rollPrayers("user-123:week-5", 2);
    const b = rollPrayers("user-123:week-5", 2);
    expect(a).toEqual(b);
  });

  it("returns count prayers", () => {
    const result = rollPrayers("seed", 2);
    expect(result).toHaveLength(2);
  });
});

describe("shouldRollPrayers", () => {
  it("returns 0 for non-underdog", () => {
    expect(shouldRollPrayers({ ownTV: 1000, opponentTV: 1000 }))
      .toEqual({ rollCount: 0 });
  });

  it("returns 1 for 20% underdog", () => {
    expect(shouldRollPrayers({ ownTV: 800, opponentTV: 1000 }))
      .toEqual({ rollCount: 1 });
  });

  it("returns 2 for 40% underdog", () => {
    expect(shouldRollPrayers({ ownTV: 600, opponentTV: 1000 }))
      .toEqual({ rollCount: 2 });
  });
});
```
