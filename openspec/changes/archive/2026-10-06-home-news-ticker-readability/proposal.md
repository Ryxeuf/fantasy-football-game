# Bandeau « À la une » lisible : cartes de résultats + ligne d'actualité

## Pourquoi

Retour du mainteneur : « les infos sont très peu lisibles ». Le bandeau
défilait en continu (`translateX(-50%)` sur une durée fixe) :

- vitesse proportionnelle à la LONGUEUR du texte, donc imprévisible ;
- 14 px, contexte à 60 % d'opacité, étiquettes 11 px toutes dorées ;
- score noyé dans la phrase (« Rats 2 – 1 Nains »), vainqueur non marqué ;
- 🏆 et 🥇 quasi identiques pour ligue et coupe ;
- `roster` et `at` servis par l'API mais jamais affichés ;
- lire une cible en mouvement est pénible, surtout sur mobile.

Trois pistes maquettées (une info à la fois / cartes de scores / hybride),
piste D retenue.

## Quoi

1. **Résultats en cartes fixes** : badge de famille, âge relatif, compétition,
   deux lignes « écusson du roster + équipe + score », vainqueur en gras et
   score doré, mention forfait. Défilement horizontal au doigt (scroll-snap)
   ou par flèches (bureau).
2. **Actualités sur une ligne tournante** (Gazette, inscriptions ouvertes) :
   une à la fois toutes les 6 s, flèches, compteur, pause (bouton, survol,
   focus clavier) ; pas de rotation automatique si l'utilisateur a demandé
   moins d'animations.
3. **Une couleur par famille** : Ligue or, Coupe rouge, Gazette ivoire,
   Inscriptions vert.
4. **Âge relatif** (« il y a 2 h ») via `Intl.RelativeTimeFormat`.

API inchangée : tout ce qu'il faut est déjà servi. Toujours derrière
`home_news_ticker` (OFF).

## Hors périmètre (suites possibles)

- Nom de roster en infobulle de l'écusson (demande le catalogue des rosters).
- Lien « Tous les résultats » quand une page d'agrégat existera.
