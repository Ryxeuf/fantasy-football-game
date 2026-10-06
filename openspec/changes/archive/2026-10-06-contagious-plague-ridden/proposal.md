# Trait « Contagieux » : la seconde source de joueur relevé

## Pourquoi

« Relever le Mort » (Maîtres de la Non-vie, change `raise-the-dead-masters-of-undeath`)
a doté la feuille de match d'un joueur SYNTHÉTIQUE né pendant le match. Le
livre connaît une seconde règle du même genre, portée non par une équipe mais
par un Trait de joueur : **Contagieux** (Nurgle — chaque Pourri, Boursoufflé,
Pestigor et Rejeton Putride le porte ; Guffle Pussmaw aussi).

> Une fois par match, quand un joueur ayant ce Trait inflige une Élimination
> à un joueur adverse suite à une Action de Blocage, et que le joueur subit un
> résultat Mort […], vous pouvez immédiatement ajouter 1 nouveau joueur
> Trois-quart de votre Fiche d'Équipe à votre Box des Réserves. […] Pendant la
> Séquence d'Après Match, vous pouvez embaucher ce joueur de la même manière
> que les Joueurs Journaliers. On ne peut pas utiliser ce Trait contre des
> joueurs Gros Bras, ni un joueur ayant les Traits Décomposition,
> Régénération ou Minus.

Elle avait été consignée au backlog des suites (`openspec-suites.md`). Sans
elle, un coach Nurgle est dans la situation d'Ombrelame avant le change
précédent : gérer « avec un achat de joueur lineman » — sauf que la recrue ne
joue pas le match et ne gagne pas ses PSP.

## Quoi

- La feuille reconnaît une **seconde source** de relevé, `plague_ridden`, à
  côté de `masters_of_undeath` : un côté en dispose dès qu'un de ses joueurs
  (roster, journalier aligné, Star Player engagé) porte le Trait (slugs
  `contagieux` en Saison 3, `plague-ridden` sur le catalogue antérieur et les
  Star Players).
- Une victime est contaminable si elle est morte sur un **blocage** dont
  l'auteur porte le Trait, et n'est ni Gros Bras (Mot-clé du poste), ni
  Décomposition, ni Régénération, ni Minus. Pas de plafond de Force.
- Le Contaminé est le même joueur synthétique (`raised-<side>-1`, un par côté
  et par match) : pickers, PSP, Joueur du Match, évolution, tirage « Hasard ».
  Il se libelle « Contaminé (<poste>) ».
- Il s'embauche **au prix du poste** (plus le surcoût de son évolution),
  « de la même manière que les Joueurs Journaliers » — jamais gratuitement.
  Le montant saisi est ignoré dans les deux cas : c'est la règle qui fixe le
  prix.
- L'API expose `raiseDead.sources`, `victims[].source`, `raisedDead.source`
  et `raisedDead.hireCost` ; le web adopte le vocabulaire de la règle
  (☣️ Contaminé, « Contaminé (prix du poste) »). Aucune colonne nouvelle : la
  source se redérive de l'éligibilité, la gratuite l'emportant si les deux
  règles s'appliquent.

## Hors périmètre

- Blessures durables subies par le relevé pendant le match : non reportées
  s'il est recruté (même limite que le journalier — déjà au backlog).
- Un second relevé sur le même côté quand les deux règles jouent dans le
  même match (Morts-Vivants avec Guffle Pussmaw) : un seul choix par côté,
  la victime gratuite étant préférée.
