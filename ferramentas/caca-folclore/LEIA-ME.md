# Caça Folclore (protótipo)

Jogo em `Jogos/caca-folclore/` (abrir `index.html`). Ainda não está ligado ao hub nem ao service worker.

Fonte para regenerar: `template.html` + `rls.txt` (grade do mapa de Angatuba) + `build_proto.py` (injeta dados e gera o `index.html`; os caminhos dentro dele são do ambiente de trabalho do Claude e precisam ser ajustados).
Geradores de arte (Python/PIL): `cf_npcs.py` (NPCs), `cf_ruas.py` (carros e mobiliário urbano), `cf_predios.py` (fachadas). Uso: `python cf_npcs.py <pasta>`.
Status e pendências: doc `caca-folclore-protótipo-status.md` do projeto no Claude.
