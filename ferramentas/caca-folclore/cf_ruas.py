"""Carros (atlas) e mobiliário urbano. uso: python3 -I cf_ruas.py <proto_dir>"""
import sys, os, math
from PIL import Image, ImageDraw, ImageChops
S=4
OUT=(38,24,22)
def hexc(h):
    h=h.lstrip('#')
    if len(h)==3: h=''.join(c*2 for c in h)
    return tuple(int(h[i:i+2],16) for i in (0,2,4))
def sh(c,f): return tuple(max(0,min(255,int(v*f))) for v in c[:3])
class R:
    def __init__(s,w,h): s.w,s.h=w,h; s.im=Image.new('RGBA',(w*S,h*S),(0,0,0,0)); s.d=ImageDraw.Draw(s.im)
    def poly(s,pts,c,shade=0):
        p=[(x*S,y*S) for x,y in pts]; s.d.polygon(p,fill=c+(255,))
        if shade:
            ys=[y for _,y in pts]; mid=min(ys)+(max(ys)-min(ys))*.62
            m=Image.new('L',s.im.size,0); ImageDraw.Draw(m).polygon(p,fill=255)
            m2=Image.new('L',s.im.size,0); ImageDraw.Draw(m2).rectangle([0,mid*S,s.w*S,s.h*S],fill=255)
            s.im.paste(Image.new('RGBA',s.im.size,sh(c,.8)+(255,)),(0,0),ImageChops.multiply(m,m2)); s.d=ImageDraw.Draw(s.im)
    def rect(s,x0,y0,x1,y1,c,shade=0): s.poly([(x0,y0),(x1,y0),(x1,y1),(x0,y1)],c,shade)
    def ell(s,cx,cy,rx,ry,c,shade=0): s.poly([(cx+rx*math.cos(a/16*math.pi),cy+ry*math.sin(a/16*math.pi)) for a in range(32)],c,shade)
    def fin(s):
        im=s.im.resize((s.w,s.h),Image.BOX); px=im.load()
        for y in range(s.h):
            for x in range(s.w):
                a=px[x,y][3]; px[x,y]=px[x,y][:3]+((255 if a>=110 else 0),)
        rgb=Image.new('RGB',(s.w,s.h)); rgb.paste(im.convert('RGB')); q=rgb.quantize(48,method=Image.MEDIANCUT).convert('RGB'); qp=q.load()
        for y in range(s.h):
            for x in range(s.w):
                if px[x,y][3]: px[x,y]=qp[x,y]+(255,)
        o=Image.new('RGBA',(s.w,s.h),(0,0,0,0)); op=o.load(); bp=im.load()
        for y in range(s.h):
            for x in range(s.w):
                if bp[x,y][3]==0:
                    for dx,dy in((1,0),(-1,0),(0,1),(0,-1)):
                        X,Y=x+dx,y+dy
                        if 0<=X<s.w and 0<=Y<s.h and bp[X,Y][3]: op[x,y]=OUT+(255,);break
        o.alpha_composite(im); return o
CW,CH=96,64
def carro_lado(c):
    r=R(CW,CH); c=hexc(c); gl=hexc('#9ad0e8'); 
    for wx in(26,68): r.ell(wx,56,7,7,hexc('#262626')); r.ell(wx,56,3.2,3.2,hexc('#b8b8b8'))
    r.poly([(6,52),(6,38),(10,33),(30,31),(38,20),(60,20),(70,31),(86,34),(90,42),(90,52)],c,1)
    r.poly([(40,23),(58,23),(66,31),(36,31)],gl)
    r.rect(48,23,50,31,sh(c,.8))
    r.rect(86,38,90,42,hexc('#f6e27a')); r.rect(6,40,9,44,hexc('#d03030'))
    r.rect(6,50,90,53,sh(c,.6)); 
    r.ell(26,56,7.6,7.6,hexc('#262626')) ; r.ell(26,56,3.2,3.2,hexc('#b8b8b8')); r.ell(68,56,7.6,7.6,hexc('#262626')); r.ell(68,56,3.2,3.2,hexc('#b8b8b8'))
    return r.fin()
def carro_frente(c,tras=False):
    r=R(CW,CH); c=hexc(c); gl=hexc('#9ad0e8')
    r.rect(26,52,36,62,hexc('#262626')); r.rect(60,52,70,62,hexc('#262626'))
    r.poly([(24,54),(24,34),(30,24),(66,24),(72,34),(72,54)],c,1)
    r.poly([(31,26),(65,26),(69,36),(27,36)],gl if not tras else sh(gl,.85))
    if not tras:
        r.rect(27,40,35,45,hexc('#f6e27a')); r.rect(61,40,69,45,hexc('#f6e27a')); r.rect(38,43,58,48,hexc('#3a3a3a'))
    else:
        r.rect(27,40,35,45,hexc('#d03030')); r.rect(61,40,69,45,hexc('#d03030')); r.rect(40,46,56,51,hexc('#e8e8e0'))
    r.rect(24,50,72,54,sh(c,.6))
    return r.fin()
CORES=['#c0392b','#2f6fb0','#e8e8e8','#2a2a30','#e0b030','#3a8a4a','#8a8a94','#d86a2a']
def carros(dest):
    atl=Image.new('RGBA',(CW*3,CH*len(CORES)),(0,0,0,0))
    for i,c in enumerate(CORES):
        atl.alpha_composite(carro_lado(c),(0,i*CH)); atl.alpha_composite(carro_frente(c),(CW,i*CH)); atl.alpha_composite(carro_frente(c,True),(CW*2,i*CH))
    atl.save(os.path.join(dest,'carros.png'))

def prop(nome,w,h,fn,dest):
    r=R(w,h); fn(r); r.fin().save(os.path.join(dest,'props',nome+'.png'))
def lixeira(r):
    r.rect(5,12,19,32,hexc('#3a7a4a'),1); r.rect(4,9,20,13,hexc('#2a5a36')); r.rect(8,16,16,17,hexc('#1a3a24')); r.rect(8,22,16,23,hexc('#1a3a24'))
def orelhao(r):
    r.rect(10,28,16,54,hexc('#6a6a72'),1); r.poly([(3,2),(23,2),(25,26),(1,26)],hexc('#e0922a'),1); r.rect(7,6,19,16,hexc('#2a2a30')); r.rect(9,19,17,22,hexc('#f2f2e8'))
def ponto(r):
    r.rect(4,6,6,64,hexc('#6a6a72')); r.rect(76,6,78,64,hexc('#6a6a72')); r.poly([(0,2),(82,2),(80,12),(2,12)],hexc('#2f6fb0'),1)
    r.rect(8,36,74,40,hexc('#8a5a3a')); r.rect(10,40,13,52,hexc('#6a4a2a')); r.rect(69,40,72,52,hexc('#6a4a2a')); r.rect(40,16,70,30,hexc('#e8f2f8')); r.rect(44,19,66,22,hexc('#2f6fb0'),0)
def placa(r):
    r.rect(9,22,13,60,hexc('#6a6a72'),1); r.poly([(6,2),(16,2),(21,7),(21,17),(16,22),(6,22),(1,17),(1,7)],hexc('#d03030'),1); r.rect(5,10,17,14,hexc('#f6f6f0'))
def hidrante(r):
    r.rect(4,8,14,24,hexc('#d03030'),1); r.ell(9,8,6,4,hexc('#d03030'),1); r.rect(1,12,4,17,hexc('#b02020')); r.rect(14,12,17,17,hexc('#b02020')); r.rect(2,22,16,26,hexc('#a02020'))
def banca(r):
    r.rect(4,22,68,60,hexc('#e0a43a'),1); r.poly([(0,8),(72,8),(68,24),(4,24)],hexc('#c8402e'),1)
    for i in range(6): r.rect(5+i*11,26,13+i*11,40,[hexc(x) for x in ['#4a78b8','#f2e078','#6ab87a','#d86a8a','#9a6ac8','#e8e0d0']][i])
    r.rect(8,44,64,50,hexc('#6a4a2a'))
def poste2(r):
    r.rect(8,6,13,100,hexc('#7a7a82'),1); r.rect(2,2,19,8,hexc('#5a5a62')); r.rect(0,8,8,12,hexc('#f6e27a'))
def arvore_rua(r):
    r.rect(14,50,20,88,hexc('#6a4a2a'),1); r.ell(17,34,17,24,hexc('#3f8a3a'),1); r.ell(10,40,10,12,hexc('#4a9a44'),0); r.ell(25,28,9,11,hexc('#34762f'),0)
if __name__=='__main__':
    d=sys.argv[1]
    carros(d)
    for n,w,h,f in [('lixeira',24,34,lixeira),('orelhao',26,56,orelhao),('ponto',84,66,ponto),('placa_pare',22,62,placa),('hidrante',18,28,hidrante),('banca',72,62,banca),('poste2',22,102,poste2),('arvore_rua',34,90,arvore_rua)]:
        prop(n,w,h,f,d)
    print('ok')
