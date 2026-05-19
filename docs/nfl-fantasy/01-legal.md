# 01 — Cadre légal & Pseudonymisation

> **⚠️ Disclaimer** : ce document est une synthèse d'orientation issue
> d'une session d'exploration. Il **ne remplace pas** un avis juridique
> formel. Avant lancement commercial, validation par un juriste IP/RGPD
> (FR + US) est obligatoire.

## TL;DR

| Élément | Statut US | Statut EU/FR | Action recommandée |
|---|---|---|---|
| Noms réels joueurs NFL | ✅ Autorisés (CBC v. MLB AM) | ⚠️ Zone grise (droit à l'image) | Pseudonymiser par sécurité |
| Stats réelles (yards, TD, sacks) | ✅ Faits, non protégés | ✅ Faits, non protégés | Libre usage |
| Noms d'équipes NFL (Chiefs, Eagles) | ❌ Trademark NFL | ❌ Trademark NFL | Utiliser ville uniquement |
| Logos NFL et équipes | ❌ Trademark NFL | ❌ Trademark | Bannir totalement |
| Photos / headshots joueurs | ❌ Copyright + publicity | ❌ Droit à l'image | Bannir, créer avatars BB |
| Uniformes / couleurs officielles | ❌ Trade dress | ❌ Trade dress | Couleurs BB de la race |
| Surnoms trademarkés (TB12, Megatron) | ❌ Trademark individuel | ❌ | Bannir |

## Précédent CBC v. MLB AM (8th Circuit, 2007)

### Faits
- CBC Distribution opérait un fantasy baseball commercial utilisant noms réels
  et stats réelles des joueurs MLB
- MLB Advanced Media exigeait une licence "right of publicity"
- CBC refusait et a continué d'opérer

### Décision (Cour fédérale 8e circuit)
- Le **1er Amendement** (free speech) **prime** sur le right of publicity
  des joueurs dans ce contexte
- **Noms + stats des joueurs sont des informations factuelles**, protégées
  par la liberté d'expression
- Le fantasy sport sans licence est légal

### Portée et limites
- ✅ Précédent fédéral US, suivi dans plusieurs autres circuits
- ✅ Confirmé en pratique : Yahoo, ESPN, CBS opèrent sans licence
  (DraftKings/FanDuel achètent quand même pour photos + relation)
- ⚠️ **Non transposable automatiquement en droit européen**
- ⚠️ Ne protège PAS l'usage des marques (trademarks NFL)

## Droit européen / France

### Article 9 Code civil (droit à l'image)
Toute personne a droit au respect de sa vie privée et de son image.
Usage commercial du nom et de l'image d'une personne **liés à un produit
ou service** nécessite consentement.

### RGPD
Le nom d'une personne physique est une **donnée personnelle**. Traitement
commercial nécessite une **base légale** : consentement, contrat, intérêt
légitime (à arbitrer).

### Risque pratique
Aucune jurisprudence française tranchée sur les fantasy sports US non-licenciés.
Position défensive : pseudonymisation pour éviter le test.

Référence pratique : **Sorare, MPG, Mon Petit Gazon** prennent tous des
licences (LFP, NBA, MLB) précisément pour blinder le risque EU, même
quand le précédent US les couvrirait.

## Stratégie en 3 niveaux de risque

### Niveau 1 — POC / hobby / interne
- Noms réels joueurs NFL utilisables
- Stats réelles, libres
- Pas de logos NFL, pas de photos
- Disclaimer "Not affiliated with NFL or NFLPA"
- Usage : développement, tests internes, communauté privée
- Risque EU : modéré, acceptable en non-commercial

### Niveau 2 — Lancement commercial petit budget ✅ RECOMMANDÉ
- **Pseudonymisation totale** des noms joueurs et équipes
- Stats : 100% réelles
- Noms joueurs : titres BB-flavored + numéros de maillot + ville
- Noms équipes : `{Ville} {Race BB}`
- Couleurs : palette de la race BB (pas couleurs NFL officielles)
- Avatars : créés sur mesure dans style BB (pas photos)
- Référencement croisé (vraie identité ↔ pseudo BB) **côté code privé**,
  pas exposé publiquement
- Disclaimer fort, terms of service explicites

### Niveau 3 — Échelle commerciale (>10k DAU)
- **NFLPA Group Licensing Agreement (GLA)** : ~$50-150k entry + royalties
  sur revenue. Couvre ~2000 joueurs actifs.
- Accès aux photos officielles via NFLPA
- Pas de licence NFL équipes (Properties LLC) si on garde le `{Ville}+Race BB`
- Possibilité de licencier individuellement les stars hors NFLPA si besoin
- Toujours pas de logos NFL ou d'uniformes officiels

## Conventions de pseudonymisation (Niveau 2)

### Équipes : `{Ville canonique} {Race BB}`

Les **villes** ne sont pas des marques NFL (ce sont des géonymes publics).
Seuls **les noms d'équipes** sont protégés (NFL Properties LLC).

Exemples :
- ✅ "Kansas City Skaven", "Philadelphia Orcs", "New Orleans Necromantic"
- ❌ "Chiefs", "Eagles", "Saints" (trademarks)
- ❌ Logos, couleurs officielles (trade dress)

Cas particuliers villes partagées :
- Los Angeles : `Los Angeles (R-side) Wood Elves` (Rams) /
  `Los Angeles (C-side) Khorne` (Chargers)
- New York : `New York (G-side) Dwarfs` (Giants) /
  `New York (J-side) Khorne` (Jets)
- East Rutherford ou MetLife pour distinguer si on veut éviter NY ambiguïté

### Joueurs : `{Titre BB} de {Ville}, #{Numéro}`

Format public :
```
{Adjectif descriptif} {Poste BB} de {Ville}, #{Jersey number}
```

Exemples :
- "Le Sidearm Wizard de Kansas City, #15" → identifiable comme Mahomes
- "La Sack Beast de Bay Area, #97" → identifiable comme Bosa
- "Le Catcher Griddy du Northland, #18" → identifiable comme Jefferson
- "Le Thrower Barbu de Buffalo, #17" → identifiable comme Allen

L'utilisateur fan de NFL fait immédiatement le lien grâce au numéro,
la ville et le descripteur. Le mapping `(pseudo → vraie identité)` est
**stocké côté code privé** uniquement, jamais exposé publiquement
(pour préserver le caractère factuel de la stat mais pseudonymisé du nom).

### Pseudonymisation programmatique

```ts
// nfl-mapper/src/pseudonymize.ts
interface NflPlayerRealId {
  realName: string;     // PRIVÉ - jamais exposé public
  team: NflTeamCode;
  jerseyNumber: number;
  position: NflPosition;
  archetype: PlayerArchetype; // speed, power, etc.
}

interface NflPlayerPublicAlias {
  pseudonym: string;     // "Le Sidearm Wizard de Kansas City"
  cityTag: string;       // "Kansas City"
  jerseyNumber: number;  // 15 — OK, jersey numbers ne sont pas IP
  bbPosition: BbPosition;
  bbRace: BbRace;
}

// Mapping privé en base, jamais sérialisé vers le client
// Public API renvoie uniquement NflPlayerPublicAlias
```

### Avatars BB

Pas de photos réelles. Trois options :
1. **Avatars génériques par race+poste** : 8 races × ~6 postes = 48 avatars
2. **Génération procédurale** par traits (race, taille, couleur, équipement)
3. **Avatars uniques sur mesure** pour les "stars" (top 50 joueurs NFL)

Recommandation MVP : option 1, upgrade vers option 2 ou 3 à terme.

## Disclaimer recommandé (footer + about page)

> NFL Fantasy by Nuffle Arena is an independent fantasy football game.
> NFL, the NFL shield, team names, and team logos are registered trademarks
> of NFL Properties LLC. This product is not affiliated with, endorsed by,
> sponsored by, or specifically approved by NFL Properties LLC, the National
> Football League, the NFL Players Association, or any of its member teams
> or players.
>
> Player names referenced in this product are used in their factual context,
> protected under the First Amendment as established in CBC Distribution and
> Marketing v. Major League Baseball Advanced Media (8th Cir. 2007). All
> player statistics are obtained from publicly available factual data sources.

## Terms of Service — clauses critiques

- Pas d'argent réel directement misé (pas de gambling / paris d'argent)
- Récompenses en gold virtuel et items BB uniquement (in-game)
- Pas de cash-out (pas de retrait en monnaie réelle)
- Pas de loot boxes aléatoires (à éviter pour ne pas tomber sous régulation gambling)
- Cookies + RGPD compliance (déjà géré par le projet existant)
- Restriction d'âge : 18+ (cohérence avec règles fantasy commerciales)

## Veille à organiser

À monitorer trimestriellement :
- Évolutions législatives EU sur les fantasy sports (en particulier
  ANJ France, UKGC UK, BZGA Allemagne)
- Décisions DGCCRF ou CNIL sur les data sportives commerciales
- Évolutions licensing NFLPA (deals, pricing)
- Mouvements concurrents (Sorare NFL si lancé, Sleeper EU, DraftKings EU)
