"""Folha 4x4 do Gemini -> sheet NPC 512x384 (celulas 128x96, ancora (64,90)).
uso: python3 -I cf_npc_gemini.py <img> <saida.png> [altura_alvo=66]
Linhas: baixo, direita, cima, parado. Fundo claro ligado a borda (linhas finas de moldura tratadas como fundo);
cada frame = maior componente cujo centroide cai na celula."""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
src, out = sys.argv[1], sys.argv[2]
ALVO = int(sys.argv[3]) if len(sys.argv)>3 else 66
im = Image.open(src).convert('RGB'); W,H = im.size
a = np.asarray(im).astype(int); mx=a.max(2); mn=a.min(2)
claro = (mn>195)&((mx-mn)<35)
escuro = mx<120
grosso = ndi.binary_opening(escuro, structure=np.ones((13,13)))
fino = escuro & ~ndi.binary_dilation(grosso, iterations=2)
linhas = ndi.binary_opening(fino,structure=np.ones((1,220)))|ndi.binary_opening(fino,structure=np.ones((220,1)))
import os
if not os.environ.get('SEMLINHAS'):
    linhas |= ndi.binary_opening(escuro,structure=np.ones((int(.2*H),3)))|ndi.binary_opening(escuro,structure=np.ones((3,int(.2*W))))
linhas = ndi.binary_dilation(linhas, iterations=5)
# linhas cinza claras tambem contam como claro
c2 = claro|linhas
lab,n = ndi.label(c2)
borda = set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
sz = ndi.sum(c2,lab,range(1,n+1))
ids=[i for i in range(1,n+1) if i in borda]
bg = np.isin(lab,ids)
fg = (~bg)&(~linhas)
fg = ndi.binary_opening(fg, structure=np.ones((5,5)))
cw,ch = W/4,H/4
agr = ndi.binary_dilation(fg, iterations=8)
l,k = ndi.label(agr)
cel = {}
for i in range(1,k+1):
    m = (l==i)&fg
    ar = m.sum()
    if ar < 800: continue
    ys,xs = np.where(m)
    r,c = min(3,int(ys.mean()//ch)), min(3,int(xs.mean()//cw))
    if (r,c) not in cel or cel[(r,c)][0]<ar: cel[(r,c)]=(ar,m,(xs.min(),ys.min(),xs.max()+1,ys.max()+1))
faltam=[(r,c) for r in range(4) for c in range(4) if (r,c) not in cel]
if faltam: print('FALTAM',faltam,file=sys.stderr)
hs=[v[2][3]-v[2][1] for v in cel.values()]; med=float(np.median(hs)); esc=ALVO/med
a8=np.asarray(im)
sheet=Image.new('RGBA',(512,384),(0,0,0,0))
for (r,c),(ar,m,b) in cel.items():
    x0,y0,x1,y1=b
    s=Image.fromarray(np.dstack([a8[y0:y1,x0:x1],(m[y0:y1,x0:x1]*255).astype(np.uint8)]))
    nw,nh=max(1,round(s.width*esc)),max(1,round(s.height*esc))
    s=s.resize((nw,nh),Image.LANCZOS)
    arr=np.asarray(s).copy(); arr[...,3]=np.where(arr[...,3]>127,255,0); s=Image.fromarray(arr)
    if nw>128 or nh>96: print('AVISO cel',r,c,nw,nh,file=sys.stderr)
    sheet.alpha_composite(s,(max(0,c*128+64-nw//2),max(0,r*96+90-nh)))
sheet.save(out); print('ok',out,'escala',round(esc,3))
