"""Gerador de sprites de NPCs (128x96 por frame) para o Caça Folclore.
uso: python3 -I cf_npcs.py <pasta_saida>
Cada NPC vira uma sheet 4 colunas: baixo 0-3, direita 4-7, cima 8-11, parado 12-15."""
import sys, os, json, math
from PIL import Image, ImageDraw
S=4; W,H=128,96
def hexc(h):
    h=h.lstrip('#')
    if len(h)==3: h=''.join(c*2 for c in h)
    return tuple(int(h[i:i+2],16) for i in (0,2,4))
def sh(c,f): return tuple(max(0,min(255,int(v*f))) for v in c[:3])
OUT=(38,24,22)

class R:
    def __init__(s): s.im=Image.new('RGBA',(W*S,H*S),(0,0,0,0)); s.d=ImageDraw.Draw(s.im)
    def poly(s,pts,c,shade=True):
        p=[(x*S,y*S) for x,y in pts]; s.d.polygon(p,fill=c+(255,))
        if shade:
            xs=[x for x,_ in pts]; mid=(min(xs)+max(xs))/2+ (max(xs)-min(xs))*.18
            m=Image.new('L',s.im.size,0); ImageDraw.Draw(m).polygon(p,fill=255)
            m2=Image.new('L',s.im.size,0); ImageDraw.Draw(m2).rectangle([mid*S,0,W*S,H*S],fill=255)
            from PIL import ImageChops
            mm=ImageChops.multiply(m,m2); dark=Image.new('RGBA',s.im.size,sh(c,.78)+(255,)); s.im.paste(dark,(0,0),mm)
            s.d=ImageDraw.Draw(s.im)
    def rect(s,x0,y0,x1,y1,c,shade=True): s.poly([(x0,y0),(x1,y0),(x1,y1),(x0,y1)],c,shade)
    def ell(s,cx,cy,rx,ry,c,shade=True):
        pts=[(cx+rx*math.cos(a/16*math.pi),cy+ry*math.sin(a/16*math.pi)) for a in range(32)]; s.poly(pts,c,shade)
    def dot(s,x,y,r,c): s.d.ellipse([(x-r)*S,(y-r)*S,(x+r)*S,(y+r)*S],fill=c+(255,))
    def line(s,x0,y0,x1,y1,w,c): s.d.line([x0*S,y0*S,x1*S,y1*S],fill=c+(255,),width=int(w*S))

def finish(r):
    im=r.im.resize((W,H),Image.BOX)
    px=im.load(); 
    for y in range(H):
        for x in range(W):
            a=px[x,y][3]; px[x,y]=px[x,y][:3]+((255 if a>=110 else 0),)
    # quantiza cores pra ficar com cara de pixel art
    rgb=Image.new('RGB',(W,H),(0,0,0)); rgb.paste(im.convert('RGB'))
    q=rgb.quantize(40,method=Image.MEDIANCUT).convert('RGB'); qp=q.load()
    for y in range(H):
        for x in range(W):
            if px[x,y][3]: px[x,y]=qp[x,y]+(255,)
    # contorno
    base=im.copy(); bp=base.load(); out=Image.new('RGBA',(W,H),(0,0,0,0)); op=out.load()
    for y in range(H):
        for x in range(W):
            if bp[x,y][3]==0:
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    X,Y=x+dx,y+dy
                    if 0<=X<W and 0<=Y<H and bp[X,Y][3]: op[x,y]=OUT+(255,);break
    out.alpha_composite(base); return out

def personagem(P,dire,fr,mov):
    """P: dict de aparência. dire: 'f','b','s'. fr: 0-3. mov: True=andando."""
    r=R(); sk=hexc(P['pele']); hr=hexc(P['cabelo']); top=hexc(P['top']); bot=hexc(P['bot']); shoe=hexc(P.get('sapato','#3a2a22'))
    estilo=P.get('estilo','camisa'); cab=P.get('cab','curto'); chapeu=P.get('chapeu')
    sw=[0,3,0,-3][fr] if mov else 0          # balanço das pernas
    bob=-1 if (fr%2==1 and mov) else 0
    if not mov: bob=[0,-1,0,0][fr]
    cx=64; yb=90; hy=36+bob  # centro da cabeça
    vestido=estilo in('vestido','batina','jaleco_longo')
    # ---- pernas / saia
    if dire=='s':
        r.rect(cx-5+sw,70+bob,cx+1+sw,yb-3,bot if not vestido else sk)
        r.rect(cx-1-sw,70+bob,cx+5-sw,yb-3,bot if not vestido else sk)
        r.rect(cx-6+sw,yb-4,cx+3+sw,yb,shoe,False); r.rect(cx-2-sw,yb-4,cx+7-sw,yb,shoe,False)
    else:
        r.rect(cx-8,70+bob,cx-2,yb-3,bot if not vestido else sk)
        r.rect(cx+2,70+bob,cx+8,yb-3,bot if not vestido else sk)
        lo=[0,-2,0,2][fr] if mov else 0
        r.rect(cx-9,yb-4+(lo if lo>0 else 0),cx-1,yb+(lo if lo>0 else 0),shoe,False)
        r.rect(cx+1,yb-4+(-lo if lo<0 else 0),cx+9,yb+(-lo if lo<0 else 0),shoe,False)
    # ---- braços atrás (lado)
    ac=hexc(P.get('manga',P['top'])) if P.get('manga') else top
    if dire=='s':
        r.rect(cx-2-sw*1.0,48+bob,cx+3-sw*1.0,67+bob,sh(ac,.9)) ; 
    # ---- tronco
    if estilo in('vestido',):
        w0,w1=10,15
        r.poly([(cx-w0,47+bob),(cx+w0,47+bob),(cx+w1,80),(cx-w1,80)],top)
    elif estilo=='batina':
        r.poly([(cx-10,47+bob),(cx+10,47+bob),(cx+14,88),(cx-14,88)],top)
    elif estilo=='jaleco_longo':
        r.poly([(cx-11,47+bob),(cx+11,47+bob),(cx+13,82),(cx-13,82)],top)
    else:
        wid=8 if dire=='s' else 11
        r.poly([(cx-wid,47+bob),(cx+wid,47+bob),(cx+wid,72+bob),(cx-wid,72+bob)],top)
    if estilo=='avental' and dire!='b':
        ap=hexc(P.get('avental','#f4f4f0')); r.poly([(cx-8,52+bob),(cx+8,52+bob),(cx+9,80),(cx-9,80)],ap)
    if estilo=='colete':
        co=hexc(P.get('colete','#3b5a8a')); r.rect(cx-10,48+bob,cx-4,72+bob,co) ; r.rect(cx+4,48+bob,cx+10,72+bob,co)
    if estilo=='terno' and dire=='f':
        r.poly([(cx-3,47+bob),(cx+3,47+bob),(cx+2,62+bob),(cx-2,62+bob)],hexc('#f2f2f2'),False)
        r.poly([(cx-1,50+bob),(cx+1,50+bob),(cx+2,64+bob),(cx-2,64+bob)],hexc(P.get('gravata','#a22')),False)
    if estilo=='batina' and dire=='f':
        r.rect(cx-3,47+bob,cx+3,51+bob,hexc('#f4f4f0'),False)
    if estilo=='enfermeira' and dire=='f':
        r.rect(cx-3,56+bob,cx+3,57+bob,hexc('#d33'),False); r.rect(cx-.5,54.5+bob,cx+.5,58.5+bob,hexc('#d33'),False)
    # ---- braços frente
    if dire=='s':
        r.rect(cx-3+sw,48+bob,cx+3+sw,68+bob,ac); r.ell(cx+sw*.0,69+bob,3,2.5,sk,False)
    else:
        sa=[0,2,0,-2][fr] if mov else 0
        r.rect(cx-15,48+bob+sa,cx-10,68+bob+sa,ac); r.ell(cx-12.5,69+bob+sa,3,2.6,sk,False)
        r.rect(cx+10,48+bob-sa,cx+15,68+bob-sa,ac); r.ell(cx+12.5,69+bob-sa,3,2.6,sk,False)
    # ---- pescoço + cabeça
    r.rect(cx-3,43+bob,cx+3,48+bob,sh(sk,.92),False)
    hw=8.5 if dire!='s' else 7.5
    # cabelo atrás (longo / coque)
    if cab in('longo','ondulado') and dire!='f':
        r.poly([(cx-hw-2,hy-6),(cx+hw+2,hy-6),(cx+hw+3,hy+16),(cx-hw-3,hy+16)],hr)
    elif cab in('longo','ondulado') and dire=='f':
        r.poly([(cx-hw-2,hy-4),(cx+hw+2,hy-4),(cx+hw+3,hy+14),(cx-hw-3,hy+14)],hr)
    r.ell(cx,hy,hw,9,sk)
    if dire=='s': r.ell(cx+hw,hy+1,1.6,1.8,sk,False)  # nariz
    # cabelo topo
    if cab!='careca':
        if dire=='b':
            r.ell(cx,hy-1,hw+.8,9.5,hr)
        else:
            r.poly([(cx-hw-.8,hy+1),(cx-hw,hy-6),(cx-4,hy-10),(cx+4,hy-10),(cx+hw,hy-6),(cx+hw+.8,hy+1),(cx+hw-2,hy-3),(cx-hw+2,hy-3)],hr)
            if cab=='grisalho': pass
        if cab=='coque': r.ell(cx,hy-12,4.5,4,hr)
        if dire=='s' and cab not in('careca',): r.rect(cx-hw,hy-8,cx-1,hy+4,hr)
    else:
        if dire=='b': pass
    if P.get('lenco'):
        lc=hexc(P['lenco']); r.poly([(cx-hw-1,hy+2),(cx-hw-1,hy-7),(cx,hy-11),(cx+hw+1,hy-7),(cx+hw+1,hy+2),(cx+hw-1,hy-3),(cx-hw+1,hy-3)],lc)
    # rosto
    if dire=='f':
        r.dot(cx-3.2,hy+1,1.1,(30,20,20)); r.dot(cx+3.2,hy+1,1.1,(30,20,20))
        r.line(cx-2,hy+5.5,cx+2,hy+5.5,.8,sh(sk,.55))
        if P.get('bigode'): r.rect(cx-3.5,hy+3.6,cx+3.5,hy+5,hr if cab!='careca' else hexc('#3a2a22'),False)
        if P.get('oculos'): 
            for ox in(-3.2,3.2): r.d.ellipse([(cx+ox-2.4)*S,(hy+1-2.2)*S,(cx+ox+2.4)*S,(hy+1+2.2)*S],outline=(40,40,48,255),width=S)
        if P.get('batom'): r.rect(cx-1.8,hy+5,cx+1.8,hy+6.2,hexc('#c33'),False)
    elif dire=='s':
        r.dot(cx+3.6,hy+1,1.1,(30,20,20)); r.line(cx+2,hy+5.5,cx+5,hy+5.5,.8,sh(sk,.55))
        if P.get('bigode'): r.rect(cx+2,hy+3.6,cx+6,hy+5,hexc('#3a2a22'),False)
        if P.get('oculos'): r.d.ellipse([(cx+1.4)*S,(hy-1.4)*S,(cx+6)*S,(hy+3.4)*S],outline=(40,40,48,255),width=S)
    # chapéu
    if chapeu=='pala':
        cc=hexc(P.get('chapeu_cor','#3b6e3a')); r.poly([(cx-hw-.8,hy-3),(cx-hw,hy-9),(cx,hy-12),(cx+hw,hy-9),(cx+hw+.8,hy-3)],cc)
        if dire=='f': r.rect(cx-hw-1,hy-4,cx+hw+1,hy-1.5,sh(cc,.85),False)
        if dire=='s': r.rect(cx,hy-4,cx+hw+5,hy-1.5,sh(cc,.85),False)
    elif chapeu=='palha':
        cc=hexc('#d9b45c'); r.ell(cx,hy-5,hw+6,3.2,cc); r.poly([(cx-hw+1,hy-5),(cx-hw+2,hy-11),(cx+hw-2,hy-11),(cx+hw-1,hy-5)],sh(cc,1.05))
        r.rect(cx-hw+1,hy-7,cx+hw-1,hy-5.5,hexc('#8a5a2a'),False)
    elif chapeu=='chef':
        cc=hexc('#f6f6f2'); r.rect(cx-hw+1,hy-8,cx+hw-1,hy-3,cc); r.ell(cx,hy-12,hw,5,cc)
    elif chapeu=='enfermeira':
        cc=hexc('#f6f6f2'); r.rect(cx-hw+1,hy-9,cx+hw-1,hy-4,cc); r.rect(cx-1,hy-8,cx+1,hy-5,hexc('#d33'),False)
    elif chapeu=='fone':
        pass
    return finish(r)

def sheet(P):
    cols,rows=4,4
    sh_=Image.new('RGBA',(cols*W,rows*H),(0,0,0,0))
    def put(i,im): sh_.alpha_composite(im,((i%cols)*W,(i//cols)*H))
    for f in range(4):
        put(f,personagem(P,'f',f,True)); put(4+f,personagem(P,'s',f,True)); put(8+f,personagem(P,'b',f,True)); put(12+f,personagem(P,'f',f,False))
    return sh_

PELE={'a':'#f1c9a0','b':'#e0a878','c':'#c68a5c','d':'#8d5a3a','e':'#6b4128'}
# nome -> aparência
NPCS={
 'lurdes':dict(pele=PELE['a'],cabelo='#c9c9c9',cab='coque',top='#7a4a8a',bot='#7a4a8a',estilo='vestido'),
 'antonio':dict(pele=PELE['c'],cabelo='#3a2a22',cab='curto',top='#4a78b8',bot='#4a4f5c',chapeu='pala',chapeu_cor='#b8a040',bigode=1),
 'cida':dict(pele=PELE['d'],cabelo='#2a1a14',cab='curto',top='#e0c040',bot='#9a4a3a',estilo='vestido',lenco='#d8584a'),
 'ze':dict(pele=PELE['b'],cabelo='#4a3a2c',cab='curto',top='#8aa8c8',bot='#5a4a3a',estilo='avental',avental='#f1efe4',bigode=1),
 'neusa':dict(pele=PELE['c'],cabelo='#b8b8b8',cab='ondulado',top='#5a9a6a',bot='#5a9a6a',estilo='vestido',oculos=1),
 'padre':dict(pele=PELE['a'],cabelo='#8a8a8a',cab='curto',top='#1e1e24',bot='#1e1e24',estilo='batina',shoe='#111'),
 'fatima':dict(pele=PELE['d'],cabelo='#1c1410',cab='coque',top='#e8e0b8',bot='#4a6a8a',estilo='avental',avental='#d85a4a',batom=1),
 'valdir':dict(pele=PELE['b'],cabelo='#5a4a3a',cab='curto',top='#f6f6f2',bot='#d8d8d0',estilo='avental',avental='#f6f6f2',chapeu='chef',bigode=1),
 'zefa':dict(pele=PELE['a'],cabelo='#8a4a2a',cab='longo',top='#d86a8a',bot='#d86a8a',estilo='vestido'),
 'paulo':dict(pele=PELE['a'],cabelo='#4a4a4a',cab='curto',top='#f4f6f6',bot='#3a4a5a',estilo='jaleco_longo',oculos=1),
 'celia':dict(pele=PELE['e'],cabelo='#1a1414',cab='ondulado',top='#e6a43a',bot='#3a3a4a',estilo='camisa',batom=1),
 'marlene':dict(pele=PELE['b'],cabelo='#6a1a1a',cab='longo',top='#c8283a',bot='#c8283a',estilo='vestido',batom=1),
 'rosa':dict(pele=PELE['c'],cabelo='#2a1a14',cab='coque',top='#e8d0a0',bot='#6a3a2a',estilo='avental',avental='#e86a2a'),
 'tiao':dict(pele=PELE['d'],cabelo='#2a1a14',cab='careca',top='#c83a3a',bot='#3a3a44',estilo='avental',avental='#f4f4f0',bigode=1),
 'vera':dict(pele=PELE['a'],cabelo='#d8c8a0',cab='longo',top='#5a8ac8',bot='#2a3a5a',estilo='camisa',oculos=1,batom=1),
 'lia':dict(pele=PELE['b'],cabelo='#3a2a3a',cab='coque',top='#9a6ac8',bot='#4a3a6a',estilo='camisa',oculos=1),
 'nelson':dict(pele=PELE['c'],cabelo='#8a8a8a',cab='curto',top='#6a8a5a',bot='#6a6a50',estilo='colete',colete='#c8a040',chapeu='palha',bigode=1),
 'almeida':dict(pele=PELE['a'],cabelo='#7a7a7a',cab='curto',top='#2a3a5a',bot='#2a3a5a',estilo='terno',gravata='#a22828',oculos=1),
 'sonia':dict(pele=PELE['c'],cabelo='#2a1a14',cab='coque',top='#f4f8f8',bot='#f4f8f8',estilo='enfermeira',chapeu='enfermeira',batom=1),
 'zeca':dict(pele=PELE['b'],cabelo='#3a2a22',cab='curto',top='#9a9a50',bot='#4a4a5a',estilo='camisa',bigode=1),
 'dirceu':dict(pele=PELE['b'],cabelo='#2a1a14',cab='curto',top='#e8e8e0',bot='#2a2a30',estilo='avental',avental='#2a3a5a',bigode=1),
 'marta':dict(pele=PELE['c'],cabelo='#5a2a1a',cab='coque',top='#f4a0c0',bot='#f4a0c0',estilo='avental',avental='#fff4f8',batom=1,chapeu='enfermeira'),
 'jorge':dict(pele=PELE['a'],cabelo='#9a9a9a',cab='curto',top='#2a5aa8',bot='#3a3a44',estilo='camisa',oculos=1),
 'borracheiro':dict(pele=PELE['d'],cabelo='#1c1410',cab='curto',top='#c8a030',bot='#3a4a6a',estilo='camisa',chapeu='pala',chapeu_cor='#2a2a2a'),
 'bia':dict(pele=PELE['b'],cabelo='#c8a060',cab='longo',top='#4ab8a8',bot='#3a3a4a',estilo='camisa',batom=1),
 'cota':dict(pele=PELE['d'],cabelo='#c8c8c8',cab='ondulado',top='#4a6aa8',bot='#4a6aa8',estilo='vestido'),
}
# moradores genéricos (pedestres e casas)
import random
GEN=[]
rnd=random.Random(7)
ROUPA=['#c0504a','#4a78b8','#e0b040','#5a9a6a','#9a6ac8','#e8e0d0','#d87a3a','#4aa8a8','#8a5a3a','#7a7a8a']
CAL=['#3a4a6a','#4a4f5c','#6a5a4a','#2a2a30','#7a8aa0','#5a4a3a']
CAB=['#1c1410','#3a2a22','#5a3a22','#8a5a2a','#c8a060','#b8b8b8','#2a1a14']
for i in range(18):
    fem=i%2==0
    d=dict(pele=rnd.choice(list(PELE.values())),cabelo=rnd.choice(CAB),top=rnd.choice(ROUPA),bot=rnd.choice(CAL))
    if fem: d.update(cab=rnd.choice(['longo','coque','ondulado','curto']),estilo=rnd.choice(['vestido','camisa','camisa']),batom=rnd.random()<.5)
    else:
        d.update(cab=rnd.choice(['curto','curto','careca']),estilo=rnd.choice(['camisa','camisa','colete']),bigode=rnd.random()<.35,oculos=rnd.random()<.2)
        if rnd.random()<.3: d.update(chapeu='pala',chapeu_cor=rnd.choice(['#3b6e3a','#3a5a9a','#a83a3a']))
    if d.get('estilo')=='vestido': d['bot']=d['top']
    GEN.append(d)
if __name__=='__main__':
    out=sys.argv[1]; os.makedirs(out,exist_ok=True); ids=[]
    for k,P in NPCS.items(): sheet(P).save(os.path.join(out,f'{k}.png')); ids.append(k)
    for i,P in enumerate(GEN): sheet(P).save(os.path.join(out,f'g{i}.png')); ids.append(f'g{i}')
    json.dump(ids,open(os.path.join(out,'_ids.json'),'w')); print(len(ids),'sheets')
