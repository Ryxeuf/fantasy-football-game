# Pronostiquer les rencontres de sa ligue

## Pourquoi

Entre deux matchs, une ligue sur table n'a rien à suivre : la prochaine
rencontre des autres ne concerne personne d'autre que ses deux coachs. Les
pronostics donnent un enjeu à CHAQUE rencontre de la journée, pour tous les
coachs de la ligue — et, si le commissaire l'ouvre, pour les spectateurs.

Tout ce que le dépôt sait faire en la matière vit dans la Pro League (paris à
cotes en Crowns, mini-ligues de pronostics, Survivor), GELÉE depuis le
2026-06-01 : rien n'est atteignable en production, et la ligue de base — celle
qui vit — n'a aucun pronostic. Une première session (« Paris sur matchs de
ligue », 2026-09-11) s'était arrêtée sur six décisions sans rien consigner ;
elles sont tranchées dans
[`docs/roadmap/explorations/2026-09-27-pronostics-de-ligue.md`](../../../docs/roadmap/explorations/2026-09-27-pronostics-de-ligue.md).

## Quoi

- **Un pick'em à points, pas un pari.** Sur chaque rencontre, on prédit le
  vainqueur (domicile, nul, extérieur) et, en option, le score exact en TD.
  Un résultat juste vaut 3 points — le nul comme la victoire —, le score
  exact 2 de plus. Ni cote, ni mise, ni monnaie.
- **Une portée par ligue** : `off`, `members` (défaut des ligues neuves :
  coachs d'une équipe active de la saison et commissaire) ou `open` (tout
  compte connecté qui voit la ligue). Elle se COMPOSE avec la visibilité : une
  ligue privée reste introuvable pour qui n'en fait pas partie, quelle que
  soit la portée. Une ligue antérieure (`null`) a les pronostics coupés
  jusqu'à ce que son commissaire les active — aucun backfill.
- **On ne pronostique pas sa propre rencontre.** Un coach retiré n'est plus
  membre.
- **La clôture tient seule** : elle s'écrit UNE fois sur la rencontre au
  premier évènement de la feuille, à la première soumission, au résultat ou
  à la clôture manuelle (le commissaire pour une journée, les coachs d'une
  rencontre pour la leur) ; la date prévue est relue à chaque lecture.
- **Rien des pronostics des autres avant la clôture** — ni répartition, ni
  noms, ni nombre —, et c'est le serveur qui ne les envoie pas.
- **Deux classements, une implémentation** : onglet Coachs (N-1 rencontres
  par journée) et onglet Tribunes (N), groupe relu à l'affichage. Classement
  DÉRIVÉ des pronostics réglés, jamais de compteur persisté ; invalider une
  feuille le remet d'aplomb seul.
- **Des gains qui servent** : le titre d'Oracle au palmarès de saison (le
  meilleur coach), cinq succès, et une notification par journée réglée.

## Hors périmètre

- **Les Crowns.** Le wallet est monté sous `/pro-league/**` (404 en prod) et
  aucun puits n'existe hors Pro League. Les points de pronostic sont
  persistés par pronostic : une conversion rétroactive restera possible le
  jour où la monnaie aura des usages (gate décrite dans l'exploration).
- **Les coupes.** Le modèle s'appelle `CompetitionPrediction` pour accueillir
  plus tard un `cupPairingId` sans renommage (un renommage de modèle sous
  `db push`, c'est DROP + CREATE).
- **Le widget « pronostics à faire » sur l'accueil** et la puce « ton prono »
  dans les cartes du calendrier.
- **D'autres types de pronostics** (sorties, morts, TD pairs…), lisibles dans
  le résumé de feuille mais hors v1.
