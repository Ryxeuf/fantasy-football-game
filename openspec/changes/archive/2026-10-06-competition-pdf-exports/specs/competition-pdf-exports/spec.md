# competition-pdf-exports

## ADDED Requirements

### Requirement: Sept exports communs aux ligues et aux coupes

La fiche d'une ligue (saison sélectionnée) et la fiche d'une coupe DOIVENT
proposer un menu « Exports PDF » offrant : la prochaine journée (ronde en
cours pour une coupe), le classement, les tops, le calendrier complet, les
play-offs et les statistiques. Chaque document DOIT être produit par le MÊME
gabarit pour les deux compétitions, seule la traduction des données
différant. Une entrée sans objet (aucune journée, aucun bracket, aucun
classement) DOIT être désactivée.

#### Scenario: Export d'un classement de ligue
- WHEN un utilisateur choisit « Classement » sur une ligue à deux poules
- THEN un PDF DOIT être téléchargé avec un tableau par poule, dans l'ordre des poules
- AND les rangs qualificatifs de chaque poule DOIVENT être marqués

#### Scenario: Coupe sans play-offs
- WHEN la coupe n'a pas de bracket configuré
- THEN l'entrée « Play-offs » DOIT être désactivée

### Requirement: Recette derrière un feature flag

Tous les points d'entrée des exports PDF (menus de ligue et de coupe, bouton
de la feuille de match, nouveau gabarit de l'export de journée) DOIVENT être
conditionnés au feature flag `competition_pdf_exports`, désactivé par défaut.
Flag inactif pour le compte, aucun de ces points d'entrée NE DOIT être rendu
et l'export de journée historique DOIT garder son rendu antérieur. Hors
contexte de flags, le gate DOIT rester fermé.

#### Scenario: Coach sans le flag
- WHEN un coach sans override ouvre la fiche de sa ligue alors que le flag est désactivé
- THEN le menu « Exports PDF » NE DOIT PAS être affiché

#### Scenario: Testeur activé
- WHEN un override active le flag pour un compte
- THEN ce compte DOIT voir les menus d'export et le bouton de feuille imprimable

### Requirement: Rendu chargé à la demande

Le moteur de rendu PDF NE DOIT être chargé qu'au clic sur un export. Une
erreur de chargement des données (tops, palmarès, bracket) DOIT s'afficher
dans le menu sans télécharger de fichier.

#### Scenario: Échec de chargement du bracket
- WHEN l'utilisateur exporte les play-offs et que la lecture du bracket échoue
- THEN le message d'erreur DOIT s'afficher
- AND aucun PDF NE DOIT être téléchargé

### Requirement: Prochaine journée à remplir

L'export de la prochaine journée DOIT porter sur la première journée non
terminée (ligue) ou la première ronde ayant une rencontre ouverte (coupe),
sinon la dernière. Les rencontres DOIVENT être groupées par poule de l'équipe
à domicile quand au moins deux poules sont représentées, jamais pour une
ronde de bracket. Une rencontre non jouée DOIT présenter deux cases de score
vides ; un exempt DOIT être indiqué comme tel.

#### Scenario: Saison entamée
- WHEN les journées 1 à 4 sont terminées et la 5 en cours
- THEN l'export DOIT porter sur la journée 5

### Requirement: Scores imprimés

Un score de ligue NE DOIT être imprimé que s'il provient d'une feuille de
match VALIDÉE. Un score de coupe DOIT être celui du match local complété,
orienté domicile / extérieur. La route `GET /leagues/seasons/:id/playoff-bracket`
DOIT servir le statut et le score de la feuille de chaque rencontre.

#### Scenario: Feuille soumise non validée
- WHEN les deux coachs ont soumis la feuille mais que le commissaire ne l'a pas validée
- THEN aucun score NE DOIT être imprimé pour cette rencontre

#### Scenario: Vainqueur du bracket
- WHEN la finale est validée sur un score non nul
- THEN le vainqueur DOIT être imprimé dans la case « Vainqueur »

### Requirement: Feuille de rencontre imprimable

La feuille de match (ligue et coupe) DOIT proposer une feuille de rencontre
PDF en A4 paysage comprenant : l'avant-match (identité figée, popularité,
coups de pouce, prières, météo, toss, forfait), une page par équipe listant
chaque joueur disponible avec une case par action saisissable sur le site, un
journal des évènements avec ses légendes (types, blessures, table de coup
d'envoi 2D6 du moteur), la fin de match dans l'ordre du livre et les
signatures. Les joueurs morts NE DOIVENT pas y figurer ; un absent DOIT être
grisé ; journaliers, Star Players engagés et joueur relevé DOIVENT être
listés.

#### Scenario: Feuille vierge
- WHEN aucune saisie n'a été faite sur la feuille du site
- THEN la feuille imprimée NE DOIT porter ni score, ni évènement, ni compteur

#### Scenario: Feuille déjà saisie
- WHEN des évènements, un avant-match ou des JDM sont saisis sur le site
- THEN ils DOIVENT être reportés sur la feuille imprimée

#### Scenario: Rencontre de coupe
- WHEN la rencontre appartient à une coupe
- THEN la feuille NE DOIT comporter ni colonne de PSP, ni gains, ni améliorations, ni embauches, ni erreurs coûteuses

### Requirement: En-tête de la feuille de rencontre

`GET /leagues/pairings/:id/sheet` DOIT servir le placement de la rencontre :
numéro et nom de journée (ligue) ou de ronde (coupe), stade de bracket,
saison de ligue et date prévue (celle de la rencontre, sinon celle de la
ronde). Une donnée absente DOIT être servie `null` sans empêcher la lecture
de la feuille. La feuille imprimée DOIT en porter le libellé (« Journée 5 »,
« Ronde 3 », « Play-offs - Finale »), la saison et la date ; servie par un
serveur qui ne le fournit pas, elle DOIT retomber sur « Rencontre ».

#### Scenario: Rencontre de ligue
- WHEN la feuille imprimée porte sur la journée 5 de la « Saison 3 », prévue le 04/10/2026
- THEN l'en-tête DOIT indiquer « Journée 5 », la saison « Saison 3 » et la date prévue

#### Scenario: Finale de coupe
- WHEN la rencontre est la finale du bracket d'une coupe
- THEN l'en-tête DOIT indiquer « Play-offs - Finale »

### Requirement: Contenu imprimable

Les PDF DOIVENT être lisibles une fois imprimés : fond blanc, pied de page
« Page i / N » sur chaque page, bandeau rappelant la compétition sur les
pages de continuation. Tout caractère non encodable par les polices standard
(emoji, flèche, comparateur) DOIT être remplacé ou retiré.

#### Scenario: Nom d'équipe avec emoji
- WHEN une équipe s'appelle « 🏆 Les Crânes → Karak »
- THEN le PDF DOIT imprimer « Les Crânes > Karak »
