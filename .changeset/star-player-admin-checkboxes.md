---
"@bb/web": minor
"@bb/server": patch
---

Admin Star Players : les compétences et les règles de recrutement se saisissent en cases à cocher (catalogue complet, groupé par catégorie, filtrable) au lieu de deux champs texte de slugs séparés par des virgules. Les règles proposées couvrent `all`, les ligues régionales et les alignements « Favori de… », et un roster précis se coche dans une liste dédiée. Corrige au passage deux défauts : les compétences n'étaient pas enregistrables (le serveur connectait la relation par `skill: { connect: { slug } }` alors que `Skill` est unique par `[slug, ruleset]`, ce que Prisma rejette — la résolution se fait désormais par ID dans le ruleset du joueur, avant toute suppression de relation, avec un 400 explicite sur slug inconnu), et le lien vers un roster précis était perdu à chaque enregistrement (le couple `{ rule, rosterId }` est maintenant réémis).
