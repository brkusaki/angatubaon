"""Gera Jogos/caca-folclore/index.html a partir do template.html.

Uso (de qualquer pasta): python ferramentas/caca-folclore/build_proto.py
Os dados dos sprites (const D) são lidos do index.html atual.
"""
import os, re, json

AQUI = os.path.dirname(os.path.abspath(__file__))
JOGO = os.path.join(AQUI, '..', '..', 'Jogos', 'caca-folclore', 'index.html')

t = open(os.path.join(AQUI, 'template.html'), encoding='utf-8').read()
old = open(JOGO, encoding='utf-8').read()
m = re.search(r"const D=(\{.*?\});\n", old, re.S)
D = m.group(1)
hw = {'casa_amarela': [140, 130, .5], 'casa_azul': [140, 130, .30], 'casa_rosa': [143, 130, .32], 'mercearia': [133, 130, .5]}
GRID = open(os.path.join(AQUI, 'rls.txt'), encoding='utf-8').read().strip()
out = t.replace('__GRID__', GRID).replace('__DATA__', D).replace('__HW__', json.dumps(hw))
open(JOGO, 'w', encoding='utf-8', newline='\n').write(out)
print(len(out))
