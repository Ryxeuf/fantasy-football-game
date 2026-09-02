# Roadmap v2 — Sprints 24-27

> Derniere mise a jour : 2026-09-02
> Contexte : v1.240.x livree (beta publique). Roadmap v1 archivee dans
> [`archive/v1.73/`](./archive/v1.73/README.md). Cette nouvelle roadmap
> couvre les 4 sprints initiaux S24-27 + sprints post-audit O-R derives
> du gap analysis 2026-05-10.

## Index des sprints

| Sprint | Theme | Fichier | Etat |
|--------|-------|---------|------|
| **S24** | Stabilite & DX core (fix P0 + securite + hot-reload dev) | [sprints/S24-stabilite-securite.md](./sprints/S24-stabilite-securite.md) | TERMINE |
| **S25** | Observabilite, perf & qualite (logs, metrics, tests, bundle) | [sprints/S25-observabilite-qualite.md](./sprints/S25-observabilite-qualite.md) | TERMINE |
| **S26** | Refactor + Retention & engagement (page.tsx prerequis, achievements, profil, ligues) | [sprints/S26-retention-engagement.md](./sprints/S26-retention-engagement.md) | TERMINE |
| **S27** | Evolutions & confort (esport, mobile parite, S4 skeleton, audit log, B0.1 residuels) | [sprints/S27-evolutions-confort.md](./sprints/S27-evolutions-confort.md) | TERMINE |
| **Ligues v2** | Gestion complete des ligues BB (creation UI, inscription, calendrier auto, forfait, Jeu en Ligue post-match, awards) | [sprints/SPRINT-leagues-v2.md](./sprints/SPRINT-leagues-v2.md) | TERMINE |
| **Pro League** | Championnat virtuel 16 equipes IA vs IA, matchs auto mardi 21h, paris Crowns, Gazette LLM, Hall of Fame | [sprints/SPRINT-pro-league.md](./sprints/SPRINT-pro-league.md) | TERMINE Phase 0 + 1 (session polish 2026-05-10 livre 12 lots #728-#742) |
| **Sprint O** | **Bug fixes engine + deblocage acquisition** (regles BB Perfect Defence/Illegal Procedure/regen order, skills registry, registration auto-approve, onboarding, OG image, share) | [sprints/SPRINT-O-bug-fixes-acquisition.md](./sprints/SPRINT-O-bug-fixes-acquisition.md) | **TERMINE 87%** — 7 lots livres 2026-05-11 (PRs #744-#751). Lot O.A.2-4 (skill registry) differe session engine focus. |
| **Sprint P** | **Ops readiness + scaling 10k MAU** (mode maintenance, season factory, admin wallet, password reset, soft-delete + GDPR, sinks Crowns, dashboard analytics) | [sprints/SPRINT-P-ops-readiness.md](./sprints/SPRINT-P-ops-readiness.md) | PLANIFIE (3 sem) |
| **Sprint Q** | **Differenciation fan / engagement narratif Pro League** (career pages, MVP vote, clips highlights MP4, mini-leagues privees, Survivor Pick'em, commentaires Gazette) | [sprints/SPRINT-Q-fan-differentiation.md](./sprints/SPRINT-Q-fan-differentiation.md) | **TERMINE** — 12 PRs (#772-#784) 2026-05-12. Q.A/Q.B/Q.D livres ; Q.C (clips MP4) differe. |
| **Sprint R** | **International + monetisation + mobile release** (i18n EN/DE/PL/ES, Patreon + Season Pass, App Store + Play Store, Discord, ambassadeurs, NAF, PvP async tours-par-jour) | [sprints/SPRINT-R-international-monetization-mobile.md](./sprints/SPRINT-R-international-monetization-mobile.md) | PLANIFIE (3-6 mois) |

> **Win condition 12 mois (Sprint R termine) :** 10 000 MAU + top 3
> reconnaissance BB online FR/EN/DE. Voir
> [session log 2026-05-10](./sessions/2026-05-10-pro-league-ui-polish.md)
> pour le contexte et l'audit complet 7 agents qui derive O-R.

## Livre depuis (hors plan initial S24-R)

- **NFL Fantasy** (2026-05, post-Q) — axe MPG-like sur stats NFL reelles
  skinnees BB. Package `@bb/nfl-mapper`, ingestion nflverse + ESPN,
  league/roster/lineup/scoring/mercato, crons, admin explorer, frontend,
  Gazette LLM, backfill saisons passees. ~14 modeles `Nfl*`. Doc :
  [`../nfl-fantasy/README.md`](../nfl-fantasy/README.md).
- **Gestion des Ligues** (2026-06-06, #886-#889) — invitations, withdraw
  guard, multi-poules + scheduler, feuille de match v2, edition ex-post.
  Voir [`sessions/2026-06-06-league-management.md`](./sessions/2026-06-06-league-management.md).
- **Acquisition/retention web** (2026-06-13→15, #890-#897) — refonte home
  Nuffle + accueil personnalise, comparateur de rosters SSR + tier-list,
  notifications de re-engagement (Web Push + digest e-mail), onboarding
  "60 secondes", OpenSpec workflow.
- **Ligues physiques : feuille de match v2 + confort** (2026-06-25→07-28) —
  achats/licenciements hors ligne, verrouillage de l'edition d'equipe
  engagee, cycle de vie des statuts de ligue, morts et licenciements traces
  et reversibles, regle Capitaine, colonnes etendues du classement.
- **Vague "gestion d'equipe & feuille de match"** (2026-08-17→09-01,
  #938-#1006) — **69 PR, 859 fichiers, ~123 500 lignes, 197 nouveaux
  fichiers de test, 6 modeles Prisma.** Quatre chantiers :
  1. **Feuille de match conforme au livre** (18 PR) — sequence de fin de
     match p.68, gel du match a l'ouverture, journaliers panachables et
     Star Players synthetiques, PSP de reception, invalidation d'un match
     de play-off, catalogue d'embauche.
  2. **Valeur d'equipe qui cesse de mentir** (11 PR) — separation or /
     valeur, Fans Devoues hors VE/VEA, "Trois-quarts a vil prix" en VEA,
     surcout des competences d'Elite, VEA = VE − absents.
  3. **Referentiels "base d'abord"** (6 PR) — audit statique vs BDD puis
     lots 1→6 : coups de pouce, bareme d'avancement, regles speciales,
     univers des rosters passent en base avec repli compile.
  4. **Journal d'equipe** (#985) — `TeamAuditEvent` append-only (qui / quoi
     / **quel resultat**), contexte ambiant `AsyncLocalStorage`, garde CI
     a ratchet.

  Recit complet :
  [`sessions/2026-09-02-vague-gestion-equipe-et-feuille-de-match.md`](./sessions/2026-09-02-vague-gestion-equipe-et-feuille-de-match.md).

## Suivi qualite actif

- ✅ **B0.1 (skill registry residuels) clos** le 2026-05-11 via Sprint O
  lot O.A.2-4 (17 tests `registry-wiring.test.ts`). Seul reste differe :
  Pile Driver (foul gratuit post-knockdown, action speciale). Detail :
  [`follow-up-b01.md`](./follow-up-b01.md).
- ✅ **CI qui avalait les echecs de test clos** le 2026-08-31 (#1000). La
  step "Unit tests" se terminait par `|| echo "..."`, ce qui noyait le code
  de sortie de **toutes** les suites : `@bb/tests` et
  `@bb/tests-integration` ont derive sans alerte. Les workspaces e2e sont
  desormais exclus **par filtre**, les deux suites gatent la CI, et 27 tests
  rouges ont ete repares.
- ⚠️ **59 changesets non consommes** dans `.changeset/`, le plus ancien du
  2026-07-22. `semantic-release` assure le versionnement reel (v1.240.1) et
  `pnpm changeset:version` n'a jamais tourne sur cette serie : deux
  mecanismes coexistent sans que l'un consomme l'autre. A trancher — les
  consommer, ou documenter qu'ils servent de journal de release.

## Journal de decisions (OpenSpec)

Au 2026-09-02, **30 changes archives** (28 verses ce jour) dans
[`openspec/changes/archive/`](../../openspec/changes/archive/) et **29
capabilities** specifiees dans [`openspec/specs/`](../../openspec/specs/).
Plus aucun change actif : la totalite du journal de decisions est passee en
archive, delta-specs synchronisees.

Les suites hors perimetre de ces changes sont remontees dans
[`backlog/openspec-suites.md`](./backlog/openspec-suites.md) pour rester
trouvables sans fouiller l'archive.

## Items ecartes / backlog

| Pourquoi | Items |
|----------|-------|
| Faux positifs (deja faits) | A.9 badge connexion, I.6 specialRules star players, O.2 / O.3 audit S2/S3 |
| Differes (non prioritaires) | Replay public sharable, OpenTelemetry full, CodeQL CI, lore par equipe, season passes / cosmetics premium |
| Hors scope 4 sprints | E2E mobile Detox/Appium (chantier complet, 1 sprint dedie a prevoir) |
| Backlog idees Pro League differees | MPG-layer mercato, multi-leagues, weather sync IRL, NFL Twin Mirror, Twitch auto-cast, etc. — voir [`backlog/future-ideas.md`](./backlog/future-ideas.md) |

## Source

Audit conduit le 2026-04-27 par 10 agents Explore en parallele (game
engine, frontend web, mobile, backend/API/DB, tests/CI, securite,
performance/scaling, DX/monitoring, contenu/data/i18n, engagement/
retention). 74 findings consolides en 32 taches reparties sur 4 sprints.
