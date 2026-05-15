# SPRINT P — Ops readiness + scaling 10k MAU

> **Statut** : **TERMINE** — verifie 2026-05-15. Tous les 10 lots
> (P.A.1-3, P.B.1-4, P.C.1-3) sont livres et tests. Voir audit
> ci-dessous.
> **Duree estimee** : 3 semaines.
> **Pre-requis** : Sprint O merge (bugs critiques + acquisition).

## Contexte

L'audit 7 agents identifie 7 trous critiques cote operations qui
empechent de scaler sereinement a 10 000 MAU :

1. Pas de mode maintenance global → chaque deploy = downtime non-geree.
2. Pas de season factory Pro League → bug saison = SQL manuel + corruption etat.
3. Pas d'admin wallet → fraude/bug pari = SQL direct, pas de refund tracable.
4. Pas de password reset (admin ou self-service) → support submerge.
5. Pas de soft-delete users → audit log refere des fantomes, RGPD-export absent.
6. Pas de sinks Crowns → hyperinflation garantie a scale.
7. Pas de dashboard business → blind sur DAU/MAU/funnel/Crowns inflation.

**Objectif :** etre operationnellement pret a recevoir 10× le trafic
actuel sans plomb. Decoupage en 7 lots de < 3j chacun.

## Definition of done sprint

- [ ] Mode maintenance toggleable via feature flag, affiche page
  custom + retry-after.
- [ ] Admin peut creer / cloner / regenerer schedule / reset standings
  pour une saison Pro League depuis l'UI admin.
- [ ] Admin peut voir transactions / ajuster solde / refund pari via
  UI dedie + audit log strict.
- [ ] Password reset self-service (email) + override admin.
- [ ] Suppression user = soft-delete (`deletedAt` colonne) + export
  GDPR complet (JSON).
- [ ] Au moins 2 sinks Crowns implementes (cosmetiques HoF, entry
  tournois).
- [ ] Dashboard `/admin/analytics` affiche DAU/MAU/funnel signup→first
  match + Crowns inflation 30j.

## Decoupage en lots

### Lot P.A — Mode maintenance + soft-delete + GDPR (~4j)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| P.A.1 | Mode maintenance global | Backend + Frontend | M | [x] | **DONE** : middleware `apps/server/src/middleware/maintenance.ts` (kill-switch flag), page `apps/web/app/maintenance/page.tsx`. Toggle admin via feature-flags UI. |
| P.A.2 | Soft-delete users | DB + Backend | M | [x] | **DONE** : `User.deletedAt` (schema.prisma:75) + `apps/server/src/lib/prisma-soft-delete.ts` (helpers `whereActiveUser` / `isActiveUser`), restore endpoint admin (admin.ts:732). |
| P.A.3 | GDPR export endpoint | Backend | M | [x] | **DONE** : `GET /me/gdpr-export` dans `apps/server/src/routes/auth-privacy.ts:83` + `services/gdpr-export.ts` (audit log, throttle 1/24h). |

**DoD lot P.A** : test e2e mode maintenance, test e2e soft-delete +
restore, test JSON GDPR-export contient toutes les sections.

### Lot P.B — Admin wallet + season factory (~7j)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| P.B.1 | Admin wallet UI + endpoints | Backend + Frontend | M | [x] | **DONE** : `routes/admin-wallet.ts` + UI `apps/web/app/admin/wallets/[userId]/page.tsx`. |
| P.B.2 | Crowns sinks (HoF inscriptions + tournois entry) | Backend + Frontend | M | [x] | **DONE** : `services/pro-hall-of-fame-dedicate.ts` (`dedicateHallOfFame`) + `services/pro-tournament-entry.ts` (`enterTournament`). |
| P.B.3 | Season factory CLI + admin UI | Backend + Frontend | L | [x] | **DONE** : `services/pro-season-factory.ts` + `routes/admin-pro-season.ts` + UI `apps/web/app/admin/pro-league/seasons/`. |
| P.B.4 | Moderation matchs humains | Backend + Frontend | M | [x] | **DONE** : endpoints forfeit/cancel/ban dans `admin.ts:975` / `:450` / `:527` (unban). Tests `admin-moderation.test.ts`. |

**DoD lot P.B** : un admin peut creer une saison en moins de 60s,
faire un refund de pari frauduleux en < 30s, forfaiter un match
toxique. Tests integration + audit log entries.

### Lot P.C — Password reset + dashboard business (~4j)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| P.C.1 | Password reset self-service | Backend + Frontend | M | [x] | **DONE** : `services/password-reset.ts` + routes `auth.ts:324/356` + pages `forgot-password` / `reset-password`. Token hash SHA-256, single-use, expire 24h. |
| P.C.2 | Admin password reset override | Backend + Frontend | S | [x] | **DONE** : `admin.ts:587` + `services/temp-password.ts`. `User.mustChangePassword` flag pour forcer le change a la prochaine connexion. |
| P.C.3 | Dashboard analytics admin | Backend + Frontend | L | [x] | **DONE** : `services/admin-analytics.ts` + `routes/admin-analytics.ts` + UI `apps/web/app/admin/analytics/page.tsx`. |

**DoD lot P.C** : un user qui a perdu son password peut se
reconnecter en < 5 min sans contacter le support. Admin voit le DAU
jour-jour + funnel signup→first match.

## Calendrier indicatif

| Semaine | Lots | Livrables |
|---------|------|-----------|
| 1 | P.A | Mode maintenance + soft-delete + GDPR export |
| 2 | P.B.1 + P.B.2 | Admin wallet + Crowns sinks |
| 3 | P.B.3 + P.B.4 + P.C | Season factory + moderation + password reset + dashboard |

## Risques

| Risque | Mitigation |
|--------|------------|
| Soft-delete change comportement queries existantes (joins, counts) | Helper centralise `withSoftDelete()` + tests de regression sur queries critiques (login, matchmaking) |
| Sinks pas adoptes par users → inflation persiste | Mesurer via dashboard P.C.3 + ajuster montants si necessaire ; ajouter sinks en Sprint Q (cosmetiques season pass) |
| Mode maintenance bypass mal config → admin lock-out | Toujours bypass pour role=admin ; tester avant deploy |

## Dependances

- **Sprint O termine** (bugs engine fixes, plus de panique acquisition).
- **Service mail configure** (P.C.1 password reset). Si pas configure,
  fallback admin reset only.

## Sources

- Audit admin de la session 2026-05-10 : "Verdict ops-readiness".
- Audit Pro League : section "Economie virtuelle" (sinks Crowns).
