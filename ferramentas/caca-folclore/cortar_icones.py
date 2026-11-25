"""Recorta uma folha de ícones do Gemini (grade NxM, fundo branco) em PNGs com transparência.
uso: python cortar_icones.py folha.jpg linhas colunas saida/ nome1,nome2,... [tam=128]
- fundo = pixels claros ligados à borda da célula (flood fill), com borda suave
- cada ícone é aparado, centralizado e reduzido para caber em tam×tam
"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd

def corta(im, lin, col, nomes, out, tam=128):
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    H, W = a.shape[:2]; ch, cw = H / lin, W / col
    k = 0
    for r in range(lin):
        for c in range(col):
            if k >= len(nomes): return
            nome = nomes[k]; k += 1
            if not nome or nome == '-': continue
            y0, y1, x0, x1 = int(r*ch), int((r+1)*ch), int(c*cw), int((c+1)*cw)
            cel = a[y0:y1, x0:x1]
            # "claro" = perto do branco e pouco saturado
            mx = cel.max(2); mn = cel.min(2)
            claro = (mn > 222) & (mx - mn < 26)
            lb, n = nd.label(claro)
            borda = set(np.unique(np.concatenate([lb[0], lb[-1], lb[:, 0], lb[:, -1]]))) - {0}
            fundo = np.isin(lb, list(borda))
            obj = ~fundo
            # fica só com componentes grandes (descarta sujeira)
            lo, no = nd.label(obj)
            if no == 0: print('vazio', nome); continue
            tamc = nd.sum(obj, lo, range(1, no+1))
            keep = np.zeros_like(obj)
            for i, t in enumerate(tamc):
                if t > tamc.max() * 0.02: keep |= (lo == i+1)
            obj = nd.binary_fill_holes(keep) if False else keep
            # alpha suave: erode 1px e desfoca levemente a borda
            alpha = nd.binary_erosion(obj, iterations=1).astype(np.float32)
            alpha = np.clip(nd.gaussian_filter(alpha, 0.8) * 1.15, 0, 1)
            rgb = cel.astype(np.uint8)
            rgba = np.dstack([rgb, (alpha * 255).astype(np.uint8)])
            ys, xs = np.where(alpha > 0.05)
            rgba = rgba[ys.min():ys.max()+1, xs.min():xs.max()+1]
            ic = Image.fromarray(rgba, 'RGBA')
            s = (tam - 6) / max(ic.size)
            ic = ic.resize((max(1, round(ic.size[0]*s)), max(1, round(ic.size[1]*s))), Image.LANCZOS)
            can = Image.new('RGBA', (tam, tam), (0, 0, 0, 0))
            can.paste(ic, ((tam - ic.size[0]) // 2, (tam - ic.size[1]) // 2), ic)
            can.save(f'{out}/{nome}.png', optimize=True)
            print(nome, ic.size)

if __name__ == '__main__':
    f, lin, col, out, nomes = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5].split(',')
    tam = int(sys.argv[6]) if len(sys.argv) > 6 else 128
    import os; os.makedirs(out, exist_ok=True)
    corta(Image.open(f), lin, col, nomes, out, tam)
