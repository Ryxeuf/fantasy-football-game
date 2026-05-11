# SPRINT Q — Differenciation fan / engagement narratif Pro League

> **Statut** : PLANIFIE — demarre apres Sprint P.
> **Duree estimee** : 6-8 semaines.
> **Pre-requis** : Sprint O (acquisition) + Sprint P (ops + sinks
> Crowns).

## Contexte

L'audit Pro League montre que **techniquement** la couche fan est riche
(broadcaster SSE, paris Crowns, Gazette LLM, badges, leaderboard
parieurs), mais **socialement / emotionnellement** elle est tres
pauvre : pas de partage, pas de commentaires, pas de career page
joueur durable, pas de "rivalry buildup" visible, pas de player-of-
the-week vote. L'objectif business est de devenir **"le Sorare / MPG /
ESPN de Blood Bowl"** — l'espace fan/spectateur qui n'existe nulle
part (FUMBBL = PvP league pur, Cyanide = jeu paye sans meta).

**Objectif :** transformer Pro League de "produit de niche" en
**"experience fan virale"** : chaque match shareable, chaque joueur
memorable, chaque blessure narrativisee, chaque fan engage dans une
communaute.

## Definition of done sprint

- [ ] Career page joueur durable : 50 matchs historique, greatest
  match, top rival, statistiques cumulees, trajectoire SPP/TV.
- [ ] Player-of-the-week vote : 24h post-match, top voted recoit badge
  "Carried My Team" + bonus Crowns.
- [ ] Clips highlight auto : top 3 moments d'un match → MP4 vertical
  1080×1920 (TikTok/Shorts) generes via Pixi headless + ffmpeg.
- [ ] Prediction mini-leagues privees : un user cree une ligue,
  invite 5-50 amis, weekly pick → leaderboard custom.
- [ ] Gazette commentaires moderes + fan predictions thread.
- [ ] Team head-to-head card : historique W-D-L 2 equipes, narrative
  rivalry detect (`storyline-detector` deja en place).
- [ ] Survivor Pick'em hebdo (1 match / semaine, FOMO engine).

## Decoupage en lots

### Lot Q.A — Career page + narrative joueur (~10j)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| Q.A.1 | Career stats persistees joueur | DB + Backend | M | [ ] | Nouvelle table `ProPlayerCareerSnapshot` qui agrege par joueur : `matchesPlayed`, `tdTotal`, `casTotal`, `mvpTotal`, `bestMatchId`, `worstMatchId`, `topNemesisTeamId`, `topVictoryTeamId`, `currentStreak`. Cron post-match recompute (incremental). Read-only API `GET /api/pro-league/players/:id/career`. |
| Q.A.2 | Page `/pro-league/players/[id]/career` | Frontend | M | [ ] | Nouvelle sub-page de la fiche joueur : graphique SPP/TV sur saison, table top 5 matches (les plus marquants), section "Rivalries" (top 3 teams qui ont battu/blesse le joueur), liste casualties recues + infligees. Cards visuelles, partageable. |
| Q.A.3 | Team head-to-head card | Frontend + Backend | M | [ ] | Service `pro-league-rivalry.ts` : pour 2 teams, calcule W-D-L historique sur N saisons, top scorers head-to-head, casualties causes. UI sur `/pro-league/teams/[slug]` : section "Rivalries" liste top 3 rivaux + boutton "Voir l'historique vs X". |
| Q.A.4 | Rivalry narrative dans Gazette | Backend | M | [ ] | Extend `pro-storyline-detector.ts` : detecte "rivalry_buildup" (>= 3 matchs en 30j entre 2 teams) → trigger article Gazette specifique "Storyline of the Rivalry". Persona "statistician" raconte l'historique. Test : 3 matchs Buffalo vs GB en 30j → article auto-publie. |

**DoD lot Q.A** : un joueur fictif a une page career complete avec
trajectoire visible, on peut raconter son histoire. Une equipe a des
rivaux nommes avec un historique W-D-L.

### Lot Q.B — Engagement social Gazette + vote (~8j)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| Q.B.1 | Player-of-the-week vote | Backend + Frontend | M | [ ] | Modele Prisma `ProPlayerOfMatchVote {userId, matchId, votedRosterId, createdAt}`. Window 24h post-match. UI : sur `/pro-league/matches/[id]` apres `completed`, montre cards des MVPs potentiels (top SPP gagne du match) avec bouton "Voter". Tally final : top voted recoit badge `carried_my_team` + bonus 25 Crowns. Weekly leaderboard "Player of the Week". |
| Q.B.2 | Commentaires Gazette | Backend + Frontend | L | [ ] | Modele `ProGazetteComment {id, articleId, userId, body, createdAt, deletedAt}`. Max 500 chars. UI thread sous chaque article Gazette. Moderation : `flagComment` + auto-flag Perspective API si configure (sinon manual flagging). Page admin `/admin/gazette/comments` pour bulk moderate. Test : commentaire avec slur → flag auto + masque pour autres users. |
| Q.B.3 | Fan predictions thread | Backend + Frontend | M | [ ] | Pre-match, fans peuvent poster prediction publique (max 200 chars, ex: "Orcs gagnent 3-1"). Modele `ProMatchPrediction {userId, matchId, body, createdAt}`. Post-match, badge `seer` si la prediction "match" le resultat (heuristique simple : contient mention de l'equipe gagnante + diff TD coherent). UI thread integre sur fiche match. |

**DoD lot Q.B** : un fan peut voter MVP, commenter un article, poster
une prediction. Au moins 100 commentaires generes en 1 semaine
post-launch.

### Lot Q.C — Viralite : highlights clips + share enrichi (~12j)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| Q.C.1 | Pixi headless renderer | Backend (Node + canvas) | L | [ ] | Service `apps/server/src/services/pro-highlight-renderer.ts` : prend un range de events (eg. TD scoring sequence ~30s), render via `node-canvas` + Pixi.js + reuse le renderer existant. Output : sequence d'images PNG. Tests perf : un highlight 30s renderise en < 60s sur 1 CPU. |
| Q.C.2 | ffmpeg encoder MP4 vertical | Backend | M | [ ] | Pipe les PNG vers `fluent-ffmpeg` → MP4 1080×1920 vertical (TikTok/Shorts/Reels ratio). Encode H.264 + AAC mute (BB n'a pas de son officiel — overlay text). Save dans S3-compatible storage (existing : MinIO/S3). |
| Q.C.3 | Auto-detect top 3 moments | Backend | M | [ ] | Extend `pro-storyline-detector.ts` : pour chaque match `completed`, identifie top 3 events spectaculaires (TD majeur, double casualty, Nuffle event chaotique). Cron post-match : trigger render highlights → save dans `ProHighlight` table. |
| Q.C.4 | Share highlights UI | Frontend | S | [ ] | Section "Highlights" sur `/pro-league/matches/[id]/page.tsx` : 3 video tags `<video controls>` + boutons share. URL publique playable. og:video meta tag pour Twitter video player. |

**DoD lot Q.C** : un match Pro League genere 3 clips MP4 verticaux,
playable + shareable Twitter avec auto-play. Pic d'audience apres
publication 1er clip viral.

### Lot Q.D — Prediction mini-leagues privees + Survivor (~8j)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| Q.D.1 | Prediction mini-leagues | Backend + Frontend | L | [ ] | Modeles `ProPredictionLeague {id, name, ownerId, isPrivate, joinCode, createdAt}`, `ProPredictionLeagueMember {leagueId, userId, joinedAt}`, `ProPredictionPick {leagueId, userId, matchId, selection, createdAt}`. Endpoints : create, join via code, list members, pick. UI `apps/web/app/pro-league/leagues/page.tsx` (mes ligues) + `[id]/page.tsx` (leaderboard custom). Score = correct picks dans la ligue. |
| Q.D.2 | Survivor Pick'em hebdo | Backend + Frontend | M | [ ] | 1 match selectionne / semaine. User pique 1 equipe → si elle gagne, il survive a la semaine, sinon eliminate. Modele `ProSurvivorEntry {userId, seasonId, weekN, pickedTeamId, status enum(alive/eliminated)}`. UI countdown "Survivor cette semaine : Round 5 - mardi 21h". Last survivor recoit 5000 Crowns. |

**DoD lot Q.D** : 50+ ligues prediction crees, Survivor pick'em a 200+
entries la 1ere semaine.

## Calendrier indicatif

| Semaine | Lots | Livrables |
|---------|------|-----------|
| 1-2 | Q.A | Career pages + rivalries + Gazette extension |
| 3-4 | Q.B | Vote MVP + commentaires + predictions |
| 5-7 | Q.C | Pixi headless + ffmpeg + clips auto |
| 7-8 | Q.D | Mini-leagues + Survivor Pick'em |

## Risques

| Risque | Mitigation |
|--------|------------|
| Pixi headless instable en Node | Fallback : pre-render server-side via worker isolated. Alternative : Playwright headless rendering (lent mais robuste). |
| Moderation commentaires manuelle = bottleneck | Integration Perspective API (Google, gratuit jusqu'a 1qps) + ban hammer admin. |
| Mini-leagues = duplication de FUMBBL divisions | Differenciation : prediction-only (pas de PvP), social FOMO (share leaderboard), bonus Crowns winner. |
| Clips MP4 storage couteux | Lifecycle 90 jours, archive S3 Glacier au-dela. |

## Dependances

- **Sprint O + P livres.**
- Service S3-compatible (existing).
- Service mail si notifications "Survivor cette semaine" envoyees.

## Sources

- Audit Pro League / fan experience : section "Manques narratifs" et
  "Strategic bets fan".
- Audit strategique : verdict "ESPN/Sorare/MPG de Blood Bowl".
