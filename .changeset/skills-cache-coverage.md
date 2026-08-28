---
"@bb/server": patch
---

Couvre par des tests la purge du cache du catalogue public de compétences (`invalidatePublicSkillsCache`). Le comportement était vérifié indirectement via un mock : les tests valident désormais que la purge force réellement le recalcul du mémo, qu'elle vide toutes les clés du namespace (une par édition × catégorie), qu'elle reste chirurgicale (les autres namespaces sont intacts) et qu'elle ne lève pas quand rien n'est en cache. La fenêtre de péremption de 5 minutes — celle dans laquelle un trait « Haine (X) » fraîchement créé s'affichait en slug brut — est elle aussi documentée par un test.
