import sys, json, numpy as np
sys.path.insert(0,'/home/claude/pixel_scripts')
from cf_lib import *
from PIL import Image
from scipy import ndimage as ndi
M=json.load(open('/tmp/g/map2.json'))['extra']
which=sys.argv[1]; out='/tmp/g/extras/'; os.makedirs(out,exist_ok=True)
if which.startswith('carro'):
    off=0 if which=='carro1' else 4
    rgb,cel=segmenta(M[which],3,4,thick=False,fecha=4)
    side=[b[2]-b[0] for (r,c),(m,b) in cel.items() if c==0]
    esc=84/float(np.median(side))
    atl=Image.new('RGBA',(288,256),(0,0,0,0))
    for (r,c),(m,b) in cel.items():
        m0=ndi.binary_fill_holes(ndi.binary_closing(m,iterations=8))
        if c==0 and m0.sum()<0.55*(b[2]-b[0])*(b[3]-b[1]):
            m0=ndi.binary_fill_holes(ndi.binary_closing(np.pad(m,40),iterations=40))[40:-40,40:-40]
        m=m0; s=reduz(recorte(rgb,m,b),esc)
        atl.alpha_composite(s,(c*96+48-s.width//2, r*64+63-s.height))
    atl.save(out+which+'.png'); print(which,len(cel),'esc',round(esc,3))
elif which=='props':
    rgb,cel=segmenta(M['props'],4,2,linhas_on=False,minarea=600)
    nomes=[['poste','lixeira','hidrante','placa_pare'],['orelhao','banca','ponto','arvore_rua']]
    T={'poste':(22,82),'lixeira':(24,34),'hidrante':(18,28),'placa_pare':(22,62),'orelhao':(26,56),'banca':(72,62),'ponto':(84,66),'arvore_rua':(34,90)}
    for (r,c),(m,b) in cel.items():
        n=nomes[r][c]; tw,th=T[n]; s=recorte(rgb,m,b)
        esc=th/s.height; s=reduz(s,esc); W=max(tw,s.width)
        cv=Image.new('RGBA',(W,th),(0,0,0,0)); cv.alpha_composite(s,(W//2-s.width//2,th-s.height)); cv.save(out+n+'.png'); print(n,s.size)
    print(len(cel))
else:
    T={'f_prefeitura':(240,196),'f_padaria':(192,206),'f_farmacia':(192,206),'f_modas':(192,206)}
    tw,th=T.get(which,(192,150))
    rgb,cel=segmenta(M[which],1,1,linhas_on=False,minarea=5000)
    m,b=cel[(0,0)]; s=recorte(rgb,m,b)
    esc=min(th/s.height,tw/s.width); s=reduz(s,esc)
    cv=Image.new('RGBA',(tw,th),(0,0,0,0)); cv.alpha_composite(s,(tw//2-s.width//2,th-s.height))
    cv.save(out+which[2:]+'.png'); print(which,s.size)
