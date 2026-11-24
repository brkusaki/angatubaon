"""Monta atlas + anims.json de uma criatura a partir de <dir>/px/*.png
Uso: python3 -I cf_atlas.py <dir> <nome>
"""
import sys, os, json, glob
from PIL import Image
d, nome = sys.argv[1], sys.argv[2]
px = f'{d}/px'
fs = sorted(glob.glob(f'{px}/*.png'))
names = [os.path.basename(f)[:-4] for f in fs]
FW, FH, cols = 128, 96, 6
rows = (len(names) + cols - 1) // cols
at = Image.new('RGBA', (cols * FW, rows * FH))
for i, f in enumerate(fs):
    at.paste(Image.open(f), ((i % cols) * FW, (i // cols) * FH))
at.save(f'{d}/{nome}_atlas.png')
idx = {n: i for i, n in enumerate(names)}
def grp(pref, rr=None):
    return [idx[n] for n in names if n.startswith(pref) and (rr is None or f'_r{rr}_' in n)]
anims = {'baixo': grp('andar', 0), 'direita': grp('andar', 1), 'cima': grp('andar', 2),
         'parado': grp('parado'), 'ataque': grp('ataque'), 'dano': grp('dano')}
anims = {k: v for k, v in anims.items() if v}
json.dump({'nome': nome, 'FW': FW, 'FH': FH, 'AX': 64, 'AY': 90, 'cols': cols, 'quadros': idx, 'anims': anims},
          open(f'{d}/{nome}_anims.json', 'w'), indent=1)
print(nome, len(names), 'quadros', {k: len(v) for k, v in anims.items()})
