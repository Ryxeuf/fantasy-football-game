# SPRINT Pro League — Championnat virtuel Blood Bowl + Paris MVP

> Statut : A faire (P1, demarre apres SPRINT Ligues v2)
> Duree cible : ~12 semaines (Phase 0 = 8 sem bloquant, Phase 1 = 4 sem MVP)
> Theme : creer un championnat IA vs IA permanent (16 equipes hommages NFL),
> matchs auto diffuses "live" le mardi 21h, paris en monnaie virtuelle (Crowns),
> mode spectateur/fan, narratif quotidien (Nuffle Gazette LLM).
> Pre-requis : SPRINT Ligues v2 livre (reutilise infra LeagueSeason / standings).

## Contexte

Aujourd'hui Nuffle Arena propose **uniquement du PvP synchrone** (matchs joues
en personne). Trois constats :

1. **Trou de marche BB** : aucun produit (Cyanide BB3, FUMBBL, NAF) ne propose
   un format "saison reguliere round-robin permanente" type Ligue 1 / NFL. Tous
   les tournois officiels sont en elimination directe ou Swiss.
2. **Engagement async manquant** : entre deux matchs PvP, le coach n'a rien a
   suivre, rien a anticiper, pas de second-screen.
3. **Audience superieure aux coachs** : sur les jeux a succes (FM, Hattrick,
   MPG), les fans/spectateurs sont 3x plus nombreux que les managers actifs.

Ce sprint cree un **championnat virtuel "Old World League"** de 16 equipes
gerees par le systeme, dont les matchs se simulent automatiquement et se
diffusent en direct le mardi 21h. Les utilisateurs **parient en Crowns**, gagnent
des badges, suivent leur equipe favorite, lisent une Gazette quotidienne
generee par LLM.

**Inspirations produit** : MPG (mecaniques d'enjeu hebdo, communaute), Hattrick
(rendez-vous social fixe), Football Manager (live ticker + narratif),
ESPN/Sorare (cartes joueurs + scoring auto). **Inspiration narrative** : NFL
(homages reconnaissables sans utiliser les marques), univers Games Workshop
(Blood Bowl, Spike Magazine, Nuffle).

**Objectif strategique** : prouver l'engagement d'un mode async avant
d'engager la complexite d'une couche fantasy/mercato (consignee en backlog,
voir [`docs/roadmap/backlog/future-ideas.md`](../backlog/future-ideas.md)).

## Vision MVP

| Element | MVP |
|---------|-----|
| **Championnat** | 1 seule "Old World League", 16 equipes IA, 1 saison de 15 journees |
| **Equipes** | Rosters fixes pre-construits, hommages NFL × races BB |
| **Calendrier** | Round-robin simple, 2 matchs/semaine, mardi 21h heure serveur |
| **Sim** | Hybride (drives haut niveau + key moments resolus par game-engine) |
| **Diffusion** | "Live" SSE : sim pre-calculee T-24h, events dispatched a l'heure reelle |
| **Paris** | 1N2 + over/under TD + MVP du match + casualty count, en Crowns gagnees uniquement |
| **Crowns** | Monnaie 100% earned (jamais achetable, jamais cashable) |
| **Engagement** | Leaderboards parieurs hebdo/saison, badges/titres, mode spectateur/fan, Nuffle Gazette LLM quotidienne |
| **Casualties** | Identite BB preservee : MNG / niggling / -stat / DEAD persistants. Hall of Fame light pour les stars retires/morts |

## Hors scope (consigne backlog)

Tout ce qui suit est documente dans
[`docs/roadmap/backlog/future-ideas.md`](../backlog/future-ideas.md) et **ne sera
pas attaque** tant que les KPI MVP (volume coachs actifs, retention 30j) ne
sont pas atteints :

- Couche MPG-style (mercato, drafts, lineups, capitaine, ligues privees)
- Multi-leagues (Old World League #2, Gridiron League foot US flavored)
- Cross-over PvP (prets joueurs, XP partagee)
- Weather sync IRL, NFL Twin Mirror, Twitch auto-cast
- Pep Talk push, conferences de presse interactives
- Promotion/relegation pyramidale (necessite >= 2 ligues)

## Decoupage en phases

| Phase | Theme | Objectif livrable | Duree |
|-------|-------|-------------------|-------|
| **0** | Sim Foundation (gate bloquant) | Sim engine credible + 16 profils tactiques + bench harness valide stat & humain | ~8 sem |
| **1** | MVP Pro League + Paris | Saison playable, diffusion live, paris MVP, Gazette, mode fan | ~4 sem |

**Gate Phase 0 → Phase 1** : si la validation humaine (panel BB experts) note
< 6.5/10 sur "lisibilite tactique" ou si les benchs statistiques devient de
> 10% des refs FUMBBL, **on n'attaque pas la Phase 1**. La Phase 0 boucle
jusqu'a passer le gate.

---

## Phase 0 — Sim Foundation (8 sem, BLOQUANT)

### Lot 0.A — Architecture sim engine (~2 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| 0.A.1 | Nouveau package `packages/sim-engine` | Backend | M | [x] | Workspace pnpm, build TS, depend de `packages/game-engine` (regles, dices, types). Interface publique : `simulateMatch(input: SimInput): SimResult`. Output : `{result, events: MatchEvent[], summary, casualties[], engineVer}`. |
| 0.A.2 | Driver hybride (drive-level + key moments) | Backend | L | [x] | Boucle haut niveau : kickoff → drive → resolution turn-by-turn des actions critiques (block, dodge, pass, turnover) via `game-engine` actions. Drives non-critiques resolus en proba (avancement yards + fumble chance). Garde la possibilite de basculer en `full` driver plus tard sans casser les events. |
| 0.A.3 | Format `MatchEvent` typé partage | Types | M | [x] | `packages/shared-types/match-event.ts` : enum `EventType` (KICKOFF / TURN_START / BLOCK / DODGE / PASS / TD / KO / CASUALTY / TURNOVER / NUFFLE / HALFTIME / END). Champs `displayAtMs` (offset depuis kickoff pour la diffusion live), `seed`, `meta`. Versionne via `engineVer`. |
| 0.A.4 | PRNG seede + injection partout | Backend | M | [x] | `packages/sim-engine/rng/seeded.ts` (xoroshiro). Banni `Math.random` du package via lint custom (`no-restricted-globals`). Tout consommateur recoit le PRNG en parametre. Permet replay deterministe + audit. |
| 0.A.5 | Resolvers actions BB | Backend | L | [x] | `resolvers/{block,dodge,pass,pickup,gfi,foul}.ts` consomment `game-engine` rules (skills, modifiers, weather) pour rester strict regle. Output : `{success, newState, events[]}`. Couverture par tests unitaires sur cas typiques + cas edge (skill stack, double-skull, etc.). |

### Lot 0.B — Profils tactiques 16 equipes (~2 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| 0.B.1 | Behavior tree + patterns library | Backend | XL | [x] | `ai/strategy/` (cage-build, breakaway, defensive-screen, blitz-train, stall, foul-fest), `ai/tactics/patterns/` (cage-formation, line-grind, pass-route-deep, wedge, screen). 3 passes par tour : evaluer situation → choisir strategie → executer pattern. Garantit coherence narrative des drives. |
| 0.B.2 | Type `TacticalProfile` + schema Zod | Types | S | [x] | ~15 parametres : bashIndex, passingFrequency, riskAppetite, cageAffinity, blitzPriority, reroll_usage, pace, foulFrequency, stallTendency, kickReturn, etc. Validation Zod cote sim-engine. Profile stocke en JSON sur `ProTeam.tactics`. |
| 0.B.3 | 16 profils raciaux pour les 16 equipes Pro League | Content | L | [x] | Mapping NFL × race BB (cf. tableau "Mapping 16 equipes" plus bas). Chaque profil parametre pour refleter l'identite : Pittsburgh Smashers (Orcs, bash 85, pace measured), Kansas City Soaring Hawks (Wood Elves, passing 75, risk 70), etc. Tunable. |
| 0.B.4 | Memoire partielle d'etat de match (momentum) | Backend | M | [x] | Forme par joueur : `hot` apres 2+ TD ou 3+ blocks reussis (+1 confiance temporaire), `cold` apres echecs en chaine. Memoire mensuelle visible publiquement. Alimente la Gazette et les paris. |
| 0.B.5 | Temperature IA (decisions sub-optimales controlees) | Backend | M | [x] | Au lieu de toujours prendre l'action max-EV, sample sur top-K avec poids dependant du profil (`riskAppetite` → temperature). Genere variance entre matchs identiques sur le papier. |

### Lot 0.C — Variance & Nuffle moments (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| 0.C.1 | Bibliotheque "Eye of Nuffle" events | Content + Backend | M | [ ] | ~25-30 events scriptes avec probabilites : rookie_brilliance (3%), crowd_riot (1%), sudden_inspiration (4%), weather_shift (5%), tantrum_star (2%), banana_skin (2%), bombardier_gone_wild (1%), nemesis_clash (3%), etc. Chacun emet un `MatchEvent` type `NUFFLE` annonce par le ticker. |
| 0.C.2 | Hooks injection Nuffle events | Backend | S | [ ] | Le driver hybride invoque le rolleur Nuffle a chaque debut de tour. Effets appliques au state via PRNG seede. Events stockes en DB pour replay et alimentation Gazette. |
| 0.C.3 | Boost variance underdog (subtil) | Backend | S | [ ] | Si TV gap > 200 ou pre-match win prob < 15%, +10% sur les rolls critiques cote underdog. Non visible utilisateur. Cible : upset rate 12-18% (pas 5%). |
| 0.C.4 | Streaks/forme cross-match | Backend | S | [ ] | Persiste `PlayerForm` (hot/normal/cold) entre matchs. Decay sur 3 matchs. Visible sur la fiche joueur publique. |

### Lot 0.D — Bench harness (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| 0.D.1 | CLI `pnpm sim:bench` | DevX | M | [ ] | Script `packages/sim-engine/scripts/bench.ts` : `--team=A vs --team=B --runs=10000` simule en parallele worker_threads, sort un rapport stat (TDs/match, casualties, turnovers, win%, std dev, p5/p95). Optionnel `--matrix` pour toutes les races. |
| 0.D.2 | Dataset reference FUMBBL | Data | M | [ ] | Scraper / import statique des stats publiques FUMBBL : winrates par race, casualty rates, TD averages, durees de drive. Stocke en `packages/sim-engine/bench/reference-fumbbl.json` versionne. |
| 0.D.3 | Metriques "vivacite" (variance & outliers) | DevX | S | [ ] | Au-dela des moyennes : std dev, fat-tails (% matchs avec >= 5 TD, >= 4 casualties), upset rate, distribution MVP (Gini coefficient). Cible MVP : std dev TD >= 1.4, upset rate 12-18%, MVP non concentre uniquement sur stars. |
| 0.D.4 | CI regression `sim-bench` | DevX | M | [ ] | `.github/workflows/sim-bench.yml` : sur chaque PR touchant `packages/sim-engine`, run `--runs=5000` vs `bench-baseline.json`. Alerte si deviation > 5% sur metriques cles. Baseline versionne avec `engineVer`. |

### Lot 0.E — Tuning loop + Human playtest gate (~2 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| 0.E.1 | Iteration tuning profils | Tuning | XL | [ ] | Boucle : run bench → identifier deltas vs FUMBBL (>10%) → ajuster profils (bashIndex, riskAppetite, etc.) → re-run. Objectif : tous les matchups raciaux dans ±10% du winrate FUMBBL. Documenter ajustements dans `packages/sim-engine/CHANGELOG.md`. |
| 0.E.2 | Replay sampling tool | DevX | M | [ ] | Script `pnpm sim:replay --random=50` qui sort 50 matchs aleatoires en format lisible (txt narratif + lien web Pixi spectate). Pour panel humain. |
| 0.E.3 | Panel BB experts (5 testeurs) | Process | M | [ ] | Recruter 5 testeurs BB experts (FUMBBL veterans, NAF coaches, communaute). Leur fournir 50 replays aleatoires + grille notation 0-10 sur : lisibilite tactique, coherence drives, identite raciale, moments memorables. Cible >= 7/10 moyenne. |
| 0.E.4 | Gate decision documentee | Process | S | [ ] | Document `docs/roadmap/sprints/pro-league-gate.md` : metriques stat finales, scores humains, deltas residuels, GO/NO-GO motive. Si NO-GO, retour en Lot 0.E.1 avec plan d'amelioration. |

---

## Phase 1 — MVP Pro League + Paris (4 sem)

### Lot 1.A — Data model + scheduler + sim runner (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| 1.A.1 | Modeles Prisma Pro League | DB | L | [ ] | `ProLeague`, `ProTeam`, `ProTeamRoster` (joueurs avec stats / forme / status), `ProLeagueSeason`, `ProLeagueRound`, `ProLeagueMatch` (status, scheduledAt, seed, engineVer, replayId), `ProLeagueStandings`. Migration + seed des 16 equipes initiales. |
| 1.A.2 | Modele `Replay` + storage events | DB | M | [ ] | `Replay {matchId @id, payload Bytes, highlights Json, durationMs}`. Compression CBOR + gzip. Migration. Helper `compressEvents/decompressEvents` dans sim-engine. |
| 1.A.3 | Service `pro-league-scheduler.ts` | Backend | M | [ ] | Au demarrage de saison, genere round-robin (15 journees, 2 matchs/round, soit 16 equipes / 2 = 8 matchs/round, ajuste : pour 16 eq round-robin classique = 15 rounds × 8 matchs = 120 matchs/saison sur 15 semaines). Persiste `ProLeagueRound[]` + `ProLeagueMatch[]` avec `scheduledAt` mardi 21h. Idempotent. |
| 1.A.4 | Service `sim-runner.ts` (in-process) | Backend | M | [ ] | Cron T-24h qui pre-simule tous les matchs de la prochaine journee. Stocke `Replay.payload` + `ProLeagueMatch.result`. Pas de worker dedie au MVP — execution dans `apps/server` via `node-cron` ou setInterval simple. Preserve interface pour migration BullMQ future. |
| 1.A.5 | Versionning IA + freeze replays | Backend | S | [ ] | `engineVer` stocke sur chaque match + replay. Replays anciens = read-only. Si simulation fail, fallback sur engine version pinnee. |

### Lot 1.B — Live broadcaster SSE (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| 1.B.1 | Service `match-broadcaster.ts` | Backend | M | [ ] | A `scheduledAt`, charge `Replay.payload`, dispatch les events via `EventEmitter` interne (ou Redis pub/sub si dispo) selon leur `displayAtMs`. Catch-up pour spectateurs en retard : leur envoie les events deja passes en bloc puis tail live. |
| 1.B.2 | Endpoint SSE `/pro-league/matches/:id/stream` | API | M | [ ] | Route SSE qui consomme le broadcaster. Heartbeat 30s. Reconnection-friendly (Last-Event-ID). Retourne le replay complet en oneshot si le match est `done`. |
| 1.B.3 | Mode spectate Pixi reutilise | Frontend | L | [ ] | Reutilise renderer PvP existant en mode read-only : consomme l'`EventSource`, anime le terrain selon les events. Couche `<TickerFeed/>` React au-dessus. Skip / x2 / x4 / "go to halftime". |
| 1.B.4 | Ticker textuel mobile-friendly | Frontend | M | [ ] | Vue alternative pure texte pour mobile/low-bandwidth : timeline scrollable, badges TD/CAS/NUFFLE, score en sticky header. Auto-refresh sur SSE. |

### Lot 1.C — UI Pro League + spectator/fan (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| 1.C.1 | Page `/pro-league` (hub) | Frontend | M | [ ] | Saison en cours, journee N, prochains matchs avec compte a rebours T-21h mardi, classement live, liens fiches equipes. Header avec branding "Old World League". |
| 1.C.2 | Page `/pro-league/teams/:slug` | Frontend | M | [ ] | Roster avec stats + forme, calendrier, historique matchs, joueurs en HoF, fans count, identite NFL homage (couleurs, devise). |
| 1.C.3 | Page `/pro-league/matches/:id` | Frontend | M | [ ] | Pre-match : odds, lineups, hype meter. Live : Pixi spectate + ticker + chat fans. Post-match : resume, MVP, casualties, highlights, replay. |
| 1.C.4 | Mode "Suivre cette equipe" (fan) | Frontend + Backend | M | [ ] | Modele `SpectatorFollow {userId, proTeamId, since}`. Bouton "Suivre" sur fiche equipe. Newsfeed perso `/pro-league/feed` avec actus des equipes suivies. Reset hebdo notifications. |
| 1.C.5 | Page `/pro-league/standings` | Frontend | S | [ ] | Classement detaille : V/N/D, points, TD+/-, casualties, forme 5 derniers, badges. |

### Lot 1.D — Systeme de paris + economie Crowns (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| 1.D.1 | Modeles Prisma `Wallet`, `Transaction` | DB | M | [ ] | `Wallet {userId @id, crowns Int}` + `Transaction {id, walletId, type enum(BET / WIN / REWARD / DAILY / BADGE), amount Int, ref, createdAt}`. Reuse en Phase 2 (mercato). Service `wallet.ts` avec helpers atomiques (`debit`, `credit`, `transfer`). |
| 1.D.2 | Modeles `BetMarket`, `Bet`, `BetSettlement` | DB | M | [ ] | `BetMarket {matchId, type enum(1N2 / OVER_UNDER_TD / MVP / CAS_COUNT / NUFFLE_OCCURS), config Json, status, closesAt}`. `Bet {id, userId, marketId, selection, stake, oddsAtPlace, status, payoutAmount?}`. `BetSettlement` audit. |
| 1.D.3 | Calcul cotes dynamique | Backend | L | [ ] | Service `odds-calculator.ts` qui pre-simule N=200 matchs (sample du `engineVer` actuel) pour estimer probas, applique marge maison 5%, expose cotes via API. Re-calcul au pre-match si line-up change. Stocke `oddsAtPlace` au moment du pari pour fairness. |
| 1.D.4 | Endpoints paris | API | M | [ ] | `GET /pro-league/matches/:id/markets` (liste markets ouverts), `POST /pro-league/bets` (placer pari : valide market open, debit wallet), `GET /me/bets` (historique). Idempotence cle `clientToken`. |
| 1.D.5 | Settlement automatique | Backend | M | [ ] | Hook post-match : pour chaque `BetMarket` du match, evalue le `result`, met `Bet.status` a `won`/`lost`, credit le wallet pour les gagnes. Idempotent (flag `BetMarket.settled`). |
| 1.D.6 | Daily login bonus + sources de Crowns | Backend | S | [ ] | Daily : 50 Crowns / login (max 1/24h). First-time bonus : 1000 Crowns. Pas d'achat IRL. Ratelimite. |
| 1.D.7 | UI paris | Frontend | L | [ ] | Composants `<BetSlip/>` (panier), `<MarketsList/>` sur page match, `<MyBets/>` sur dashboard. Confirmation modale, animations win/lose. Mobile-first. |
| 1.D.8 | Leaderboards parieurs | Frontend + Backend | M | [ ] | Vues : `/pro-league/leaderboard?period=weekly|season|all-time`. Metriques : profit Crowns, accuracy %, longest streak, biggest win. Pagination. Recompenses hebdo (top 10 = badge + bonus Crowns). |
| 1.D.9 | Badges/titres | Backend + Content | M | [ ] | `Badge {code, name, description, criteria Json}`, `UserBadge {userId, badgeCode, earnedAt}`. Catalogue MVP : "Oracle of Nuffle" (10 pronos justes d'affilee), "Profit King" (top 1% gains saison), "Blood Reader" (90%+ accuracy prop bets violents), "Underdog Whisperer" (5 paris cote >= 5 gagnes), "First Kickoff" (1er pari saison), "Loyal Fan" (suivi 1 equipe 30j). UI sur profil. |

### Lot 1.E — Nuffle Gazette + casualties + HoF light (~ inclus dans 4 sem) 

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| 1.E.1 | Service `nuffle-gazette.ts` (LLM Claude Haiku) | Backend + Content | L | [ ] | Cron quotidien 8h : pour chaque journee jouee, genere 1 article principal (resume saison J-1) + 3 breves (transferts/blessures/dramas) + 1 edito signe par 1 des 3 personas IA recurrents (le cynique, l'enthousiaste orc, le statisticien). Prompt template avec context = events du jour + standings + storylines actives. Cache prompts (ratio 70%) pour optimiser cout. Stocke en `GazetteArticle`. |
| 1.E.2 | Modele `GazetteArticle` + UI | DB + Frontend | M | [ ] | `GazetteArticle {id, date, persona, type enum(MAIN / BREVE / EDITO), title, body, relatedTeamIds, relatedPlayerIds}`. Page `/nuffle-gazette` (latest), `/nuffle-gazette/:date` (archive). Cards partageables (OG image generee). |
| 1.E.3 | Detection storylines automatique | Backend | M | [ ] | Service `storyline-detector.ts` post-match : detecte rivalites (3 matchs serres entre A et B), retours (joueur revenu de blessure), records, defaites surprises. Output `Storyline {type, weight, refs}` consomme par la Gazette. |
| 1.E.4 | Casualties persistantes | Backend | M | [ ] | `ProTeamRoster` integre permanent injuries : `dead bool, niggling int, maReduction, stReduction, etc.`. Apres chaque match, post-process applique les casualties. Joueur DEAD = retire roster + entree HoF si carriere notable. |
| 1.E.5 | Hall of Fame light | Backend + Frontend | M | [ ] | `HallOfFameEntry {playerId, teamId, careerStats, retiredAt, cause enum(DEATH / RETIREMENT / INJURY)}`. Page `/pro-league/hall-of-fame` avec filtres. Critere d'entree : >= 30 TD ou >= 15 cas ou MVP de saison. |
| 1.E.6 | Rookie pipeline (remplacement morts) | Backend | M | [ ] | Si une equipe perd >= 1 joueur (DEAD/MNG longue duree), draft d'urgence d'un rookie genere proceduralement (nom, stats baseline, potentiel). Annonce dans la Gazette. |

### Lot 1.F — E2E + go-live (~inclus)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| 1.F.1 | Tests E2E Playwright "saison Pro League" | Tests | M | [ ] | Scenario : creation saison admin → cron sim T-24h → broadcaster live (mock T+0 accelere) → user place bet → match settle → wallet credite → badge eventuel debloque → article Gazette publie. Garde-fou anti-regression. |
| 1.F.2 | Beta fermee 50 testeurs | Process | M | [ ] | Recrutement Discord communaute BB. Feedback structure (form + Discord channel). 2 saisons completes en accelerated mode (1 journee/jour au lieu de 1/sem) pour valider boucle complete en 2 semaines reelles. |
| 1.F.3 | Monitoring + alerting prod | DevOps | M | [ ] | Sentry sur sim-runner / broadcaster / settlement. Dashboard Grafana : matchs simules/jour, paris places, Crowns en circulation, taux d'erreur, latence broadcaster. Alerte si match `FAILED` ou settlement bloque. |
| 1.F.4 | Page marketing `/pro-league/about` | Frontend + Marketing | S | [ ] | Pitch produit, calendrier saison, regles paris (no real money, no cashout), FAQ. SEO ready. |

---

## Mapping 16 equipes Pro League (homages NFL × races BB)

> **Statut juridique** : aucun nom, logo ou marque NFL n'est utilise. Les
> equipes sont des **clins d'oeil** identifiables par les fans (ville, couleurs,
> archetype) sans citation directe. Cf. analyse legale en section "Risques".

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

> A iterer au Lot 0.B.3 (tuning des profils tactiques) et avant beta. Couleurs,
> devises, lore courte, blasons originaux a produire en parallele du dev par
> l'agent design / illustrateur communautaire.

---

## Architecture technique synthese

### Sim engine
```
packages/sim-engine/
  src/
    drivers/
      hybrid.ts          # MVP : drive-level + key moments resolus
      full.ts            # backlog : action-by-action (futur)
    resolvers/           # block, dodge, pass, gfi, foul (consomme game-engine)
    ai/
      strategy/          # cage-build, breakaway, defensive-screen, blitz-train
      tactics/patterns/  # cage-formation, line-grind, pass-route-deep
      profiles/          # 16 profils raciaux
    nuffle/              # bibliotheque events + injection
    rng/                 # PRNG seede (xoroshiro)
    events/              # MatchEvent emitter typed
  bench/
    reference-fumbbl.json
    bench-baseline.json
  scripts/
    bench.ts             # CLI benchmark
    replay.ts            # Sampling pour panel humain
```

### Backend
```
apps/server/src/
  services/
    pro-league-scheduler.ts   # generation calendrier saison
    sim-runner.ts              # cron T-24h pre-simulation
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

---

## Definition of done

### Phase 0 (gate bloquant)
- [ ] Bench stat : tous les matchups raciaux dans ±10% du winrate FUMBBL.
- [ ] Bench variance : std dev TD >= 1.4, upset rate 12-18%, % matchs >=5 TD entre 4-7%.
- [ ] Panel humain (5 testeurs BB experts) note moyenne >= 7/10 sur 50 replays.
- [ ] CI sim-bench passe sur baseline pinnee.
- [ ] Doc gate `pro-league-gate.md` publiee avec metriques + GO motive.

### Phase 1 (MVP)
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

---

## Calendrier aligne saison NFL 2026-27

| Periode | Activite Pro League |
|---------|---------------------|
| Mai-Juin 2026 | Phase 0 — sim foundation, profils, bench, gate |
| Juillet 2026 | Phase 1 dev (lots 1.A → 1.E) |
| Aout 2026 | Phase 1 finalisation, beta fermee 50 testeurs, tuning final |
| **5 sept 2026** | **Kickoff Old World League saison 1** synchrone NFL Week 1 |
| Sept 2026 → Janv 2027 | Saison reguliere 15 journees, ~1 match/sem mardi 21h |
| **8 fev 2027** | **"Blood Bowl Final"** — finale Old World League aligne Super Bowl LXI weekend |

---

## Dependances & risques

### Dependances
- **SPRINT Ligues v2 livre** : reutilise les concepts `LeagueSeason`, `LeagueRound` etendus. Si le modele `ProLeague*` doit diverger, decision a prendre au Lot 1.A.1.
- **`packages/game-engine` stable** : la sim depend des resolvers actions BB. Aucune evolution breaking pendant Phase 0.
- **Anthropic API key** : pour Nuffle Gazette (Claude Haiku 4.5). Cout estime `<5 €/mois` sur MVP (1 ligue, ~30 articles/jour).
- **node-cron ou equivalent** dans `apps/server` : deja present pour les forfaits ligue (cf. SPRINT-leagues-v2 L2.A.11).

### Risques

- **Realisme sim insuffisant** (P1, critique) : si le panel humain note <7/10, le MVP perd toute credibilite et les paris perdent leur saveur. **Mitigation** : Phase 0 gate strict, 8 semaines de tuning prevues, 5 testeurs experts panel, possibilite de boucler en Phase 0.E.1 sans avancer en Phase 1.
- **Variance trop forte / trop faible** : si favoris perdent 50% du temps = roulette ; si <5% = ennui. **Mitigation** : metriques `upset rate` mesuree explicitement (cible 12-18%), variance pilotable via temperature IA + Nuffle events probas.
- **Drift game-engine ↔ sim-engine** : un patch BB Cyanide / regles GW peut invalider replays. **Mitigation** : `engineVer` strict, replays anciens read-only, freeze des matchs joues.
- **Cout LLM** : sur 1 ligue MVP, ~5 €/mois. Si scale soudain (multi-leagues backlog) : surveille via dashboard + hard limit Anthropic. **Mitigation** : prompt caching active, batch API si non-urgent.
- **Engagement reel insuffisant** : si <20 utilisateurs places paris regulierement apres 1 mois MVP, le mode est un echec. **Mitigation** : beta fermee 50 testeurs avant go-live, NPS >= 30 requis pour go-live public, daily bonus + first-time grace pour onboarding.
- **Live SSE scaling** : si finale attire 1000+ spectateurs simultanes, `apps/server` peut saturer. **Mitigation MVP** : single instance suffit pour <500 ; au-dela, basculer vers Redis pub/sub (deja prevu dans architecture). Pas urgent au MVP.
- **Determinisme casse** : un `Math.random` oublie dans `sim-engine` ou un import non-pur (`Date.now()`) casse les replays et l'audit anti-triche. **Mitigation** : lint custom `no-restricted-globals`, PRNG injecte partout, tests de reproductibilite (re-simuler 10x un meme match avec meme seed → events identiques).
- **Statut juridique homages NFL** : un usage trop appuye (logos, noms officiels) declenche cease-and-desist NFL. **Mitigation** : noms et blasons originaux uniquement, ville + couleurs OK (faits), aucun logo/marque NFL en assets, validation legale avant beta publique. Fallback : retirer toute reference NFL et garder seulement les villes US / l'esprit "foot americain".
- **Casualties dramatiques** : un joueur "favori" qui meurt cree frustration. **Mitigation** : DEAD reste rare (~1-2/saison sur 16 equipes), Hall of Fame transforme la mort en hommage, rookie pipeline donne immediatement un remplacant narratif.

---

## Migration / data

- **Phase 0** : aucune migration Prisma. Seules additions code dans `packages/sim-engine` (nouveau package) + `packages/shared-types` (types `MatchEvent`, `TacticalProfile`).
- **Phase 1** : 3 migrations Prisma sequentielles :
  1. **PR1.A.1** : `ProLeague`, `ProTeam`, `ProTeamRoster`, `ProLeagueSeason`, `ProLeagueRound`, `ProLeagueMatch`, `Replay`, `ProLeagueStandings`. Seed 16 equipes initiales.
  2. **PR1.D.1** : `Wallet`, `Transaction`, `BetMarket`, `Bet`, `BetSettlement`. Init wallet pour tous les users existants avec 0 Crowns.
  3. **PR1.E.2** : `GazetteArticle`, `Storyline`, `HallOfFameEntry`, `Badge`, `UserBadge`, `SpectatorFollow`, `PlayerForm`.
- **Seeder etendu** : ajouter les 16 equipes Pro League en seed `seed/pro-league/teams.json` avec rosters complets pre-construits.

---

## Ordre de livraison recommande

| PR | Phase | Lots | Description | Estim |
|----|-------|------|-------------|-------|
| **PR0.1** | 0 | 0.A.1-0.A.5 | Sim engine fondation + driver hybride + resolvers | ~2 sem |
| **PR0.2** | 0 | 0.B.1-0.B.5 | Behavior trees + 16 profils + temperature IA + memoire match | ~2 sem |
| **PR0.3** | 0 | 0.C.1-0.C.4 | Variance, Nuffle events, underdog boost, streaks | ~1 sem |
| **PR0.4** | 0 | 0.D.1-0.D.4 | Bench harness + dataset + CI regression | ~1 sem |
| **PR0.5** | 0 | 0.E.1-0.E.4 | Tuning loop + replay sampling + panel humain + gate doc | ~2 sem |
| **GATE** | — | — | Decision GO/NO-GO basee sur metriques + panel | — |
| **PR1.1** | 1 | 1.A.1-1.A.5 | Modeles Prisma + scheduler + sim-runner + replay storage | ~1 sem |
| **PR1.2** | 1 | 1.B.1-1.B.4 | Broadcaster live SSE + spectate Pixi + ticker mobile | ~1 sem |
| **PR1.3** | 1 | 1.C.1-1.C.5 | UI Pro League (hub, teams, matches, standings, follow) | ~1 sem |
| **PR1.4** | 1 | 1.D.1-1.D.9 | Wallet + paris MVP + cotes + leaderboards + badges | ~1.5 sem |
| **PR1.5** | 1 | 1.E.1-1.E.6 | Nuffle Gazette LLM + storylines + casualties + HoF + rookies | ~1 sem |
| **PR1.6** | 1 | 1.F.1-1.F.4 | E2E + monitoring + page marketing + beta fermee | ~0.5 sem |
| **GO-LIVE** | — | — | Saison 1 kickoff 5 sept 2026 | — |

---

## Sources

- Audit produit + architecture conduit le 2026-05-05 par 5 agents en parallele
  (game design / paris / paysage concurrentiel / architecture technique /
  moonshots).
- Inspirations produit : MPG (Mon Petit Gazon), Hattrick, Football Manager,
  OOTP Baseball, Sorare, NFL Fantasy.
- Donnees BB : FUMBBL stats publiques, NAF tournament data, regles officielles
  Saison 2/3 (cf. `extraction_blood_bowl.md`).
- `packages/game-engine/` : resolvers existants block/dodge/pass/foul reutilises.
- `apps/server/src/services/league*.ts` : modele de symetrie pour
  `pro-league-scheduler.ts`.
- `docs/roadmap/sprints/SPRINT-leagues-v2.md` : pre-requis (infrastructure
  ligues consolidee).
- `docs/roadmap/backlog/future-ideas.md` : items differes (mercato MPG-layer,
  multi-leagues, weather sync, etc.).
