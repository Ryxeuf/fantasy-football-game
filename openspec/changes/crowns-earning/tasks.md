# Tasks — les Couronnes se gagnent en jouant

## 1. Registre et règles pures

- [x] 1.1 Ajouter le modèle `CrownsReward` (D2 : `sourceKey` unique, `userId`, `kind`, `periodKey`, `amount`, `baseAmount`, `transactionId`, `createdAt`, index `(userId, periodKey)` et `(userId, createdAt)`) et sa back-relation sur `User` dans `prisma/schema.prisma` ; vérifier que le client Prisma se génère et que le miroir SQLite des tests crée la table.
- [x] 1.2 Créer `apps/server/src/services/crowns-rewards-rules.ts` (pur) : barème D4, constructeurs de clés (`sheet:<id>:home|away`, `achievement:<userId>:<slug>`, `signup:<userId>`), clés de période (`season:<id>`, `cup:<id>`) et `planCrownsRewards` ; vérifier par `crowns-rewards-rules.test.ts` : montants du barème, plafond tronqué au reliquat puis nul, ordre déterministe (date de validation puis id), saisons indépendantes, succès et bonus hors plafond, plan identique à entrée identique.

## 2. Rattrapage

- [x] 2.1 Charger les candidats « feuille » (D5) dans `apps/server/src/services/crowns-rewards.ts` : feuilles `validated` de ligue et de coupe où le coach possède un côté, autre côté d'un autre compte, période de la saison ou de la coupe ; vérifier par test (Prisma mocké) : feuille invalidée exclue, brouillon exclu, même compte des deux côtés exclu, coupe rattachée à `cup:<id>`, ligue à `season:<id>`.
- [x] 2.2 Charger les candidats « succès » (lignes `UserAchievement` ∩ `ACHIEVEMENTS_CATALOG`) et « bonus » (marqueur à 0 si une opération `REWARD` réf. `first_signup` existe) ; vérifier par test : slug hors catalogue ignoré, bonus Pro League ⇒ marqueur sans opération.
- [x] 2.3 Écrire `reconcileCrownsRewards(userId)` (D3, D8) : plan pur, puis UNE transaction (opération `REWARD` réf. `rewards:<cuid>` si total > 0, lignes du registre rattachées, incrément du wallet), lignes à 0 écrites sans opération, P2002 ⇒ passage annulé sans erreur, débounce par coach (60 s prod, 0 test) ; vérifier par test : second appel sans écriture, P2002 ⇒ aucun crédit et pas d'exception, total = somme des lignes, wallet créé s'il manque.
- [x] 2.4 Faire refuser `grantFirstTimeBonus` quand le registre porte un bonus de bienvenue versé (D7) ; vérifier par test qu'un coach crédité par le rattrapage ne reçoit pas les 1000 de la route Pro League.
- [x] 2.5 Documenter le patron dans `CLAUDE.md` (section « Couronnes (Crowns) » : sources, rattrapage à la lecture, registre à clé globale, plafond par saison, lignes à 0 jamais retentées) ; vérifier que les chemins cités existent.

## 3. Route et journal

- [ ] 3.1 Brancher le rattrapage dans `GET /crowns/me` (`apps/server/src/routes/crowns.ts`) en best-effort avant la lecture, et servir le champ optionnel `rewards { sheets, achievements, signup, capped }` sur les opérations `rewards:` (une requête sur le registre) ; vérifier par test de route : rattrapage en échec ⇒ 200 avec le solde, détail servi, flag fermé ⇒ 403 inchangé.
- [ ] 3.2 Libeller les passages dans `apps/web/app/lib/crowns.ts` (`describeCrownsTransaction` : « Récompenses : 2 feuilles de match, 1 succès », mention des plafonnées ; une `REWARD` sans réf. `rewards:` reste « Bonus de bienvenue ») avec le champ `rewards` optionnel dans les types ; vérifier par `crowns.test.ts`.
- [ ] 3.3 Ajouter le bloc « Comment gagner des Couronnes » (feuille validée, succès, bonus de bienvenue, plafond par saison) à la carte Couronnes du profil et à la boutique `/me/dice-themes` ; vérifier par tests de rendu (bloc présent flag actif, absent flag inactif).

## 4. Admin

- [ ] 4.1 Ajouter `GET /admin/coach-cosmetics/:userId/crowns-rewards` (`adminOnly`, 50 plus récentes : source, période, montant, barème, date) au routeur admin des cosmétiques ; vérifier par test de route : admin 200, coach 403, coach inconnu 404.
- [ ] 4.2 Afficher la section « Récompenses » sur `/admin/coach-cosmetics/[userId]` (plafonnées signalées) ; vérifier par test de rendu.

## 5. Dette des écrivains du wallet

- [ ] 5.1 Passer `grantFirstTimeBonus` et `claimDailyBonus` (`pro-wallet-rewards.ts`) à `{ increment }` dans leurs transactions ; vérifier que leurs tests passent et qu'un test asserte l'incrément (plus d'écriture « solde lu + montant »).
- [ ] 5.2 Passer `pro-hall-of-fame-dedicate.ts` et `pro-tournament-entry.ts` au décrément conditionnel (`updateMany where crowns >= montant`, 0 ligne ⇒ `InsufficientFundsError`) ; vérifier par tests : solde insuffisant refusé, jamais de solde négatif.

## 6. Intégration

- [ ] 6.1 Écrire `tests/e2e-api/specs/crowns-earning.spec.ts` : deux coachs, une feuille de ligue validée ⇒ `GET /crowns/me` crédite à chacun bonus + feuille ; seconde lecture inchangée ; invalidation puis revalidation ⇒ solde inchangé ; journal détaillé ; vérifier que la spec passe dans la suite e2e-api.
- [ ] 6.2 Remonter les suites dans `docs/roadmap/backlog/openspec-suites.md` (pronostics et palmarès à la clôture de saison, succès comptant les feuilles, barème éditable, notification de gain) ; vérifier que le lien vers l'exploration du 2026-10-06 résout.
- [ ] 6.3 Vérifier l'ensemble : typecheck serveur et web, tests unitaires serveur et web verts.

## Workflow follow-up

- Ouvrir la PR, la mener au vert, puis `/opsx:sync` et `/opsx:archive` après merge.
- Déploiement : `db push` crée `CrownsReward` ; le flag `crowns` reste fermé jusqu'à la recette (premier passage d'un compte réel, plafond, journal, écran admin).
- Calibrer le barème (D4) sur le rythme réel de feuilles validées avant d'ouvrir `crowns` à tous.
