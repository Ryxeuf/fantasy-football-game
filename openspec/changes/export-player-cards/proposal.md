# Cartes joueur exportables (façon cartes à collectionner)

## Why

Les coachs veulent partager et imprimer leurs joueurs comme les cartes
officielles Blood Bowl (bandeau nom, colonne MA/ST/AG/PA/AV, compétences,
« plays for », coût) : trophée après un match mémorable, carte souvenir d'un
joueur décédé, fiche de star player à glisser dans une conversation de
ligue. Le site sait déjà exporter un roster complet en PDF tabulaire
(`exportPDF.ts`) mais rien d'individuel ni de « beau » : aucune surface ne
produit un visuel par joueur, alors que toutes les données (stats,
compétences résolues FR/EN, carrière SPP/TD/sorties, coût, couleurs
canoniques du roster) existent déjà.

## What Changes

- **Modèle pur** `apps/web/app/lib/player-card/card-model.ts` :
  `PlayerCardData` auto-porté + builders `buildStarPlayerCardData` /
  `buildTeamPlayerCardData` + encodeur base64url et **décodeur validant**
  (bornes strictes par champ) pour transporter la carte dans une URL.
- **Template satori** `card-art.tsx` : carte 750×1050 px (poker 63,5×88,9 mm
  à 300 dpi), identité Nuffle Arena (marine + or + couleur canonique du
  roster), emblème programmatique (`renderTeamLogoSvg` / étoile), monogramme
  superposé, ruban MEGA-STAR / DÉCÉDÉ / LICENCIÉ, rubrique carrière (joueur)
  ou règle spéciale (star). Polices OFL committées dans
  `apps/web/assets/fonts/` (satori exige les TTF bruts).
- **Routes Next (nodejs)** :
  - `GET /api/player-card?d=<payload>&download=1` — renderer générique ;
  - `GET /star-players/[slug]/card?lang&download` — URL stable par star,
    données chargées serveur (même source que la fiche), prix de paire
    respecté.
- **UI** : boutons « Voir la carte » / « Télécharger la carte PNG » sur la
  fiche star player ; boutons 🃏/⬇️ par joueur sur la fiche d'équipe
  (tableau desktop + cartes mobile), payload construit client-side depuis
  les données déjà chargées. Évènement Umami `card-export`.
- **Helper** `getPlaysForCardLines` (plays-for) : sentinelle `all` → libellé
  unique, listes longues coupées avec « + N autres équipes ».

## Impact

- Aucun changement de schéma ni d'API Express : le renderer vit dans le
  serveur Next, comme les images OG existantes (même pipeline satori).
- Pas d'artwork Games Workshop dans les PNG téléchargeables : l'habillage
  est propre à Nuffle Arena et la zone portrait est un emblème
  programmatique (cf. design.md — contrainte technique ET prudence PI,
  cohérente avec la politique du compendium).
- `/api/player-card` accepte des payloads arbitraires **bornés** : décodeur
  validant, caps de longueur, réponse 400 sans rendu sinon. Coût satori
  ~quelques dizaines de ms par PNG, avec `Cache-Control: public` 1 h.
- +420 Ko de polices TTF committées (Bebas Neue, Montserrat 600/800 — OFL).
