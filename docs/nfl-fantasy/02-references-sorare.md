# 02 — Études de cas : Sorare et concurrents

> Ce document analyse les concurrents et références du fantasy sport
> multi-sport pour informer nos choix d'architecture et de gameplay.

## Sorare — référence principale

### Identité

- **Fondé** : 2018, Paris, par Nicolas Julia & Adrien Montfort
- **Funding** : Série B record sept 2021 — **680M$ menée par SoftBank**,
  valorisation 4.3Md$
- **Effectif** : ~200 personnes (après layoffs 2023 -13%)
- **HQ** : Paris + bureaux NY

### Produit

Fantasy sport où l'utilisateur construit une lineup hebdo de 5 cartes
joueurs (NFT sur StarkNet L2) et score selon les vraies performances
en match. Classements, divisions, récompenses en cartes + ETH.

### Multi-sport (point clé pour notre architecture)

| Sport | Lancement | Licence |
|---|---|---|
| Football (soccer) | 2019 | 330+ clubs (PL, La Liga, Bundesliga, Ligue 1, MLS, etc.) |
| MLB (baseball) | juillet 2022 | Officielle MLB + MLBPA |
| NBA (basketball) | octobre 2022 | Officielle NBA + NBPA |
| NFL | en discussion 2022-24 | Jamais lancé |

**Architecture multi-sport** : chaque sport est un silo de **scoring**
mais partage l'infra commune (wallet, marketplace, manager profile,
divisions, ladder, gamification).

**Leçon** : c'est exactement le pattern "axe additionnel" qu'on
recherche. Tu peux ajouter un sport sans refondre l'app.

### Mécaniques de jeu transposables

#### Lineup hebdo
- 5 cartes par compétition
- 1 Captain (×1.2 ou ×2 selon mode)
- Lock au kickoff
- Foot : GK + Def + Mid + Fwd + Extra
- NBA : 5 joueurs
- MLB : 7 joueurs

#### Scoring par sport
- **Foot** : engine maison + data Opta (decisive actions, passes,
  tackles, bonus/malus position)
- **NBA** : fantasy points classiques (pts + reb + ast + stl + blk - to)
- **MLB** : sabermetrics-influenced

#### Compétitions en pyramide (depuis "Sorare PRO" 2024)
- Champion Europe / Global All-Star / Underdog / Specialist /
  Captain Mode / Single Game Week
- Promotion/relégation entre divisions D1 → D5
- Récompenses scalées par division

#### Cartes et rareté (économie)

| Rareté | Quantité | Valeur typique | Usage |
|---|---|---|---|
| Common | Gratuites | 0 | Compétitions Casual uniquement |
| Limited | 1000/saison/joueur | ~5-500€ | Toutes compétitions |
| Rare | 100/saison/joueur | ~50-5000€ | Toutes compétitions |
| Super Rare | 10/saison/joueur | ~500-50000€ | Toutes compétitions |
| Unique | 1/saison/joueur | jusqu'à 700k€ | Toutes compétitions |

Mbappé Unique vendu **685k€** en 2022 (pic du marché).

#### Mercato
- Enchères primaires Sorare (nouvelles cartes)
- Marché secondaire P2P (manager-à-manager)
- Fee Sorare 5% sur secondaire
- ETH natif, on/off-ramp Ramp/Moonpay

### Business model

| Source | % revenue 2022 | Notes |
|---|---|---|
| Vente primaire cartes | ~70% | Enchères Sorare |
| Fee 5% marché secondaire | ~25% | P2P |
| Subscriptions PRO | ~5% (2024+) | $8-30/mois |
| Sponsoring (kit deals, endorsements) | indirect | Bayern, Real, PSG, Mbappé equity holder |

Revenue 2022 ~115M$. 2023 en chute libre (post-NFT crash). 2024
restructuration vers subscription + gameplay-first.

### Galères / leçons pour nous

1. **Bull NFT 2021 → crash 2022-23** : prix cartes -70 à -90% depuis peak
   - **Leçon** : gameplay doit tenir SANS spéculation
   - **Notre choix** : pas de NFT, ownership en SQL classique

2. **Régulation gambling**
   - ANJ FR enquête 2022 → conclusion 2024 borderline mais pas illégal
   - UKGC pareil
   - **Leçon** : frontière skill vs chance scrutée
   - **Notre choix** : pas de loot boxes randomisées, pas de mise cash direct

3. **Layoffs 2023** (-30 personnes / 13%)
   - **Leçon** : ne pas sur-anticiper la croissance

4. **NFL absent** : ~2 ans de discussions, jamais conclu
   - **Cause** : NFLPA licence très chère + lobby DraftKings/FanDuel
   - **Opportunité pour nous** : marché EU NFL fantasy peu servi

### Ce qu'on copie de Sorare

✅ Architecture multi-sport avec scoring engine plug-in par sport
✅ Wallet + mercato + ladder + divisions mutualisés
✅ Captain multiplier
✅ Single Game Week mode
✅ Pyramide promotion/relégation
✅ Common cards gratuites pour onboarding

### Ce qu'on évite (leur erreur, notre avantage)

❌ **Pas de NFT** : ownership en SQL, pas de blockchain, pas de gas fees,
   pas de volatilité crypto
❌ **Pas de licence officielle** au départ : pseudonymisation niveau 2
❌ **Gameplay-first dès jour 1** : pas de marketing "investissement",
   on est un jeu

## Concurrents fantasy NFL US

### DraftKings / FanDuel
- **Type** : DFS (Daily Fantasy Sports)
- **Modèle** : entry fee $$$, prizes cash
- **Licence** : NFLPA officielle
- **Audience** : US, gambling-oriented
- **Pourquoi pas pour nous** : régulation gambling EU, marché saturé US

### Sleeper
- **Type** : season-long fantasy, free-to-play
- **Audience** : ~3M users US
- **USP** : UX moderne, social, communautaire
- **Levier croissance** : focus mobile-first
- **Pourquoi étudier** : meilleure UX fantasy actuelle, à inspirer

### ESPN / Yahoo / CBS Fantasy
- **Type** : season-long, gratuit
- **Audience** : audience massive US grâce aux portails média
- **Modèle** : pub + premium leagues
- **Pourquoi pas concurrent direct** : on cible EU + skin BB original

### Underdog Fantasy
- **Type** : best-ball + pick'em
- **Levée** : valorisation 1.2Md$ en 2023
- **USP** : draft sans gestion hebdo
- **Inspiration** : peut-être un mode best-ball BB à terme

## Concurrents fantasy FR/EU

### Mon Petit Gazon (MPG)
- **Fondée** : 2014, FR
- **Audience** : ~3M users actifs (FR + EU + LATAM)
- **Sports** : Foot principalement (L1, L2, Ligue des Champions, PL, Liga...)
- **Modèle** : freemium (premium leagues payantes ~10€/saison)
- **USP** : focus mercato à enchères live + notation post-match
- **Acquisition** : racheté par Sorare en 2024 (annoncé)
- **Pourquoi référence** : pattern UX/mercato/scoring à copier directement

### Comunio (DE/ES)
- **Type** : fantasy foot classique
- **Audience** : surtout DACH + Espagne
- **Moins intéressant** : peu d'innovation gameplay

## Concurrents fantasy crypto (post-Sorare)

### Olympus Reign, Fantasy.top, etc.
- **Type** : NFT fantasy (post-Sorare clones)
- **Audience** : crypto natifs, niche
- **Pourquoi pas pour nous** : on s'éloigne du NFT pour audience mainstream

## Tableau comparatif synthèse

| Plateforme | Sport | Modèle | Audience | License | Notre takeaway |
|---|---|---|---|---|---|
| Sorare | Multi | NFT cards | ~1M actifs | Officielle | Archi multi-sport, pas de NFT pour nous |
| DraftKings | NFL DFS | Pay-to-play cash | ~10M US | Officielle | Trop gambling, hors scope |
| Sleeper | NFL season | Freemium social | ~3M US | Sans (CBC) | UX à étudier de près |
| MPG | Foot season | Freemium | ~3M EU | Officielle | Mercato à enchères + notation |
| Yahoo Fantasy | NFL season | Gratuit pub | massive US | Sans (CBC) | Reference UX classique |
| Underdog | NFL best-ball | Pay-to-play | ~500k US | Sans (CBC) | Best-ball mode futur |

## Inspirations design / UX

À étudier pour les mockups :
- **Sorare iOS** : lineup builder, captain selection
- **Sleeper iOS** : feed social, league chat, transactions
- **MPG iOS** : enchères live, notation 0-10
- **Sorare NBA** : scoring board hebdo, breakdown stats
- **DraftKings** : optimizer (à éviter — trop gambling-feel)

## Sources

- Sorare Help Center : <https://sorare.com/help>
- Sorare blog : <https://blog.sorare.com>
- CBS Insights Sorare profile (privé)
- Crunchbase Sorare profile (publique)
- Articles TechCrunch / Sifted sur layoffs 2023
- Communiqués officiels Sorare/Olympique de Marseille/PSG sleeve deals
