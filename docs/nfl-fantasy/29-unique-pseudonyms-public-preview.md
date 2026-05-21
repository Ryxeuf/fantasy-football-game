# 29 — Pseudonyms uniques + aperçu profil public (Phase 5.D)

> Deux ajustements UX en aval de Phase 5.A : garantir l'unicite des
> pseudonyms (le sample montrait jusqu'a 24 joueurs partageant
> exactement le meme "Le Sprint Daemon de Arizona, #0") et donner a
> l'admin un visuel direct de ce qui sera expose publiquement.

## Phase 5.D.1 — Pseudonyms uniques (BB-flavored surname)

### Probleme

`generatePseudonym({cityTag, bbPosition, jerseyNumber})` est
deterministe mais pas injectif :
- Avant Phase 5.A : jerseyNumber=null devenait `0` → tous les FA /
  retired / pre-roster partageaient un nom (max constate : 33 joueurs
  identiques).
- Apres Phase 5.A : 89% des actifs ont un vrai jersey → meilleur,
  mais 2 joueurs au meme poste avec le meme jersey (succession sur
  plusieurs annees, retired + active) collidaient encore.

Pre-fix : `4564 pseudos distincts sur 4565 joueurs ⇒ massif overlap`
(en mode plain count, sans groupBy + having ⇒ 24 lignes "Sprint
Daemon Arizona #0" en exemple).

### Solution

Ajout d'un parametre **optionnel** `playerId` qui derive un surnom
BB-flavored deterministe via FNV-1a :

```ts
deriveSurname(playerId: string): string
// "00-0033873" → "Skel'Nar"
// "00-0034796" → "Bjor'Wyn"
```

Pool : 24 prefixes (Krak, Vor, Throg, Skarn, ...) × 24 suffixes
('Skar, 'Drim, 'Fang, ...) = **576 combinaisons**.

Format final : `"{Surname} le {Descriptor} de {City}, #{Jersey}"`

Exemple : `"Skel'Nar le Sidearm Wizard de Kansas City, #15"`

Le `playerId` est passe depuis les 2 callers : `ingestNflverseRosters`
+ `ingestNflverseWeek`. Backward-compat preservee — sans playerId,
format legacy intact.

### Validation

Re-ingest des 3 saisons :
- 2025 : 3137 rows, 3133 players updated en 20s
- 2024 : 3216 rows, 3215 players updated en 19s
- 2023 : 3090 rows, 3089 players updated en 13s

DB apres : **4564 pseudonyms distincts sur 4565 joueurs** (1 seule
collision globale, ~0.02%, vs ~50% pre-fix).

### Tests

`pseudonymize.test.ts` (+7 tests = 38 total) :
- `deriveSurname` deterministe + ≥50% unique sur 200 ids
- Format regex `[A-Z][a-z]+'[A-Z][a-z]+`
- 100 GutterRunner ARI #0 → ≥80 pseudos distincts
- Backward-compat sans playerId

## Phase 5.D.2 — Bloc "Apercu profil public"

### Probleme

L'admin player page mixe info **interne** (realName, gsis_id,
headshotUrl, sppBreakdown) et info **publique** (pseudonym, stats,
team). Difficile pour le PO de visualiser ce que verra un user
public quand `/nfl-fantasy/players/[id]` sera lance.

### Solution

Section `PublicProfilePreview` collapsible (default fermee) tout en
haut de la page admin. Quand ouverte, simule le rendu user-facing :

- **Header** : "avatar" emoji derive de bbPosition (`🎯` Thrower,
  `🏃` Catcher/GutterRunner, `⚔️` Blitzer, etc.) + pseudonym + team
  (city + raceLabel) + jerseyNumber + status humain
- **Profil** : taille / poids / age / college / draft / saison
  rookie (faits factuels publics — pas de birthDate exact ni
  headshot)
- **Carrière** : games joues, total SPP, moy/game, saisons jouees
- **5 derniers games** : week + opponent + SPP (pas de
  sppBreakdown)
- **Footer disclaimer** : liste explicite de ce qui est masque
  (realName, headshotUrl, gsis_id, sppBreakdown, ingestSource)

Le bouton headshot dans le header admin recoit un `title="ADMIN
UNIQUEMENT — non exposee publiquement (Q8)"` pour rappeler la regle.

### Pas affichee publiquement

Pour rester aligne sur la pseudonymisation niveau 2 (cf.
`01-legal.md`) :

- `realName` ← privacy / NIL pas signe
- `headshotUrl` ← IP NFL (photo officielle)
- `birthDate` exact ← PII (on affiche seulement `ageYears`)
- `gsis_id` ← identifiant tracker
- `sppBreakdown`, `ingestSource` ← detail technique

Ce qui RESTE expose :
- `pseudonym`, `bbPosition`, `team.city`, `team.raceLabel`,
  `jerseyNumber`, `nflPosition`, `status`
- Bio factuelle : `heightInches`, `weightLbs`, `ageYears`,
  `college`, `draftYear/Round/Pick/Club`, `rookieYear`
- Stats : `totalSpp`, `gamesPlayed`, `categoryStats`, `seasons[]`,
  `stats[]` (sans breakdown)

## Hors scope (futurs)

- **Page user-facing `/nfl-fantasy/players/[id]`** : actuellement
  admin only. V2 : route publique avec autorisation `seenInLeague`
  (un user ne voit que les joueurs dans son roster ou ceux des
  adversaires de matchups passes).
- **Tabs admin** : sections "Bio / Stats / Career / Game log /
  Apercu public" pour alleger la page (deja ~1000 lignes).
- **Profil pour les retired** : la card "5 derniers games" pourrait
  afficher la derniere saison active au lieu des 5 derniers en
  general.
