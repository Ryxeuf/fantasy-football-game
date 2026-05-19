# 00 — Vision & Scope

## Le pitch

> Mon Petit Gazon × NFL × Blood Bowl : un fantasy game où tu construis
> une équipe BB en draftant des joueurs NFL réels (mais skinnés en
> Throwers/Catchers/Blitzers), où les vraies performances du dimanche
> alimentent les SPP et où tu actives des relances, inducements et
> prières à Nuffle pour booster ta semaine.

## Pourquoi un axe additionnel et pas un remplacement

Le projet actuel a deux moteurs majeurs :
- `packages/sim-engine` : Pro League simulée (matches BB automatiques)
- `packages/game-engine` : Match BB online (head-to-head temps réel)

Le module NFL Fantasy **réutilise** ces moteurs (la Gazette narrative,
le système de SPP, la progression joueur, le mercato, le wallet, les
badges) **sans les remplacer**. Un user peut être actif sur :
- Pro League BB (simulation, 12 mois/an)
- Match online BB (head-to-head)
- NFL Fantasy (sept-février, complémentaire)

## Complémentarité calendaire (argument fort)

```
       JAN  FEV  MAR  AVR  MAI  JUN  JUL  AOÛ  SEP  OCT  NOV  DEC
NFL    ███   ★                            ▒▒▒  ███  ███  ███  ███
       playoffs/SB                        preseason → regular
Pro BB ███  ███  ███  ███  ███  ███  ███  ███  ███  ███  ███  ███
       toute l'année
```

- **Pic d'engagement NFL** : sept-fév (6 mois)
- **Off-season NFL** : mars-août (6 mois) — users restent sur Pro League BB
- **Anti-churn naturel** : zéro période morte, l'utilisateur reste actif
  toute l'année

## Audiences ciblées

| Audience | Pro League BB | NFL Fantasy | Cross |
|---|---|---|---|
| BB veterans | ⭐⭐⭐ Cœur | ⭐⭐ Découverte | Univers familier |
| Fantasy NFL US | ⭐ Découverte | ⭐⭐⭐ Cœur | Gameplay original |
| MPG / Sorare users | ⭐ | ⭐⭐⭐ | Mécaniques connues + skin BB |
| Casual gamers FR/EU | ⭐⭐ | ⭐⭐ | Storytelling Gazette |

## Scope MVP

**In** (V1) :
- 32 équipes NFL mappées aux 8 races BB
- Roster draftable (53 joueurs NFL actifs par équipe)
- Lineup hebdo 11 titulaires + 2 captains
- Scoring stats → SPP via mapping pur
- Relances (8/saison) + inducements (3 slots/match)
- Prières à Nuffle (auto-roll si underdog)
- Gazette narrative hebdo
- 1 league par user (private ou public)
- Standings + playoffs
- Ingestion data via nflverse + ESPN hidden API (gratuit)

**Out** (V2+) :
- DFS (Daily Fantasy) — risque légal gambling
- Auctions live (MPG real-time draft)
- Cartes / collection NFT (cf. Sorare crash)
- Mode "season-long persistent player" (level-ups inter-saisons)
- Licence officielle NFLPA (à considérer si volume justifie)
- Mode coach (choisir play calling) — out of scope

## Questions ouvertes

### Tranchées (session 2026-05-19)

1. **Mode mercato** ✅ → **Snake draft** (MPG/ESPN-like). Draft asynchrone, ordre serpenté.
   Pas d'event live synchrone à orchestrer. Familier pour l'audience fantasy.
2. **League size** ✅ → **10 users**. 5 matchups H2H par semaine, 9 semaines de
   regular season permettent à chaque user d'affronter tous les autres une fois
   + 1 rematch. Bon équilibre roster scarcity vs pool draftable.
3. **Captain slots** ✅ → **1 captain ×1.5 + 1 vice ×1.2** (MPG-like).
   2 décisions stratégiques par semaine, différencie de Sorare (×2 unique).
4. **Prières à Nuffle conditions** ✅ → **Underdog par TV** (Team Value).
   Cohérent avec la règle BB officielle (inducements + prayers basés sur TV).
   Lien narratif fort avec l'univers BB.
5. **Race assignment** ✅ → **Fixe par équipe**. Tous les joueurs d'une équipe
   NFL héritent de la race de leur équipe (cf. `04-race-mapping.md`).
   Data model : `NflPlayer.teamCode` → race lookup. Pas de champ `archetype` requis
   pour la V1. Branding équipe préservé ("Kansas City Skaven").
6. **Cross-pollution avec Pro League** ✅ → **Non, silos séparés**.
   `NflPlayer` et `ProPlayer` = tables distinctes, pas de lien cross-module.
   Scope MVP clair, moins de bugs. À reconsidérer en V2 si engagement justifie.
7. **Monétisation V1** ✅ → **Freemium**. Tout gratuit, achats optionnels en gold
   (inducements premium, captain boost, rerolls suppl.). Réutilise le wallet
   gold BB existant. Subscription à reconsidérer en V2.
8. **NFLPA licence** ✅ → **Pseudonymisé full + flag DB préparé**.
   V1 100% pseudonymisé (cf. `01-legal.md`). Prévoir flag `realNameDisplay`
   dans `NflPlayer` pour pivot futur sans migration lourde. Pas de coût upfront.

## KPI de succès V1

- **DAU NFL Fantasy** : 30% des DAU Pro League BB convertis (cross-sell)
- **Rétention W4** : 50% des users qui complètent une lineup S1 reviennent S5
- **Engagement** : 3 sessions/semaine en moyenne (jeudi prep, dimanche live, mardi review)
- **Coût API** : <100€/mois en V1 (nflverse + ESPN free)
- **Conversion mercato** : 20% des users dépensent au moins 1× du gold mercato sur inducements/rerolls

## Risques majeurs

| Risque | Impact | Mitigation |
|---|---|---|
| Évolution juris EU sur fantasy NFL non-licencié | Bloquant | Pseudonymisation forte, disclaimer, monitoring |
| Coût API si volume scale rapide | Élevé | Tier-up progressive (nflverse → MySportsFeeds → SportRadar) |
| Cannibalisation de la Pro League existante | Modéré | Calendaire complémentaire, cross-promo |
| Dilution narrative ("on est plus un jeu BB") | Modéré | Storytelling Gazette renforcé, mapping race strict |
| Saturation marché fantasy NFL (DraftKings/FanDuel/Sleeper) | Élevé | Niche BB-flavored, audience FR/EU sous-servie |
