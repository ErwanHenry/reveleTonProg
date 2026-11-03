# Corpus de test (entièrement fictif)

Ce corpus est **entièrement fictif**. Les personnes, partis, mesures et sources qu'il contient n'existent pas.

Il reproduit l'arborescence du dépôt (`src/content/<collection>/…`, `archives/…`) : le même code de validation et de construction le traite exactement comme le vrai contenu.

- Toutes les URL utilisent des hôtes en `.invalid` (RFC 2606), qui ne se résolvent jamais. Seule exception : `archive.wayback_url`, qui pointe vers `web.archive.org` mais enveloppe une URL en `.invalid`.
- `ids.lock` doit lister tous les identifiants de candidats présents (`npm run ids -- --write`).
- N'ajoutez **jamais** de contenu réel sur de vrais candidats dans ce dossier.
- Ce corpus doit continuer à passer toutes les règles actuelles et futures : s'il échoue, c'est une règle qui a changé, à corriger ici.
