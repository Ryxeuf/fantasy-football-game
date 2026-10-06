# dice-themes

## MODIFIED Requirements

### Requirement: Le coach choisit son thème dans la boutique
Quand le flag est actif, la catégorie « Thèmes de dés » de la boutique
(`/me/shop/dice-themes`) DOIT lister les thèmes en vente et ceux que le
coach possède, avec un aperçu de leurs faces, marquer le thème actif et
permettre de choisir un thème possédé. Le profil DOIT montrer le thème actif
et mener à cette catégorie.

#### Scenario: Choix d'un thème possédé
- WHEN le coach choisit un thème possédé
- THEN `PUT /dice-themes/me` DOIT l'enregistrer et le servir comme thème actif

#### Scenario: Thème inconnu ou non possédé
- WHEN `PUT /dice-themes/me` reçoit un thème inconnu
- THEN la réponse DOIT être 400 `unknown-theme`, sans écriture
- WHEN il reçoit un thème payant non possédé
- THEN la réponse DOIT être 403 `theme-not-owned`, sans écriture
