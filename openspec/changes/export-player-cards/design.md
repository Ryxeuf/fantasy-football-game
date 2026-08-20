# Design — Cartes joueur exportables

## Décision 1 : rendu serveur satori (`ImageResponse`) plutôt que client

Trois options examinées :

| Option | Pour | Contre |
| --- | --- | --- |
| **satori / `next/og` (retenue)** | pipeline déjà en prod (5 images OG), PNG déterministe 300 dpi, URL partageable, zéro dépendance nouvelle, marche sur mobile | flexbox uniquement, pas de webp, fontes à fournir |
| html-to-image côté client | fidélité CSS totale (le DOM devient l'image) | nouvelle dépendance, quirks Safari/fontes, rien de partageable (pas d'URL), impossible pour un bot/Discord |
| jsPDF (comme `exportPDF.ts`) | outil déjà présent | rendu « tableur », pas de dessin riche ; l'existant sert un autre besoin (feuilles complètes) |

Un PNG servi par une URL est à la fois l'aperçu (onglet), le téléchargement
(`?download=1` → `Content-Disposition: attachment`) et un embed potentiel
(Discord/forum). C'est aussi le seul chemin commun web + mobile Expo.

## Décision 2 : payload auto-porté dans l'URL pour les joueurs d'équipe

`/team/:id` est authentifié : un renderer serveur qui re-fetcherait le
joueur devrait faire suivre le token vers l'API Express. À la place, le
client (qui a déjà toutes les données affichées) construit un
`PlayerCardData` complet et l'encode en base64url dans `?d=`. Le renderer
est alors un pur « dessinateur » sans état ni auth — même modèle qu'un
générateur d'images à la volée.

Garde-fous (le payload est de l'entrée non fiable) :

- décodeur validant `decodeCardPayload` : bornes par champ (nom ≤ 80,
  ≤ 24 compétences, texte libre ≤ 340, coût ≤ 5 M, stats 0–15…), caractères
  de contrôle neutralisés, `rosterSlug` filtré par regex — tout écart → 400 ;
- cap global `MAX_ENCODED_PAYLOAD_LENGTH` (8 Ko) avant même le décodage ;
- aucune donnée sensible : uniquement des champs d'affichage que l'auteur
  voit déjà (le pire abus possible est « dessiner une fausse carte », comme
  n'importe quel générateur de meme).

Les stars restent servies par une URL canonique
(`/star-players/[slug]/card`) : données publiques chargées côté serveur
(`fetchServerJson`, revalidate 1 h) — partage stable, prix de paire (Lot G)
appliqué comme sur la fiche.

## Décision 3 : emblème programmatique, pas de portrait bitmap

Deux contraintes convergent :

1. **Technique** : satori ne décode pas les `.webp` (vérifié : « a is not
   iterable ») — or les 68 portraits de stars du site sont en webp, et il
   n'y a ni `sharp` ni décodeur webp dans les dépendances. Les `<text>` des
   SVG embarqués ne sont pas rendus non plus (resvg sans fontes), d'où le
   monogramme superposé en texte satori par-dessus la forme du logo.
2. **Prudence PI** : produire un fichier téléchargeable qui imite
   l'habillage GW *avec* l'artwork GW serait une reproduction bien plus
   exposée que l'affichage web existant. Même politique que le compendium
   (contenu publié réécrit) : structure d'information similaire,
   **habillage propre** — marine/or Nuffle Arena, couleurs canoniques du
   roster, emblème `renderTeamLogoSvg` (dont la doc prévoyait déjà l'usage
   satori) ou étoile pour les stars.

Évolution possible (hors scope) : pipeline de conversion webp→png committé
pour réintroduire les portraits *maison* si on en produit un jour.

## Décision 4 : polices OFL committées

satori exige les données TTF brutes ; `next/font` ne les expose pas au
runtime et un fetch Google Fonts à chaud serait un point de panne réseau en
prod. Bebas Neue 400 + Montserrat 600/800 (~420 Ko, licence SIL OFL 1.1,
familles déjà dans l'identité du site) sont committées dans
`apps/web/assets/fonts/` et lues via `process.cwd()` — le Dockerfile web
copie tout `apps/web`, donc le chemin vaut en dev comme en prod. Le cache
de chargement est process-wide et un échec fs n'est pas figé dans le cache.

## Dimensions et gabarit

750×1050 px = carte poker 63,5×88,9 mm à 300 dpi : imprimable telle quelle,
sleeves standard. Gabarit : bandeau nom incliné pleine largeur (taille de
police dégressive selon la longueur), rail gauche MA/ST/AG/PA/AV
(`formatPlusStat` pour AG/PA/AV, PA null → « - »), badge coût (COÛT/VALEUR +
montant + PO/GP), zone emblème extensible (flexGrow — absorbe la hauteur
libre), rubriques COMPÉTENCES & TRAITS / JOUE POUR / RÈGLE SPÉCIALE ou
CARRIÈRE (chips MATCHS/TD/SORTIES/PSP), pied de carte marque + domaine.
