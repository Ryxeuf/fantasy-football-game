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

À trancher avant POC implementation :

1. **Mode mercato** : draft snake (MPG-like), auction budget (Yahoo-like),
   ou achat libre via wallet (mercato BB existant) ?
2. **League size** : 8, 10 ou 12 users par league ?
3. **Captain slots** : 1 captain ×2 (Sorare) ou 1 captain ×1.5 + 1 vice ×1.2 ?
4. **Prières à Nuffle conditions** : underdog par TV (Team Value) ou
   par classement (loser bracket) ?
5. **Race assignment fixe ou dynamique** : un joueur NFL gagne sa race
   intrinsèque (cf. archétype) ou hérite de la race de son équipe ?
6. **Cross-pollution avec Pro League** : un joueur NFL "carrière fini"
   peut-il être recruté dans une équipe Pro League BB simulée ?
7. **Monétisation** : freemium (achievements gratuits + mercato gold)
   ou subscription premium (boost rerolls, mercato premium) ?
8. **NFLPA licence** : démarrer pseudonymisé full puis upgrade, ou
   licencier dès le départ pour pas avoir à pivoter ?

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
