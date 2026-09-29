# Home compacte : l'essentiel en un à deux écrans

## Pourquoi

Retour du mainteneur : « j'ai l'impression de devoir aller loin sur la page
pour avoir les infos utiles ». Mesuré (navigateur headless, API simulée, FR) :

| | Bureau (900 px) | Mobile (844 px) |
|---|---|---|
| Titre « Gestion de ligue » | 3,5 écrans | **6,0 écrans** |
| Longueur totale | 6,1 écrans | **10,0 écrans** |

La home vendait un catalogue (rosters, Star Players, compétences) alors que
la valeur du site est devenue la gestion de compétitions. Le hero faisait à
lui seul 1,9 écran sur mobile ; cartes à paragraphe + « Accès rapide »
(mêmes liens) 2,2 écrans ; trois sections de fin redisaient le hero.

## Quoi

1. **Hero compact** : sans logo en double ni second paragraphe ; médaillon et
   lanceur de dés réservés aux écrans larges. Appel principal : inscription
   (retour aux équipes) pour un visiteur, `/me/teams` pour un coach reconnu ;
   bouton secondaire vers les ligues ; lien « Déjà un compte ? ».
2. **Compétitions juste après le hero**, en deux cartes côte à côte.
3. **Catalogue en tuiles** (icône, titre, une ligne), toutes liées, dont les
   règles, l'aide de jeu et la tier-list ; plus d'« Accès rapide ».
4. **Factions** après le catalogue, écus cliquables vers `/teams/<slug>`,
   libellés traduits.
5. **Fin de page** : FAQ puis un bloc final unique (appel + soutien).
6. **Gazette** en liste compacte sous `sm`.

Résultat : ligue à 1,3 écran (bureau et mobile), page à 4,4 / 5,5 écrans.
Direction artistique inchangée.

## Hors périmètre (suites possibles)

- Captures du produit dans le hero et le JSON-LD (`screenshot` = logo).
- FAQ JSON-LD alignée sur la FAQ affichée (7 questions contre 5).
- Home en composant serveur + ISR (blog et stats dans le HTML servi).
- Variante coach connecté (prochain match en tête).
