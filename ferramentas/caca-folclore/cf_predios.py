"""Gera as fachadas de Angatuba (casas, sobrados, comércios, prefeitura, posto) em pixel art.
Cada sprite tem largura = N tiles de 48px; a base fica rente ao fundo da imagem.
Uso: python3 -I cf_predios.py <saida_props_dir>  -> imprime JSON com {nome:[w_tiles,altura_px]}"""
import sys, json, random
from PIL import Image, ImageDraw, ImageFont
T = 48
OUT = (58, 40, 36, 255)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def hx(c, a=255):
    c = c.lstrip('#'); return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), a)

def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)

class Cv:
    def __init__(s, w, h):
        s.im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); s.d = ImageDraw.Draw(s.im); s.w = w; s.h = h
    def r(s, x0, y0, x1, y1, f, o=True):
        s.d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=f, outline=OUT if o else None)
    def f(s, x0, y0, x1, y1, f):
        s.d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=f)
    def text(s, cx, cy, t, col, size=12):
        ft = ImageFont.truetype(FONT, size)
        m = Image.new('L', (s.w, s.h), 0); md = ImageDraw.Draw(m); md.fontmode = '1'
        bb = md.textbbox((0, 0), t, font=ft); tw, th = bb[2] - bb[0], bb[3] - bb[1]
        md.text((cx - tw // 2 - bb[0], cy - th // 2 - bb[1]), t, fill=255, font=ft)
        sh = Image.new('L', (s.w, s.h), 0); sh.paste(m, (1, 1))
        s.im.paste(Image.new('RGBA', (s.w, s.h), OUT), (0, 0), sh)
        s.im.paste(Image.new('RGBA', (s.w, s.h), col), (0, 0), m)

def telhado(c, x0, y0, x1, y1, cor):
    """telhado colonial visto de frente: faixa com fileiras de telhas"""
    c.r(x0, y0, x1, y1, cor)
    cl = shade(cor, .82); ch = shade(cor, 1.12)
    for yy in range(y0 + 5, y1 - 2, 6):
        c.f(x0 + 1, yy, x1 - 1, yy + 1, cl)
        off = 0 if ((yy - y0) // 6) % 2 == 0 else 5
        for xx in range(x0 + 3 + off, x1 - 2, 10):
            c.f(xx, yy - 4, xx + 1, yy, cl)
    c.f(x0 + 1, y0 + 1, x1 - 1, y0 + 3, ch)
    c.f(x0 + 1, y1 - 3, x1 - 1, y1 - 1, shade(cor, .7))

def janela(c, x, y, w, h, vene, venez=True):
    c.r(x, y, x + w, y + h, hx('#3a2a2a'))
    c.f(x + 2, y + 2, x + w - 2, y + h - 2, hx('#2b2220'))
    c.f(x + 2, y + 2, x + w // 2 - 1, y + 5, hx('#4d5b66'))
    if venez:
        c.r(x - 7, y - 1, x, y + h + 1, vene); c.r(x + w, y - 1, x + w + 7, y + h + 1, vene)
        for k in range(y + 4, y + h - 2, 4):
            c.f(x - 6, k, x - 1, k + 1, shade(vene, .75)); c.f(x + w + 1, k, x + w + 6, k + 1, shade(vene, .75))
    c.r(x - 2, y + h, x + w + 2, y + h + 3, hx('#efe2bd'))

def porta(c, x, y, w, h, cor):
    c.r(x, y, x + w, y + h, cor)
    c.f(x + 3, y + 3, x + w // 2 - 1, y + h // 2 - 2, shade(cor, 1.15)); c.f(x + w // 2 + 2, y + 3, x + w - 3, y + h // 2 - 2, shade(cor, 1.15))
    c.f(x + 3, y + h // 2 + 2, x + w // 2 - 1, y + h - 4, shade(cor, .85)); c.f(x + w // 2 + 2, y + h // 2 + 2, x + w - 3, y + h - 4, shade(cor, .85))
    c.f(x + w - 6, y + h // 2, x + w - 3, y + h // 2 + 3, hx('#e8c25a'))

def reboco(c, x0, y0, x1, y1, cor):
    c.r(x0, y0, x1, y1, cor)
    rnd = random.Random(x0 * 31 + y0)
    for _ in range((x1 - x0) * (y1 - y0) // 90):
        xx = rnd.randint(x0 + 2, x1 - 4); yy = rnd.randint(y0 + 2, y1 - 3)
        c.f(xx, yy, xx + 2, yy + 1, shade(cor, .93))
    c.f(x0 + 1, y1 - 5, x1 - 1, y1 - 1, shade(cor, .8))  # barra

# ---------------------------------------------------------------- casas
PAREDES = ['#f2d27a', '#8fc4e6', '#f1a6b4', '#cfe3b0', '#f4ead0', '#e9a77a', '#b9a5dc', '#9ad3c2']
TELHAS = ['#d9784a', '#c0502f', '#b34848', '#9c6b4a', '#c9693f', '#d98a4a']
PORTAS = ['#9a6334', '#3f7d4a', '#3a5f9a', '#8a3a2a']
VENE = ['#9a6334', '#3f7d4a', '#2f5f8f', '#a8472f']

def casa(i):
    rnd = random.Random(100 + i)
    W, H = 144, 118
    c = Cv(W, H); pa = hx(PAREDES[i % len(PAREDES)]); te = hx(TELHAS[i % len(TELHAS)])
    dc = [0, 1, 2][i % 3]
    laje = i % 4 == 3
    if laje:
        c.r(0, 18, W, 30, shade(pa, 1.05)); c.f(1, 19, W - 1, 22, shade(pa, 1.2)); reboco(c, 3, 30, W - 3, H - 4, pa)
        top = 30
    else:
        telhado(c, 0, 0, W, 40, te); reboco(c, 5, 40, W - 5, H - 4, pa); top = 40
    for t in range(3):
        cxm = t * T + T // 2
        if t == dc:
            porta(c, cxm - 11, H - 4 - 44, 22, 44, hx(PORTAS[(i + 1) % 4]))
        else:
            janela(c, cxm - 13, top + 14, 26, 24, hx(VENE[i % 4]), venez=True)
    c.r(0, H - 5, W, H, shade(pa, .6))
    return c.im

def sobrado(i):
    rnd = random.Random(200 + i)
    W, H = 144, 190
    c = Cv(W, H); pa = hx(PAREDES[(i * 3 + 1) % len(PAREDES)]); te = hx(TELHAS[(i + 2) % len(TELHAS)])
    dc = [1, 0, 2][i % 3]
    telhado(c, 0, 0, W, 38, te)
    reboco(c, 5, 38, W - 5, H - 4, pa)
    c.r(3, 108, W - 3, 116, shade(pa, 1.15))  # laje entre andares
    for t in range(3):
        cxm = t * T + T // 2
        janela(c, cxm - 13, 54, 26, 28, hx(VENE[(i + t) % 4]))
    # sacada
    c.r(8, 92, W - 8, 100, hx('#efe2bd'))
    for xx in range(12, W - 10, 8): c.f(xx, 100, xx + 2, 108, hx('#6a4a2a'))
    for t in range(3):
        cxm = t * T + T // 2
        if t == dc:
            porta(c, cxm - 11, H - 4 - 46, 22, 46, hx(PORTAS[(i + 2) % 4]))
        else:
            janela(c, cxm - 13, 128, 26, 28, hx(VENE[(i + t + 1) % 4]))
    c.r(0, H - 5, W, H, shade(pa, .6))
    return c.im

# ---------------------------------------------------------------- comércios
def comercio(nome, texto, cor_placa, cor_texto, cor_toldo, cor_par, dc, andares=1, toldo2='#ffffff', tw=4, tamfonte=13):
    W = tw * T; H = 150 if andares == 1 else 206
    c = Cv(W, H)
    # platibanda + placa
    c.r(0, 0, W, 44, shade(hx(cor_par), 1.05)); c.f(1, 1, W - 1, 4, shade(hx(cor_par), 1.25))
    c.r(10, 7, W - 10, 38, hx(cor_placa)); c.f(12, 9, W - 12, 12, shade(hx(cor_placa), 1.25))
    c.text(W // 2, 23, texto, hx(cor_texto), tamfonte)
    y0 = 44
    if andares == 2:
        reboco(c, 3, y0, W - 3, 104, hx(cor_par))
        for t in range(tw):
            if t % 1 == 0: janela(c, t * T + 11, 62, 26, 28, hx(VENE[t % 4]))
        c.r(2, 100, W - 2, 108, shade(hx(cor_par), 1.15)); y0 = 108
        reboco(c, 3, y0, W - 3, H - 4, hx(cor_par))
    else:
        reboco(c, 3, y0, W - 3, H - 4, hx(cor_par))
    base = H - 4
    ty = y0 + 6
    # toldo
    ch = hx(cor_toldo); c2 = hx(toldo2)
    c.r(2, ty, W - 2, ty + 18, ch)
    for k, xx in enumerate(range(3, W - 3, 12)):
        c.f(xx, ty + 1, min(xx + 6, W - 3), ty + 17, c2 if k % 2 else ch)
    for xx in range(3, W - 3, 12):
        c.d.pieslice([xx, ty + 12, xx + 12, ty + 24], 0, 180, fill=c2 if ((xx - 3) // 12) % 2 else ch, outline=OUT)
    # vitrines e porta
    for t in range(tw):
        cxm = t * T + T // 2
        if t == dc:
            porta(c, cxm - 12, base - 46, 24, 46, hx('#7a5230'))
            c.f(cxm - 9, base - 43, cxm + 9, base - 26, hx('#a9d4e6'))
            c.d.line([cxm, base - 43, cxm, base - 26], fill=OUT)
        else:
            c.r(t * T + 5, base - 46, t * T + T - 5, base - 8, hx('#3a2a2a'))
            c.f(t * T + 8, base - 43, t * T + T - 8, base - 11, hx('#8ecae0'))
            c.f(t * T + 10, base - 41, t * T + 20, base - 33, hx('#cfeaf5'))
            c.f(t * T + 8, base - 22, t * T + T - 8, base - 20, hx('#6b8a99'))
            c.f(t * T + 12, base - 20, t * T + 24, base - 11, hx('#e8c25a')); c.f(t * T + 28, base - 20, t * T + 36, base - 11, hx('#d9604c'))
    c.r(0, H - 5, W, H, shade(hx(cor_par), .6))
    return c.im

def prefeitura():
    W, H = 5 * T, 196
    c = Cv(W, H); pa = hx('#f4ead0'); az = hx('#3d6fa8')
    # frontão
    c.d.polygon([(8, 52), (W // 2, 4), (W - 8, 52)], fill=hx('#e2d3ad'), outline=OUT)
    c.d.polygon([(30, 50), (W // 2, 14), (W - 30, 50)], fill=pa, outline=OUT)
    c.d.ellipse([W // 2 - 12, 28, W // 2 + 12, 52], fill=hx('#3d6fa8'), outline=OUT)
    c.d.ellipse([W // 2 - 6, 34, W // 2 + 6, 46], fill=hx('#f0c64a'), outline=OUT)
    c.r(4, 50, W - 4, 62, hx('#d8c898'))
    reboco(c, 8, 62, W - 8, H - 4, pa)
    c.r(8, 62, W - 8, 90, az); c.text(W // 2, 76, 'PREFEITURA', hx('#ffffff'), 14)
    for k in range(5):
        xx = 14 + k * 46
        if k != 2:
            c.r(xx, 96, xx + 28, 96 + 46, hx('#3a2a2a')); c.f(xx + 3, 99, xx + 25, 139, hx('#9ec9e0'))
            c.f(xx + 13, 99, xx + 15, 139, OUT); c.f(xx + 3, 117, xx + 25, 119, OUT)
    # colunas e porta central
    for xx in (W // 2 - 44, W // 2 + 30):
        c.r(xx, 92, xx + 14, H - 6, hx('#f7f1df')); c.f(xx + 2, 94, xx + 4, H - 8, hx('#fffdf2'))
    porta(c, W // 2 - 20, H - 4 - 66, 40, 66, hx('#8a5a30'))
    c.r(W // 2 - 26, H - 4 - 74, W // 2 + 26, H - 4 - 66, hx('#e2d3ad'))
    # bandeira
    c.f(W - 20, 0, W - 17, 30, OUT)
    c.r(W - 17, 2, W - 4, 14, hx('#3f9f4a')); c.d.polygon([(W - 15, 8), (W - 10, 4), (W - 6, 8), (W - 10, 12)], fill=hx('#f0c64a'))
    c.r(0, H - 5, W, H, shade(pa, .6))
    return c.im

def posto():
    W, H = 4 * T, 150
    c = Cv(W, H); pa = hx('#f4f7f4')
    c.r(0, 0, W, 40, hx('#eef3ee')); c.r(10, 6, W - 10, 34, hx('#2f7fc0'))
    c.text(W // 2 + 12, 20, 'POSTO DE SAÚDE', hx('#ffffff'), 11)
    c.f(22, 12, 38, 28, hx('#ffffff')); c.f(28, 10, 32, 30, hx('#d9453a')); c.f(20, 18, 40, 22, hx('#d9453a'))
    reboco(c, 3, 40, W - 3, H - 4, pa)
    c.r(3, 50, W - 3, 58, hx('#2f7fc0'))
    base = H - 4
    for t in range(4):
        cxm = t * T + T // 2
        if t == 1:
            porta(c, cxm - 14, base - 50, 28, 50, hx('#e8eef0'))
            c.f(cxm - 11, base - 47, cxm + 11, base - 26, hx('#a9d4e6'))
        else:
            janela(c, cxm - 13, 70, 26, 36, hx('#2f7fc0'), venez=False)
    c.f(2 * T + 10, 62, 3 * T + 30, 66, hx('#d9453a'))
    c.r(0, H - 5, W, H, shade(pa, .6))
    return c.im

def main(out):
    S = {}
    for i in range(8): S['casa%d' % i] = casa(i)
    for i in range(4): S['sobrado%d' % i] = sobrado(i)
    S['mercado'] = comercio('mercado', 'MERCADO', '#2f7a3f', '#fff6c8', '#3f9f4a', '#f2e6c2', 2)
    S['padaria'] = comercio('padaria', 'PADARIA', '#a8582a', '#ffe7b0', '#d98a3a', '#f4d9a4', 1, 2)
    S['farmacia'] = comercio('farmacia', 'FARMÁCIA', '#2a8a6a', '#ffffff', '#2a8a6a', '#eef3ee', 2, 2, tamfonte=12)
    S['bar'] = comercio('bar', 'BAR DO ZÉ', '#8a2a2a', '#ffe08a', '#b83a3a', '#e6c79a', 1)
    S['lanchonete'] = comercio('lanchonete', 'LANCHES', '#d9a02a', '#4a2a10', '#e4572e', '#fbe8b8', 2)
    S['acougue'] = comercio('acougue', 'AÇOUGUE', '#a02a3a', '#ffffff', '#c93a4a', '#efe3d0', 1)
    S['modas'] = comercio('modas', 'MODAS', '#7a3a9a', '#ffe6f5', '#a34ac0', '#f2dcec', 2, 2)
    S['pesqueiro'] = comercio('pesqueiro', 'ISCAS E PESCA', '#2a6a9a', '#e6f4ff', '#3a8ac0', '#dcebf2', 1, tamfonte=10)
    S['barbearia'] = comercio('barbearia', 'BARBEARIA', '#2a3a5a', '#f4f0e0', '#3a5a8a', '#e8e0d0', 1, tamfonte=11)
    S['sorveteria'] = comercio('sorveteria', 'SORVETES', '#e0608c', '#ffffff', '#f08ab0', '#fff0f4', 1, tamfonte=12)
    S['loterica'] = comercio('loterica', 'LOTÉRICA', '#2a5aa8', '#ffe34a', '#3a7ad0', '#e6eef6', 1, tamfonte=12)
    S['borracharia'] = comercio('borracharia', 'BORRACHARIA', '#3a3a3a', '#ffd23a', '#5a5a5a', '#d8d8d0', 1, tamfonte=9)
    S['petshop'] = comercio('petshop', 'PET SHOP', '#3a9a8a', '#ffffff', '#4ab8a8', '#e8f4f0', 1, tamfonte=12)
    S['prefeitura'] = prefeitura()
    S['posto'] = posto()
    meta = {}
    for k, im in S.items():
        im2 = Image.new('RGBA', (im.width + 2, im.height + 2), (0, 0, 0, 0)); im2.paste(im, (1, 1))
        im.save(f'{out}/{k}.png'); meta[k] = [im.width // T, im.height]
    print(json.dumps(meta))

main(sys.argv[1])
