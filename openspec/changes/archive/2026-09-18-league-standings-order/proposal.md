# L'ordre de classement d'une ligue se corrige, et se choisit

## Pourquoi

Retour d'usage : « le classement ne trie pas dans le bon ordre ».

Le tableau de classement affiche, dans cet ordre, **Pts | Bo | MJ | For |
TD+ | TD- | Diff TD | Sor+ | Sor- | Diff Sor**. Le TRI, lui, n'en lisait que
trois colonnes : points → différence de TD → TD marqués → différence de
sorties → nom. Deux colonnes bien visibles n'entraient donc jamais dans le
départage :

- **les points bonus (`Bo`)**, qui sont comptés À PART de `points` (c'est
  leur seule matérialisation) : une équipe qui gagne ses bonus passait
  derrière une équipe qui n'en a aucun, à points égaux ;
- **les forfaits (`For`)**, c'est-à-dire les points retirés par les forfaits
  déclarés : déclarer forfait ne coûtait rien au départage.

Le second manque est plus large : `League.tieBreakRules` existe depuis
L2.C.5 et l'API l'accepte, mais **aucun écran ne l'expose**. Ni le
formulaire de création, ni l'édition, ni la console admin — une ligue ne
pouvait en pratique pas s'écarter du défaut, et personne ne pouvait voir
lequel s'appliquait. La coupe, elle, a son éditeur depuis
`cups-managed-like-leagues`.

Enfin, `PATCH /leagues/:id` se verrouille dès qu'un match est joué (à juste
titre : y toucher au barème réécrirait des points déjà attribués). Une
erreur d'ordre de classement constatée en cours de saison était donc
définitive.

## Quoi

- **Le défaut suit les colonnes affichées** : points → bonus → forfaits
  (décroissant, donc zéro forfait devant un forfait) → différence de TD →
  différence de sorties → nom. Aucun backfill : l'ordre par défaut est
  appliqué à toute ligue qui ne configure rien, y compris celles
  antérieures à la colonne.
- **Le créateur compose son ordre** à la création comme à l'édition de sa
  ligue (liste ordonnée : ajouter, monter, descendre, retirer). L'ordre par
  défaut est annoncé en toutes lettres pour que « ne rien cocher » reste un
  choix informé.
- **Le commissaire comme un administrateur le corrigent à tout moment**
  (`PATCH /leagues/:id/standings-order`,
  `PATCH /api/admin/leagues/:id/standings-order`), y compris sur une ligue
  verrouillée, en cours ou archivée : le classement est trié À LA LECTURE,
  aucun compteur persisté ne bouge. La fiche de ligue garde son accès aux
  réglages dans ce cas, et l'écran sert un panneau réduit au lieu de
  rediriger — un réglage annoncé sans chemin d'accès équivaut à un réglage
  absent.
- **L'ordre appliqué est visible** : sous le tableau de classement pour les
  coachs, sur chaque ligne de la console admin (avec la mention
  « (defaut) ») pour les administrateurs.
- **Quatre critères de plus au catalogue** — points bonus, forfaits, sorties
  subies (le moins), matchs joués — en plus des neuf existants.

## Hors périmètre

- **Additionner les bonus aux points.** `points` reste le barème
  win/draw/loss pur et `Bo` son sous-total : c'est un critère de départage
  de plus, pas une redéfinition du total. Une ligue qui veut l'inverse
  n'a, pour l'instant, pas de levier.
- **Le classement des COUPES.** Il a déjà son éditeur et son catalogue
  (`cup-standings-criteria`) ; seul le composant d'édition est désormais
  partagé.
- **Ouvrir l'édition de la ligue au commissaire après le verrou.** Seul
  l'ordre de classement, qui ne touche à rien de persisté, échappe au
  verrou — et il y échappe pour les administrateurs.
