# Caça Folclore (protótipo)

Jogo em `Jogos/caca-folclore/` (abrir `index.html`). Ligado ao hub (`Jogos/cacafolclore.js`, abre num iframe).

Fonte para regenerar: `template.html` + `rls.txt` (grade do mapa de Angatuba) + `build_proto.py` (injeta dados e grava `Jogos/caca-folclore/index.html`; rode `python ferramentas/caca-folclore/build_proto.py` de qualquer pasta). Mudou o template? Rode o build_proto e depois `npm run build` (sobe o service worker).
Geradores de arte (Python/PIL): `cf_npcs.py` (NPCs), `cf_ruas.py` (carros e mobiliário urbano), `cf_predios.py` (fachadas). Uso: `python cf_npcs.py <pasta>`.
Status e pendências: doc `caca-folclore-protótipo-status.md` do projeto no Claude.
