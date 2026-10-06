# Les dés et leurs faces dans le compendium

## Pourquoi

Demande du mainteneur : « il faut ajouter les dés et le design des faces de
dé dans les pages compendium, comme `/compendium/des-de-blocage` ». Le
chapitre des Dés de Blocage décrivait les cinq icônes du dé… sans jamais les
montrer, et les tables de jets (2D6, D16, D6, D8, 1ᵉʳ/2ᵉ D6) restaient des
colonnes de chiffres, alors que le site sait dessiner chaque dé dans le
thème du coach (`BlockDieIcon`, `D6Icon`, `NumberDieIcon`).

## Quoi

1. **Le Dé de Blocage déplié** : nouveau bloc `dice` (purement visuel, aucun
   texte de règle) dans le chapitre `des-de-blocage` — les six faces dans
   l'ordre du livre, Repoussé deux fois, chacune nommée.
2. **Une face par résultat nommé** : toute cellule de table qui porte le nom
   OFFICIEL d'une face du Dé de Blocage s'illustre de cette face.
3. **Les jets en faces de dés** : une colonne dont l'en-tête est un dé
   (« D6 », « 2D6 », « D8 », « D16 », « 1ᵉʳ D6 »…) dessine ses plages —
   faces à points pour un D6 (une par valeur), dés chiffrés pour un D8/D16,
   total chiffré pour 2D6. Le texte reste dans le DOM (lecteurs d'écran,
   recherche, indexation) ; ce qui n'est pas une plage du dé reste du texte.

Le thème de dés du coach s'applique (dé ORIGINAL or & charbon pour un
visiteur ou hors flag `dice_themes`). Le JSON publié ne reçoit AUCUNE
annotation de présentation hors du bloc `dice` : les notations de dés sont
RELUES depuis le texte existant (`compendium/dice-notation.ts`, pur).

## Hors périmètre (suites possibles)

- Mêmes faces dans les fiches de l'aide de jeu (`aide-de-jeu`), qui
  réutilisent les tables du compendium avec leur propre rendu.
- Illustration des autres dés (D3, D8, D16) en bloc `dice` dédié.
