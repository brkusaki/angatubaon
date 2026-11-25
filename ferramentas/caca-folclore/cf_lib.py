import numpy as np, os
from PIL import Image
from scipy import ndimage as ndi
def segmenta(src, cols, rows, linhas_on=True, minarea=800, thick=True, fecha=0):
    im = Image.open(src).convert('RGB'); W,H = im.size
    a = np.asarray(im).astype(int); mx=a.max(2); mn=a.min(2)
    claro = (mn>195)&((mx-mn)<35)
    escuro = mx<120
    linhas = np.zeros(claro.shape,bool)
    if linhas_on:
        grosso = ndi.binary_opening(escuro, structure=np.ones((13,13)))
        fino = escuro & ~ndi.binary_dilation(grosso, iterations=2)
        linhas = ndi.binary_opening(fino,structure=np.ones((1,220)))|ndi.binary_opening(fino,structure=np.ones((220,1)))
        if thick: linhas |= ndi.binary_opening(escuro,structure=np.ones((int(.2*H),3)))|ndi.binary_opening(escuro,structure=np.ones((3,int(.2*W))))
        linhas = ndi.binary_dilation(linhas, iterations=5)
    c2 = claro|linhas
    if fecha: c2e = ndi.binary_erosion(c2, iterations=fecha, border_value=1)
    else: c2e = c2
    lab,n = ndi.label(c2e)
    borda = set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg = np.isin(lab,list(borda))
    if fecha: bg = ndi.binary_dilation(bg, iterations=fecha) & c2
    fg = (~bg)&(~linhas)
    fg = ndi.binary_opening(fg, structure=np.ones((5,5)))
    agr = ndi.binary_dilation(fg, iterations=8)
    l,k = ndi.label(agr)
    cw,ch = W/cols,H/rows; cel={}
    for i in range(1,k+1):
        m=(l==i)&fg; ar=m.sum()
        if ar<minarea: continue
        ys,xs=np.where(m)
        r,c=min(rows-1,int(ys.mean()//ch)),min(cols-1,int(xs.mean()//cw))
        if (r,c) not in cel or cel[(r,c)][0]<ar: cel[(r,c)]=(ar,m,(xs.min(),ys.min(),xs.max()+1,ys.max()+1))
    return np.asarray(im), {k:(v[1],v[2]) for k,v in cel.items()}
def recorte(rgb,m,b):
    x0,y0,x1,y1=b
    return Image.fromarray(np.dstack([rgb[y0:y1,x0:x1],(m[y0:y1,x0:x1]*255).astype(np.uint8)]))
def reduz(s,esc):
    nw,nh=max(1,round(s.width*esc)),max(1,round(s.height*esc))
    s=s.resize((nw,nh),Image.LANCZOS)
    arr=np.asarray(s).copy(); arr[...,3]=np.where(arr[...,3]>127,255,0); return Image.fromarray(arr)
