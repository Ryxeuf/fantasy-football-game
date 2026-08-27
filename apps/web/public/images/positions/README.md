# Illustrations des positionnels

Visuels servis pour les postes de roster (`Position.imageUrl`).

- Nom de fichier conseillé : le slug de la position (`amazon_guerriere_aigle.png`).
- Formats acceptés : `.png`, `.jpg`, `.gif`, `.svg`, `.webp`, `.avif`.
- L'URL se saisit dans `/admin/data/positions/<id>/edit`, champ
  « Illustration (URL) », sous la forme `/images/positions/<fichier>`.

Les cartes joueur exportables (satori) ne savent décoder que png/jpeg/gif/svg :
un `.webp` ou un `.avif` est transcodé en PNG à la volée
(`app/lib/player-card/portrait.ts`). Aucun autre dossier n'est lisible par ce
chemin — l'allowlist vit dans le même module.
