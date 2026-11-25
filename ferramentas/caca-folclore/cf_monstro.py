"""Folha 4x4 do Gemini -> atlas do jogo (células 128x96, âncora nos pés em (64,90), 6 colunas).

uso: python cf_monstro.py <especie> <folha.jpg> <altura_alvo> [espelhar_lado=0] [saida_dir]
Linhas da folha: 1 andando de frente, 2 andando pro lado (virado pra DIREITA), 3 andando de costas,
4 = parado, parado, preparando ataque, ataque.
Grava <saida>/<especie>.png e imprime o JSON de anims pra colar no D do index.html.
"""
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cf_lib import segmenta, recorte, reduz
from scipy import ndimage as ndi
from PIL import Image, ImageOps

FW, FH, AX, AY, COLS = 128, 96, 64, 90, 6

def grupos(vals, n):
    """separa valores em n grupos pelos maiores vãos"""
    o = sorted(vals); gaps = sorted(range(1, len(o)), key=lambda i: o[i] - o[i-1], reverse=True)[:n-1]
    cortes = sorted(o[i] for i in gaps); return lambda v: sum(v >= c for c in cortes)

def blocos(src):
    """acha os 16 quadros pela posição real (a grade do Gemini nem sempre ocupa a imagem toda)"""
    im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(int); mx = a.max(2); mn = a.min(2)
    claro = (mn > 200) & ((mx - mn) < 32)
    lab, n = ndi.label(claro); borda = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ~np.isin(lab, list(borda)); fg = ndi.binary_opening(fg, structure=np.ones((3, 3)))
    agr = ndi.binary_dilation(fg, iterations=10); l, k = ndi.label(agr)
    comps = []
    for i in range(1, k + 1):
        m = (l == i) & fg; ar = m.sum()
        if ar < 2500: continue
        ys, xs = np.where(m); comps.append((ar, m, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), ys.mean(), xs.mean()))
    comps.sort(key=lambda c: -c[0]); comps = comps[:16]
    gy = grupos([c[3] for c in comps], 4); out = {}
    for r in range(4):
        linha = [c for c in comps if gy(c[3]) == r]; gx = grupos([c[4] for c in linha], min(4, len(linha))) if len(linha) > 1 else (lambda v: 0)
        for c in linha: out[(r, gx(c[4]))] = (c[1], c[2], a.astype(np.uint8))
    falt = [(r, c) for r in range(4) for c in range(4) if (r, c) not in out]
    if falt: print('faltando', falt)
    return out

def atlas(esp, src, alvo, esp_lado=False, out='.'):
    cel = blocos(src)
    fr = {}
    for (r, c), (m, b, rgb) in cel.items():
        m = ndi.binary_fill_holes(m); fr[(r, c)] = recorte(rgb, m, b)
    hs = [fr[k].height for k in fr if k[0] in (0, 2)] or [f.height for f in fr.values()]
    esc = alvo / float(np.median(hs))
    esc = min(esc, (FW - 6) / max(f.width for f in fr.values()), (AY - 2) / max(f.height for f in fr.values()))
    at = Image.new('RGBA', (FW * COLS, FH * 3), (0, 0, 0, 0))
    ordem = [(r, c) for r in range(4) for c in range(4)]
    for i, k in enumerate(ordem):
        if k not in fr: continue
        s = reduz(fr[k], esc)
        if esp_lado and k[0] == 1: s = ImageOps.mirror(s)
        x = (i % COLS) * FW + AX - s.width // 2; y = (i // COLS) * FH + AY - s.height
        at.alpha_composite(s, (x, max((i // COLS) * FH, y)))
    os.makedirs(out, exist_ok=True); at.save(f'{out}/{esp}.png', optimize=True)
    anims = {'baixo': [0, 1, 2, 3], 'direita': [4, 5, 6, 7], 'cima': [8, 9, 10, 11], 'parado': [12, 13], 'ataque': [14, 15, 15, 15, 14], 'dano': [13, 12]}
    d = {'cols': COLS, 'anims': anims}
    print(esp, 'escala', round(esc, 3)); return d

if __name__ == '__main__':
    esp, src, alvo = sys.argv[1], sys.argv[2], float(sys.argv[3])
    lado = len(sys.argv) > 4 and sys.argv[4] == '1'
    out = sys.argv[5] if len(sys.argv) > 5 else '.'
    print(json.dumps(atlas(esp, src, alvo, lado, out)))
