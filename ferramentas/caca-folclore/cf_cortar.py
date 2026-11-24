"""Corta uma folha do Gemini em quadros (rembg + corte por colunas vazias).
Uso: python3 -I cf_cortar.py <imagem> <saida_dir> <prefixo> <linhas> <colunas>
Gera <saida_dir>/<prefixo>_r{i}_c{j}.png e <prefixo>_prev.png (conferencia)
"""
import sys, os
import numpy as np
from PIL import Image
from rembg import remove, new_session

src, outd, pre, rows, ncols = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
os.makedirs(outd, exist_ok=True)
aux = outd.rstrip('/') + '_aux'; os.makedirs(aux, exist_ok=True)
im = Image.open(src).convert('RGB')
if os.environ.get('STRIPLINE') == '1':
    # apaga linha de chao (faixa escura longa e fina) antes de separar o fundo
    from scipy import ndimage as ndi
    A = np.array(im).astype(int)
    dark = A.max(axis=2) < 60
    hor = ndi.binary_opening(dark, structure=np.ones((1, 110)))
    lb, nb = ndi.label(hor)
    for i, sl in enumerate(ndi.find_objects(lb)):
        hgt = sl[0].stop - sl[0].start
        if hgt <= 7:
            seg = lb[sl] == i + 1
            seg = ndi.binary_dilation(seg, structure=np.ones((3, 3)), iterations=1)
            A[sl][seg] = 255
    im = Image.fromarray(A.astype(np.uint8))
if os.environ.get('FLOOD') == '1':
    # fundo branco ligado a borda (preserva partes brancas do bicho: peito, dentes, etc.)
    from scipy import ndimage as ndi
    arr = np.array(im).astype(int)
    near = (arr.min(axis=2) > 236) & ((arr.max(axis=2) - arr.min(axis=2)) < 16)
    lab, nn = ndi.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgm = np.isin(lab, list(edge))
    # um pouco de erosao do fundo: tira a franja clara do antialias
    bgm = ndi.binary_dilation(bgm, iterations=1) & (arr.min(axis=2) > 200)  | bgm
    al = (~bgm).astype(np.uint8) * 255
    r = Image.fromarray(np.dstack([np.array(im), al]), 'RGBA')
else:
    r = remove(im, session=new_session('isnet-general-use'))
r.save(f'{aux}/{pre}_rembg.png')
a = np.array(r)
fg = a[..., 3] > 40
H, W = fg.shape

def runs(profile, mingap, minsize=0):
    on = profile > minsize
    segs, start, gap, end = [], None, 0, 0
    for i, v in enumerate(on):
        if v:
            if start is None: start = i
            gap = 0; end = i
        elif start is not None:
            gap += 1
            if gap >= mingap: segs.append((start, end)); start = None
    if start is not None: segs.append((start, end))
    return segs

# linhas: faixas horizontais com conteudo (ignora sujeira pequena)
rs = runs(fg.sum(axis=1), 14, 3)
rs = [s for s in rs if s[1] - s[0] > 40]
if len(rs) != rows:
    # fallback: divide em faixas iguais
    ys = np.where(fg.any(axis=1))[0]; y0, y1 = ys[0], ys[-1]
    h = (y1 - y0 + 1) / rows
    rs = [(int(y0 + i * h), int(y0 + (i + 1) * h) - 1) for i in range(rows)]
    print('aviso: linhas por divisao igual')
for ri, (y0, y1) in enumerate(rs):
    band = fg[y0:y1 + 1]
    prof = band.sum(axis=0)
    xs = np.where(prof > 0)[0]
    x0, x1 = xs[0], xs[-1]
    cw = (x1 - x0 + 1) / ncols
    cuts = [x0]
    for k in range(1, ncols):
        nom = x0 + k * cw
        lo, hi = int(nom - cw * 0.35), int(nom + cw * 0.35)
        seg = prof[lo:hi]
        # coluna mais vazia; empate -> a mais proxima do centro nominal
        m = seg.min(); cand = np.where(seg == m)[0] + lo
        cuts.append(int(cand[np.argmin(abs(cand - nom))]))
    cuts.append(x1 + 1)
    for ci in range(ncols):
        s = a[y0:y1 + 1, cuts[ci]:cuts[ci + 1]].copy()
        m = s[..., 3] > 40
        s[~m, 3] = 0
        yy, xx = np.where(m)
        if len(yy) < 50: print('quadro vazio', ri, ci); continue
        if os.environ.get('STRIPLINE') == '1':
            from scipy import ndimage as ndi
            rgbs = s[..., :3].astype(int)
            wh = m & (rgbs.min(axis=2) > 244)
            lw, nw = ndi.label(wh)
            for i in range(1, nw + 1):
                cm = lw == i
                if cm.sum() >= 12: s[cm, 3] = 0
            m = s[..., 3] > 40; yy, xx = np.where(m)
            ww = xx.max() - xx.min() + 1
            lum = rgbs.sum(axis=2) / 3
            for y in range(yy.max(), max(yy.min(), yy.max() - 4), -1):
                row = m[y]
                if row.sum() > 0.5 * ww and (lum[y][row] > 95).mean() > 0.5 or (row.sum() > 0.7 * ww and (lum[y][row] < 60).mean() > 0.8):
                    s[y, :, 3] = 0
                else:
                    if row.sum() > 0: break
            m = s[..., 3] > 40; lb2, n2 = ndi.label(m)
            if n2 > 1:
                sz = ndi.sum(m, lb2, range(1, n2 + 1)); keep = int(np.argmax(sz)) + 1
                s[(lb2 != keep) & (sz[np.clip(lb2 - 1, 0, None)] < 40), 3] = 0
            m = s[..., 3] > 40; yy, xx = np.where(m)
        Image.fromarray(s[yy.min():yy.max() + 1, xx.min():xx.max() + 1]).save(f'{outd}/{pre}_r{ri}_c{ci}.png')
# conferencia
bg = Image.new('RGBA', r.size, (60, 120, 60, 255)); bg.alpha_composite(r)
bg.convert('RGB').resize((1376, int(1376 * r.height / r.width))).save(f'{aux}/{pre}_prev.png')
print('ok', pre, len(rs), 'linhas')
