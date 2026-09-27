# Tasks — exports PDF des compétitions

## 1. Gabarits (module pur `lib/competition-pdf`)
- [x] 1.1 Modèles de vue, thème impression, `pdfSafe`, mise en page commune
      (en-tête, bandeau courant, pied numéroté, champs, cases, grilles).
- [x] 1.2 Journée à venir (cases de score) et calendrier complet.
- [x] 1.3 Classement par poule + légende, barème et départages.
- [x] 1.4 Tops en cartes (joueurs / équipes).
- [x] 1.5 Bracket de play-offs en paysage (centrage par tour, vainqueur).
- [x] 1.6 Statistiques : chiffres clés, palmarès, totaux par équipe.
- [x] 1.7 Feuille de rencontre 5 pages (avant-match, deux pages d'équipe,
      journal, fin de match) ; sections gouvernées par les règles de
      compétition ; tables lues dans le moteur.
- [x] 1.8 Point d'entrée synchrone `render.ts`, chargement à la demande
      `download.ts`, noms de fichiers ASCII.

## 2. Adaptateurs (purs)
- [x] 2.1 Ligue : rencontres (score validé, statuts, poules), prochaine
      journée, classement par poule, tops, bracket, stats + awards.
- [x] 2.2 Coupe : rondes (système, exempts, score orienté), classement,
      podiums à rang partagé, stats, bracket (score servi).
- [x] 2.3 Feuille de match : joueurs (morts écartés, absents grisés,
      journaliers / Star Players / relevé), compteurs, journal codé,
      avant-match, JDM, règles de coupe.

## 3. Serveur
- [x] 3.1 `GET /leagues/seasons/:id/playoff-bracket` sert `matchSheet`
      (statut + score). Test de route.
- [x] 3.2 `resolveCompetitionPairing` lit le placement de la rencontre
      (journée / ronde, nom, stade, saison, date de la rencontre sinon de la
      ronde) via `fixtureInfoFromRow` (pur, tolérant à une ligne partielle) ;
      `getMatchSheet` le sert en `fixture`. L'adaptateur web en dérive
      l'en-tête (`sheetRoundLabel`), la saison et la date, avec repli
      « Rencontre » sur un serveur antérieur. Tests contexte, service, web.

## 4. Écrans
- [x] 4.1 `CompetitionPdfMenu` (menu, états occupé / erreur / désactivé).
- [x] 4.2 Fiche de ligue : `LeaguePdfExports`.
- [x] 4.3 Fiche de coupe : `CupPdfExports`.
- [x] 4.4 Feuille de match : `MatchSheetPdfButton`.
- [x] 4.5 `MatchdayExport` passe par le gabarit commun.

## 4bis. Feature flag (recette)
- [x] 4b.1 `competition_pdf_exports` : constante serveur + `KNOWN_FLAGS`,
      miroir web, seed prod (OFF, `update` sans toucher `enabled`), seed
      `/__test/seed-rosters` (ON pour les suites).
- [x] 4b.2 `useFeatureFlagOrOff` (fermé hors provider) ; gates sur les
      menus ligue / coupe et le bouton de feuille ; export de journée
      historique conservé flag OFF (`matchday-legacy-pdf`).
- [x] 4b.3 Tests : gate fermé hors provider / OFF, ouvert ON ; journée
      historique vs gabarit commun selon le flag.

## 5. Tests
- [x] 5.1 Rendu des 14 exemples (pages, textes, paysage, documents vides,
      feuille de coupe sans économie) + helpers.
- [x] 5.2 Adaptateurs ligue, coupe, feuille de match.
- [x] 5.3 Menu (téléchargement, entrée désactivée, erreur) ; test
      `MatchdayExport` adapté.

## Suites possibles (hors périmètre)
- [ ] Recette validée : activer puis retirer le flag `competition_pdf_exports`
      du code (constante, `KNOWN_FLAGS`, miroir web, gates, seeds,
      `matchday-legacy-pdf`) ; la ligne en base se supprime depuis l'admin.
- [ ] Version anglaise des PDF.
