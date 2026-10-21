/* coruja_voo_anim.js — animação de voo da Corujinha (Voo da Coruja)
 *
 * Spritesheet: coruja_voo_sheet.png — 9 frames em linha, célula 160x136 px.
 * Âncora de cada célula = centro do corpo (x=80) e linha dos pés (y=130):
 * passe em desenhar() a posição dos PÉS da coruja e o corpo fica sempre no lugar.
 *
 * Uso:
 *   const coruja = new CorujaVooAnim(img);        // img = <img> já carregada
 *   // a cada frame do jogo:
 *   coruja.atualizar(dtMs);
 *   coruja.desenhar(ctx, x, yPes, escala, olhandoEsquerda);
 *   // eventos do jogo:
 *   coruja.tocar('impulso');   // quicou/pulou  -> agacha, pula e entra no voo
 *   coruja.tocar('pouso');     // vai tocar a plataforma -> pousa e volta a 'parado'
 */
(function (global) {
  'use strict';

  // índices 0..8 = frames 1..9 do sheet
  var META = {
    cw: 160, ch: 136, ax: 80, ay: 130,
    //  1:em pé  2:agachar  3:pulo  4:abrindo  5:abertas  6:meio  7:fechando  8:pouso  9:em pé
    ms: [100,     60,       80,     60,        110,       80,     80,         100,      160]
  };

  var SEQ = {
    parado:  { f: [0],          loop: true },                 // em pé
    impulso: { f: [1, 2],       prox: 'voo' },                // agachar -> pulo (asas fechadas)
    voo:     { f: [3, 4, 5, 6], loop: true },                 // abrindo -> abertas -> meio -> fechando
    pouso:   { f: [7, 8],       prox: 'parado' }              // pouso -> em pé
  };

  function CorujaVooAnim(img, opcoes) {
    this.img = img;
    this.m = {};
    var k;
    for (k in META) this.m[k] = META[k];
    if (opcoes) for (k in opcoes) this.m[k] = opcoes[k];
    this.vel = 1;            // multiplicador de velocidade (ex.: bater asas mais rápido)
    this.tocar('parado', true);
  }

  var P = CorujaVooAnim.prototype;

  P.tocar = function (nome, forcar) {
    if (!SEQ[nome]) return this;
    if (this.seq === nome && !forcar && SEQ[nome].loop) return this; // não reinicia loops
    this.seq = nome; this.k = 0; this.t = 0;
    return this;
  };

  P.frame = function () { return SEQ[this.seq].f[this.k]; };

  P.atualizar = function (dtMs) {
    this.t += Math.min(dtMs, 100);            // trava dt (aba em segundo plano, lag)
    for (;;) {
      var s = SEQ[this.seq];
      if (s.f.length === 1) { this.t = 0; return; }
      var dur = this.m.ms[s.f[this.k]] / this.vel;
      if (this.t < dur) return;
      this.t -= dur;
      if (++this.k >= s.f.length) {
        if (s.loop) this.k = 0;
        else { this.seq = s.prox; this.k = 0; }
      }
    }
  };

  // x = centro do corpo, y = linha dos pés (coordenadas do canvas)
  P.desenhar = function (ctx, x, y, escala, espelhar) {
    var m = this.m, e = escala || 1, i = this.frame();
    var w = m.cw * e, h = m.ch * e, dy = Math.round(y - m.ay * e);
    if (espelhar) {
      ctx.save();
      ctx.translate(Math.round(x), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.img, i * m.cw, 0, m.cw, m.ch, Math.round(-m.ax * e), dy, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(this.img, i * m.cw, 0, m.cw, m.ch, Math.round(x - m.ax * e), dy, w, h);
    }
  };

  global.CorujaVooAnim = CorujaVooAnim;
})(window);
