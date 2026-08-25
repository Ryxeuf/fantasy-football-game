---
"@bb/game-engine": patch
"@bb/server": patch
"@bb/web": patch
---

La fiche d'équipe affiche l'alignement « Favori de… » gagné avec la Ligue régionale.

Une équipe Nordique créée avec la Ligue « Clash du Chaos » annonçait « Règles spéciales : Aucune ». Le moteur savait pourtant que cette Ligue apporte l'alignement Favori de Khorne (il conditionne déjà le recrutement des Star Players) : la fiche lisait seulement `Roster.specialRules`, c'est-à-dire les règles du roster et non celles de l'équipe.

- `resolveTeamSpecialRules()` (moteur, pur) résout les règles effectives = règles du roster + alignement apporté par la Ligue retenue ; `favouredOfLabel()` en donne l'intitulé (« Favori de Khorne » / « Favoured of Khorne »).
- `GET /team/:id` expose `team.specialRules` (localisé, paramètre `lang` accepté). Le web l'affiche avec repli sur les règles du roster pour rester compatible d'un serveur antérieur.
- Le sélecteur de Ligue à la création et la fiche d'équipe partagent désormais le même libellé d'alignement.
- Sans Ligue enregistrée (équipes antérieures à la règle), le repli historique est conservé : aucun alignement n'est retiré rétroactivement.
