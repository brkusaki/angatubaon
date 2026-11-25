# Caça Folclore (protótipo)

Jogo em `Jogos/caca-folclore/` (abrir `index.html`). Ligado ao hub (`Jogos/cacafolclore.js`, abre num iframe).

Fonte para regenerar: `template.html` + `rls.txt` (grade do mapa de Angatuba) + `build_proto.py` (injeta dados e grava `Jogos/caca-folclore/index.html`; rode `python ferramentas/caca-folclore/build_proto.py` de qualquer pasta). Mudou o template? Rode o build_proto e depois `npm run build` (sobe o service worker).
Geradores de arte (Python/PIL): `cf_npcs.py` (NPCs), `cf_ruas.py` (carros e mobiliário urbano), `cf_predios.py` (fachadas). Uso: `python cf_npcs.py <pasta>`.
Status e pendências: doc `caca-folclore-protótipo-status.md` do projeto no Claude.


## Interface (nov/2026)
Ícones da interface em `Jogos/caca-folclore/ui/` (Gemini, folha 4×4 recortada com `cortar_icones.py folha.jpg 4 4 saida nome1,nome2,...`; depois quantizados a 256 cores). Ilustrações do prólogo em `ui/prologo1-4.webp` (1120×630). Se um ícone faltar, o jogo usa o emoji de reserva (`EMO` no template).
Casas e sobrados (`props/casa0-7`, `props/sobrado0-3`) refeitos no Gemini com as fachadas das lojas anexadas como referência; a coluna da porta de cada uma está no `PD` do template.
