# SPRINT Pro League — Championnat virtuel + Paris MVP

> Statut : **DIFFERE** (P2/P3, depend du retour PvE)
> Duree cible : ~4-5 semaines
> Theme : creer un championnat IA vs IA permanent (16 equipes hommages NFL),
> matchs auto diffuses "live" le mardi 21h, paris en monnaie virtuelle
> (Crowns), mode spectateur/fan, narratif quotidien (Nuffle Gazette LLM).
> Pre-requis :
> 1. [`SPRINT-sim-engine.md`](./SPRINT-sim-engine.md) **livre et gate passe**.
> 2. [`SPRINT-pve-bot-mvp.md`](./SPRINT-pve-bot-mvp.md) **livre et KPI 3 mois
>    atteints** (>= 60% nouveaux jouent PvE, retention boost mesuree, NPS >= 35).

## Pourquoi differe

Ce sprint a ete conceptualise initialement comme **prochaine priorite** apres
le sim-engine. Il a ete **deplace en P2/P3** apres analyse strategique
(2026-05-05) :

1. **PvE bot a un ROI superieur a court terme** : 100% audience addressable
   (vs Pro League qui necessite masse critique audience), onboarding boost
   immediat, validation sim-engine en production.
2. **Dependance audience** : la Pro League n'a de sens que si une audience
   spectatrice existe. Sur 50 utilisateurs c'est mort, sur 500+ ca decolle.
   Le PvE va precisement servir a **faire grandir cette base** avant.
3. **Effort lourd** : 4-5 semaines de dev produit (paris, broadcaster,
   Gazette LLM, casualties, HoF) qui ne sont pertinents que si la traction
   suit.

**Quand reprendre ce sprint** : apres 3 mois de PvE en prod, si les KPI sont
atteints (cf. `SPRINT-pve-bot-mvp.md` section KPI). Sinon, **iterer sur le
PvE** (variantes, tournois solo, nouvelles personnalites) avant d'attaquer la
Pro League.

## Contexte (rappel)

Trois constats produit :

1. **Trou de marche BB** : aucun produit (Cyanide BB3, FUMBBL, NAF) ne propose
   un format "saison reguliere round-robin permanente" type Ligue 1 / NFL.
2. **Audience superieure aux coachs** : sur les jeux a succes (FM, Hattrick,
   MPG), les fans/spectateurs sont 3x plus nombreux que les managers actifs.
3. **Engagement async manquant** : entre deux matchs PvP, le coach n'a rien a
   suivre, rien a anticiper, pas de second-screen.

Ce sprint cree un **championnat virtuel "Old World League"** de 16 equipes
gerees par le systeme, dont les matchs se simulent automatiquement via le
sim-engine et se diffusent en direct le mardi 21h. Les utilisateurs
**parient en Crowns**, gagnent des badges, suivent leur equipe favorite,
lisent une Gazette quotidienne generee par LLM.

**Inspirations produit** : MPG (mecaniques d'enjeu hebdo, communaute),
Hattrick (rendez-vous social fixe), Football Manager (live ticker + narratif),
ESPN/Sorare (cartes joueurs + scoring auto). **Inspiration narrative** : NFL
(homages reconnaissables sans utiliser les marques), univers Games Workshop
(Blood Bowl, Spike Magazine, Nuffle).

## Vision MVP

| Element | MVP |
|---------|-----|
| **Championnat** | 1 seule "Old World League", 16 equipes IA, 1 saison de 15 journees |
| **Equipes** | Rosters fixes pre-construits, hommages NFL × races BB |
| **Calendrier** | Round-robin simple, 2 matchs/semaine, mardi 21h heure serveur |
| **Sim** | **Reuse sim-engine livre** (driver hybride, 16 profils, variance, Nuffle events) |
| **Diffusion** | "Live" SSE : sim pre-calculee T-24h via `simulateMatch`, events dispatched a l'heure reelle via `displayAtMs` |
| **Paris** | 1N2 + over/under TD + MVP du match + casualty count, en Crowns gagnees uniquement |
| **Crowns** | Monnaie 100% earned (jamais achetable, jamais cashable) |
| **Engagement** | Leaderboards parieurs hebdo/saison, badges/titres, mode spectateur/fan, Nuffle Gazette LLM quotidienne |
| **Casualties** | Identite BB preservee : MNG / niggling / -stat / DEAD persistants. Hall of Fame light pour les stars retires/morts |

## Hors scope (consigne backlog)

Tout ce qui suit est documente dans
[`docs/roadmap/backlog/future-ideas.md`](../backlog/future-ideas.md) :

- Couche MPG-style (mercato, drafts, lineups, capitaine, ligues privees)
- Multi-leagues (Old World League #2, Gridiron League foot US flavored)
- Cross-over PvP (prets joueurs, XP partagee)
- Weather sync IRL, NFL Twin Mirror, Twitch auto-cast
- Pep Talk push, conferences de presse interactives
- Promotion/relegation pyramidale (necessite >= 2 ligues)

## Decoupage en lots

| Lot | Theme | Objectif livrable | Estimation |
|-----|-------|-------------------|------------|
| **A** | Data model + scheduler + sim runner | Modeles Prisma, scheduler saison, cron pre-sim | ~1 sem |
| **B** | Live broadcaster SSE | Diffusion live mardi 21h, replay Pixi spectate | ~1 sem |
| **C** | UI Pro League + spectator/fan | Pages hub/equipes/match/standings, mode "Suivre equipe" | ~1 sem |
| **D** | Systeme de paris + economie Crowns | Wallet, markets, settlement, leaderboards, badges | ~1.5 sem |
| **E** | Nuffle Gazette + casualties + HoF light | LLM generation, storylines, casualties persistantes, HoF | ~1 sem |
| **F** | E2E + go-live | Tests, beta fermee, monitoring, page marketing | ~0.5 sem |

## Taches

### Lot A — Data model + scheduler + sim runner (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| A.1 | Modeles Prisma Pro League | DB | L | [ ] | `ProLeague`, `ProTeam`, `ProTeamRoster` (joueurs avec stats / forme / status), `ProLeagueSeason`, `ProLeagueRound`, `ProLeagueMatch` (status, scheduledAt, seed, engineVer, replayId), `ProLeagueStandings`. Migration + seed des 16 equipes initiales. |
| A.2 | Modele `Replay` + storage events | DB | M | [ ] | `Replay {matchId @id, payload Bytes, highlights Json, durationMs}`. Compression CBOR + gzip. Migration. Helper `compressEvents/decompressEvents` cote sim-engine consumer. |
| A.3 | Service `pro-league-scheduler.ts` | Backend | M | [ ] | Au demarrage de saison, genere round-robin (15 journees, 8 matchs/round = 120 matchs/saison sur 15 semaines). Persiste `ProLeagueRound[]` + `ProLeagueMatch[]` avec `scheduledAt` mardi 21h. Idempotent. |
| A.4 | Service `sim-runner.ts` (in-process) | Backend | M | [ ] | Cron T-24h qui pre-simule tous les matchs de la prochaine journee via `simEngine.simulateMatch`. Stocke `Replay.payload` + `ProLeagueMatch.result`. Pas de worker dedie au MVP — execution dans `apps/server` via `node-cron`. Preserve interface pour migration BullMQ future. |
| A.5 | Versionning IA + freeze replays | Backend | S | [ ] | `engineVer` (recupere depuis `simEngine`) stocke sur chaque match + replay. Replays anciens = read-only. Si simulation fail, fallback sur engine version pinnee. |

### Lot B — Live broadcaster SSE (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| B.1 | Service `match-broadcaster.ts` | Backend | M | [ ] | A `scheduledAt`, charge `Replay.payload`, dispatch les events via `EventEmitter` interne (ou Redis pub/sub si dispo) selon leur `displayAtMs`. Catch-up pour spectateurs en retard : leur envoie les events deja passes en bloc puis tail live. |
| B.2 | Endpoint SSE `/pro-league/matches/:id/stream` | API | M | [ ] | Route SSE qui consomme le broadcaster. Heartbeat 30s. Reconnection-friendly (Last-Event-ID). Retourne le replay complet en oneshot si le match est `done`. |
| B.3 | Mode spectate Pixi reutilise | Frontend | L | [ ] | Reutilise renderer PvP existant en mode read-only : consomme l'`EventSource`, anime le terrain selon les events. Couche `<TickerFeed/>` React au-dessus. Skip / x2 / x4 / "go to halftime". |
| B.4 | Ticker textuel mobile-friendly | Frontend | M | [ ] | Vue alternative pure texte pour mobile/low-bandwidth : timeline scrollable, badges TD/CAS/NUFFLE, score en sticky header. Auto-refresh sur SSE. |

### Lot C — UI Pro League + spectator/fan (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| C.1 | Page `/pro-league` (hub) | Frontend | M | [ ] | Saison en cours, journee N, prochains matchs avec compte a rebours T-21h mardi, classement live, liens fiches equipes. Header avec branding "Old World League". |
| C.2 | Page `/pro-league/teams/:slug` | Frontend | M | [ ] | Roster avec stats + forme, calendrier, historique matchs, joueurs en HoF, fans count, identite NFL homage (couleurs, devise). |
| C.3 | Page `/pro-league/matches/:id` | Frontend | M | [ ] | Pre-match : odds, lineups, hype meter. Live : Pixi spectate + ticker + chat fans. Post-match : resume, MVP, casualties, highlights, replay. |
| C.4 | Mode "Suivre cette equipe" (fan) | Frontend + Backend | M | [ ] | Modele `SpectatorFollow {userId, proTeamId, since}`. Bouton "Suivre" sur fiche equipe. Newsfeed perso `/pro-league/feed` avec actus des equipes suivies. Reset hebdo notifications. |
| C.5 | Page `/pro-league/standings` | Frontend | S | [ ] | Classement detaille : V/N/D, points, TD+/-, casualties, forme 5 derniers, badges. |

### Lot D — Systeme de paris + economie Crowns (~1.5 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| D.1 | Modeles Prisma `Wallet`, `Transaction` | DB | M | [ ] | `Wallet {userId @id, crowns Int}` + `Transaction {id, walletId, type enum(BET / WIN / REWARD / DAILY / BADGE), amount Int, ref, createdAt}`. Reuse en V2 (mercato). Service `wallet.ts` avec helpers atomiques (`debit`, `credit`, `transfer`). |
| D.2 | Modeles `BetMarket`, `Bet`, `BetSettlement` | DB | M | [ ] | `BetMarket {matchId, type enum(1N2 / OVER_UNDER_TD / MVP / CAS_COUNT / NUFFLE_OCCURS), config Json, status, closesAt}`. `Bet {id, userId, marketId, selection, stake, oddsAtPlace, status, payoutAmount?}`. `BetSettlement` audit. |
| D.3 | Calcul cotes dynamique | Backend | L | [ ] | Service `odds-calculator.ts` qui pre-simule N=200 matchs (sample du `engineVer` actuel, via `simEngine.simulateMatch`) pour estimer probas, applique marge maison 5%, expose cotes via API. Re-calcul au pre-match si line-up change. Stocke `oddsAtPlace` au moment du pari pour fairness. |
| D.4 | Endpoints paris | API | M | [ ] | `GET /pro-league/matches/:id/markets` (liste markets ouverts), `POST /pro-league/bets` (placer pari : valide market open, debit wallet), `GET /me/bets` (historique). Idempotence cle `clientToken`. |
| D.5 | Settlement automatique | Backend | M | [ ] | Hook post-match : pour chaque `BetMarket` du match, evalue le `result`, met `Bet.status` a `won`/`lost`, credit le wallet pour les gagnes. Idempotent (flag `BetMarket.settled`). |
| D.6 | Daily login bonus + sources de Crowns | Backend | S | [ ] | Daily : 50 Crowns / login (max 1/24h). First-time bonus : 1000 Crowns. Pas d'achat IRL. Ratelimite. |
| D.7 | UI paris | Frontend | L | [ ] | Composants `<BetSlip/>` (panier), `<MarketsList/>` sur page match, `<MyBets/>` sur dashboard. Confirmation modale, animations win/lose. Mobile-first. |
| D.8 | Leaderboards parieurs | Frontend + Backend | M | [ ] | Vues : `/pro-league/leaderboard?period=weekly|season|all-time`. Metriques : profit Crowns, accuracy %, longest streak, biggest win. Pagination. Recompenses hebdo (top 10 = badge + bonus Crowns). |
| D.9 | Badges/titres | Backend + Content | M | [ ] | `Badge {code, name, description, criteria Json}`, `UserBadge {userId, badgeCode, earnedAt}`. Catalogue : "Oracle of Nuffle" (10 pronos justes d'affilee), "Profit King" (top 1% gains saison), "Blood Reader" (90%+ accuracy prop bets violents), "Underdog Whisperer" (5 paris cote >= 5 gagnes), "First Kickoff" (1er pari saison), "Loyal Fan" (suivi 1 equipe 30j). UI sur profil. Reutilise infra achievements PvE (cf. `SPRINT-pve-bot-mvp` Lot C.3). |

### Lot E — Nuffle Gazette + casualties + HoF light (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| E.1 | Service `nuffle-gazette.ts` (LLM Claude Haiku) | Backend + Content | L | [ ] | Cron quotidien 8h : pour chaque journee jouee, genere 1 article principal (resume saison J-1) + 3 breves (transferts/blessures/dramas) + 1 edito signe par 1 des 3 personas IA recurrents (le cynique, l'enthousiaste orc, le statisticien). Prompt template avec context = events du jour + standings + storylines actives. Cache prompts (ratio 70%) pour optimiser cout. Stocke en `GazetteArticle`. |
| E.2 | Modele `GazetteArticle` + UI | DB + Frontend | M | [ ] | `GazetteArticle {id, date, persona, type enum(MAIN / BREVE / EDITO), title, body, relatedTeamIds, relatedPlayerIds}`. Page `/nuffle-gazette` (latest), `/nuffle-gazette/:date` (archive). Cards partageables (OG image generee). |
| E.3 | Detection storylines automatique | Backend | M | [ ] | Service `storyline-detector.ts` post-match : detecte rivalites (3 matchs serres entre A et B), retours (joueur revenu de blessure), records, defaites surprises. Output `Storyline {type, weight, refs}` consomme par la Gazette. |
| E.4 | Casualties persistantes | Backend | M | [ ] | `ProTeamRoster` integre permanent injuries : `dead bool, niggling int, maReduction, stReduction, etc.`. Apres chaque match, post-process applique les casualties. Joueur DEAD = retire roster + entree HoF si carriere notable. |
| E.5 | Hall of Fame light | Backend + Frontend | M | [ ] | `HallOfFameEntry {playerId, teamId, careerStats, retiredAt, cause enum(DEATH / RETIREMENT / INJURY)}`. Page `/pro-league/hall-of-fame` avec filtres. Critere d'entree : >= 30 TD ou >= 15 cas ou MVP de saison. |
| E.6 | Rookie pipeline (remplacement morts) | Backend | M | [ ] | Si une equipe perd >= 1 joueur (DEAD/MNG longue duree), draft d'urgence d'un rookie genere proceduralement (nom, stats baseline, potentiel). Annonce dans la Gazette. |

### Lot F — E2E + go-live (~0.5 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| F.1 | Tests E2E Playwright "saison Pro League" | Tests | M | [ ] | Scenario : creation saison admin → cron sim T-24h → broadcaster live (mock T+0 accelere) → user place bet → match settle → wallet credite → badge eventuel debloque → article Gazette publie. Garde-fou anti-regression. |
| F.2 | Beta fermee 50 testeurs | Process | M | [ ] | Recrutement Discord communaute BB. Feedback structure (form + Discord channel). 2 saisons completes en accelerated mode (1 journee/jour au lieu de 1/sem) pour valider boucle complete en 2 semaines reelles. |
| F.3 | Monitoring + alerting prod | DevOps | M | [ ] | Sentry sur sim-runner / broadcaster / settlement. Dashboard Grafana : matchs simules/jour, paris places, Crowns en circulation, taux d'erreur, latence broadcaster. Alerte si match `FAILED` ou settlement bloque. |
| F.4 | Page marketing `/pro-league/about` | Frontend + Marketing | S | [ ] | Pitch produit, calendrier saison, regles paris (no real money, no cashout), FAQ. SEO ready. |

## Mapping 16 equipes Pro League (homages NFL × races BB)

> **Statut juridique** : aucun nom, logo ou marque NFL n'est utilise. Les
> equipes sont des **clins d'oeil** identifiables par les fans (ville, couleurs,
> archetype) sans citation directe.

| # | Ville | Nom propose | Race BB | Identite tactique | NFL inspiration |
|---|-------|-------------|---------|-------------------|----------------|
| 1 | Pittsburgh | Smashers | Orcs | Bash 85, pace measured | Steelers (blue collar, defense brutale) |
| 2 | Dallas | Vipers | Dark Elves | Risk 70, agility 85 | Cowboys (richesse, prima donnas, etoile) |
| 3 | Kansas City | Soaring Hawks | Wood Elves | Passing 80, risk 75 | Chiefs (jeu aerien, Mahomes-flavored) |
| 4 | New England | Cold Tacticians | Lizardmen | Discipline 90, methodique | Patriots (froid, dynastie) |
| 5 | San Francisco | Gold Rush | Skaven | Speed 95, gunslinger | 49ers (scrappy, west coast) |
| 6 | Carolina | Jungle Queens | Amazons | Defense 80, tribal | Panthers (jungle, agressif) |
| 7 | Las Vegas | Outlaws | Norse | Brutal 80, hors-la-loi | Raiders (pirate, noir/argent) |
| 8 | New Orleans | Voodoo Saints | Undead | Necro 75, slow grind | Saints (Big Easy, voodoo) |
| 9 | Chicago | Iron Bears | Dwarves | Tank 90, smashmouth | Bears (rugged) |
| 10 | Philadelphia | Storm Eagles | Pro Elves | Balance 70 | Eagles (Philly, flying) |
| 11 | Phoenix | Tomb Cardinals | Tomb Kings (Khemri) | Slow 95, undead | Cardinals (desert) |
| 12 | Minneapolis | Frostraiders | Norse alt | Raid heavy | Vikings (purple, raids) |
| 13 | Green Bay | Cheese Halflings | Halflings | Underdog 100 | Packers (cheese-head, ouvriers) |
| 14 | Jacksonville | Swamp Lizards | Lizardmen alt | Variant Lizard | Jaguars (Florida jungle) |
| 15 | Denver | Mile High Centaurs | Beastmen / Chaos | Wild West, raids | Broncos (mile high, wild) |
| 16 | Buffalo | Snow Ogres | Ogres | Brutal 95, snow mastery | Bills (Buffalo snow, blue collar) |

> Les profils tactiques de ces equipes seront **derives des profils raciaux
> du sim-engine** (livres en Lot B.3). Couleurs, devises, lore courte, blasons
> originaux a produire en parallele du dev par l'agent design / illustrateur
> communautaire.

## Architecture technique synthese

### Backend
```
apps/server/src/
  services/
    pro-league-scheduler.ts   # generation calendrier saison
    sim-runner.ts              # cron T-24h pre-simulation
                               # consomme simEngine.simulateMatch
    match-broadcaster.ts       # diffusion live SSE
    odds-calculator.ts         # pre-sim 200 matchs pour cotes
    bet-settlement.ts          # post-match auto settlement
    nuffle-gazette.ts          # cron quotidien LLM
    storyline-detector.ts      # detection rivalites/dramas
    wallet.ts                  # debit/credit/transfer atomique
  routes/
    pro-league.ts              # standings, matches, teams
    pro-league-bets.ts         # markets, place, history
    nuffle-gazette.ts          # articles
  jobs/
    pro-league-sim-runner.ts   # cron T-24h
    nuffle-gazette-daily.ts    # cron 8h
```

### Frontend
```
apps/web/app/pro-league/
  page.tsx                     # hub
  teams/[slug]/page.tsx
  matches/[id]/page.tsx        # spectate live + ticker + paris
  standings/page.tsx
  leaderboard/page.tsx
  hall-of-fame/page.tsx
  feed/page.tsx                # newsfeed fan
apps/web/app/nuffle-gazette/
  page.tsx
  [date]/page.tsx
apps/web/components/pro-league/
  TickerFeed.tsx
  BetSlip.tsx
  MarketsList.tsx
  TeamCard.tsx
```

### Diffusion live (sequencement)
```
T-24h    sim-runner cron    -> simulate match (~2s) -> store Replay
T-2h     match-broadcaster prepares -> load Replay events in memory
T-0      kickoff            -> dispatch events via SSE according to displayAtMs
T+90min  match end          -> trigger settlement -> credit Crowns -> generate Gazette feed
T+8h     nuffle-gazette cron-> publish daily articles
```

## Definition of done

- [ ] Une saison Pro League peut etre creee, calendrier genere, matchs joues automatiquement.
- [ ] Diffusion live SSE fonctionnelle un mardi 21h reel sur >= 100 spectateurs simultanes.
- [ ] User peut placer un pari sur un match a venir, settlement automatique post-match, wallet credite.
- [ ] >= 6 markets de pari ouverts par match (1N2, O/U TD, MVP, CAS count, NUFFLE occurs, double chance).
- [ ] Leaderboards parieurs hebdo + saison + all-time fonctionnels avec >= 6 badges debloquables.
- [ ] Mode "Suivre une equipe" avec newsfeed fonctionnel.
- [ ] Nuffle Gazette publie automatiquement >= 5 articles/jour pendant 7j consecutifs.
- [ ] Casualties persistantes appliquees au roster, joueurs DEAD remplaces par rookies.
- [ ] Hall of Fame light avec >= 5 entrees apres 1 saison.
- [ ] Tests E2E Playwright "saison complete" passent.
- [ ] Beta fermee 50 testeurs validee (NPS >= 30).

## Dependances & risques

### Dependances
- **`SPRINT-sim-engine.md` livre et gate passe** : ce sprint reutilise `simEngine.simulateMatch`, profils tactiques, variance, Nuffle events. Aucune evolution breaking pendant ce sprint.
- **`SPRINT-pve-bot-mvp.md` livre et KPI 3 mois atteints** : valide la traction utilisateur avant d'investir.
- **SPRINT Ligues v2 livre** : reutilise certains concepts `LeagueSeason`, `LeagueRound` etendus en `ProLeagueSeason`/`ProLeagueRound`.
- **Anthropic API key** : pour Nuffle Gazette (Claude Haiku 4.5). Cout estime `<5 €/mois` sur MVP (1 ligue, ~30 articles/jour).

### Risques

- **Statut juridique homages NFL** : un usage trop appuye (logos, noms officiels) declenche cease-and-desist NFL. **Mitigation** : noms et blasons originaux uniquement, ville + couleurs OK (faits), aucun logo/marque NFL en assets, validation legale avant beta publique. Fallback : retirer toute reference NFL et garder seulement les villes US / l'esprit "foot americain".
- **Cout LLM** : sur 1 ligue MVP, ~5 €/mois. Si scale soudain (multi-leagues backlog) : surveille via dashboard + hard limit Anthropic. **Mitigation** : prompt caching active, batch API si non-urgent.
- **Engagement reel insuffisant** : si <20 utilisateurs places paris regulierement apres 1 mois, le mode est un echec. **Mitigation** : beta fermee 50 testeurs avant go-live, NPS >= 30 requis pour go-live public, daily bonus + first-time grace pour onboarding.
- **Live SSE scaling** : si finale attire 1000+ spectateurs simultanes, `apps/server` peut saturer. **Mitigation MVP** : single instance suffit pour <500 ; au-dela, basculer vers Redis pub/sub. Pas urgent au MVP.
- **Casualties dramatiques** : un joueur "favori" qui meurt cree frustration. **Mitigation** : DEAD reste rare (~1-2/saison sur 16 equipes), Hall of Fame transforme la mort en hommage, rookie pipeline donne immediatement un remplacant narratif.
- **Drift sim-engine** : si le sim-engine evolue entre la livraison de ce sprint et la fin d'une saison Pro League, les replays peuvent diverger. **Mitigation** : `engineVer` strict, replays anciens read-only, freeze des matchs joues.

## Migration / data

- 3 migrations Prisma sequentielles :
  1. **PR1.A.1** : `ProLeague`, `ProTeam`, `ProTeamRoster`, `ProLeagueSeason`, `ProLeagueRound`, `ProLeagueMatch`, `Replay`, `ProLeagueStandings`. Seed 16 equipes initiales.
  2. **PR1.D.1** : `Wallet`, `Transaction`, `BetMarket`, `Bet`, `BetSettlement`. Init wallet pour tous les users existants avec 0 Crowns (ou les Crowns deja distribuees via achievements PvE si pertinent).
  3. **PR1.E.2** : `GazetteArticle`, `Storyline`, `HallOfFameEntry`, `Badge`, `UserBadge`, `SpectatorFollow`, `PlayerForm`.
- **Seeder etendu** : ajouter les 16 equipes Pro League en seed `seed/pro-league/teams.json` avec rosters complets pre-construits.

## Ordre de livraison recommande

| PR | Lots | Description | Estim |
|----|------|-------------|-------|
| **PR1** | A.1-A.5 | Modeles Prisma + scheduler + sim-runner + replay storage | ~1 sem |
| **PR2** | B.1-B.4 | Broadcaster live SSE + spectate Pixi + ticker mobile | ~1 sem |
| **PR3** | C.1-C.5 | UI Pro League (hub, teams, matches, standings, follow) | ~1 sem |
| **PR4** | D.1-D.9 | Wallet + paris MVP + cotes + leaderboards + badges | ~1.5 sem |
| **PR5** | E.1-E.6 | Nuffle Gazette LLM + storylines + casualties + HoF + rookies | ~1 sem |
| **PR6** | F.1-F.4 | E2E + monitoring + page marketing + beta fermee | ~0.5 sem |
| **GO-LIVE** | — | Saison 1 kickoff (date a definir selon trajectoire PvE) | — |

## Sources

- Audit produit + architecture conduit le 2026-05-05 par 5 agents en parallele.
- Inspirations produit : MPG (Mon Petit Gazon), Hattrick, Football Manager, OOTP Baseball, Sorare, NFL Fantasy.
- Donnees BB : FUMBBL stats publiques, NAF tournament data, regles officielles Saison 2/3.
- [`SPRINT-sim-engine.md`](./SPRINT-sim-engine.md) : sprint amont fournisseur de la sim.
- [`SPRINT-pve-bot-mvp.md`](./SPRINT-pve-bot-mvp.md) : sprint amont qui valide la traction avant d'attaquer celui-ci.
- [`docs/roadmap/backlog/future-ideas.md`](../backlog/future-ideas.md) : items differes (mercato MPG-layer, multi-leagues, weather sync, etc.).
