# SPRINT P — Ops readiness + scaling 10k MAU

> **Statut** : PLANIFIE — demarre apres Sprint O.
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
| P.A.1 | Mode maintenance global | Backend + Frontend | M | [ ] | Feature flag `MAINTENANCE_MODE` (existing system). Middleware `apps/server/src/middleware/maintenance.ts` qui intercept toutes les routes non-`/admin/*` + retourne 503 avec `Retry-After: 3600`. Page Next.js `/maintenance/page.tsx` avec timer estime. Toggle via admin UI `/admin/feature-flags`. |
| P.A.2 | Soft-delete users | DB + Backend | M | [ ] | Migration Prisma : `User.deletedAt DateTime?` (null par defaut). Tous les `findMany/findUnique/findFirst` ajoutent `where: { deletedAt: null }` (helper `apps/server/src/lib/prisma-soft-delete.ts`). `DELETE /admin/users/:id` set `deletedAt = now` au lieu de hard delete. Audit log conserve `userId` reference. Endpoint `/admin/users/:id/restore` pour annuler. |
| P.A.3 | GDPR export endpoint | Backend | M | [ ] | `GET /me/gdpr-export` (auth required) : retourne JSON complet user (account, teams, matches, bets, transactions, badges, follows, audit_log entries). Format conforme RGPD (lisible). Limite 1 export / 24h. Idempotent. Audit log "user.gdpr.export". |

**DoD lot P.A** : test e2e mode maintenance, test e2e soft-delete +
restore, test JSON GDPR-export contient toutes les sections.

### Lot P.B — Admin wallet + season factory (~7j)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| P.B.1 | Admin wallet UI + endpoints | Backend + Frontend | M | [ ] | Nouvelle route serveur `apps/server/src/routes/admin-wallet.ts` : `GET /admin/wallets/:userId/transactions` (paginee), `PATCH /admin/wallets/:userId/balance` (ajustement avec reason obligatoire, audit log strict), `POST /admin/bets/:betId/refund` (annule un pari, credit le wallet, log audit). UI `apps/web/app/admin/wallets/page.tsx` + `/admin/wallets/[userId]/page.tsx`. |
| P.B.2 | Crowns sinks (HoF inscriptions + tournois entry) | Backend + Frontend | M | [ ] | 2 nouveaux markets sinks : (a) `POST /pro-league/hall-of-fame/dedicate` (cout 500 Crowns, ajoute message custom sur fiche joueur HoF), (b) `POST /pro-league/tournaments/:id/enter` (entry fee 100 Crowns, payable une fois). Audit log + transaction wallet. UI : bouton "Dedicate" sur HoF entries + section "Tournois ouverts" sur hub. |
| P.B.3 | Season factory CLI + admin UI | Backend + Frontend | L | [ ] | Service `apps/server/src/services/pro-season-factory.ts` : `cloneSeason(fromSeasonId)`, `regenerateSchedule(seasonId)`, `resetStandings(seasonId)`, `forceForfeit(matchId, winnerId)`, `cancelSeason(seasonId)`. CLI `pnpm pro:season:clone --from=...`. UI `apps/web/app/admin/pro-league/seasons/page.tsx` avec actions par saison. Tous audites + idempotents. |
| P.B.4 | Moderation matchs humains | Backend + Frontend | M | [ ] | Endpoint `POST /admin/matches/:id/forfeit` (admin force forfait avec raison), `POST /admin/matches/:id/cancel` (annule + refund bets associes), `POST /admin/users/:id/ban` (deja existant, ajouter raison + duree). UI `/admin/matches/[id]/page.tsx` enrichi avec ces actions. Audit log strict. |

**DoD lot P.B** : un admin peut creer une saison en moins de 60s,
faire un refund de pari frauduleux en < 30s, forfaiter un match
toxique. Tests integration + audit log entries.

### Lot P.C — Password reset + dashboard business (~4j)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| P.C.1 | Password reset self-service | Backend + Frontend | M | [ ] | POST `/auth/forgot-password` : genere token JWT expirant 24h, envoie email avec lien `/reset-password?token=...`. POST `/auth/reset-password` : valide token, update `User.password` (bcrypt), invalidate sessions actives. Pages Next.js `/forgot-password` + `/reset-password`. Audit log. Tests securite : token unique, expire, single-use. |
| P.C.2 | Admin password reset override | Backend + Frontend | S | [ ] | POST `/admin/users/:id/password-reset` : generate temp password, retourne pour transmission a l'utilisateur (out-of-band). Force re-login + change-on-next-login. Audit log strict. |
| P.C.3 | Dashboard analytics admin | Backend + Frontend | L | [ ] | Service `apps/server/src/services/admin-analytics.ts` : `getDailyActiveUsers(days)`, `getMonthlyActiveUsers(months)`, `getSignupToFirstMatchFunnel()`, `getCrownsInflation30d()`. Endpoint `GET /admin/analytics` agrege. UI `apps/web/app/admin/analytics/page.tsx` avec 4 charts (Recharts) + delta vs periode precedente. |

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
