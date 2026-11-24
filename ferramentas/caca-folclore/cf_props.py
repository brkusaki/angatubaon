"""Recorta objetos de cenário usando a máscara do remove.bg (preview) aplicada na imagem original.
Uso: python3 -I cf_props.py <original> <removebg_preview.png> <saida_dir> nome:altura nome:altura ...
Os objetos são ordenados por linha e depois coluna (pelo centro)."""
import sys,os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
orig,prev,out=sys.argv[1:4];itens=[a.split(':') for a in sys.argv[4:]]
os.makedirs(out,exist_ok=True)
O=Image.open(orig).convert('RGB');P=Image.open(prev).convert('RGBA')
al=np.array(P.getchannel('A').resize(O.size,Image.BILINEAR)).astype(float)
a=np.dstack([np.array(O),(al>128)*255]).astype(np.uint8)
m=a[...,3]>0
lab,c=ndi.label(ndi.binary_dilation(m,iterations=max(4,O.width//300)))
sz=ndi.sum(np.ones_like(lab),lab,range(1,c+1))
ks=[i+1 for i in np.argsort(sz)[::-1][:len(itens)]]
cent={k:ndi.center_of_mass(lab==k) for k in ks}
H=O.height;rowh=H/int(os.environ.get("ROWS","1"))
ks.sort(key=lambda k:(int(cent[k][0]//rowh),cent[k][1]))
for (nome,alt),k in zip(itens,ks):
    h=int(alt);b=a.copy();b[(lab!=k)|~m,3]=0
    im=Image.fromarray(b);im=im.crop(im.getbbox());w=max(1,round(im.width*h/im.height))
    pm=np.array(im).astype(float);pm[...,:3]*=pm[...,3:4]/255
    rgb=np.array(Image.fromarray(pm[...,:3].astype(np.uint8)).resize((w,h),Image.BOX)).astype(float)
    A=np.array(Image.fromarray(np.array(im)[...,3]).resize((w,h),Image.BOX)).astype(float)
    rgb=(rgb/np.maximum(A[...,None]/255,1e-3)).clip(0,255)
    o=np.dstack([rgb,(A>110)*255]).astype(np.uint8)
    o[...,:3]=np.array(Image.fromarray(o[...,:3]).quantize(28,method=Image.MEDIANCUT).convert('RGB'))
    o2=np.zeros((h+2,w+2,4),np.uint8);o2[1:-1,1:-1]=o
    mm=o2[...,3]>0;e=ndi.binary_dilation(mm)&~mm;o2[e]=[30,22,20,255]
    Image.fromarray(o2).save(f'{out}/{nome}.png');print(nome,w+2,h+2)
