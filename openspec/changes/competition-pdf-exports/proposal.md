# Exports PDF imprimables des ligues et des coupes

## Pourquoi

Les ligues et les coupes de Nuffle Arena se jouent SUR TABLE : au club, en
tournoi, autour d'un terrain en carton. Or tout ce qui s'organise autour de la
table vit uniquement à l'écran. Pour afficher la journée au mur du club,
distribuer le classement ou jouer un match sans téléphone à la main, les
commissaires recopiaient les données du site.

Le seul export existant (`MatchdayExport`, une journée de ligue) produisait un
tableau brut sans poule ni score, et rien n'existait pour les coupes. Surtout,
aucune **feuille de rencontre papier** ne correspondait à ce que la feuille de
match du site permet de saisir : les coachs notaient les évènements sur une
feuille libre, puis les ressaisissaient de mémoire.

## Quoi

Sept documents PDF, **identiques pour une ligue et pour une coupe** (seule la
traduction des données diffère) :

1. **Prochaine journée / ronde en cours** — rencontres groupées par poule,
   cases de score VIDES à remplir au stylo, date prévue, encadré de rappel.
2. **Classement** — un tableau par poule (général sinon), rangs qualificatifs
   marqués, barème et départages appliqués, légende des colonnes.
3. **Tops** — une carte par catégorie (joueurs puis équipes), podium médaillé.
4. **Calendrier complet** — toutes les journées / rondes, scores connus.
5. **Play-offs** — arbre d'élimination directe en paysage, jusqu'au vainqueur.
6. **Statistiques** — chiffres clés, palmarès, totaux par équipe.
7. **Feuille de rencontre** (A4 paysage, 5 pages) — tout ce que la feuille de
   match du site permet de saisir, à remplir autour de la table :
   avant-match (identité figée, popularité, coups de pouce, prières, météo,
   toss, forfait), une page par équipe (profil de chaque joueur + une case par
   action : TD, passe, réception, interception, sortie, agression, lancer,
   atterrissage, expulsion, JDM, blessure, PSP gagnés), journal des
   évènements avec légendes (codes, blessures, table de coup d'envoi 2D6),
   fin de match dans l'ordre du livre (p.68) et signatures. Ce qui est déjà
   saisi sur le site est reporté ; une coupe (aucun or, PSP ni évolution) ne
   dessine que le résultat.

Accès : un menu « Exports PDF » sur la fiche de ligue et sur la fiche de coupe,
un bouton « Feuille imprimable (PDF) » sur la feuille de match. L'export de
journée existant passe par le même gabarit.

Côté serveur, deux ajouts, tous deux additifs :

- `GET /leagues/seasons/:id/playoff-bracket` sert le statut et le score de la
  feuille de chaque rencontre (le bracket ne pouvait imprimer aucun résultat) ;
- `GET /leagues/pairings/:id/sheet` sert `fixture` — journée ou ronde, nom,
  stade de bracket, saison et date prévue — pour que la feuille imprimée
  porte « Journée 5 » (ou « Ronde 3 », « Play-offs - Finale ») plutôt qu'un
  « Rencontre » anonyme.

## Hors périmètre

- Génération côté serveur (PDF envoyé par e-mail, lien permanent).
- Export des rosters d'équipe (existe déjà dans `/me/teams`).
- Traduction anglaise des PDF (le contenu imprimé est en français).
