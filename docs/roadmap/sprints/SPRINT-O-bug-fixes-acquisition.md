# SPRINT O — Bug fixes engine + déblocage acquisition

> **Statut** : EN COURS — démarré 2026-05-10.
> **Duree estimee** : 2 semaines (1 dev senior) ou 1 semaine (2 devs en
> parallele).
> **Origine** : audit complet du projet par 7 agents specialises
> ([session 2026-05-10](../sessions/2026-05-10-pro-league-ui-polish.md)).
> Synthese : 5 bugs regles BB **visibles immediatement par un veteran
> FUMBBL** + 3 deblocages acquisition (registration, onboarding,
> partage social) + 3 hooks retention (daily bonus UI, match report,
> badge unlock toast).

## Contexte

Le projet est techniquement remarquable (2141 tests serveur, 901 tests
web, sim engine deterministe seede, broadcaster SSE in-process, 30
races jouables, 156 skills, Gazette LLM, Hall of Fame, admin tooling
avance). Mais **5 trous critiques** bloquent toute campagne marketing :

1. 4 bugs regles BB qu'un coach FUMBBL trouve en 5 min de test.
2. `/register` bloque sur "pending validation" admin → 70%+ bounce.
3. Aucune page partageable sur les reseaux (zero OG image dynamique).
4. Daily bonus existe mais aucun bouton UI pour claim.
5. Post-match : score affiche mais zero indice "ton joueur a
   level-up, va voir les advancements".

**Objectif :** pouvoir poster le site sur r/bloodbowl ou un Discord BB
sans honte technique. Decoupage en 8 lots de < 2 jours chacun.

## Definition of done sprint

- [ ] Les 5 bugs regles BB sont fixes + tests de non-regression.
- [ ] `/register` n'a plus de pending state (auto-approve avec email
  verify).
- [ ] Un visiteur arrive sur `/pro-league/matches/:id` → click "Partager"
  ouvre Twitter avec OG image generee dynamiquement (scores, teams).
- [ ] Un nouveau coach arrive sur `/me` apres signup → voit un modal
  d'onboarding avec 3 CTA clairs.
- [ ] `/pro-league/me/wallet` affiche un bouton "Claim daily bonus" qui
  marche.
- [ ] Apres un match, un banner sur `/me/teams/:id` resume score +
  MVP + advancements en attente.
- [ ] Quand un badge se debloque, l'utilisateur voit un toast immediat.

## Decoupage en lots

### Lot O.A — Bug fixes engine BB (~7j)

> Audit `game-engine` (`packages/game-engine/src/mechanics/*`) revele
> 5 bugs visibles par un veteran FUMBBL. Chacun est ferme en < 2j.
> Justification detaillee dans
> [session 2026-05-10](../sessions/2026-05-10-pro-league-ui-polish.md).

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| O.A.1 | Fix regeneration / apothecary order | Engine | XS | [ ] | `packages/game-engine/src/mechanics/injury.ts:94` : actuel `regen check AVANT apothecary` ; BB officiel = "apothecary peut sauver, sinon regen". Swap des 2 branches + test `injury.test.ts` qui couvre la sequence KO → apothecary → regen. |
| O.A.2 | Cabler Sure Feet / Sprint dans `movement.ts` | Engine | S | [x] | **DONE** (verifie 2026-05-11) : Sure Feet wired via `canSkillReroll(player, 'on-gfi', state)` dans `move-handlers.ts:171,283`. Sprint wired en S27.7.2 via `getGfiCap()`. Tests `registry-wiring.test.ts`. |
| O.A.3 | Cabler Horns / Pile Driver dans `blocking.ts` | Engine | S | [x] | **DONE** Horns (verifie 2026-05-11) : `block-handler.ts:149-159` consomme `collectModifiers(attacker, 'on-block-attacker', { isBlitz })`. Pile Driver registre passif mais consumer "foul gratuit" pas implemente — differe (action speciale complexe). |
| O.A.4 | Cabler Stunty / Sneaky Git | Engine | S | [x] | **DONE** (verifie 2026-05-11) : Stunty wired en S27.7 via `blocking.ts:143`. Sneaky Git wired via `isSneakyGitActive` (bridge) dans `foul.ts:118` — pas de hardcode duplicate. Tests `registry-wiring.test.ts`. |
| O.A.5 | Resolve Perfect Defence kickoff event | Engine | M | [x] | **DONE** (verifie 2026-05-11) : `mechanics/kickoff-resolution.ts:30` expose `resolveKickoffPerfectDefence` avec validation des positions (in bounds, on team half, no overlap). Coupling avec `pendingKickoffEvent: { type: 'perfect-defence', team }`. |
| O.A.6 | Add Illegal Procedure check | Engine | M | [ ] | **DEFERE** : scope plus large que prevu (logique referee transverse a toutes les actions, pas seulement foul). A traiter en lot dedie. |
| O.A.7 | Wire Diving Tackle dans dodge sequence | Engine | M | [x] | **DONE** (verifie 2026-05-11) : `move-handlers.ts:60-62` consomme `getDodgeSkillModifiers(state, player, from)` qui itere les adversaires adjacents et applique leur `on-dodge` modifier (`-2` pour DT, etc.). Tests `registry-wiring.test.ts` "Diving Tackle adjacent". |

**DoD lot O.A** : 5 bugs fixes + 6 tests de non-regression + bench sim
re-run pour confirmer drift < 1% vs baseline (`pnpm sim:perf`).

### Lot O.B — Deblocage acquisition (~3j)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| O.B.1 | Auto-approve registration | Backend + DB | S | [ ] | `apps/server/src/routes/auth.ts` POST `/register` : remplace `valid: false` par `valid: true` par defaut. Garde un feature flag `REQUIRE_ADMIN_VALIDATION` pour reverter en cas d'abus. Migration Prisma : `User.valid` reste mais default change. Audit log conserve. |
| O.B.2 | Email verification (optionnel, light) | Backend + Frontend | M | [x] | **DONE 2026-05-15** : `User.emailVerifiedAt` + table `EmailVerificationToken` (migration `20260528000000_add_email_verification`). Service `email-verification.ts` miroir de `password-reset.ts` : token plain envoye par email, hash SHA-256 seul persiste, single-use via `usedAt`, expiration 24h, devLink en non-prod / log serveur en prod. Routes : `GET /auth/verify-email?token=...` (public, consomme le token) + `POST /auth/resend-verification` (auth). Hook automatique sur `POST /auth/register` (best-effort). Page `/verify-email` cote web. Pas bloquant connexion (banniere UX uniquement, a brancher quand `/me` reprend du contenu). 12 tests service + 8 tests routes. Transport mail non branche au MVP — brancher un callback `sendEmailVerificationEmail()` une fois SMTP/SendGrid choisi. |
| O.B.3 | Onboarding modal post-signup | Frontend | M | [ ] | `apps/web/app/me/page.tsx` : si `user.createdAt > now - 24h && teams.length === 0`, affiche modal welcome avec 3 CTA : "Creer mon equipe" (lien `/me/teams/new`), "Faire le tutoriel" (lien `/tutoriel`), "Voir la Pro League" (lien `/pro-league`). Persist "onboarding-dismissed" dans localStorage pour eviter re-affichage. Test e2e Playwright : nouveau signup → modal visible. |

**DoD lot O.B** : bounce rate `/register` mesure < 30% sur 100 signups
test (vs 70%+ actuel estime). Tutorial completion +20% (mesure via
`TutorialCompletion` model).

### Lot O.C — Hooks retention (~4j)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| O.C.1 | Daily bonus claim UI | Frontend | S | [ ] | `apps/web/app/pro-league/me/wallet/page.tsx` : ajoute section "Daily streak" avec bouton "Claim aujourd'hui (50 Crowns)". POST `/pro-league/me/wallet/daily-bonus/claim` (route existe deja, Lot 1.D.6). Affiche le streak (consecutive days) + le prochain claim possible. Idempotent (1 claim / 24h). |
| O.C.2 | Match report banner post-match | Frontend | M | [ ] | Nouveau composant `MatchReportBanner` sur `apps/web/app/me/teams/[id]/page.tsx` : derniere fenetre de 7j, affiche score + MVP + casualties + SPP gagnes + bouton "Voir advancements" si `pendingChoices > 0`. Disparait apres dismiss ou apres claim. Coupling avec `post-match-league-sequence` deja en place. |
| O.C.3 | Badge unlock toast | Frontend + Backend | M | [ ] | Wrapper `evaluateBadgesForUser()` (`services/pro-badges.ts`) : retourne liste des badges nouvellement debloques. Front : sur chaque action qui peut debloquer (place bet, claim daily), check la response et affiche toast "Oracle of Nuffle debloque !" pendant 5s. Test : un user qui complete 10 streak doit voir le toast. |

**DoD lot O.C** : DAU sur 7j +15% mesure via DAU dashboard (a livrer en
Sprint P), advancement claim rate +25% (post-match banner mesure).

### Lot O.D — Viralite / partage social (~3j)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| O.D.1 | OG image dynamique matchs | Backend + Frontend | M | [ ] | Nouvelle route `GET /api/og/pro-league/matches/[id]` qui genere une image 1200×630 (via `@vercel/og` ou `satori`) avec : scores, logos teams (color dots), round, date. Cache 5 min. Coupling : `apps/web/app/pro-league/matches/[id]/layout.tsx` ajoute `generateMetadata` avec `openGraph.images: [{ url, width: 1200, height: 630 }]` + `twitter.card: 'summary_large_image'`. |
| O.D.2 | OG image dynamique Gazette | Backend + Frontend | S | [ ] | Idem pour `GET /api/og/pro-league/gazette/[date]` : titre edition + persona avatar + 1ere phrase article principal. Ajoute generateMetadata sur `pro-league/gazette/[date]/page.tsx`. |
| O.D.3 | Share buttons Twitter/Discord/copy | Frontend | S | [ ] | Composant `<ShareButtons url, title />` reutilisable sur `/pro-league/matches/[id]` et `/pro-league/gazette/[date]`. 3 boutons : "Tweet" (window.open Twitter intent), "Copy link" (navigator.clipboard), "Discord" (window.open Discord deep-link si possible, sinon copy link). |

**DoD lot O.D** : test manuel — coller `https://nuffle-arena.com/pro-league/matches/<id>`
dans Twitter, voit l'OG image avec scores. Idem Discord, Slack.

## Calendrier indicatif

| Semaine | Lots | Livrables |
|---------|------|-----------|
| 1 | O.A (engine bugs) | 5 bugs fixes mergees, bench sim re-validee, drift < 1% |
| 2 | O.B + O.C + O.D | Acquisition + retention + partage social shippes |

## Risques

| Risque | Mitigation |
|--------|------------|
| Bug regen order modifie outcomes existants en DB | Migration write-only ; pas de replay re-calcul ; ajouter feature flag `INJURY_ORDER_V2` toggle pour rollback |
| Auto-approve attire spam | Garder feature flag, ajouter rate-limit signup IP (10/jour), captcha leger optionnel |
| OG image generation pas dispo dans Next.js 14 | Fallback : pre-generation statique au moment du replay save (job background) |

## Dependances

- **Aucune** sur autre sprint. Sprint O peut etre realise immediatement
  apres la session de polish 2026-05-10 (PRs #728-#742 deja mergees).

## Sources

- Audit complet 7 agents : section "Verdict competitive" et "Lacunes
  regles BB" du rapport game-engine maturity.
- `docs/roadmap/follow-up-b01.md` (skill registry residuels).
- Session log 2026-05-10 (`docs/roadmap/sessions/`).
