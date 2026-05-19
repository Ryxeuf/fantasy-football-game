# 05 — Mapping postes NFL → postes BB

> Mapping des positions NFL vers les positions Blood Bowl, paramétré
> par race. Une même position NFL (ex: WR) peut se mapper sur un poste
> BB différent selon la race (Gutter Runner pour Skaven, Catcher pour
> Wood Elf, etc.).

## Principe

```
Position NFL × Race équipe → Position BB (+ skills suggérées)
```

Variantes possibles selon le **archetype** du joueur :
- Speed (40-yard dash < 4.4s)
- Power (>225 lbs WR, >250 lbs LB, etc.)
- Agility (cone < 6.7s)
- Receiving (catch% > 70%)

## Table de mapping universelle

### Offense

| NFL Position | BB Position (générique) | Notes |
|---|---|---|
| QB pocket passer | Thrower | Sure Hands, Accurate, Pass |
| QB mobile / dual-threat | Thrower OU Runner | Selon race (Skaven : Thrower MA7) |
| QB scrambler | Runner | Si run-first comme Lamar 2018 era |
| RB power back | Lineman / Blitzer | Selon race (Orc : Black Orc Blitzer) |
| RB receiving back | Runner / Gutter Runner | MA+ stat priority |
| RB scat back | Gutter Runner | Skaven uniquement |
| FB | Lineman | Blocking-only |
| WR1 alpha | Catcher | Side Step, Catch, Diving Catch |
| WR speed | Gutter Runner / Catcher MA+ | Selon race |
| WR possession | Catcher | Sure Hands, Catch |
| WR slot | Runner / Catcher | Agility-first |
| TE receiving | Catcher | Race équipe |
| TE blocking | Blitzer / Lineman | Race équipe (Orc: Black Orc) |
| OL center | Lineman | Block, Wrestle |
| OL guard | Lineman / Black Orc | Selon race |
| OL tackle (élite) | Black Orc / Bull Centaur / Dwarf Blocker | Selon race |
| K (kicker) | Kicker (BB7) ou Lineman bench | Rôle optionnel |
| P (punter) | Lineman bench | Rôle optionnel |

### Defense

| NFL Position | BB Position (générique) | Notes |
|---|---|---|
| DT nose tackle | Big Guy (race-specific) | Mighty Blow |
| DT 3-tech penetrator | Beast / Blitzer | Block, Mighty Blow |
| DE / EDGE pass rusher | Blitzer | Mighty Blow, Tackle |
| DE / EDGE power | Blitzer / Beast | Race-specific |
| LB MIKE (middle) | Blitzer | Block, Tackle |
| LB WILL (weak) | Blitzer / Runner | Agility-first |
| LB SAM (strong) | Blitzer | Block, Mighty Blow |
| CB shutdown | Catcher défensif | Diving Tackle, Pass Block |
| CB slot | Runner | Catch, Diving Tackle |
| S strong | Blitzer | Hit, Tackle |
| S free | Runner / Catcher | Pass Block, Catch |
| Nickelback | Runner | Versatile |

## Mapping par race (détaillé)

### Skaven roster

Roster BB Skaven (BB2020) :
- 0-12 Lineman (MA7 AG3+ AV8+ — Dodge)
- 0-2 Thrower (MA7 AG3+ — Pass, Sure Hands)
- 0-4 Gutter Runner (MA9 AG2+ — Dodge)
- 0-2 Storm Vermin (MA7 ST3 AV8+ — Block)
- 0-1 Rat Ogre (MA6 ST5 — Loner, Frenzy, Mighty Blow, Prehensile Tail, Wild Animal)

| NFL Position | Skaven Position |
|---|---|
| QB | Thrower |
| QB mobile | Thrower (avec Sure Feet skill) |
| RB scat | Gutter Runner |
| RB power | Storm Vermin |
| WR speed | Gutter Runner |
| WR possession | Lineman avec Catch |
| TE receiving | Storm Vermin avec Catch |
| TE blocking | Storm Vermin |
| OL | Lineman |
| DT | Rat Ogre |
| DE | Storm Vermin |
| LB | Storm Vermin |
| CB / S | Gutter Runner |

### Wood Elf roster

Roster BB Wood Elf :
- 0-12 Lineman (MA7 AG2+ — Dodge)
- 0-2 Thrower (MA7 AG2+ — Pass, Dodge)
- 0-4 Catcher (MA8 AG2+ — Catch, Dodge, Side Step)
- 0-2 Wardancer (MA8 ST3 AG2+ — Block, Dodge, Leap)
- 0-1 Treeman (MA2 ST6 — Loner, Mighty Blow, Stand Firm, Strong Arm, Take Root, Thick Skull, Throw Team-Mate)

| NFL Position | Wood Elf Position |
|---|---|
| QB | Thrower |
| RB | Lineman (ou Catcher si receiving back) |
| WR1 alpha | Catcher élite |
| WR speed | Catcher |
| WR slot | Catcher |
| TE | Catcher |
| OL | Lineman |
| DT | Treeman |
| DE | Wardancer |
| LB | Wardancer |
| CB | Catcher (défensif) |
| S | Catcher / Lineman |

### Orc roster

Roster BB Orc :
- 0-12 Lineman (MA5 ST3 AG3+ AV9+)
- 0-2 Thrower (MA5 AG3+ — Pass, Sure Hands)
- 0-4 Black Orc (MA4 ST4 AV10+ — Block, Brawler, Grab)
- 0-4 Blitzer (MA6 ST3 AV9+ — Block)
- 0-4 Goblin (MA6 ST2 AG2+ AV7+ — Dodge, Right Stuff, Stunty)
- 0-1 Troll (MA4 ST5 AV9+ — Loner, Always Hungry, Mighty Blow, Really Stupid, Regenerate, Throw Team-Mate)

| NFL Position | Orc Position |
|---|---|
| QB pocket | Thrower |
| QB mobile (Lamar) | Thrower avec Sprint skill |
| RB power (Henry) | Black Orc / Blitzer |
| RB receiving (Barkley) | Blitzer (avec Catch) |
| WR physical (AJ Brown) | Black Orc avec Catch |
| WR speed | Blitzer avec Catch |
| TE blocking | Black Orc |
| TE receiving | Blitzer avec Catch |
| OL tackle | Black Orc |
| OL guard/center | Lineman |
| K returner | Goblin |
| DT (J. Carter) | Troll |
| DE pass rusher (Watt) | Blitzer |
| LB | Blitzer |
| CB | Lineman (défensif) |
| S | Blitzer |

### Human roster

Roster BB Human :
- 0-16 Lineman (MA6 ST3 AG3+ AV9+)
- 0-2 Thrower (MA6 AG3+ — Pass, Sure Hands)
- 0-4 Catcher (MA8 ST2 AV8+ — Catch, Dodge)
- 0-4 Blitzer (MA7 ST3 AV9+ — Block)
- 0-1 Ogre (MA5 ST5 — Loner, Bone-head, Mighty Blow, Thick Skull, Throw Team-Mate)

| NFL Position | Human Position |
|---|---|
| QB | Thrower |
| RB | Blitzer (ou Lineman si pure power) |
| WR | Catcher |
| TE | Catcher (ou Blitzer si blocking) |
| OL | Lineman |
| DT élite | Ogre |
| DE | Blitzer |
| LB | Blitzer |
| CB | Catcher (défensif) |
| S | Blitzer ou Catcher |

### Norse roster

Roster BB Norse :
- 0-12 Lineman (MA6 ST3 AV8+ — Block)
- 0-2 Thrower (MA6 — Block, Pass)
- 0-2 Runner (MA7 — Block)
- 0-2 Catcher (MA7 AG2+ — Block, Catch)
- 0-4 Berserker (MA6 ST3 — Block, Frenzy, Jump Up)
- 0-2 Ulfwerener (MA6 ST4 — Frenzy)
- 0-1 Yhetee (MA5 ST5 — Loner, Claw, Disturbing Presence, Frenzy, Wild Animal)

Tous les Norse standards ont **Block** — cohérent avec leur identité
"physique mais skilled" (vs Orc qui doivent acheter Block).

| NFL Position | Norse Position |
|---|---|
| QB (Allen) | Thrower (avec Strong Arm) |
| RB power | Ulfwerener |
| RB speed | Runner |
| WR1 alpha (Jefferson) | Catcher |
| WR | Catcher / Runner |
| TE | Berserker avec Catch |
| OL | Lineman |
| DT | Yhetee |
| DE (Hutchinson) | Berserker |
| LB | Berserker |
| CB | Catcher défensif |
| S | Berserker / Runner |

### Dwarf roster

Roster BB Dwarf :
- 0-16 Blocker (MA4 ST3 AV10+ — Block, Tackle, Thick Skull)
- 0-2 Runner (MA6 ST3 — Sure Hands, Thick Skull)
- 0-2 Blitzer (MA5 ST3 AV10+ — Block, Tackle, Thick Skull)
- 0-2 Trollslayer (MA5 ST3 — Block, Dauntless, Frenzy, Thick Skull)
- 0-1 Deathroller (MA4 ST7 — Loner, Break Tackle, Dirty Player, Juggernaut, Mighty Blow, No Hands, Secret Weapon, Stand Firm)

Particularité Dwarf : pas de Thrower dédié. Le QB devient un Runner
avec skills Pass via levelup, ou un Blocker exception.

| NFL Position | Dwarf Position |
|---|---|
| QB | Runner (avec Pass skill) |
| RB power | Blocker / Blitzer |
| RB receiving | Runner |
| WR | Runner avec Catch (rare en Dwarf) |
| TE | Blocker |
| OL | Blocker |
| DT (Lawrence, Garrett) | Deathroller (Big Guy unique) |
| DE | Blitzer |
| LB | Blitzer / Trollslayer |
| CB | Runner |
| S | Blitzer |

### Khorne roster

Roster BB Khorne (Khorne Daemonkin BB2020) :
- 0-12 Bloodseeker (MA6 ST3 AG3+ AV9+ — Frenzy)
- 0-4 Khorngor (MA6 ST3 AG2+ AV9+ — Horns, Juggernaut)
- 0-4 Bloodspawn (MA5 ST4 AV9+ — Block, Claws, Frenzy, Mighty Blow)
- 0-1 Bloodthirster (MA5 ST5 — Loner, Claws, Frenzy, Mighty Blow, Unchannelled Fury, Wild Animal)

Tous frénétiques, low AG → adaptation : on autorise un "Khorne Caster"
custom (Thrower décent) pour les QBs NFL :

| NFL Position | Khorne Position |
|---|---|
| QB (Mayfield gunslinger) | Bloodseeker avec Pass skill (custom) |
| RB power | Bloodspawn |
| RB speed | Khorngor |
| WR | Khorngor avec Catch |
| TE | Bloodspawn avec Catch |
| OL | Bloodseeker |
| DT (Q. Williams) | Bloodthirster |
| DE (Crosby, Mack, Bosa) | Bloodspawn |
| LB | Khorngor |
| CB (Sauce Gardner) | Khorngor avec Catch |
| S | Bloodseeker / Khorngor |

### Necromantic roster

Roster BB Necromantic Horror :
- 0-12 Zombie (MA4 ST3 AG3+ AV8+ — Regenerate)
- 0-2 Ghoul (MA7 ST3 AG2+ AV8+ — Dodge)
- 0-4 Wight (MA6 ST3 AV9+ — Block, Regenerate)
- 0-2 Flesh Golem (MA4 ST4 AV9+ — Regenerate, Stand Firm, Thick Skull)
- 0-2 Werewolf (MA8 ST3 AG2+ AV8+ — Claws, Frenzy, Regenerate)

Tous Regenerate ⇒ thématique parfaite pour les franchises NFL "rebuild
qui ne meurent jamais".

| NFL Position | Necromantic Position |
|---|---|
| QB | Ghoul avec Pass skill |
| RB power | Wight |
| RB speed (Kamara) | Werewolf ou Ghoul |
| WR alpha (Olave, Sutton) | Ghoul avec Catch |
| TE | Wight avec Catch |
| OL | Zombie |
| DT (Simmons) | Flesh Golem |
| DE (Cam Jordan) | Werewolf vétéran |
| LB | Wight |
| CB (Surtain) | Ghoul |
| S | Wight |

## Stats BB de base → archétype NFL

Pour matcher un joueur NFL à un poste BB, on dérive aussi des stats BB :

```ts
interface BbStats {
  ma: number;   // Movement Allowance (1-9)
  st: number;   // Strength (1-7)
  ag: number;   // Agility (1+ to 6+, lower = better)
  pa: number;   // Pass Ability (1+ to 6+, lower = better)
  av: number;   // Armor Value (7+ to 11+)
}
```

Conversion :
- **MA** ← 40-yard dash time
  - <4.3s = MA9, 4.3-4.4 = MA8, 4.4-4.5 = MA7, 4.5-4.6 = MA6, etc.
- **ST** ← weight + bench press
  - >250 lbs + 25+ reps = ST4+, etc.
- **AG** ← cone + shuttle drills
  - Cone <6.7s = AG2+, etc.
- **PA** ← QB rating + completion %
  - Élite QB (>100 rating) = PA2+, etc.
- **AV** ← position (OL/DL plus high, WR plus low)
  - OL/DL = AV10+, LB/TE = AV9+, RB/WR = AV8+, etc.

## Génération automatique par player

```ts
// nfl-mapper/src/player-to-bb-position.ts (pure)

interface NflPlayerCombineData {
  fortyYard?: number;
  weight?: number;
  benchReps?: number;
  cone?: number;
  shuttle?: number;
}

interface NflPlayerCareerStats {
  position: NflPosition;
  career: { games: number; ppr: number; /* etc. */ };
  bestSeason: { /* ... */ };
}

export function deriveBbPositionAndStats(
  player: NflPlayerCombineData & NflPlayerCareerStats,
  teamRace: BbRace,
): { bbPosition: BbPosition; bbStats: BbStats; skills: readonly BbSkill[] } {
  // 1. Archetype detection
  // 2. Map to race-specific BB position
  // 3. Compute BB stats from combine
  // 4. Suggest skills from career stats
}
```

## Cas particuliers

### QB mobile (Lamar Jackson, Jayden Daniels, Justin Fields)

Dilemme : Thrower (passing identity) ou Runner (mobile) ?

**Solution** : Thrower avec skill **Sprint** ou stat MA améliorée :
- Lamar 2019 (MVP) : Thrower MA7 (vs Thrower normal MA5-6 selon race)
- Justin Fields : Thrower MA8 si race Skaven, Thrower MA6 sinon

### Pass-catching RB (CMC, Bijan, Kamara)

Dual-role player. Solution :
- Skaven : Gutter Runner avec Block skill ajoutée
- Wood Elf : Catcher (force versatile)
- Orc : Blitzer avec Catch skill
- Norse : Runner avec Catch
- Human : Blitzer avec Catch
- Dwarf : Runner
- Khorne : Khorngor
- Necromantic : Werewolf ou Ghoul

### TE hybride (Kelce, Bowers, LaPorta, Kittle)

Mapping selon race :
- Skaven : Storm Vermin avec Catch
- Wood Elf : Catcher
- Orc : Black Orc avec Catch
- Norse : Berserker avec Catch
- etc.

### Édge fluide vs power (Watt vs Garrett vs Bosa)

Tous des Blitzers (ou équivalent race). Différenciation par stats :
- Power (Garrett 270lbs, Watt 270lbs) : ST4 ou Beast
- Speed (Parsons, Crosby) : MA+ Blitzer

### Spécialistes ST (kickers, punters)

Hors scope MVP. À ajouter en V2 si on veut un mode "field position"
plus complet. En V1, on ignore les K/P (scoring trop spécifique).

## Skills BB pré-attribuées par poste NFL

Standard NFL → BB skill packages :

```
QB élite (Mahomes-tier)
└── Thrower base + Pass + Sure Hands + Accurate + Strong Arm

QB mobile (Allen, Lamar)
└── Thrower base + Pass + Sprint + Sure Feet

WR1 alpha (Chase, Jefferson)
└── Catcher base + Side Step + Diving Catch + Block

RB workhorse (Henry, Taylor)
└── Blitzer base + Break Tackle + Stand Firm

DE pass rusher (Watt, Crosby)
└── Blitzer base + Mighty Blow + Tackle + Strip Ball

DT elite (Donald-tier, Q. Williams)
└── Big Guy + Mighty Blow + Multiple Block

CB shutdown (Sauce, Surtain)
└── Catcher défensif + Diving Tackle + Pass Block

TE versatile (Kelce, Bowers)
└── Catcher base + Side Step + Block + Sure Hands
```

Le mapping détaillé est dans [`08-rosters-2025.md`](./08-rosters-2025.md).
