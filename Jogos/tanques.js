/* ═══════════════════════════════════════════════════════════════
   BATALHA DE TANQUES — módulo de jogo (lazy-loaded)
   1x1 em tempo real, arena widescreen (16:9) vista de cima. Cada
   jogador controla um tanque, precisa girar antes de andar pra
   frente, e atira nos blocos de tijolo (destrutíveis) e no tanque
   adversário.
   Dois modos: sozinho contra a CPU, ou multiplayer de verdade via
   Jogos/multiplayer.js (AngatubaMP) — mesma sala por código de 4
   letras usada pelo Ping Pong, dados trafegando P2P (WebRTC).

   MODELO DE REDE (hibrido — diferente do Ping Pong porque aqui os
   DOIS tanques são controlados por pessoas, não só um lado):
     - Cada jogador simula o PRÓPRIO tanque localmente (rotação +
       avanço, colisão com parede) — responde na hora, sem esperar
       a rede. Como o layout de paredes é fixo (só o estado
       destruída/intacta muda), os dois lados calculam a mesma
       colisão sem precisar combinar nada.
     - Só o ANFITRIÃO simula os PROJÉTEIS (nascem, colidem com
       parede/tanque, morrem) e o estado das paredes (dano) — exidem
       autoridade única, senão os dois lados veem coisas diferentes
       (a bola no Ping Pong tem o mesmo motivo). O convidado manda
       {t:'p', x,y,ang} com a própria posição a cada quadro e
       {t:'tiro', x,y,ang} quando atira; o anfitrião manda de volta
       {t:'e', ...} com a posição dele, os projéteis, o estado das
       paredes e o placar da partida.
     - No modo sozinho não tem rede nenhuma: o próprio jogador simula
       o proprio tanque, e o "convidado" é a CPU (ver _tqAtualizarIA).

   FÍSICA DO TANQUE: ângulo 0 = mirando pro norte (cima da tela),
   cresce no sentido horário (mesma convenção do ctx.rotate). Empurrar
   o joystick numa direção GIRA o tanque pra lá (limitado por
   TQ_GIRO_VEL) e avança na direção que o tanque JÁ está apontando
   (não direto pro joystick) — é o que dá a sensação de "gira, depois
   anda" sem precisar de uma máquina de estados separada.

   PAREDES: sorteadas de um POOL de mapas fixos (_TQ_MAPAS) no início
   de cada PARTIDA (não a cada rodada) — cada mapa é simétrico (metade
   + espelho 180°, ver _tqMontarMapa). Só o ANFITRIÃO sorteia; o mapa
   escolhido viaja pro convidado dentro da mensagem 'oi' (conexão) ou
   'rr' (revanche) — depois disso os dois lados têm a MESMA geometria
   e só sincronizam o dano (destruída/intacta), igual antes. Cada
   parede aguenta TQ_PAREDE_HP tiros antes de virar escombro (para de
   bloquear). Tiros que saem da arena (borda) quicam UMA vez antes de
   sumir (ver TQ_RICOCHETE_MAX em _tqAtualizarProjeteis). Cada mapa
   também tem moitas (não bloqueiam) — escondem o tanque que estiver
   dentro E não tiver atirado nos últimos TQ_MOITA_REVELA_SEG segundos
   (ver _tqEmMoita/_tqEscondido*), tanto do desenho do adversário
   quanto da mira da IA. Algumas paredes têm tipo:'metal' (ver
   _tqMontarMapa/_tqResetParedes) — em vez de levar dano, ricocheteiam
   o tiro (_tqRefletirEmParede), consumindo o mesmo orçamento de
   quiques da borda da arena (TQ_RICOCHETE_MAX).

   BARRIS EXPLOSIVOS: pontos fixos por mapa (_TQ_MAPAS[].barris, ver
   _tqMontarPontos — mesma ideia de _tqMontarMapa, mas pra geometria de
   PONTO em vez de retângulo), resetados (não-destruídos) a cada
   RODADA igual as paredes (ver _tqResetBarris). Só o ANFITRIÃO detecta
   o acerto (mesma autoridade de paredes/projéteis/caixas) — qualquer
   tiro que encostar detona o barril inteiro (_tqExplodirBarril),
   aplicando dano de área (TQ_BARRIL_RAIO_EXPLOSAO) nos tanques por
   perto via a MESMA _tqAplicarDano dos tiros diretos (escudo/HP/
   Pesado funcionam sem código extra). O estado (destruído) sincroniza
   pro convidado em 'e' (campo "bd", mesmo padrão do "pd" das paredes);
   o efeito visual da explosão é local e não sincronizado — cada lado
   dispara a própria animação ao detectar a transição pra destruído
   (_tqDispararExplosaoVisual).

   CLASSES E PODER-UPS: cada jogador escolhe sua classe (Padrão/Leve/
   Pesado — ver TQ_CLASSES) no menu antes de jogar; a própria já é
   aplicada na hora, a do adversário chega pela mensagem 'oi'. Só quem
   é Pesado tem mais de 1 HP (ver t.hp/_tqAplicarDano) — os outros
   ainda morrem num tiro só. Caixas de suprimento (escudo/tiro rápido/
   tiro duplo) nascem sozinhas de tempos em tempos; só o ANFITRIÃO
   sorteia posição/tipo e detecta quem pegou (mesma autoridade das
   paredes/projéteis) — a lista viaja pro convidado em 'e' (campo
   "cx"), e o cooldown reduzido do PRÓPRIO convidado também (campo
   "rg", pro gatilho local não esperar a rede a cada tiro).

   MODOS DE JOGO: Clássico (padrão), Rei do Pedaço e Batata Quente —
   escolhido no menu (pill igual a classe, ver _tqEscolherModo), mas é
   ajuste de PARTIDA (não por jogador): só o ANFITRIÃO decide, o
   convidado recebe pela mensagem 'oi' (campo "modo", ver TQ_MODOS/
   _tqModoJogo). Nos dois modos novos o combate normal (atirar, morrer
   com HP zerado) continua funcionando igual — a vitória por zona/
   batata é um jeito A MAIS de vencer a rodada. Rei do Pedaço: fica
   sozinho dentro de "o pedaço" (círculo achado por _tqAcharCentroZona,
   determinístico a partir do mapa — não precisa viajar pela rede) por
   TQ_ZONA_TEMPO_VITORIA segundos pra vencer (ver _tqAtualizarZona,
   só o ANFITRIÃO decide, progresso sincroniza em 'e' pros dois lados
   verem o mesmo arco). Batata Quente: um lado sorteado começa com a
   batata (campo "bt", mesma autoridade dos spawns); encostar no
   adversário passa ela pro outro (com um respiro de imunidade); quem
   estiver com ela quando o timer estourar perde a rodada (ver
   _tqAtualizarBatata).

   ARENA, MUNDO E CÂMERA: o MUNDO (onde tanques/paredes/moitas vivem)
   agora é bem maior que a TELA — TQ_VIEWPORT_LARGURA/ALTURA (16/9 × 1,
   a mesma proporção de sempre) é só a "janela" visível, e MUNDO_LARGURA/
   ALTURA (viewport × TQ_MUNDO_ESCALA) é o mapa inteiro. Uma câmera
   (_tqCamera, ver _tqAtualizarCamera) segue o PRÓPRIO tanque, centralizada
   nele e travada nas bordas do mundo pra nunca mostrar área fora do mapa.
   Todo pixel-por-unidade continua usando _tqH (altura real do canvas)
   como fator uniforme pros dois eixos — _tqW = _tqH × TQ_VIEWPORT_LARGURA
   sempre, porque o CSS trava aspect-ratio 16/9 na arena. A câmera é
   puramente um deslocamento de desenho: um único ctx.translate(-câmera)
   em _tqDesenhar() antes de desenhar chão/rastro/moitas/paredes/caixas/
   tanques — nenhuma dessas funções de desenho precisa saber que a câmera
   existe. Em celular deitado ou com o lock nativo de tela
   (screen.orientation.lock), o canvas já nasce nessa proporção; em
   retrato sem o lock, o wrapper #tq-rot gira 90° por CSS (mesmo padrão
   da Corrida, ver _tqAplicarOrientacao) — o joystick então precisa
   converter toque em tela pra espaço local antes de calcular direção
   (_tqDeltaLocal).

   OCULTAÇÃO POR DISTÂNCIA: como o mapa é grande, o adversário também
   fica escondido (não desenhado, IA não mira) quando está longe demais
   (> TQ_VISAO_RAIO), somado à ocultação por moita que já existia — ver
   _tqEscondido* em _tqSimularMundo.

   SPAWNS INTELIGENTES: no início de cada RODADA, o anfitrião sorteia um
   par de pontos nas bordas/cantos do mapa com distância mínima de
   segurança entre si (ver _tqSortearSpawns) — o ponto do convidado
   viaja pela rede (campo "gsp"/"spg", ver mensagens 'oi'/'rr'/'e').

   Fala com o app só via window.AngatubaGames (a ponte) e com a rede
   só via window.AngatubaMP (Jogos/multiplayer.js). Expõe
   window.TanquesGame = { preparar, comecar, parar }.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Ajustes do jogo ─────────────────────────────────────────── */
  var TQ_RODADAS_PARA_VENCER = 2;    // melhor de 3 — primeiro a 2 vitórias de rodada
  var TQ_RAIO_TANQUE   = 0.052;      // raio de colisão do tanque (unidades de mundo)
  var TQ_RAIO_PROJETIL = 0.010;
  var TQ_VELOCIDADE    = 0.34;       // unidades de arena por segundo, com o joystick no talo
  var TQ_GIRO_VEL       = 4.6;       // rad/s — quão rápido o tanque gira até apontar pro alvo
  var TQ_VEL_PROJETIL  = 0.95;
  var TQ_COOLDOWN_TIRO = 0.45;       // segundos entre tiros (por lado)
  var TQ_PAREDE_HP     = 2;          // tiros até a parede virar escombro
  var TQ_DEADZONE      = 0.12;       // magnitude mínima do joystick pra contar como "empurrado"
  var TQ_PAUSA_RODADA  = 1.4;        // segundos de pausa mostrando quem venceu a rodada
  var TQ_RICOCHETE_MAX = 1;          // quantas vezes um tiro pode quicar na borda da arena (ou em parede metálica) antes de sumir
  var TQ_BARRIL_RAIO          = 0.05;   // raio de colisão do barril (mesma escala de TQ_RAIO_TANQUE/CAIXA)
  var TQ_BARRIL_RAIO_EXPLOSAO = 0.34;   // raio de dano em área ao explodir

  // Viewport = "janela" que a câmera mostra (mesma proporção/tamanho
  // de sempre); MUNDO_* = mapa inteiro, um múltiplo do viewport — ver
  // TQ_MUNDO_ESCALA e o comentário "ARENA, MUNDO E CÂMERA" no topo.
  var TQ_VIEWPORT_LARGURA = 16 / 9;
  var TQ_VIEWPORT_ALTURA  = 1;
  var TQ_MUNDO_ESCALA = 4;      // mundo tem 4× a largura E 4× a altura do viewport (16× a área)
  var MUNDO_LARGURA = TQ_VIEWPORT_LARGURA * TQ_MUNDO_ESCALA;
  var MUNDO_ALTURA  = TQ_VIEWPORT_ALTURA * TQ_MUNDO_ESCALA;
  var TQ_VISAO_RAIO = 1.5;      // distância além da qual o adversário fica escondido (independe de moita)
  var TQ_IA_DIST_ENGAJAR = 0.86; // distância (mundo largo) até a IA trocar patrulha por engajar — de propósito NÃO escala com o mapa, senão a CPU nunca precisaria caçar

  /* ── Classes de tanque: escolhida no menu (ver _tqEscolherClasse),
     aplicada ao PRÓPRIO tanque (_tqMinhaClasse) e sincronizada
     pro outro lado dentro do 'oi' (campo "classe") — a CPU (modo
     sozinho) é sempre "padrao". velMul/tiroMul multiplicam
     TQ_VELOCIDADE/TQ_COOLDOWN_TIRO; hpMax é quantos tiros o tanque
     aguenta antes da rodada acabar (ver _tqAplicarDano). */
  var TQ_CLASSES = {
    padrao: { nome: 'Padrão', velMul: 1,    tiroMul: 1,   hpMax: 1 },
    leve:   { nome: 'Leve',   velMul: 1.25, tiroMul: 1,   hpMax: 1 },
    pesado: { nome: 'Pesado', velMul: 0.75, tiroMul: 1.3, hpMax: 3 }
  };
  var _tqMinhaClasse = 'padrao';
  var _tqClasseAnfitriao = 'padrao', _tqClasseConvidado = 'padrao';
  function _tqClasseDoTanque(t) {
    var chave = (t === _tqTanqueAnfitriao) ? _tqClasseAnfitriao : _tqClasseConvidado;
    return TQ_CLASSES[chave] || TQ_CLASSES.padrao;
  }
  // Cooldown de tiro efetivo de um lado ('anfitriao'/'convidado'): junta
  // o multiplicador da classe com o power-up de tiro rápido, se ativo
  // (ver _tqRapidoAnfitriao/_tqRapidoConvidado, mais abaixo).
  function _tqCooldownEfetivo(quem) {
    var classe = TQ_CLASSES[quem === 'anfitriao' ? _tqClasseAnfitriao : _tqClasseConvidado] || TQ_CLASSES.padrao;
    var rapidoAtivo = quem === 'anfitriao' ? _tqRapidoAnfitriao > 0 : _tqRapidoConvidado > 0;
    return TQ_COOLDOWN_TIRO * classe.tiroMul * (rapidoAtivo ? TQ_RAPIDO_MUL : 1);
  }

  /* ── Modos de jogo: Clássico (padrão), Rei do Pedaço (controlar uma
     zona por tempo) e Batata Quente (passar a bomba antes do tempo
     acabar) — escolhido no menu (pill igual a classe, ver
     _tqEscolherModo), mas diferente de classe isso é ajuste de
     PARTIDA, não por jogador: só o ANFITRIÃO decide (ou o modo
     sozinho, sempre anfitrião) — o convidado recebe o modo escolhido
     pela rede ('oi'/'rr', campo "modo") e nunca escolhe o próprio. Nos
     dois modos novos o combate normal continua funcionando igual
     (atirar, morrer com HP zerado) — a vitória por zona/batata é um
     jeito A MAIS de vencer a rodada, não substitui o de sempre. */
  var TQ_MODOS = {
    classico: { nome: 'Clássico' },
    rei: { nome: 'Rei do Pedaço' },
    batata: { nome: 'Batata Quente' }
  };
  var _tqMeuModoEscolhido = 'classico'; // escolha local no menu — só importa se eu virar anfitrião/solo
  var _tqModoJogo = 'classico';         // modo de fato da PARTIDA atual (autoridade do anfitrião)

  // Rei do Pedaço: TQ_ZONA_RAIO/_tqZonaCentro definem "o pedaço" (ver
  // _tqAcharCentroZona); _tqZonaTempo* acumula quanto tempo cada lado
  // ficou sozinho lá dentro nessa rodada (ver _tqAtualizarZona).
  var TQ_ZONA_RAIO = 0.5;             // raio do pedaço (unidades de mundo)
  var TQ_ZONA_TEMPO_VITORIA = 10;     // segundos de controle sozinho pra vencer a rodada
  var _tqZonaCentro = null;                                  // { x, y } — achado por _tqAcharCentroZona quando o modo é 'rei'
  var _tqZonaTempoAnfitriao = 0, _tqZonaTempoConvidado = 0;  // segundos acumulados de controle nessa rodada

  // Batata Quente: quem está com ela (_tqBatataCom), quanto falta pra
  // estourar (_tqBatataTimer) e um respiro após receber (imunidade)
  // pra não ficar repassando na hora (ver _tqAtualizarBatata).
  var TQ_BATATA_DURACAO = 20;                          // segundos até a batata estourar
  var TQ_BATATA_IMUNIDADE = 1.2;                        // segundos de imunidade após RECEBER a batata
  var TQ_BATATA_RAIO_PASSE = TQ_RAIO_TANQUE * 2 + 0.02; // distância pra encostar e passar
  var _tqBatataCom = null;       // 'anfitriao' | 'convidado' | null
  var _tqBatataTimer = 0;        // segundos restantes na rodada
  var _tqBatataImunidade = 0;    // segundos restantes de imunidade de quem acabou de receber

  /* ── Caixas de suprimento: só o ANFITRIÃO gera e detecta coleta (tem
     as duas posições) — geometria/estado viajam pro convidado dentro
     da mensagem 'e' (campo "cx"). 3 tipos: escudo (absorve 1 hit sem
     gastar HP — ver _tqAplicarDano), tiro rápido (cooldown reduzido)
     e tiro duplo (2 projéteis por disparo — ver _tqCriarProjetil). */
  var TQ_CAIXA_RAIO = 0.045;
  var TQ_CAIXA_INTERVALO_MIN = 9, TQ_CAIXA_INTERVALO_MAX = 16; // segundos entre spawns
  var TQ_CAIXA_MAX_SIMULTANEAS = 1;
  var TQ_TIPOS_CAIXA = ['escudo', 'rapido', 'duplo'];
  var TQ_RAPIDO_MUL = 0.5, TQ_RAPIDO_DUR = 7;   // cooldown pela metade, por 7s
  var TQ_DUPLO_DUR = 7, TQ_DUPLO_ESPALHAR = 0.09; // 2 tiros, 7s, abertura em rad entre eles
  var _tqCaixas = [];           // { id, x, y, tipo } — lista atual (host gera/remove)
  var _tqProximaCaixaEm = 0, _tqProxCaixaId = 1;
  var _tqEscudoAnfitriao = false, _tqEscudoConvidado = false;
  var _tqRapidoAnfitriao = 0, _tqRapidoConvidado = 0;   // segundos restantes
  var _tqDuploAnfitriao = 0, _tqDuploConvidado = 0;     // segundos restantes

  /* ── Pool de mapas: cada um é "metade" + espelho 180° (ver
     cabeçalho) — garante simetria sem risco de erro de conta manual.
     Coordenadas dos literais abaixo são fração do viewport ANTIGO
     (x 0..16/9, y 0..1, o tamanho do mapa antes de existir mundo maior
     que a tela) — _tqMontarMapa multiplica tudo (posição E tamanho)
     por TQ_MUNDO_ESCALA, preservando o layout relativo de cada mapa
     mas espalhado pelo mundo novo, sem precisar reescrever os 7 mapas
     à mão. Um mapa é sorteado por PARTIDA (não por rodada), ver
     _tqEscolherMapa e o campo "mapa" nas mensagens 'oi'/'rr'. Cada
     mapa tem paredes (bloqueiam e levam dano) e moitas (não bloqueiam
     — escondem o tanque que estiver dentro, ver _tqEmMoita/_tqEscondido*). */
  function _tqMontarMapa(metade, centro) {
    var e = TQ_MUNDO_ESCALA, lista = [], i, b, bx, by, bw, bh, tipo;
    for (i = 0; i < metade.length; i++) {
      b = metade[i];
      bx = b.x * e; by = b.y * e; bw = b.w * e; bh = b.h * e;
      tipo = b.tipo || 'tijolo';
      lista.push({ x: bx, y: by, w: bw, h: bh, tipo: tipo });
      lista.push({ x: MUNDO_LARGURA - bx - bw, y: MUNDO_ALTURA - by - bh, w: bw, h: bh, tipo: tipo });
    }
    if (centro) lista.push({ x: centro.x * e, y: centro.y * e, w: centro.w * e, h: centro.h * e, tipo: centro.tipo || 'tijolo' });
    return lista;
  }
  // Espelha uma lista de PONTOS (não retângulos) pela mesma regra de
  // simetria 180° de _tqMontarMapa — usado pelos barris, que só têm
  // x/y (sem w/h).
  function _tqMontarPontos(metade) {
    var e = TQ_MUNDO_ESCALA, lista = [], i, p, px, py;
    for (i = 0; i < metade.length; i++) {
      p = metade[i];
      px = p.x * e; py = p.y * e;
      lista.push({ x: px, y: py });
      lista.push({ x: MUNDO_LARGURA - px, y: MUNDO_ALTURA - py });
    }
    return lista;
  }
  var _TQ_MAPAS = [
    // 1. Clássico — pilar + bloco, variação do layout original
    // (pilar central agora é metálico — ricocheteia em vez de quebrar)
    {
      paredes: _tqMontarMapa([
        { x: 0.42, y: 0.10, w: 0.07, h: 0.22 },
        { x: 0.40, y: 0.66, w: 0.20, h: 0.08 }
      ], { x: 0.8439, y: 0.46, w: 0.09, h: 0.09, tipo: 'metal' }),
      moitas: _tqMontarMapa([{ x: 0.26, y: 0.40, w: 0.13, h: 0.18 }]),
      barris: _tqMontarPontos([{ x: 0.60, y: 0.20 }])
    },
    // 2. Corredores — paredes verticais formando 2 corredores
    // (+ 1 parede metálica perto do centro)
    {
      paredes: _tqMontarMapa([
        { x: 0.50, y: 0.00, w: 0.06, h: 0.30 },
        { x: 0.50, y: 0.70, w: 0.06, h: 0.30 },
        { x: 0.78, y: 0.30, w: 0.06, h: 0.40 },
        { x: 0.64, y: 0.44, w: 0.08, h: 0.14, tipo: 'metal' }
      ]),
      moitas: _tqMontarMapa([{ x: 0.30, y: 0.62, w: 0.14, h: 0.16 }]),
      barris: _tqMontarPontos([{ x: 0.30, y: 0.15 }])
    },
    // 3. Cantos — blocos protegendo os 4 cantos do centro
    // (+ 1 parede metálica na lateral)
    {
      paredes: _tqMontarMapa([
        { x: 0.34, y: 0.06, w: 0.16, h: 0.09 },
        { x: 0.34, y: 0.85, w: 0.16, h: 0.09 },
        { x: 0.66, y: 0.44, w: 0.10, h: 0.12 },
        { x: 0.86, y: 0.42, w: 0.08, h: 0.16, tipo: 'metal' }
      ]),
      moitas: _tqMontarMapa([{ x: 0.28, y: 0.28, w: 0.12, h: 0.14 }]),
      barris: _tqMontarPontos([{ x: 0.50, y: 0.75 }])
    },
    // 4. Cruz — pilar vertical no centro + 2 blocos laterais
    // (pilar central agora é metálico — ricocheteia em vez de quebrar)
    {
      paredes: _tqMontarMapa([
        { x: 0.62, y: 0.42, w: 0.20, h: 0.16 }
      ], { x: 0.8389, y: 0.10, w: 0.10, h: 0.80, tipo: 'metal' }),
      moitas: _tqMontarMapa([{ x: 0.32, y: 0.66, w: 0.14, h: 0.16 }]),
      barris: _tqMontarPontos([{ x: 0.30, y: 0.20 }])
    },
    // 5. Zigue-zague — blocos escalonados
    // (+ 1 parede metálica isolada)
    {
      paredes: _tqMontarMapa([
        { x: 0.38, y: 0.06, w: 0.09, h: 0.24 },
        { x: 0.55, y: 0.38, w: 0.09, h: 0.24 },
        { x: 0.72, y: 0.70, w: 0.09, h: 0.24 },
        { x: 1.35, y: 0.10, w: 0.08, h: 0.16, tipo: 'metal' }
      ]),
      moitas: _tqMontarMapa([{ x: 0.26, y: 0.44, w: 0.12, h: 0.14 }]),
      barris: _tqMontarPontos([{ x: 0.20, y: 0.75 }])
    },
    // 6. Aberto — poucos obstáculos, mapa rápido (2 moitas — mais espaço livre)
    // (+ 1 parede metálica)
    {
      paredes: _tqMontarMapa([
        { x: 0.55, y: 0.42, w: 0.11, h: 0.16 },
        { x: 0.90, y: 0.04, w: 0.08, h: 0.14, tipo: 'metal' }
      ]),
      moitas: _tqMontarMapa([
        { x: 0.30, y: 0.20, w: 0.15, h: 0.17 },
        { x: 0.34, y: 0.64, w: 0.13, h: 0.15 }
      ]),
      barris: _tqMontarPontos([{ x: 0.20, y: 0.55 }])
    }
  ];
  var _tqMapaAtualIdx = 0;
  function _tqEscolherMapa() { return Math.floor(Math.random() * _TQ_MAPAS.length); }

  /* ── Spawns inteligentes: 8 pontos candidatos nas bordas/cantos do
     mapa (livres de parede); a cada início de RODADA (não só de
     partida), o ANFITRIÃO sorteia um PAR desses pontos com pelo menos
     TQ_SPAWN_DIST_MIN de distância entre si — evita nascer perto do
     adversário logo de cara num mapa grande — e manda um pra cada
     lado, virado pro centro do mapa. Só o anfitrião sorteia (mesma
     autoridade do mapa/paredes/power-ups); o ponto do convidado viaja
     pela rede (campo "gsp"/"spg" — ver 'oi'/'rr'/'e' em
     _tqReceberMensagem e _tqEnviarEstado/_tqEnviarReinicio). */
  var TQ_SPAWN_MARGEM = 0.35;
  var TQ_SPAWN_DIST_MIN = Math.hypot(MUNDO_LARGURA, MUNDO_ALTURA) * 0.55;

  // Valor inicial/fallback (antes do 1º sorteio de spawn de verdade) —
  // só usado no instante entre o módulo carregar e a 1ª rodada começar.
  var TQ_SPAWN_ANFITRIAO = { x: TQ_SPAWN_MARGEM, y: MUNDO_ALTURA / 2, ang: Math.PI / 2 };
  var TQ_SPAWN_CONVIDADO = { x: MUNDO_LARGURA - TQ_SPAWN_MARGEM, y: MUNDO_ALTURA / 2, ang: -Math.PI / 2 };
  function _tqPontoLivre(x, y, raio) {
    var mapa = _TQ_MAPAS[_tqMapaAtualIdx];
    var paredes = mapa.paredes;
    for (var i = 0; i < paredes.length; i++) {
      if (_tqCircRect(x, y, raio, paredes[i])) return false;
    }
    var barris = mapa.barris || [];
    for (var j = 0; j < barris.length; j++) {
      if (Math.hypot(x - barris[j].x, y - barris[j].y) < raio + TQ_BARRIL_RAIO) return false;
    }
    return true;
  }
  function _tqPontosSpawnCandidatos() {
    var pts = [
      { x: TQ_SPAWN_MARGEM, y: TQ_SPAWN_MARGEM },
      { x: MUNDO_LARGURA - TQ_SPAWN_MARGEM, y: TQ_SPAWN_MARGEM },
      { x: TQ_SPAWN_MARGEM, y: MUNDO_ALTURA - TQ_SPAWN_MARGEM },
      { x: MUNDO_LARGURA - TQ_SPAWN_MARGEM, y: MUNDO_ALTURA - TQ_SPAWN_MARGEM },
      { x: MUNDO_LARGURA / 2, y: TQ_SPAWN_MARGEM },
      { x: MUNDO_LARGURA / 2, y: MUNDO_ALTURA - TQ_SPAWN_MARGEM },
      { x: TQ_SPAWN_MARGEM, y: MUNDO_ALTURA / 2 },
      { x: MUNDO_LARGURA - TQ_SPAWN_MARGEM, y: MUNDO_ALTURA / 2 }
    ];
    var livres = [];
    for (var i = 0; i < pts.length; i++) {
      if (_tqPontoLivre(pts[i].x, pts[i].y, TQ_RAIO_TANQUE)) livres.push(pts[i]);
    }
    // Fallback de segurança: se um mapa muito cheio de parede deixar
    // menos de 2 cantos livres, usa os 8 pontos originais mesmo assim
    // (não deveria acontecer com os mapas atuais, mas evita travar).
    return livres.length >= 2 ? livres : pts;
  }
  function _tqSortearSpawns() {
    var pts = _tqPontosSpawnCandidatos();
    var pares = [], i, j, d;
    for (i = 0; i < pts.length; i++) {
      for (j = i + 1; j < pts.length; j++) {
        d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d >= TQ_SPAWN_DIST_MIN) pares.push([pts[i], pts[j]]);
      }
    }
    if (!pares.length) {
      // Nenhum par bate a distância mínima — usa o par mais distante
      // disponível em vez de travar.
      var melhor = [pts[0], pts[1]], melhorD = -1;
      for (i = 0; i < pts.length; i++) {
        for (j = i + 1; j < pts.length; j++) {
          d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d > melhorD) { melhorD = d; melhor = [pts[i], pts[j]]; }
        }
      }
      pares.push(melhor);
    }
    var par = pares[Math.floor(Math.random() * pares.length)].slice();
    if (Math.random() < 0.5) par.reverse();
    var cx = MUNDO_LARGURA / 2, cy = MUNDO_ALTURA / 2;
    function angParaCentro(p) { return Math.atan2(cx - p.x, -(cy - p.y)); }
    return {
      anfitriao: { x: par[0].x, y: par[0].y, ang: angParaCentro(par[0]) },
      convidado: { x: par[1].x, y: par[1].y, ang: angParaCentro(par[1]) }
    };
  }

  var _tqCanvas = null, _tqCtx = null, _tqW = 0, _tqH = 0, _tqDpr = 1;
  var _tqRAF = 0, _tqUltimoTs = 0;
  var _tqEstado = 'inicio';   // inicio | sala | jogando | fim
  var _tqModo = null;         // 'solo' | 'multiplayer'
  var _tqSouAnfitriao = false;
  var _tqEventosLigados = false;
  var _tqSalasDesligar = null;
  var _tqSaindoVoluntariamente = false;
  var _tqApelidoAdversario = '';

  // Tanques: {x,y,ang} em espaço 0..MUNDO_LARGURA/MUNDO_ALTURA. O
  // anfitrião é sempre azul, o convidado (ou a CPU) é sempre vermelho —
  // independe de quem "ganhou" a sala, é só uma cor fixa de cada papel.
  var _tqTanqueAnfitriao = { x: TQ_SPAWN_ANFITRIAO.x, y: TQ_SPAWN_ANFITRIAO.y, ang: TQ_SPAWN_ANFITRIAO.ang, hp: 1 };
  var _tqTanqueConvidado = { x: TQ_SPAWN_CONVIDADO.x, y: TQ_SPAWN_CONVIDADO.y, ang: TQ_SPAWN_CONVIDADO.ang, hp: 1 };
  // Último spawn do convidado sorteado pelo anfitrião (ver
  // _tqSortearSpawns) — guardado pra mandar pela rede em 'oi'/'rr'/'e'
  // (campo "gsp"), já que só o anfitrião sorteia.
  var _tqUltimoSpawnConvidado = { x: TQ_SPAWN_CONVIDADO.x, y: TQ_SPAWN_CONVIDADO.y, ang: TQ_SPAWN_CONVIDADO.ang };
  // Câmera: segue o PRÓPRIO tanque, travada nas bordas do mundo (ver
  // _tqAtualizarCamera, chamada a cada quadro em _tqDesenhar).
  var _tqCamera = { x: 0, y: 0 };

  var _tqProjeteis = [];      // { x,y,vx,vy,dono } — dono: 'anfitriao' | 'convidado'
  var _tqParedes = [];        // { x,y,w,h,hp,destruida,tipo } — geometria de _TQ_MAPAS[_tqMapaAtualIdx] + estado
  var _tqBarris = [];         // { x,y,destruido } — geometria de _TQ_MAPAS[_tqMapaAtualIdx].barris + estado
  var _tqPlacarAnfitriao = 0, _tqPlacarConvidado = 0; // rodadas vencidas na partida
  var _tqRodadaEstado = 'jogando'; // 'jogando' | 'pausa'
  var _tqPausaTimer = 0, _tqPausaVencedor = null, _tqPausaMotivo = null; // motivo: 'acerto' | 'zona' | 'batata' (ver _tqFimDeRodada/_tqDesenharAvisoRodada)
  var _tqCooldownAnfitriao = 0, _tqCooldownConvidado = 0;

  /* ── Moitas (furtividade): só o ANFITRIÃO calcula (tem as duas
     posições) — _tqRevelar* conta quanto tempo falta pro tanque parar
     de ficar "revelado" depois de atirar (mesmo dentro da moita, atirar
     denuncia a posição por TQ_MOITA_REVELA_SEG). _tqEscondido* é o
     resultado (dentro da moita E não revelado) — usado pro desenho
     (não renderiza o tanque escondido do adversário) e pela IA (não
     mira o que não vê). _tqEscondidoAnfitriao viaja pro convidado via
     'e' (campo "ea"); _tqEscondidoConvidado só importa pro anfitrião
     (ele já calcula e desenha os dois lados). */
  var TQ_MOITA_REVELA_SEG = 1.2;
  var _tqRevelarAnfitriao = 0, _tqRevelarConvidado = 0;
  var _tqEscondidoAnfitriao = false, _tqEscondidoConvidado = false;

  // Entrada local (joystick) — vetor normalizado -1..1, magnitude
  // até 1. Atualizado pelo widget DOM (ver _tqLigarJoystick).
  var _tqInputVec = { x: 0, y: 0 };
  var _tqMeuCooldown = 0;

  /* ── Game feel: screen shake, recuo do canhão e rastro de esteira ─
     Puramente visuais/locais — cada cliente calcula por conta própria
     a partir do que já está sincronizado (posição, parede destruída,
     fim de rodada), sem precisar de mensagem nova na rede. */
  var _tqShakeTimer = 0, _tqShakeDuracaoBase = 0, _tqShakeForcaBase = 0;
  var TQ_SHAKE_PAREDE_DUR = 0.22, TQ_SHAKE_PAREDE_FORCA = 6;   // parede destruída
  var TQ_SHAKE_ACERTO_DUR = 0.38, TQ_SHAKE_ACERTO_FORCA = 11;  // fim de rodada (tanque atingido)
  var TQ_SHAKE_BARRIL_DUR = 0.30, TQ_SHAKE_BARRIL_FORCA = 9;   // barril explodindo

  var _tqRecuoAnfitriao = 0, _tqRecuoConvidado = 0; // 0..1, decai a cada quadro
  var TQ_RECUO_DECAI = 7.5; // por segundo

  var _tqRastro = [];              // { x, y, ang, vida } em unidades de mundo
  var _tqUltimaPosAnfitriao = null, _tqUltimaPosConvidado = null;
  var TQ_RASTRO_DIST_MIN = 0.018;  // distância mínima entre marcas
  var TQ_RASTRO_VIDA     = 2.2;    // segundos até sumir
  var TQ_RASTRO_MAX      = 220;    // teto de marcas simultâneas (performance)

  var _tqExplosoes = [];        // { x, y, t } — efeito visual local (não sincronizado) da explosão de barril
  var TQ_EXPLOSAO_DUR = 0.45;   // segundos até o anel sumir

  /* ── IA (modo sozinho) ───────────────────────────────────────── */
  var _tqIATimer = 0, _tqIAModo = 'patrulha', _tqIAAlvoPatrulha = { x: MUNDO_LARGURA / 2, y: MUNDO_ALTURA / 2 };

  /* ── Cenário/assets: mesmo padrão do cenario-floresta.webp da
     Corrida e da cenario-arena.webp do Ping Pong — carrega cedo,
     cai num visual vetorial de fallback se faltar/falhar. Base:
     /Jogos/assets/tanques/ (T maiúsculo no "Jogos"; GitHub Pages é
     case-sensitive). */
  var _TQ_ASSET_BASE = '/Jogos/assets/tanques/';
  var _tqAssets = {};
  function _tqAsset(nome) {
    if (_tqAssets[nome]) return _tqAssets[nome];
    var reg = { img: null, ok: false, w: 0, h: 0 };
    _tqAssets[nome] = reg;
    try {
      var im = new Image();
      im.onload = function () {
        reg.ok = true; reg.img = im;
        reg.w = im.naturalWidth || 0; reg.h = im.naturalHeight || 0;
      };
      im.src = _TQ_ASSET_BASE + nome;
      reg.img = im;
    } catch (e) {}
    return reg;
  }

  /* ── Ponte com o app ────────────────────────────────────────── */
  function _tqBridge() { return window.AngatubaGames || null; }

  /* ── Ciclo de vida ─────────────────────────────────────────────*/
  function _tqPreparar() {
    _tqCanvas = document.getElementById('tq-canvas');
    if (!_tqCanvas) return;
    _tqCtx = _tqCanvas.getContext('2d');
    _tqLigarJoystick();
    _tqLigarBotaoFogo();
    _tqLigarEventosRede();
    if (!_tqResizeOn) {
      var reaval = function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) _tqAplicarOrientacao();
      };
      window.addEventListener('resize', reaval);
      window.addEventListener('orientationchange', reaval);
      // O giro do lock nativo dispara 'change' no screen.orientation
      // QUANDO a tela termina de girar de verdade (o .then do lock
      // resolve antes) — remede em passos, o layout assenta aos poucos.
      try {
        if (screen && screen.orientation && screen.orientation.addEventListener) {
          screen.orientation.addEventListener('change', function () {
            reaval();
            setTimeout(reaval, 60);
            setTimeout(reaval, 200);
            setTimeout(reaval, 450);
          });
        }
      } catch (e) {}
      _tqResizeOn = true;
    }
    _tqDimensionar();
    _tqAsset('chao-arena.webp');
    _tqAsset('tank-azul.webp');
    _tqAsset('tank-vermelho.webp');
    _tqAsset('parede-tijolo.webp');
    _tqAsset('parede-escombros.webp');
    _tqAsset('parede-metal.webp');
    _tqAsset('barril.webp');
    _tqAsset('mato.webp');
    // Pede ao sistema pra girar pra landscape (instalado/fullscreen);
    // em navegador comum é recusado e cai na rotação por CSS.
    _tqTravarLandscape();
    _tqMostrarTela('inicio');
    _tqLimparErroMenu();
    _tqResetParedes();
    _tqResetBarris();
    _tqAplicarOrientacaoRepetido();
    _tqDesenhar();
  }
  var _tqResizeOn = false;

  function _tqComecar() { _tqPreparar(); }

  function _tqParar() {
    if (_tqRAF) { cancelAnimationFrame(_tqRAF); _tqRAF = 0; }
    if (window.AngatubaMP) { _tqSaindoVoluntariamente = true; window.AngatubaMP.sair(); }
    _tqPararListaSalas();
    _tqDestravarOrientacao();
    _tqEstado = 'inicio';
    _tqModo = null;
    _tqSouAnfitriao = false;
  }

  window.TanquesGame = { preparar: _tqPreparar, comecar: _tqComecar, parar: _tqParar };

  /* ── Telas (overlays) ───────────────────────────────────────────
     3 overlays fixos no HTML: tq-menu (sozinho/criar/entrar), tq-sala
     (aguardando ou conectando) e tq-fim (resultado/erro). Durante
     'jogando' nenhum aparece — só o HUD + canvas + controles. */
  function _tqMostrarTela(qual) {
    _tqEstado = qual;
    var menu = document.getElementById('tq-menu');
    var sala = document.getElementById('tq-sala');
    var fim  = document.getElementById('tq-fim');
    if (menu) menu.style.display = (qual === 'inicio') ? '' : 'none';
    if (sala) sala.style.display = (qual === 'sala') ? '' : 'none';
    if (fim)  fim.style.display  = (qual === 'fim')  ? '' : 'none';
    var hud = document.getElementById('tq-hud');
    if (hud) hud.style.display = (qual === 'jogando') ? '' : 'none';
    var controles = document.getElementById('tq-controles');
    if (controles) controles.style.display = (qual === 'jogando') ? '' : 'none';
    if (qual !== 'jogando') _tqResetJoystickVisual();
    if (qual === 'inicio') {
      var btnC = document.getElementById('tq-btn-criar');
      var btnE = document.getElementById('tq-btn-entrar');
      if (btnC) btnC.disabled = false;
      if (btnE) btnE.disabled = false;
      _tqIniciarListaSalas();
    } else {
      _tqPararListaSalas();
    }
  }

  function _tqErroMenu(msg) {
    var el = document.getElementById('tq-menu-erro');
    if (el) { el.textContent = msg || ''; el.style.display = msg ? '' : 'none'; }
  }
  function _tqLimparErroMenu() { _tqErroMenu(''); }

  /* ── Lista de salas públicas abertas agora — mesmo padrão do
     Ping Pong (ver _ppIniciarListaSalas). */
  function _tqIniciarListaSalas() {
    if (_tqSalasDesligar || !window.AngatubaMP || typeof window.AngatubaMP.listarSalas !== 'function') return;
    _tqSalasDesligar = window.AngatubaMP.listarSalas(_tqRenderizarSalas);
  }
  function _tqPararListaSalas() {
    if (_tqSalasDesligar) { try { _tqSalasDesligar(); } catch (e) {} _tqSalasDesligar = null; }
  }
  function _tqEscaparHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _tqRenderizarSalas(lista) {
    var wrap = document.getElementById('tq-lista-salas');
    if (!wrap) return;
    if (!lista || !lista.length) {
      wrap.innerHTML = '<div class="tq-lista-vazia">Nenhuma sala pública aberta agora.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < lista.length; i++) {
      var s = lista[i];
      html += '<div class="tq-sala-item">' +
                '<span class="tq-sala-item-nome">' + _tqEscaparHtml(s.nome) + '</span>' +
                '<button type="button" class="tq-sala-item-btn" onclick="_tqEntrarSala(\'' + _tqEscaparHtml(s.codigo) + '\')">Entrar</button>' +
              '</div>';
    }
    wrap.innerHTML = html;
  }

  /* ── Ações do menu inicial ───────────────────────────────────── */
  function _tqJogarSozinho() {
    _tqModo = 'solo';
    _tqSouAnfitriao = true;
    _tqApelidoAdversario = 'Computador';
    _tqClasseAnfitriao = _tqMinhaClasse;
    _tqClasseConvidado = 'padrao'; // a CPU sempre joga com o tanque padrão
    _tqModoJogo = _tqMeuModoEscolhido;
    _tqReiniciarPartida();
    _tqComecarPartida();
  }

  function _tqCriarSala() {
    if (!window.AngatubaMP || !window.AngatubaMP.disponivel()) {
      _tqErroMenu('Multiplayer indisponível neste navegador.');
      return;
    }
    _tqLimparErroMenu();
    var btn = document.getElementById('tq-btn-criar');
    if (btn) btn.disabled = true;
    var chkPrivada = document.getElementById('tq-privada-check');
    var publica = !(chkPrivada && chkPrivada.checked);
    window.AngatubaMP.criarSala(publica).then(function (codigo) {
      _tqModo = 'multiplayer';
      _tqSouAnfitriao = true;
      _tqMostrarSala('aguardando', codigo);
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      _tqErroMenu((err && err.message) || 'Não consegui criar a sala.');
    });
  }

  function _tqEntrarSala(codigoForcado) {
    if (!window.AngatubaMP || !window.AngatubaMP.disponivel()) {
      _tqErroMenu('Multiplayer indisponível neste navegador.');
      return;
    }
    var input = document.getElementById('tq-codigo-input');
    var codigo = codigoForcado || (input ? input.value : '');
    _tqLimparErroMenu();
    var btn = document.getElementById('tq-btn-entrar');
    if (btn) btn.disabled = true;
    window.AngatubaMP.entrarSala(codigo).then(function () {
      _tqModo = 'multiplayer';
      _tqSouAnfitriao = false;
      _tqMostrarSala('conectando', codigo);
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      _tqErroMenu((err && err.message) || 'Não consegui entrar na sala.');
    });
  }

  function _tqMostrarSala(modo, codigo) {
    _tqMostrarTela('sala');
    var titulo = document.getElementById('tq-sala-titulo');
    var desc   = document.getElementById('tq-sala-desc');
    var codEl  = document.getElementById('tq-sala-codigo');
    if (modo === 'aguardando') {
      if (titulo) titulo.textContent = 'Chame um amigo!';
      if (desc) desc.textContent = 'Manda esse código pro seu amigo digitar em "Entrar com código":';
      if (codEl) { codEl.textContent = codigo; codEl.style.display = ''; }
    } else {
      if (titulo) titulo.textContent = 'Conectando…';
      if (desc) desc.textContent = 'Aguardando o anfitrião confirmar a conexão.';
      if (codEl) codEl.style.display = 'none';
    }
  }

  function _tqCopiarCodigo() {
    var codEl = document.getElementById('tq-sala-codigo');
    var codigo = codEl ? codEl.textContent : '';
    if (!codigo || !navigator.clipboard) return;
    navigator.clipboard.writeText(codigo).then(function () {
      var btn = document.getElementById('tq-btn-copiar');
      if (!btn) return;
      var original = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(function () { btn.textContent = original; }, 1500);
    }).catch(function () {});
  }

  function _tqVoltarMenu() {
    if (_tqRAF) { cancelAnimationFrame(_tqRAF); _tqRAF = 0; }
    if (window.AngatubaMP) { _tqSaindoVoluntariamente = true; window.AngatubaMP.sair(); }
    _tqModo = null;
    _tqSouAnfitriao = false;
    var btnC = document.getElementById('tq-btn-criar');
    var btnE = document.getElementById('tq-btn-entrar');
    if (btnC) btnC.disabled = false;
    if (btnE) btnE.disabled = false;
    _tqMostrarTela('inicio');
  }

  window._tqJogarSozinho = _tqJogarSozinho;
  window._tqCriarSala = _tqCriarSala;
  window._tqEntrarSala = _tqEntrarSala;
  window._tqCopiarCodigo = _tqCopiarCodigo;
  window._tqVoltarMenu = _tqVoltarMenu;
  // Pills de classe no menu inicial — só troca a escolha local
  // (_tqMinhaClasse); a aplicação de fato acontece ao começar (solo)
  // ou ao conectar (multiplayer, ver _tqLigarEventosRede).
  var TQ_CLASSE_DESC = {
    padrao: 'Velocidade e tiro padrão.',
    leve: 'Mais rápido, mas ainda morre num tiro só.',
    pesado: 'Mais lento e atira mais devagar, mas aguenta 3 tiros pra morrer.'
  };
  window._tqEscolherClasse = function (classe) {
    if (!TQ_CLASSES[classe]) return;
    _tqMinhaClasse = classe;
    var btns = document.querySelectorAll('.tq-classe-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('tq-classe-ativa', btns[i].getAttribute('data-classe') === classe);
    }
    var desc = document.getElementById('tq-classes-desc');
    if (desc) desc.textContent = TQ_CLASSE_DESC[classe] || '';
  };
  // Pill de modo de jogo — mesmo padrão da classe, mas classes CSS
  // próprias (tq-modo-btn/tq-modo-ativo) pra não interferir na busca
  // por ".tq-classe-btn" de cima.
  var TQ_MODO_DESC = {
    classico: 'Destrua o tanque adversário. Melhor de 3 rodadas.',
    rei: 'Fique sozinho dentro do pedaço por ' + TQ_ZONA_TEMPO_VITORIA + 's pra vencer a rodada (ou destrua o adversário).',
    batata: 'Um dos dois começa com a batata; encoste no adversário pra passar. Quem estiver com ela quando o tempo acabar perde a rodada.'
  };
  window._tqEscolherModo = function (modo) {
    if (!TQ_MODOS[modo]) return;
    _tqMeuModoEscolhido = modo;
    var btns = document.querySelectorAll('.tq-modo-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('tq-modo-ativo', btns[i].getAttribute('data-modo') === modo);
    }
    var desc = document.getElementById('tq-modos-desc');
    if (desc) desc.textContent = TQ_MODO_DESC[modo] || '';
  };
  window._tqPedirRevanche = function () {
    if (_tqModo === 'solo') { _tqReiniciarPartida(); _tqComecarPartida(); }
    else if (_tqSouAnfitriao) { _tqReiniciarPartida(); _tqEnviarReinicio(); _tqComecarPartida(); }
    else if (window.AngatubaMP) window.AngatubaMP.enviar({ t: 'pr' });
    var btn = document.getElementById('tq-btn-revanche');
    if (btn) btn.disabled = true;
  };

  /* ── Rede: eventos do AngatubaMP (ligados uma única vez) ──────── */
  function _tqLigarEventosRede() {
    if (_tqEventosLigados || !window.AngatubaMP) return;
    _tqEventosLigados = true;

    window.AngatubaMP.on('conectado', function () {
      var bridge = _tqBridge();
      var meuNome = (bridge && bridge.apelido && bridge.apelido()) || 'Jogador';
      var msg = { t: 'oi', nome: meuNome, classe: _tqMinhaClasse };
      if (_tqSouAnfitriao) {
        _tqClasseAnfitriao = _tqMinhaClasse;
        _tqModoJogo = _tqMeuModoEscolhido;
        // Anfitrião sorteia o mapa E os spawns da partida (e agora
        // também fixa o modo de jogo e, se for Batata Quente, quem
        // começa com ela) e avisa o convidado dentro do próprio "oi"
        // — sem isso os dois lados desenhariam paredes em lugares
        // diferentes, ou o convidado nasceria fora do ponto sorteado
        // (só o dano é sincronizado depois).
        _tqReiniciarPartida();
        msg.mapa = _tqMapaAtualIdx;
        msg.gsp = _tqUltimoSpawnConvidado;
        msg.modo = _tqModoJogo;
        msg.bt = _tqBatataCom;
      } else {
        _tqClasseConvidado = _tqMinhaClasse;
      }
      window.AngatubaMP.enviar(msg);
      _tqComecarPartida();
    });

    window.AngatubaMP.on('mensagem', _tqReceberMensagem);

    window.AngatubaMP.on('desconectado', function () {
      if (_tqSaindoVoluntariamente) { _tqSaindoVoluntariamente = false; return; }
      if (_tqEstado === 'jogando' || _tqEstado === 'sala') _tqMostrarFim('desconexao');
    });

    window.AngatubaMP.on('erro', function (err) {
      if (_tqEstado === 'sala') _tqErroMenu((err && err.message) || 'Falha na conexão.');
    });
  }

  function _tqReceberMensagem(dado) {
    if (!dado || !dado.t) return;
    switch (dado.t) {
      case 'oi':
        _tqApelidoAdversario = String(dado.nome || 'Adversário').slice(0, 20);
        // Modo de jogo: quem decide é o ANFITRIÃO (ajuste de PARTIDA,
        // não por jogador — ver TQ_MODOS/_tqModoJogo). Aplica ANTES do
        // mapa, porque achar o centro do "pedaço" (Rei do Pedaço) já
        // depende de saber o modo.
        if (!_tqSouAnfitriao && typeof dado.modo === 'string' && TQ_MODOS[dado.modo]) {
          _tqModoJogo = dado.modo;
        }
        // Só o convidado aplica: o mapa que o anfitrião sorteou (ver
        // 'conectado' acima) — sem isso o convidado ficaria com o mapa
        // 0 (o default do _tqPreparar), diferente do lado do anfitrião.
        if (!_tqSouAnfitriao && typeof dado.mapa === 'number' && _TQ_MAPAS[dado.mapa]) {
          _tqMapaAtualIdx = dado.mapa;
          _tqResetParedes();
          _tqResetBarris();
          if (_tqModoJogo === 'rei') _tqZonaCentro = _tqAcharCentroZona();
        }
        // Idem pro spawn: o anfitrião já sorteou (_tqReiniciarPartida
        // rodou antes de mandar o 'oi', ver 'conectado') — o convidado
        // aplica o próprio ponto direto, nunca sorteia por conta própria.
        if (!_tqSouAnfitriao && dado.gsp && typeof dado.gsp.x === 'number') {
          _tqTanqueConvidado.x = dado.gsp.x; _tqTanqueConvidado.y = dado.gsp.y; _tqTanqueConvidado.ang = dado.gsp.ang;
        }
        // Batata Quente: quem começa com ela — só o anfitrião sorteia
        // (ver _tqIniciarRodada), o convidado aplica o valor recebido.
        if (!_tqSouAnfitriao && typeof dado.bt === 'string') _tqBatataCom = dado.bt;
        // Classe do OUTRO lado (a minha eu já apliquei localmente no
        // 'conectado', sem depender da rede). No anfitrião, o 'oi' do
        // convidado pode chegar DEPOIS do _tqReiniciarPartida (que já
        // rodou com a classe antiga/padrão) — corrige o HP aqui.
        if (typeof dado.classe === 'string' && TQ_CLASSES[dado.classe]) {
          if (_tqSouAnfitriao) {
            _tqClasseConvidado = dado.classe;
            _tqTanqueConvidado.hp = TQ_CLASSES[_tqClasseConvidado].hpMax;
          } else {
            _tqClasseAnfitriao = dado.classe;
          }
        }
        _tqAtualizarHUD();
        break;
      case 'p': // convidado -> anfitrião: posição/ângulo do tanque do convidado
        if (_tqSouAnfitriao) {
          if (typeof dado.x === 'number') _tqTanqueConvidado.x = _tqClamp(dado.x, 0, MUNDO_LARGURA);
          if (typeof dado.y === 'number') _tqTanqueConvidado.y = _tqClamp(dado.y, 0, MUNDO_ALTURA);
          if (typeof dado.ang === 'number') _tqTanqueConvidado.ang = dado.ang;
        }
        break;
      case 'tiro': // convidado avisa que atirou — só o anfitrião spawna o projétil (é quem tem autoridade)
        if (_tqSouAnfitriao && _tqRodadaEstado === 'jogando' && _tqCooldownConvidado <= 0) {
          _tqCooldownConvidado = _tqCooldownEfetivo('convidado');
          _tqCriarProjetil(dado.x, dado.y, dado.ang, 'convidado');
        }
        break;
      case 'e': // anfitrião -> convidado: estado do mundo inteiro
        if (!_tqSouAnfitriao) {
          _tqTanqueAnfitriao.x = dado.hx; _tqTanqueAnfitriao.y = dado.hy; _tqTanqueAnfitriao.ang = dado.hang;
          if (typeof dado.hhp === 'number') _tqTanqueAnfitriao.hp = dado.hhp;
          if (typeof dado.ghp === 'number') _tqTanqueConvidado.hp = dado.ghp;
          _tqProjeteis = dado.pj || [];
          _tqCaixas = dado.cx || [];
          _tqEscondidoAnfitriao = !!dado.ea; // o anfitrião já calculou (tem as duas posições) — só aplica
          _tqEscudoAnfitriao = !!dado.esa; _tqEscudoConvidado = !!dado.esg;
          // Rei do Pedaço / Batata Quente: estado sempre sobrescrito
          // (igual pd/bd) — puramente informativo pro convidado (só o
          // anfitrião decide o resultado, ver _tqAtualizarZona/Batata).
          if (typeof dado.za === 'number') _tqZonaTempoAnfitriao = dado.za;
          if (typeof dado.zg === 'number') _tqZonaTempoConvidado = dado.zg;
          if (typeof dado.bt === 'string') _tqBatataCom = dado.bt;
          if (typeof dado.btt === 'number') _tqBatataTimer = dado.btt;
          // Vencedor/motivo da rodada — o convidado nunca chama
          // _tqFimDeRodada (só o anfitrião), então sem isso o aviso de
          // "você venceu a rodada!" nunca sabia quem realmente ganhou
          // do lado do convidado.
          if (typeof dado.pv === 'string') _tqPausaVencedor = dado.pv;
          if (typeof dado.pm === 'string') _tqPausaMotivo = dado.pm;
          // rg (tiro rápido do convidado): o ANFITRIÃO detecta a coleta
          // (tem as duas posições) — o convidado precisa saber pra usar
          // o cooldown reduzido no PRÓPRIO gatilho local (_tqTentarAtirar),
          // sem esperar a rede a cada tiro.
          if (typeof dado.rg === 'number') _tqRapidoConvidado = dado.rg;
          if (dado.pd) {
            // Detecta a TRANSIÇÃO intacta→destruída pra tremer a tela
            // também do lado do convidado (o anfitrião já treme sozinho
            // em _tqAtualizarProjeteis, que só roda nele).
            for (var i = 0; i < _tqParedes.length && i < dado.pd.length; i++) {
              var novaDestruida = !!dado.pd[i];
              if (novaDestruida && !_tqParedes[i].destruida) _tqAcionarShake(TQ_SHAKE_PAREDE_DUR, TQ_SHAKE_PAREDE_FORCA);
              _tqParedes[i].destruida = novaDestruida;
            }
          }
          if (dado.bd) {
            // Mesmo padrão do "pd" acima: detecta a transição
            // intacto→destruído pra disparar o efeito visual da
            // explosão também do lado do convidado (o anfitrião já
            // dispara sozinho em _tqExplodirBarril, que só roda nele).
            for (var bi = 0; bi < _tqBarris.length && bi < dado.bd.length; bi++) {
              var novoDestruido = !!dado.bd[bi];
              if (novoDestruido && !_tqBarris[bi].destruido) _tqDispararExplosaoVisual(_tqBarris[bi].x, _tqBarris[bi].y);
              _tqBarris[bi].destruido = novoDestruido;
            }
          }
          _tqPlacarAnfitriao = dado.sa || 0; _tqPlacarConvidado = dado.sg || 0;
          // Mesma lógica pro tremor de "acertou o tanque": entrou em
          // pausa agora (não estava antes) = a rodada acabou de terminar.
          if (dado.re === 'pausa' && _tqRodadaEstado !== 'pausa') _tqAcionarShake(TQ_SHAKE_ACERTO_DUR, TQ_SHAKE_ACERTO_FORCA);
          // Borda pausa→jogando = uma rodada NOVA acabou de começar no
          // anfitrião (_tqIniciarRodada rodou e sorteou spawn novo, ver
          // TQ_SPAWN_DIST_MIN) — só nesse instante aplica o ponto de
          // nascimento recebido no PRÓPRIO tanque; fora dessa borda o
          // campo "gsp" é ignorado (senão brigaria com a previsão local
          // do movimento do convidado durante a rodada).
          if (dado.re === 'jogando' && _tqRodadaEstado === 'pausa' && dado.gsp && typeof dado.gsp.x === 'number') {
            _tqTanqueConvidado.x = dado.gsp.x; _tqTanqueConvidado.y = dado.gsp.y; _tqTanqueConvidado.ang = dado.gsp.ang;
          }
          _tqRodadaEstado = dado.re || 'jogando';
          _tqAtualizarHUD();
          if (dado.fim) _tqMostrarFim('fim');
        }
        break;
      case 'rr':
        // dado.mapa: o anfitrião já sorteou o mapa da revanche (ver
        // _tqEnviarReinicio) — o convidado usa o MESMO índice, nunca
        // sorteia por conta própria (senão os lados desincronizam).
        // Idem pro spawn (dado.gsp) — _tqReiniciarPartida não sorteia
        // nada do lado do convidado (ver _tqIniciarRodada), então
        // aplica o ponto recebido direto, por cima.
        if (!_tqSouAnfitriao) {
          _tqReiniciarPartida(dado.mapa);
          if (dado.gsp && typeof dado.gsp.x === 'number') {
            _tqTanqueConvidado.x = dado.gsp.x; _tqTanqueConvidado.y = dado.gsp.y; _tqTanqueConvidado.ang = dado.gsp.ang;
          }
          // Batata Quente: modo em si não muda na revanche (persiste
          // do 'oi' original), só quem começa com ela de novo.
          if (typeof dado.bt === 'string') _tqBatataCom = dado.bt;
          _tqComecarPartida();
        }
        break;
      case 'pr':
        if (_tqSouAnfitriao) { _tqReiniciarPartida(); _tqEnviarReinicio(); _tqComecarPartida(); }
        break;
    }
  }

  function _tqEnviarReinicio() {
    if (_tqModo === 'multiplayer' && window.AngatubaMP) window.AngatubaMP.enviar({ t: 'rr', mapa: _tqMapaAtualIdx, gsp: _tqUltimoSpawnConvidado, bt: _tqBatataCom });
  }

  /* ── Controles: joystick FLUTUANTE (DOM) + botão de fogo ──────────
     Um joystick só: a direção que ele aponta já gira o tanque pra lá
     E avança na direção que o tanque JÁ está apontando (ver cabeçalho
     do arquivo) — não precisa de controle separado pra girar.
     Flutuante: o círculo (tq-joystick) começa invisível; tq-joy-zona
     é a metade esquerda invisível da arena que captura o toque, e o
     círculo nasce exatamente onde o dedo encostou — evita o jogador
     ter que acertar um alvo fixo e olhar pro dedo em vez do jogo. */
  var _tqJoyId = null, _tqJoyRaio = 48;
  var _tqJoyOrigem = { x: 0, y: 0 }; // ponto (client coords) onde o dedo tocou — centro fixo até soltar

  // Girado por CSS (retrato sem lock nativo — ver _tqAplicarOrientacao),
  // tela e local deixam de ser os mesmos eixos: converte um delta em
  // coordenadas de TELA pro espaço LOCAL do canvas/controles antes de
  // calcular a direção do joystick. Sem rotação, é a identidade.
  function _tqRotacionado() {
    try {
      var rot = document.getElementById('tq-rot');
      if (rot && rot.getAttribute('data-rot') === '1') return true;
    } catch (e) {}
    return false;
  }
  function _tqDeltaLocal(dxTela, dyTela) {
    return _tqRotacionado() ? { x: dyTela, y: -dxTela } : { x: dxTela, y: dyTela };
  }
  // Chamado ao sair da tela 'jogando' (fim de rodada, desconexão, voltar
  // ao menu) — evita o círculo ficar "preso" visível/deslocado da
  // última posição na próxima vez que os controles aparecerem.
  function _tqResetJoystickVisual() {
    _tqJoyId = null;
    _tqInputVec.x = 0; _tqInputVec.y = 0;
    var base = document.getElementById('tq-joystick');
    var thumb = document.getElementById('tq-joystick-thumb');
    if (base) base.classList.remove('tq-joystick-ativo');
    if (thumb) thumb.style.transform = 'translate(0,0)';
    // Mesmo caso do joystick: se a rodada/tela mudar com o dedo ainda
    // em cima da zona de fogo, o pointerup nunca chega — sem isso o
    // círculo ficaria "preso" no estado pressionado.
    _tqFireId = null;
    var fireBtn = document.getElementById('tq-fire-btn');
    if (fireBtn) fireBtn.classList.remove('tq-fire-btn-ativo');
  }
  function _tqLigarJoystick() {
    var zona = document.getElementById('tq-joy-zona');
    var base = document.getElementById('tq-joystick');
    var thumb = document.getElementById('tq-joystick-thumb');
    if (!zona || !base || !thumb || zona._tqLigado) return;
    zona._tqLigado = true;

    function aplicar(clientX, clientY) {
      var d = _tqDeltaLocal(clientX - _tqJoyOrigem.x, clientY - _tqJoyOrigem.y);
      var raio = _tqJoyRaio;
      var dist = Math.hypot(d.x, d.y);
      var mag = Math.min(1, dist / raio);
      var ang = Math.atan2(d.y, d.x);
      var nx = Math.cos(ang) * mag, ny = Math.sin(ang) * mag;
      _tqInputVec.x = nx; _tqInputVec.y = ny;
      thumb.style.transform = 'translate(' + (nx * raio * 0.55) + 'px,' + (ny * raio * 0.55) + 'px)';
    }
    function soltar() {
      _tqJoyId = null;
      _tqInputVec.x = 0; _tqInputVec.y = 0;
      thumb.style.transform = 'translate(0,0)';
      base.classList.remove('tq-joystick-ativo');
    }
    zona.addEventListener('pointerdown', function (e) {
      _tqJoyId = e.pointerId;
      try { zona.setPointerCapture(e.pointerId); } catch (err) {}
      _tqJoyOrigem.x = e.clientX; _tqJoyOrigem.y = e.clientY;
      var controles = zona.parentElement;
      var margem = _tqJoyRaio + 4;
      var localX, localY;
      if (_tqRotacionado() && controles && _tqRotLocalW && _tqRotLocalH) {
        // Girado: getBoundingClientRect() já reflete o retângulo visível
        // NA TELA (o CSS gira .tq-controles inteiro). Pra achar onde o
        // círculo nasce no espaço LOCAL (pré-rotação, eixos trocados —
        // ver _tqAplicarOrientacao), medimos o toque relativo ao CENTRO
        // e desfazemos a rotação com o mesmo _tqDeltaLocal do joystick.
        var cr = controles.getBoundingClientRect();
        var centroX = cr.left + cr.width / 2, centroY = cr.top + cr.height / 2;
        var d = _tqDeltaLocal(e.clientX - centroX, e.clientY - centroY);
        localX = d.x + _tqRotLocalW / 2;
        localY = d.y + _tqRotLocalH / 2;
        localX = Math.max(margem, Math.min(_tqRotLocalW - margem, localX));
        localY = Math.max(margem, Math.min(_tqRotLocalH - margem, localY));
      } else {
        // Sem rotação: posiciona o círculo no ponto tocado, em
        // coordenadas locais à zona (que cobre left:0/top:0 da
        // .tq-controles, mesma origem do .tq-joystick). Clampa pra não
        // desenhar cortado perto das bordas (usa a largura/altura da
        // própria .tq-controles, maior que a zona).
        var r = zona.getBoundingClientRect();
        localX = e.clientX - r.left; localY = e.clientY - r.top;
        if (controles) {
          var cr2 = controles.getBoundingClientRect();
          localX = Math.max(margem, Math.min(cr2.width - margem, localX));
          localY = Math.max(margem, Math.min(cr2.height - margem, localY));
        }
      }
      base.style.left = localX + 'px';
      base.style.top = localY + 'px';
      base.classList.add('tq-joystick-ativo');
      aplicar(e.clientX, e.clientY);
      if (e.cancelable) e.preventDefault();
    });
    zona.addEventListener('pointermove', function (e) {
      if (_tqJoyId !== e.pointerId) return;
      aplicar(e.clientX, e.clientY);
      if (e.cancelable) e.preventDefault();
    });
    zona.addEventListener('pointerup', function (e) { if (_tqJoyId === e.pointerId) soltar(); });
    zona.addEventListener('pointercancel', function (e) { if (_tqJoyId === e.pointerId) soltar(); });
  }

  // Zona de fogo: metade direita inteira atira (não só o círculo
  // tq-fire-btn, que agora é só o indicador visual) — mesmo padrão
  // do joystick (zona invisível maior que o círculo que ela controla),
  // pra não exigir precisão de mirar o dedo num alvo pequeno.
  var _tqFireId = null;
  function _tqLigarBotaoFogo() {
    var zona = document.getElementById('tq-fire-zona');
    var btn = document.getElementById('tq-fire-btn');
    if (!zona || !btn || zona._tqLigado) return;
    zona._tqLigado = true;
    zona.addEventListener('pointerdown', function (e) {
      _tqFireId = e.pointerId;
      try { zona.setPointerCapture(e.pointerId); } catch (err) {}
      btn.classList.add('tq-fire-btn-ativo');
      _tqTentarAtirar();
      if (e.cancelable) e.preventDefault();
    });
    function soltar(e) {
      if (_tqFireId !== e.pointerId) return;
      _tqFireId = null;
      btn.classList.remove('tq-fire-btn-ativo');
    }
    zona.addEventListener('pointerup', soltar);
    zona.addEventListener('pointercancel', soltar);
  }

  /* ── Dimensionamento (mesmo padrão dos outros jogos em canvas) ─ */
  function _tqDimensionar() {
    if (!_tqCanvas) return;
    var cssW, cssH;
    // Com lock nativo, o offsetWidth do canvas pode demorar a refletir
    // o giro do SO — medimos preferencialmente pela ARENA (o container
    // real, já no tamanho da tela girada); mesmo truque da Corrida.
    var arena = document.getElementById('tq-arena');
    if (_tqLockNativo && arena) {
      var ar = arena.getBoundingClientRect();
      cssW = Math.round(ar.width) || _tqCanvas.offsetWidth || 320;
      cssH = Math.round(ar.height) || _tqCanvas.offsetHeight || 320;
    } else {
      cssW = _tqCanvas.offsetWidth || 320;
      cssH = _tqCanvas.offsetHeight || 320;
    }
    if (cssW < 2) cssW = 320;
    if (cssH < 2) cssH = 320;
    _tqDpr = Math.min(2, window.devicePixelRatio || 1);
    _tqCanvas.width = Math.round(cssW * _tqDpr);
    _tqCanvas.height = Math.round(cssH * _tqDpr);
    _tqW = cssW; _tqH = cssH;
    if (_tqCtx) _tqCtx.setTransform(_tqDpr, 0, 0, _tqDpr, 0, 0);
  }

  /* ── Orientação nativa — pede ao sistema pra girar pra landscape (só
     funciona instalado/fullscreen; navegador comum recusa). Quando o
     lock nativo PEGA, o próprio SO gira a tela: a arena já nasce
     paisagem e NÃO rotacionamos por CSS (senão giraria 2x). Mesmo
     padrão da Corrida (_corTravarLandscape). ── */
  var _tqLockNativo = false;
  var _tqRotLocalW = 0, _tqRotLocalH = 0; // dimensões LOCAIS (pré-rotação) de #tq-rot/#tq-controles quando girados
  function _tqTravarLandscape() {
    try {
      if (screen && screen.orientation && screen.orientation.lock) {
        var p = screen.orientation.lock('landscape');
        if (p && p.then) {
          p.then(function () {
            _tqLockNativo = true;
            _tqAplicarOrientacao();
          }).catch(function () {
            _tqLockNativo = false;   // navegador comum recusa → usa CSS
          });
        }
      }
    } catch (e) { _tqLockNativo = false; }
  }
  function _tqDestravarOrientacao() {
    try {
      if (screen && screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (e) {}
    _tqLockNativo = false;
  }

  /* ── Rotaciona a arena por CSS quando o device está em retrato e o
     lock nativo não pegou (data-rot=1 em #tq-rot e #tq-controles,
     dimensionados em px pelo JS — eixos trocados). Reavalia em
     resize/orientationchange. Mesmo padrão da Corrida
     (_corAplicarOrientacao). ── */
  function _tqAplicarOrientacao() {
    var rot = document.getElementById('tq-rot');
    var controles = document.getElementById('tq-controles');
    var arena = document.getElementById('tq-arena');
    var dica = document.getElementById('tq-gire');
    if (!rot) return;
    function limpar(el) {
      if (!el) return;
      el.setAttribute('data-rot', '0');
      el.style.width = ''; el.style.height = ''; el.style.top = ''; el.style.left = '';
    }
    if (_tqLockNativo) {
      limpar(rot); limpar(controles);
      if (dica) dica.style.display = 'none';
      _tqRotLocalW = 0; _tqRotLocalH = 0;
      _tqDimensionar();
      if (_tqEstado === 'jogando') _tqDesenhar();
      return;
    }
    // Detecta retrato pelas dimensões REAIS da arena (mais confiável em
    // fullscreen PWA que window.innerWidth/Height). Fallback pro window
    // se a arena ainda não tiver dimensões.
    var retrato;
    var ar = arena ? arena.getBoundingClientRect() : null;
    if (ar && ar.width > 2 && ar.height > 2) {
      retrato = (ar.height >= ar.width);
    } else {
      retrato = (window.innerHeight >= window.innerWidth);
    }
    if (retrato && arena && ar) {
      var pw = Math.max(1, Math.round(ar.width));
      var ph = Math.max(1, Math.round(ar.height));
      [rot, controles].forEach(function (el) {
        if (!el) return;
        el.setAttribute('data-rot', '1');
        el.style.width = ph + 'px'; el.style.height = pw + 'px';
        el.style.top = '50%'; el.style.left = '50%';
      });
      _tqRotLocalW = ph; _tqRotLocalH = pw;
      if (dica) dica.style.display = '';
    } else {
      limpar(rot); limpar(controles);
      _tqRotLocalW = 0; _tqRotLocalH = 0;
      if (dica) dica.style.display = 'none';
    }
    _tqDimensionar();
    if (_tqEstado === 'jogando') _tqDesenhar();
  }

  // O fullscreen do celular muda o tamanho da arena de forma ASSÍNCRONA
  // e em tempo variável — reaplica a orientação várias vezes após abrir
  // pra garantir que a rotação use as dimensões finais (mesmo padrão da
  // Corrida, _corAplicarOrientacaoRepetido).
  function _tqAplicarOrientacaoRepetido() {
    _tqAplicarOrientacao();
    var atrasos = [50, 150, 300, 500, 800];
    for (var i = 0; i < atrasos.length; i++) {
      setTimeout(function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) _tqAplicarOrientacao();
      }, atrasos[i]);
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { _tqAplicarOrientacao(); });
    }
  }

  function _tqClamp(v, min, max) { return v < min ? min : (v > max ? max : v); }

  // Dispara/reinicia o tremor de tela. Uma segunda chamada enquanto um
  // tremor já está em andamento simplesmente substitui pelos novos
  // valores (o de fim de rodada, mais forte, "vence" um de parede que
  // esteja tocando ao mesmo tempo — é o comportamento certo).
  function _tqAcionarShake(duracao, forcaPx) {
    _tqShakeTimer = duracao; _tqShakeDuracaoBase = duracao; _tqShakeForcaBase = forcaPx;
  }

  /* ── Paredes: estado (hp/destruída) — geometria vem do mapa
     sorteado da partida (_TQ_MAPAS[_tqMapaAtualIdx].paredes, fixo até
     o próximo _tqReiniciarPartida). */
  function _tqResetParedes() {
    _tqParedes = _TQ_MAPAS[_tqMapaAtualIdx].paredes.map(function (g) {
      return { x: g.x, y: g.y, w: g.w, h: g.h, hp: TQ_PAREDE_HP, destruida: false, tipo: g.tipo || 'tijolo' };
    });
  }

  // Barris: estado (destruído) — geometria vem do mapa sorteado da
  // partida (_TQ_MAPAS[_tqMapaAtualIdx].barris, fixo até o próximo
  // _tqReiniciarPartida). Reseta a cada RODADA, igual às paredes —
  // nenhum barril continua destruído de uma rodada pra outra.
  function _tqResetBarris() {
    _tqBarris = (_TQ_MAPAS[_tqMapaAtualIdx].barris || []).map(function (g) {
      return { x: g.x, y: g.y, destruido: false };
    });
  }

  // Runtime (respeita "destruido") — usado pra bloquear movimento,
  // linha de visão da IA e posicionamento de caixas. Diferente de
  // _tqPontoLivre (usada só na escolha de spawn), que consulta a
  // geometria ESTÁTICA do mapa direto, sem depender de _tqBarris já
  // estar montado nesse instante.
  function _tqColideBarril(cx, cy, raio) {
    for (var i = 0; i < _tqBarris.length; i++) {
      var b = _tqBarris[i];
      if (b.destruido) continue;
      if (Math.hypot(cx - b.x, cy - b.y) < raio + TQ_BARRIL_RAIO) return true;
    }
    return false;
  }

  // Moitas: não bloqueiam movimento nem tiro — só escondem quem estiver
  // dentro (ver _tqEmMoita/_tqEscondido*, cabeçalho do arquivo). Geometria
  // fixa do mapa, sem estado próprio (ao contrário das paredes).
  function _tqEmMoita(t) {
    var moitas = _TQ_MAPAS[_tqMapaAtualIdx].moitas;
    for (var i = 0; i < moitas.length; i++) {
      var m = moitas[i];
      if (t.x >= m.x && t.x <= m.x + m.w && t.y >= m.y && t.y <= m.y + m.h) return true;
    }
    return false;
  }

  function _tqCircRect(cx, cy, r, rect) {
    var nx = _tqClamp(cx, rect.x, rect.x + rect.w);
    var ny = _tqClamp(cy, rect.y, rect.y + rect.h);
    var dx = cx - nx, dy = cy - ny;
    return (dx * dx + dy * dy) < (r * r);
  }

  function _tqColideParede(cx, cy, raio) {
    for (var i = 0; i < _tqParedes.length; i++) {
      var p = _tqParedes[i];
      if (p.destruida) continue;
      if (_tqCircRect(cx, cy, raio, p)) return true;
    }
    return false;
  }

  /* ── Partida ──────────────────────────────────────────────────
     mapaIdx: índice do mapa a usar (sincronizado via rede — ver
     cabeçalho); omitido = sorteia um novo (anfitrião e modo sozinho). */
  function _tqReiniciarPartida(mapaIdx) {
    _tqPlacarAnfitriao = 0; _tqPlacarConvidado = 0;
    _tqMapaAtualIdx = (typeof mapaIdx === 'number' && _TQ_MAPAS[mapaIdx]) ? mapaIdx : _tqEscolherMapa();
    _tqIniciarRodada();
    _tqAtualizarHUD();
  }

  function _tqIniciarRodada() {
    // Spawns: só quem tem autoridade (anfitrião OU o modo sozinho, que
    // é sempre _tqSouAnfitriao=true) sorteia — ver _tqSortearSpawns. O
    // convidado NÃO sorteia o próprio (senão desincroniza do anfitrião);
    // ele recebe o ponto pela rede e aplica direto (ver 'oi'/'rr'/'e').
    if (_tqSouAnfitriao) {
      var spawns = _tqSortearSpawns();
      _tqTanqueAnfitriao.x = spawns.anfitriao.x; _tqTanqueAnfitriao.y = spawns.anfitriao.y; _tqTanqueAnfitriao.ang = spawns.anfitriao.ang;
      _tqTanqueConvidado.x = spawns.convidado.x; _tqTanqueConvidado.y = spawns.convidado.y; _tqTanqueConvidado.ang = spawns.convidado.ang;
      _tqUltimoSpawnConvidado = spawns.convidado;
      // Batata Quente: só o anfitrião sorteia quem começa com ela
      // (mesma autoridade dos spawns) — o convidado recebe o resultado
      // pela rede (campo "bt", ver 'oi'/'rr'/'e').
      if (_tqModoJogo === 'batata') _tqBatataCom = Math.random() < 0.5 ? 'anfitriao' : 'convidado';
    }
    // Rei do Pedaço: acha o centro do "pedaço" pro mapa atual —
    // determinístico a partir do mapa (mesma geometria dos dois
    // lados), então não precisa viajar pela rede, igual as próprias
    // paredes/moitas/barris.
    if (_tqModoJogo === 'rei') _tqZonaCentro = _tqAcharCentroZona();
    _tqZonaTempoAnfitriao = 0; _tqZonaTempoConvidado = 0;
    _tqBatataTimer = TQ_BATATA_DURACAO;
    _tqBatataImunidade = 0;
    // HP de cada lado vem da classe escolhida (Pesado aguenta mais de 1 tiro).
    _tqTanqueAnfitriao.hp = TQ_CLASSES[_tqClasseAnfitriao] ? TQ_CLASSES[_tqClasseAnfitriao].hpMax : 1;
    _tqTanqueConvidado.hp = TQ_CLASSES[_tqClasseConvidado] ? TQ_CLASSES[_tqClasseConvidado].hpMax : 1;
    _tqProjeteis = [];
    _tqResetParedes();
    _tqResetBarris();
    _tqRodadaEstado = 'jogando';
    _tqPausaVencedor = null;
    _tqPausaMotivo = null;
    _tqCooldownAnfitriao = 0; _tqCooldownConvidado = 0;
    _tqIAModo = 'patrulha'; _tqIATimer = 0;
    // Reset do "game feel" — sem isso um tremor/recuo em andamento ou
    // marcas de esteira da rodada anterior vazariam pro respawn.
    _tqShakeTimer = 0;
    _tqRecuoAnfitriao = 0; _tqRecuoConvidado = 0;
    _tqRastro = [];
    _tqExplosoes = [];
    _tqUltimaPosAnfitriao = null; _tqUltimaPosConvidado = null;
    _tqRevelarAnfitriao = 0; _tqRevelarConvidado = 0;
    _tqEscondidoAnfitriao = false; _tqEscondidoConvidado = false;
    // Power-ups: nada carrega de uma rodada pra outra.
    _tqCaixas = [];
    _tqProximaCaixaEm = TQ_CAIXA_INTERVALO_MIN + Math.random() * (TQ_CAIXA_INTERVALO_MAX - TQ_CAIXA_INTERVALO_MIN);
    _tqEscudoAnfitriao = false; _tqEscudoConvidado = false;
    _tqRapidoAnfitriao = 0; _tqRapidoConvidado = 0;
    _tqDuploAnfitriao = 0; _tqDuploConvidado = 0;
  }

  function _tqComecarPartida() {
    _tqMostrarTela('jogando');
    // Reforça o pedido de landscape aqui (a tela cheia do hub muitas
    // vezes só termina de abrir agora) — mesmo padrão da Corrida.
    _tqTravarLandscape();
    _tqAplicarOrientacaoRepetido();
    _tqUltimoTs = 0;
    if (_tqRAF) cancelAnimationFrame(_tqRAF);
    _tqRAF = requestAnimationFrame(_tqLoop);
  }

  function _tqMeuTanque() { return _tqSouAnfitriao ? _tqTanqueAnfitriao : _tqTanqueConvidado; }

  // Câmera: centraliza no PRÓPRIO tanque (cada lado segue o seu, sem
  // precisar sincronizar nada pela rede — é só desenho local) e trava
  // nas bordas do mundo, garantindo que o viewport (TQ_VIEWPORT_*)
  // nunca mostre área fora do mapa. Chamada a cada quadro em
  // _tqDesenhar, mesmo fora de 'jogando' (inofensivo, spawn inicial
  // já é um ponto válido).
  function _tqAtualizarCamera() {
    var meu = _tqMeuTanque();
    _tqCamera.x = _tqClamp(meu.x - TQ_VIEWPORT_LARGURA / 2, 0, MUNDO_LARGURA - TQ_VIEWPORT_LARGURA);
    _tqCamera.y = _tqClamp(meu.y - TQ_VIEWPORT_ALTURA / 2, 0, MUNDO_ALTURA - TQ_VIEWPORT_ALTURA);
  }

  function _tqLoop(ts) {
    if (_tqEstado !== 'jogando') return;
    var dt = _tqUltimoTs ? Math.min(0.05, (ts - _tqUltimoTs) / 1000) : 0;
    _tqUltimoTs = ts;
    if (dt) {
      _tqMeuCooldown = Math.max(0, _tqMeuCooldown - dt);
      if (_tqRodadaEstado === 'jogando') _tqAtualizarTanque(_tqMeuTanque(), _tqInputVec.x, _tqInputVec.y, dt);
      if (_tqSouAnfitriao) _tqSimularMundo(dt);
      else _tqEnviarMeuTanque();
      _tqAtualizarGameFeel(dt);
    }
    _tqDesenhar();
    _tqRAF = requestAnimationFrame(_tqLoop);
  }

  // Roda todo quadro (dos dois lados): decai tremor/recuo e registra
  // marcas de esteira com base no deslocamento OBSERVADO dos tanques —
  // funciona igual pro tanque local, pra IA e pro tanque remoto (cuja
  // posição só chega via rede), sem precisar de mensagem nova.
  function _tqAtualizarGameFeel(dt) {
    if (_tqShakeTimer > 0) _tqShakeTimer = Math.max(0, _tqShakeTimer - dt);
    if (_tqRecuoAnfitriao > 0) _tqRecuoAnfitriao = Math.max(0, _tqRecuoAnfitriao - dt * TQ_RECUO_DECAI);
    if (_tqRecuoConvidado > 0) _tqRecuoConvidado = Math.max(0, _tqRecuoConvidado - dt * TQ_RECUO_DECAI);

    if (_tqRodadaEstado === 'jogando') {
      _tqUltimaPosAnfitriao = _tqRegistrarRastro(_tqTanqueAnfitriao, _tqUltimaPosAnfitriao);
      _tqUltimaPosConvidado = _tqRegistrarRastro(_tqTanqueConvidado, _tqUltimaPosConvidado);
    }
    for (var i = _tqRastro.length - 1; i >= 0; i--) {
      _tqRastro[i].vida -= dt;
      if (_tqRastro[i].vida <= 0) _tqRastro.splice(i, 1);
    }
    // Explosões de barril: só a duração da animação (TQ_EXPLOSAO_DUR),
    // sem sincronizar nada — cada lado dispara/consome a própria lista.
    for (var j = _tqExplosoes.length - 1; j >= 0; j--) {
      _tqExplosoes[j].t += dt;
      if (_tqExplosoes[j].t >= TQ_EXPLOSAO_DUR) _tqExplosoes.splice(j, 1);
    }
  }

  function _tqRegistrarRastro(t, ultimaPos) {
    if (!ultimaPos) return { x: t.x, y: t.y };
    var dx = t.x - ultimaPos.x, dy = t.y - ultimaPos.y;
    if (Math.hypot(dx, dy) < TQ_RASTRO_DIST_MIN) return ultimaPos;
    _tqRastro.push({ x: t.x, y: t.y, ang: t.ang, vida: TQ_RASTRO_VIDA });
    if (_tqRastro.length > TQ_RASTRO_MAX) _tqRastro.shift();
    return { x: t.x, y: t.y };
  }

  // Gira o tanque em direção ao vetor de entrada (limitado por
  // TQ_GIRO_VEL) e avança na direção que ele JÁ está apontando —
  // não direto pro vetor. Colisão com parede resolvida por eixo
  // (desliza ao raspar numa quina, não trava).
  function _tqAtualizarTanque(t, ix, iy, dt) {
    var mag = Math.min(1, Math.hypot(ix, iy));
    if (mag <= TQ_DEADZONE) return;
    var alvo = Math.atan2(ix, -iy);
    var diff = alvo - t.ang;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    var maxDelta = TQ_GIRO_VEL * dt;
    if (diff > maxDelta) diff = maxDelta; else if (diff < -maxDelta) diff = -maxDelta;
    t.ang += diff;
    var v = TQ_VELOCIDADE * _tqClasseDoTanque(t).velMul * mag * dt;
    var dx = Math.sin(t.ang) * v, dy = -Math.cos(t.ang) * v;
    var novoX = _tqClamp(t.x + dx, TQ_RAIO_TANQUE, MUNDO_LARGURA - TQ_RAIO_TANQUE);
    if (!_tqColideParede(novoX, t.y, TQ_RAIO_TANQUE) && !_tqColideBarril(novoX, t.y, TQ_RAIO_TANQUE)) t.x = novoX;
    var novoY = _tqClamp(t.y + dy, TQ_RAIO_TANQUE, MUNDO_ALTURA - TQ_RAIO_TANQUE);
    if (!_tqColideParede(t.x, novoY, TQ_RAIO_TANQUE) && !_tqColideBarril(t.x, novoY, TQ_RAIO_TANQUE)) t.y = novoY;
  }

  // Rei do Pedaço: acha o ponto livre mais próximo do centro do mundo
  // pra virar "o pedaço" (testa o centro exato primeiro; se cair em
  // cima de parede/barril — caso do pilar central do mapa 4 — testa
  // uma espiral de pontos ao redor até achar um livre). Evita ter que
  // sortear/autorar um ponto por mapa; funciona pra qualquer mapa
  // futuro sem dado extra. Determinístico (sem Math.random), então os
  // dois lados chegam no MESMO ponto só de saberem o mesmo mapa.
  function _tqAcharCentroZona() {
    var cx = MUNDO_LARGURA / 2, cy = MUNDO_ALTURA / 2;
    if (_tqPontoLivre(cx, cy, TQ_ZONA_RAIO)) return { x: cx, y: cy };
    var passo = 0.15, maxRaio = 2.2;
    for (var r = passo; r <= maxRaio; r += passo) {
      var passos = Math.max(8, Math.round(r * 14));
      for (var i = 0; i < passos; i++) {
        var ang = (i / passos) * Math.PI * 2;
        var x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
        if (x - TQ_ZONA_RAIO < 0 || x + TQ_ZONA_RAIO > MUNDO_LARGURA || y - TQ_ZONA_RAIO < 0 || y + TQ_ZONA_RAIO > MUNDO_ALTURA) continue;
        if (_tqPontoLivre(x, y, TQ_ZONA_RAIO)) return { x: x, y: y };
      }
    }
    return { x: cx, y: cy }; // fallback de segurança (não deveria acontecer)
  }

  // Rei do Pedaço: quem fica SOZINHO dentro do pedaço acumula tempo de
  // controle; contestado (os dois dentro) ou vazio (nenhum) não muda
  // nada. Ao acumular TQ_ZONA_TEMPO_VITORIA segundos, vence a rodada —
  // reaproveita _tqFimDeRodada, o mesmo caminho de quando o tanque é
  // destruído (matar o adversário continua valendo normalmente).
  function _tqAtualizarZona(dt) {
    var dentroAnfitriao = Math.hypot(_tqTanqueAnfitriao.x - _tqZonaCentro.x, _tqTanqueAnfitriao.y - _tqZonaCentro.y) < TQ_ZONA_RAIO;
    var dentroConvidado = Math.hypot(_tqTanqueConvidado.x - _tqZonaCentro.x, _tqTanqueConvidado.y - _tqZonaCentro.y) < TQ_ZONA_RAIO;
    if (dentroAnfitriao && !dentroConvidado) {
      _tqZonaTempoAnfitriao += dt;
      if (_tqZonaTempoAnfitriao >= TQ_ZONA_TEMPO_VITORIA) _tqFimDeRodada('anfitriao', 'zona');
    } else if (dentroConvidado && !dentroAnfitriao) {
      _tqZonaTempoConvidado += dt;
      if (_tqZonaTempoConvidado >= TQ_ZONA_TEMPO_VITORIA) _tqFimDeRodada('convidado', 'zona');
    }
  }

  // Batata Quente: só o ANFITRIÃO decide (autoridade igual zona/
  // paredes/caixas) — decrementa o timer da rodada; se estourar com
  // alguém segurando, esse lado perde. Encostar no adversário passa a
  // batata (com um respiro de imunidade pra não ficar repassando na
  // hora).
  function _tqAtualizarBatata(dt) {
    if (_tqBatataImunidade > 0) _tqBatataImunidade = Math.max(0, _tqBatataImunidade - dt);
    var dist = Math.hypot(_tqTanqueAnfitriao.x - _tqTanqueConvidado.x, _tqTanqueAnfitriao.y - _tqTanqueConvidado.y);
    if (_tqBatataImunidade <= 0 && dist < TQ_BATATA_RAIO_PASSE) {
      _tqBatataCom = (_tqBatataCom === 'anfitriao') ? 'convidado' : 'anfitriao';
      _tqBatataImunidade = TQ_BATATA_IMUNIDADE;
    }
    _tqBatataTimer -= dt;
    if (_tqBatataTimer <= 0) {
      _tqFimDeRodada(_tqBatataCom === 'anfitriao' ? 'convidado' : 'anfitriao', 'batata');
    }
  }

  // Só o anfitrião chama: avança a IA (modo sozinho), os projéteis e
  // a lógica de rodada/placar, e manda o estado pro convidado (se
  // for multiplayer).
  function _tqSimularMundo(dt) {
    if (_tqCooldownAnfitriao > 0) _tqCooldownAnfitriao -= dt;
    if (_tqCooldownConvidado > 0) _tqCooldownConvidado -= dt;

    // Ocultação: só o anfitrião calcula (tem as duas posições) — decai o
    // timer de "revelado" e recalcula quem está escondido. Sempre
    // atualizado (mesmo em pausa) pra já valer no respawn seguinte.
    // Dois motivos pra ficar escondido, com "ou" entre eles: dentro de
    // moita e não revelado (como sempre), OU longe demais um do outro
    // (TQ_VISAO_RAIO — necessário agora que o mapa é grande, senão dava
    // pra ver o adversário do outro lado do mundo).
    if (_tqRevelarAnfitriao > 0) _tqRevelarAnfitriao = Math.max(0, _tqRevelarAnfitriao - dt);
    if (_tqRevelarConvidado > 0) _tqRevelarConvidado = Math.max(0, _tqRevelarConvidado - dt);
    var foraDeAlcance = Math.hypot(_tqTanqueAnfitriao.x - _tqTanqueConvidado.x, _tqTanqueAnfitriao.y - _tqTanqueConvidado.y) > TQ_VISAO_RAIO;
    _tqEscondidoAnfitriao = foraDeAlcance || (_tqRevelarAnfitriao <= 0 && _tqEmMoita(_tqTanqueAnfitriao));
    _tqEscondidoConvidado = foraDeAlcance || (_tqRevelarConvidado <= 0 && _tqEmMoita(_tqTanqueConvidado));

    // Power-ups: decai tiro rápido/duplo (o escudo não tem timer — dura
    // até absorver um hit, ver _tqAplicarDano).
    if (_tqRapidoAnfitriao > 0) _tqRapidoAnfitriao = Math.max(0, _tqRapidoAnfitriao - dt);
    if (_tqRapidoConvidado > 0) _tqRapidoConvidado = Math.max(0, _tqRapidoConvidado - dt);
    if (_tqDuploAnfitriao > 0) _tqDuploAnfitriao = Math.max(0, _tqDuploAnfitriao - dt);
    if (_tqDuploConvidado > 0) _tqDuploConvidado = Math.max(0, _tqDuploConvidado - dt);

    if (_tqRodadaEstado === 'pausa') {
      _tqPausaTimer -= dt;
      if (_tqPausaTimer <= 0) _tqIniciarRodada();
      _tqEnviarEstado(false);
      return;
    }

    // Caixas de suprimento: sorteia uma nova de tempos em tempos (até o
    // teto de simultâneas) e checa se algum tanque acabou de pegar uma.
    _tqProximaCaixaEm -= dt;
    if (_tqProximaCaixaEm <= 0 && _tqCaixas.length < TQ_CAIXA_MAX_SIMULTANEAS) {
      _tqSpawnCaixa();
      _tqProximaCaixaEm = TQ_CAIXA_INTERVALO_MIN + Math.random() * (TQ_CAIXA_INTERVALO_MAX - TQ_CAIXA_INTERVALO_MIN);
    }
    _tqChecarColetaCaixas();

    if (_tqModo === 'solo') _tqAtualizarIA(dt);

    // Modos de jogo novos: um jeito A MAIS de vencer a rodada, além de
    // matar o adversário (que continua funcionando normal logo abaixo,
    // em _tqAtualizarProjeteis). Se a zona/batata já encerrou a rodada
    // nesse quadro, para por aqui — evita processar um tiro fatal no
    // MESMO quadro e contar a rodada como vencida duas vezes.
    if (_tqModoJogo === 'rei') {
      _tqAtualizarZona(dt);
      if (_tqRodadaEstado === 'pausa') { _tqEnviarEstado(false); return; }
    } else if (_tqModoJogo === 'batata') {
      _tqAtualizarBatata(dt);
      if (_tqRodadaEstado === 'pausa') { _tqEnviarEstado(false); return; }
    }

    _tqAtualizarProjeteis(dt);
    _tqEnviarEstado(false);
  }

  // Sorteia uma posição livre (fora de paredes) pra uma caixa nova, com
  // tipo aleatório entre os 3. Desiste depois de algumas tentativas
  // (mapas muito cheios de parede não travam o jogo por isso).
  function _tqSpawnCaixa() {
    var tentativas = 0, x, y;
    do {
      x = TQ_CAIXA_RAIO + Math.random() * (MUNDO_LARGURA - TQ_CAIXA_RAIO * 2);
      y = TQ_CAIXA_RAIO + Math.random() * (MUNDO_ALTURA - TQ_CAIXA_RAIO * 2);
      tentativas++;
    } while ((_tqColideParede(x, y, TQ_CAIXA_RAIO) || _tqColideBarril(x, y, TQ_CAIXA_RAIO)) && tentativas < 12);
    if (tentativas >= 12 && (_tqColideParede(x, y, TQ_CAIXA_RAIO) || _tqColideBarril(x, y, TQ_CAIXA_RAIO))) return;
    var tipo = TQ_TIPOS_CAIXA[Math.floor(Math.random() * TQ_TIPOS_CAIXA.length)];
    _tqCaixas.push({ id: _tqProxCaixaId++, x: x, y: y, tipo: tipo });
  }

  function _tqChecarColetaCaixas() {
    if (!_tqCaixas.length) return;
    for (var i = _tqCaixas.length - 1; i >= 0; i--) {
      var c = _tqCaixas[i];
      var pegouAnfitriao = Math.hypot(_tqTanqueAnfitriao.x - c.x, _tqTanqueAnfitriao.y - c.y) < TQ_RAIO_TANQUE + TQ_CAIXA_RAIO;
      var pegouConvidado = !pegouAnfitriao && Math.hypot(_tqTanqueConvidado.x - c.x, _tqTanqueConvidado.y - c.y) < TQ_RAIO_TANQUE + TQ_CAIXA_RAIO;
      if (pegouAnfitriao || pegouConvidado) {
        _tqAplicarPowerUp(pegouAnfitriao ? 'anfitriao' : 'convidado', c.tipo);
        _tqCaixas.splice(i, 1);
      }
    }
  }

  function _tqAplicarPowerUp(quem, tipo) {
    var souAnfitriao = quem === 'anfitriao';
    if (tipo === 'escudo') {
      if (souAnfitriao) _tqEscudoAnfitriao = true; else _tqEscudoConvidado = true;
    } else if (tipo === 'rapido') {
      if (souAnfitriao) _tqRapidoAnfitriao = TQ_RAPIDO_DUR; else _tqRapidoConvidado = TQ_RAPIDO_DUR;
    } else if (tipo === 'duplo') {
      if (souAnfitriao) _tqDuploAnfitriao = TQ_DUPLO_DUR; else _tqDuploConvidado = TQ_DUPLO_DUR;
    }
  }

  function _tqAtualizarProjeteis(dt) {
    for (var i = _tqProjeteis.length - 1; i >= 0; i--) {
      var pr = _tqProjeteis[i];
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;

      // Ricochete: passou da borda da arena e ainda tem quique sobrando
      // (rebotes < TQ_RICOCHETE_MAX) — inverte a velocidade do eixo que
      // estourou e volta a posição pra dentro, em vez de sumir. Sem
      // quique sobrando, some como antes.
      var estourouX = pr.x < 0 || pr.x > MUNDO_LARGURA;
      var estourouY = pr.y < 0 || pr.y > MUNDO_ALTURA;
      if (estourouX || estourouY) {
        if (pr.rebotes >= TQ_RICOCHETE_MAX) { _tqProjeteis.splice(i, 1); continue; }
        pr.rebotes++;
        if (estourouX) { pr.vx = -pr.vx; pr.x = _tqClamp(pr.x, 0, MUNDO_LARGURA); }
        if (estourouY) { pr.vy = -pr.vy; pr.y = _tqClamp(pr.y, 0, MUNDO_ALTURA); }
      }

      var atingiuParede = false;
      for (var j = 0; j < _tqParedes.length; j++) {
        var p = _tqParedes[j];
        if (p.destruida) continue;
        if (_tqCircRect(pr.x, pr.y, TQ_RAIO_PROJETIL, p)) {
          if (p.tipo === 'metal') {
            // Metálica: ricocheteia em vez de levar dano, consumindo o
            // MESMO orçamento de quiques da borda da arena (sem
            // contador novo) — sem quique sobrando, some igual bateu
            // numa parede normal.
            if (pr.rebotes >= TQ_RICOCHETE_MAX) { atingiuParede = true; break; }
            pr.rebotes++;
            _tqRefletirEmParede(pr, p);
            break;
          }
          p.hp--;
          if (p.hp <= 0) { p.destruida = true; _tqAcionarShake(TQ_SHAKE_PAREDE_DUR, TQ_SHAKE_PAREDE_FORCA); }
          atingiuParede = true;
          break;
        }
      }
      if (atingiuParede) { _tqProjeteis.splice(i, 1); continue; }

      // Barris explosivos: qualquer projétil que encostar detona o
      // barril inteiro (dano em área, ver _tqExplodirBarril) — testado
      // ANTES do tanque pra não acertar os dois no mesmo quadro.
      var atingiuBarril = false;
      for (var k = 0; k < _tqBarris.length; k++) {
        var br = _tqBarris[k];
        if (br.destruido) continue;
        if (Math.hypot(pr.x - br.x, pr.y - br.y) < TQ_BARRIL_RAIO + TQ_RAIO_PROJETIL) {
          atingiuBarril = true;
          _tqProjeteis.splice(i, 1);
          if (_tqExplodirBarril(k)) return;
          break;
        }
      }
      if (atingiuBarril) continue;

      // Só pode acertar o tanque do OUTRO lado (não tem "fogo amigo"
      // consigo mesmo — nem faria sentido, o alvo é sempre o rival).
      var alvoQuem = (pr.dono === 'anfitriao') ? 'convidado' : 'anfitriao';
      var alvo = (alvoQuem === 'anfitriao') ? _tqTanqueAnfitriao : _tqTanqueConvidado;
      var dist = Math.hypot(pr.x - alvo.x, pr.y - alvo.y);
      if (dist < TQ_RAIO_TANQUE + TQ_RAIO_PROJETIL) {
        _tqProjeteis.splice(i, 1);
        // Fatal (HP zerou) encerra a rodada — nesse caso para de processar
        // os outros projéteis do quadro (mesmo comportamento de antes).
        // Não-fatal (escudo absorveu, ou Pesado ainda tem HP) só remove
        // esse projétil e segue o loop normalmente.
        if (_tqAplicarDano(alvoQuem)) return;
        continue;
      }
    }
  }

  // Aplica um hit num tanque: escudo absorve inteiro (sem gastar HP);
  // senão desconta 1 HP e, se zerar, encerra a rodada. Retorna true
  // quando a rodada terminou (fatal), false caso contrário.
  function _tqAplicarDano(quem) {
    var souAnfitriao = quem === 'anfitriao';
    var temEscudo = souAnfitriao ? _tqEscudoAnfitriao : _tqEscudoConvidado;
    if (temEscudo) {
      if (souAnfitriao) _tqEscudoAnfitriao = false; else _tqEscudoConvidado = false;
      _tqAcionarShake(TQ_SHAKE_PAREDE_DUR, TQ_SHAKE_PAREDE_FORCA); // tremor leve — absorvido, não feriu
      return false;
    }
    var t = souAnfitriao ? _tqTanqueAnfitriao : _tqTanqueConvidado;
    t.hp = Math.max(0, (typeof t.hp === 'number' ? t.hp : 1) - 1);
    if (t.hp <= 0) {
      _tqFimDeRodada(souAnfitriao ? 'convidado' : 'anfitriao');
      return true;
    }
    _tqAcionarShake(TQ_SHAKE_ACERTO_DUR * 0.6, TQ_SHAKE_ACERTO_FORCA * 0.6); // atingido mas sobreviveu (Pesado)
    return false;
  }

  // Ricochete em parede metálica: acha o ponto mais próximo do centro
  // do projétil dentro do retângulo (mesma técnica de _tqCircRect) e
  // inverte a velocidade no eixo em que ele "entrou" mais fundo —
  // lateral (esquerda/direita) inverte vx, topo/base inverte vy.
  // Empurra o projétil um pouco pra fora da parede, senão ele
  // colidiria de novo no quadro seguinte e ficaria preso.
  function _tqRefletirEmParede(pr, p) {
    var nx = _tqClamp(pr.x, p.x, p.x + p.w);
    var ny = _tqClamp(pr.y, p.y, p.y + p.h);
    var dx = pr.x - nx, dy = pr.y - ny;
    if (dx === 0 && dy === 0) {
      // Centro do projétil já dentro do retângulo (colisão de raspão) —
      // usa a distância até a borda mais próxima pra decidir o eixo.
      var distEsq = pr.x - p.x, distDir = (p.x + p.w) - pr.x;
      var distTopo = pr.y - p.y, distBase = (p.y + p.h) - pr.y;
      var minH = Math.min(distEsq, distDir), minV = Math.min(distTopo, distBase);
      if (minH < minV) { pr.vx = -pr.vx; pr.x += distEsq < distDir ? -0.01 : 0.01; }
      else { pr.vy = -pr.vy; pr.y += distTopo < distBase ? -0.01 : 0.01; }
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) { pr.vx = -pr.vx; pr.x = nx + (dx > 0 ? 0.01 : -0.01); }
    else { pr.vy = -pr.vy; pr.y = ny + (dy > 0 ? 0.01 : -0.01); }
  }

  // Efeito visual da explosão (não sincronizado — cada lado dispara a
  // própria animação ao detectar a transição pra destruído, ver
  // cabeçalho do arquivo e dado.bd em _tqReceberMensagem).
  function _tqDispararExplosaoVisual(x, y) {
    _tqExplosoes.push({ x: x, y: y, t: 0 });
  }

  // Detona um barril: marca destruído, dispara o tremor de tela e o
  // efeito visual, e aplica dano de área nos tanques dentro do raio —
  // reaproveita _tqAplicarDano (escudo/HP/Pesado funcionam automático,
  // igual tiro direto). Retorna true se algum lado morreu (rodada
  // acabou), mesmo contrato de _tqAplicarDano, pro chamador parar de
  // processar o resto dos projéteis do quadro.
  function _tqExplodirBarril(idx) {
    var br = _tqBarris[idx];
    if (!br || br.destruido) return false;
    br.destruido = true;
    _tqAcionarShake(TQ_SHAKE_BARRIL_DUR, TQ_SHAKE_BARRIL_FORCA);
    _tqDispararExplosaoVisual(br.x, br.y);
    var fatal = false;
    if (Math.hypot(_tqTanqueAnfitriao.x - br.x, _tqTanqueAnfitriao.y - br.y) < TQ_BARRIL_RAIO_EXPLOSAO) {
      if (_tqAplicarDano('anfitriao')) fatal = true;
    }
    if (!fatal && Math.hypot(_tqTanqueConvidado.x - br.x, _tqTanqueConvidado.y - br.y) < TQ_BARRIL_RAIO_EXPLOSAO) {
      if (_tqAplicarDano('convidado')) fatal = true;
    }
    return fatal;
  }

  function _tqFimDeRodada(vencedor, motivo) {
    if (vencedor === 'anfitriao') _tqPlacarAnfitriao++; else _tqPlacarConvidado++;
    _tqAcionarShake(TQ_SHAKE_ACERTO_DUR, TQ_SHAKE_ACERTO_FORCA);
    _tqRodadaEstado = 'pausa';
    _tqPausaTimer = TQ_PAUSA_RODADA;
    _tqPausaVencedor = vencedor;
    _tqPausaMotivo = motivo || 'acerto'; // 'acerto' (HP zerou) | 'zona' | 'batata' — ver _tqDesenharAvisoRodada
    _tqAtualizarHUD();

    var partidaAcabou = (_tqPlacarAnfitriao >= TQ_RODADAS_PARA_VENCER || _tqPlacarConvidado >= TQ_RODADAS_PARA_VENCER);
    if (partidaAcabou) {
      _tqEnviarEstado(true);
      _tqMostrarFim('fim');
      return;
    }
    _tqEnviarEstado(false);
  }

  // Nasce um projétil sozinho, um pouco à frente do cano (já fora do
  // próprio corpo do tanque, senão colidiria com a própria parede/tanque
  // no 1º quadro). Função interna — quem chama de fora é _tqCriarProjetil.
  function _tqCriarProjetilUnico(x, y, ang, dono) {
    var offset = TQ_RAIO_TANQUE + 0.02;
    var px = x + Math.sin(ang) * offset, py = y - Math.cos(ang) * offset;
    _tqProjeteis.push({
      x: px, y: py,
      vx: Math.sin(ang) * TQ_VEL_PROJETIL, vy: -Math.cos(ang) * TQ_VEL_PROJETIL,
      dono: dono, rebotes: 0
    });
  }

  function _tqCriarProjetil(x, y, ang, dono) {
    // Tiro duplo (power-up): 2 projéteis com uma pequena abertura entre
    // eles, em vez de 1 reto. Só quem chamou tem o power-up ativo.
    var duploAtivo = (dono === 'anfitriao') ? (_tqDuploAnfitriao > 0) : (_tqDuploConvidado > 0);
    if (duploAtivo) {
      _tqCriarProjetilUnico(x, y, ang - TQ_DUPLO_ESPALHAR / 2, dono);
      _tqCriarProjetilUnico(x, y, ang + TQ_DUPLO_ESPALHAR / 2, dono);
    } else {
      _tqCriarProjetilUnico(x, y, ang, dono);
    }
    // Recuo — cobre a IA (modo sozinho) e a visão que o anfitrião tem
    // do tiro do convidado (autoridade nasce aqui pros dois casos). O
    // feedback do PRÓPRIO jogador ao apertar fogo já é instantâneo via
    // _tqTentarAtirar, sem esperar a rede.
    if (dono === 'anfitriao') _tqRecuoAnfitriao = 1; else _tqRecuoConvidado = 1;
    // Atirar denuncia a posição mesmo dentro de moita — _tqCriarProjetil
    // só roda no lado com autoridade (anfitrião), então é o ponto certo
    // pra marcar os dois lados como "revelados" por um tempo.
    if (dono === 'anfitriao') _tqRevelarAnfitriao = TQ_MOITA_REVELA_SEG; else _tqRevelarConvidado = TQ_MOITA_REVELA_SEG;
  }

  function _tqTentarAtirar() {
    if (_tqEstado !== 'jogando' || _tqRodadaEstado !== 'jogando' || _tqMeuCooldown > 0) return;
    var meuPapel = _tqSouAnfitriao ? 'anfitriao' : 'convidado';
    _tqMeuCooldown = _tqCooldownEfetivo(meuPapel);
    if (_tqSouAnfitriao) _tqRecuoAnfitriao = 1; else _tqRecuoConvidado = 1;
    var t = _tqMeuTanque();
    if (_tqSouAnfitriao) {
      if (_tqCooldownAnfitriao <= 0) {
        _tqCooldownAnfitriao = _tqCooldownEfetivo('anfitriao');
        _tqCriarProjetil(t.x, t.y, t.ang, 'anfitriao');
      }
    } else if (window.AngatubaMP) {
      window.AngatubaMP.enviar({ t: 'tiro', x: t.x, y: t.y, ang: t.ang });
    }
  }

  var _tqUltimoEnvioTanque = 0;
  function _tqEnviarMeuTanque() {
    if (_tqModo !== 'multiplayer' || !window.AngatubaMP) return;
    var agora = performance.now();
    if ((agora - _tqUltimoEnvioTanque) < 33) return;
    _tqUltimoEnvioTanque = agora;
    var t = _tqMeuTanque();
    window.AngatubaMP.enviar({ t: 'p', x: t.x, y: t.y, ang: t.ang });
  }

  var _tqUltimoEnvioEstado = 0;
  function _tqEnviarEstado(fim) {
    if (_tqModo !== 'multiplayer' || !window.AngatubaMP) return;
    var agora = performance.now();
    if (!fim && (agora - _tqUltimoEnvioEstado) < 33) return;
    _tqUltimoEnvioEstado = agora;
    var pd = _tqParedes.map(function (p) { return p.destruida ? 1 : 0; });
    var bd = _tqBarris.map(function (b) { return b.destruido ? 1 : 0; });
    window.AngatubaMP.enviar({
      t: 'e', hx: _tqTanqueAnfitriao.x, hy: _tqTanqueAnfitriao.y, hang: _tqTanqueAnfitriao.ang,
      pj: _tqProjeteis, pd: pd, bd: bd, ea: _tqEscondidoAnfitriao,
      hhp: _tqTanqueAnfitriao.hp, ghp: _tqTanqueConvidado.hp,
      cx: _tqCaixas, esa: _tqEscudoAnfitriao, esg: _tqEscudoConvidado, rg: _tqRapidoConvidado,
      sa: _tqPlacarAnfitriao, sg: _tqPlacarConvidado, re: _tqRodadaEstado, fim: !!fim,
      gsp: _tqUltimoSpawnConvidado,
      za: _tqZonaTempoAnfitriao, zg: _tqZonaTempoConvidado,
      bt: _tqBatataCom, btt: _tqBatataTimer,
      pv: _tqPausaVencedor, pm: _tqPausaMotivo
    });
  }

  /* ── IA (modo sozinho) — controla o tanque "convidado" ────────── */
  function _tqLinhaLivre(a, b) {
    var passos = 8;
    for (var i = 1; i < passos; i++) {
      var t = i / passos;
      var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      if (_tqColideParede(x, y, 0.01) || _tqColideBarril(x, y, 0.01)) return false;
    }
    return true;
  }

  function _tqAtualizarIA(dt) {
    var eu = _tqTanqueConvidado, alvo = _tqTanqueAnfitriao;
    _tqIATimer -= dt;
    if (_tqIATimer <= 0) {
      _tqIATimer = 0.4 + Math.random() * 0.5;
      var dist = Math.hypot(alvo.x - eu.x, alvo.y - eu.y);
      if (dist < TQ_IA_DIST_ENGAJAR && !_tqEscondidoAnfitriao && _tqLinhaLivre(eu, alvo)) {
        _tqIAModo = 'engajar';
      } else {
        _tqIAModo = 'patrulha';
        // Rei do Pedaço: metade das vezes patrulha em direção ao
        // pedaço em vez de um ponto aleatório — não é uma IA
        // estratégica de verdade, só evita que a CPU ignore o pedaço
        // por completo.
        _tqIAAlvoPatrulha = (_tqModoJogo === 'rei' && _tqZonaCentro && Math.random() < 0.5)
          ? { x: _tqZonaCentro.x, y: _tqZonaCentro.y }
          : { x: 0.18 + Math.random() * (MUNDO_LARGURA - 0.36), y: 0.18 + Math.random() * (MUNDO_ALTURA - 0.36) };
      }
    }

    var ix = 0, iy = 0;
    if (_tqIAModo === 'engajar') {
      var angMira = Math.atan2(alvo.x - eu.x, -(alvo.y - eu.y));
      ix = Math.sin(angMira) * 0.7; iy = -Math.cos(angMira) * 0.7;
      var diff = angMira - eu.ang;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.16 && !_tqEscondidoAnfitriao && _tqCooldownConvidado <= 0 && _tqLinhaLivre(eu, alvo)) {
        _tqCooldownConvidado = _tqCooldownEfetivo('convidado') * (1.1 + Math.random() * 0.6);
        _tqCriarProjetil(eu.x, eu.y, eu.ang, 'convidado');
      }
    } else {
      var dx = _tqIAAlvoPatrulha.x - eu.x, dy = _tqIAAlvoPatrulha.y - eu.y;
      var d = Math.hypot(dx, dy) || 1;
      ix = dx / d; iy = dy / d;
      if (d < 0.06) _tqIATimer = 0; // chegou: escolhe outro alvo já no próximo quadro
    }
    _tqAtualizarTanque(eu, ix, iy, dt);
  }

  function _tqMostrarFim(motivo) {
    if (_tqRAF) { cancelAnimationFrame(_tqRAF); _tqRAF = 0; }
    _tqMostrarTela('fim');
    var titulo = document.getElementById('tq-fim-titulo');
    var msg = document.getElementById('tq-fim-msg');
    var placar = document.getElementById('tq-fim-placar');
    var owlEl = document.getElementById('tq-fim-owl');
    var meu = _tqSouAnfitriao ? _tqPlacarAnfitriao : _tqPlacarConvidado;
    var dele = _tqSouAnfitriao ? _tqPlacarConvidado : _tqPlacarAnfitriao;
    var btnRev = document.getElementById('tq-btn-revanche');
    if (btnRev) btnRev.disabled = false;

    if (motivo === 'desconexao') {
      if (titulo) titulo.textContent = 'Conexão perdida';
      if (msg) msg.textContent = 'O outro jogador saiu ou a conexão caiu.';
      if (placar) placar.style.display = 'none';
      if (btnRev) btnRev.style.display = 'none';
      if (owlEl) { owlEl.src = '/webp/owl-wave.webp'; owlEl.style.display = ''; }
      return;
    }
    var venceu = meu > dele;
    if (titulo) titulo.textContent = venceu ? 'Você venceu! 🏆' : 'Não foi dessa vez';
    if (msg) msg.textContent = venceu ? 'Mandou bem contra ' + (_tqApelidoAdversario || 'seu adversário') + '!'
                                       : (_tqApelidoAdversario || 'Seu adversário') + ' levou essa.';
    if (placar) { placar.textContent = meu + ' x ' + dele; placar.style.display = ''; }
    if (btnRev) btnRev.style.display = '';
    if (owlEl) { owlEl.src = venceu ? '/webp/owl-trophy.webp' : '/webp/owl-wave.webp'; owlEl.style.display = ''; }

    var bridge = _tqBridge();
    if (venceu && bridge && bridge.efeitos) bridge.efeitos.confete('tq-fim', 80);
  }

  function _tqAtualizarHUD() {
    var meu = _tqSouAnfitriao ? _tqPlacarAnfitriao : _tqPlacarConvidado;
    var dele = _tqSouAnfitriao ? _tqPlacarConvidado : _tqPlacarAnfitriao;
    var elNome = document.getElementById('tq-hud-nome-adversario');
    if (elNome) elNome.textContent = _tqApelidoAdversario || 'Adversário';
    _tqAtualizarPips('tq-hud-meu-pips', meu);
    _tqAtualizarPips('tq-hud-dele-pips', dele);
  }
  function _tqAtualizarPips(id, valor) {
    var wrap = document.getElementById(id);
    if (!wrap) return;
    var pips = wrap.querySelectorAll('.tq-pip');
    for (var i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('tq-pip-cheio', i < valor);
    }
  }

  /* ── Desenho (top-down direto, sem perspectiva — arena widescreen) ─ */
  var TQ_COR_ANFITRIAO = '#3aa0ff';
  var TQ_COR_CONVIDADO = '#ff4757';

  function _tqDesenhar() {
    if (!_tqCtx || !_tqW || !_tqH) return;
    var ctx = _tqCtx;
    _tqAtualizarCamera();
    // O clear fica FORA do save/translate do tremor — limpa o quadro
    // inteiro sem deslocamento, senão sobrariam frestas nas bordas.
    ctx.clearRect(0, 0, _tqW, _tqH);
    ctx.save();
    if (_tqShakeTimer > 0 && _tqShakeDuracaoBase > 0) {
      var intensidade = _tqShakeForcaBase * (_tqShakeTimer / _tqShakeDuracaoBase);
      ctx.translate((Math.random() * 2 - 1) * intensidade, (Math.random() * 2 - 1) * intensidade);
    }
    // Câmera: um único translate desloca TUDO que é desenhado em
    // espaço de MUNDO (chão/rastro/moitas/paredes/caixas/projéteis/
    // tanques) — nenhuma dessas funções de desenho precisa saber que
    // a câmera existe, elas continuam usando coordenada×_tqH direto.
    // Isolado num save/restore próprio porque o aviso de rodada (texto
    // "você venceu!") é desenhado em espaço de TELA, não de mundo.
    ctx.save();
    ctx.translate(-_tqCamera.x * _tqH, -_tqCamera.y * _tqH);
    _tqDesenharChao();
    _tqDesenharRastro();
    _tqDesenharMoitas();
    _tqDesenharZona();
    _tqDesenharParedes();
    _tqDesenharCaixas();
    _tqDesenharBarris();

    var jogando = (_tqEstado === 'jogando');
    if (jogando) {
      for (var i = 0; i < _tqProjeteis.length; i++) _tqDesenharProjetil(_tqProjeteis[i]);
      // O PRÓPRIO tanque sempre aparece; o do adversário só se ele não
      // estiver escondido (moita ou longe demais — ver _tqEscondido*
      // em _tqSimularMundo).
      var anfitriaoVisivel = _tqSouAnfitriao || !_tqEscondidoAnfitriao;
      var convidadoVisivel = !_tqSouAnfitriao || !_tqEscondidoConvidado;
      if (anfitriaoVisivel) _tqDesenharTanque(_tqTanqueAnfitriao, 'tank-azul.webp', TQ_COR_ANFITRIAO, _tqRecuoAnfitriao, _tqEscudoAnfitriao);
      if (convidadoVisivel) _tqDesenharTanque(_tqTanqueConvidado, 'tank-vermelho.webp', TQ_COR_CONVIDADO, _tqRecuoConvidado, _tqEscudoConvidado);
      // Batata Quente: ícone só sobre um tanque que já foi desenhado
      // acima (senão entregaria a posição de um tanque escondido).
      if (_tqModoJogo === 'batata') {
        if (_tqBatataCom === 'anfitriao' && anfitriaoVisivel) _tqDesenharBatataIcone(_tqTanqueAnfitriao);
        else if (_tqBatataCom === 'convidado' && convidadoVisivel) _tqDesenharBatataIcone(_tqTanqueConvidado);
      }
    }
    _tqDesenharExplosoes();
    ctx.restore();
    if (jogando) _tqDesenharBatataHUD();
    if (jogando && _tqRodadaEstado === 'pausa') _tqDesenharAvisoRodada();
    ctx.restore();
  }

  // Caixas de suprimento: círculo escuro com um símbolo por tipo —
  // escudo (cruz azul), tiro rápido (raio amarelo), tiro duplo (2
  // bolinhas laranja). Desenhadas sobre as paredes, embaixo dos tanques.
  var TQ_CAIXA_CORES = { escudo: '#3aa0ff', rapido: '#ffd24a', duplo: '#ff9a3a' };
  function _tqDesenharCaixas() {
    if (!_tqCaixas.length) return;
    var ctx = _tqCtx;
    var r = TQ_CAIXA_RAIO * _tqH;
    for (var i = 0; i < _tqCaixas.length; i++) {
      var c = _tqCaixas[i];
      ctx.save();
      ctx.translate(c.x * _tqH, c.y * _tqH);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,15,26,0.85)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = TQ_CAIXA_CORES[c.tipo] || '#fff';
      ctx.stroke();
      ctx.fillStyle = TQ_CAIXA_CORES[c.tipo] || '#fff';
      if (c.tipo === 'escudo') {
        ctx.fillRect(-r * 0.09, -r * 0.45, r * 0.18, r * 0.9);
        ctx.fillRect(-r * 0.45, -r * 0.09, r * 0.9, r * 0.18);
      } else if (c.tipo === 'rapido') {
        ctx.beginPath();
        ctx.moveTo(-r * 0.1, -r * 0.5); ctx.lineTo(r * 0.35, -r * 0.05); ctx.lineTo(r * 0.02, -r * 0.05);
        ctx.lineTo(r * 0.28, r * 0.5); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(-r * 0.02, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(-r * 0.22, 0, r * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.22, 0, r * 0.22, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // Marcas de esteira: um par de tracinhos escuros por marca, girados
  // pro ângulo do tanque no momento em que passou ali, sumindo aos
  // poucos (fade por alpha) — desenhadas sobre o chão, embaixo de
  // paredes/tanques.
  function _tqDesenharRastro() {
    if (!_tqRastro.length) return;
    var ctx = _tqCtx;
    // _tqH (não _tqW) é o fator uniforme px-por-unidade nos dois eixos —
    // ver nota "ARENA, MUNDO E CÂMERA" no cabeçalho do arquivo.
    var diametroTela = TQ_RAIO_TANQUE * 2 * _tqH;
    var afastamento = diametroTela * 0.30;
    var compr = diametroTela * 0.22, larg = diametroTela * 0.09;
    for (var i = 0; i < _tqRastro.length; i++) {
      var m = _tqRastro[i];
      var alpha = Math.max(0, Math.min(1, m.vida / TQ_RASTRO_VIDA)) * 0.28;
      if (alpha <= 0.01) continue;
      ctx.save();
      ctx.translate(m.x * _tqH, m.y * _tqH);
      ctx.rotate(m.ang);
      ctx.fillStyle = 'rgba(0,0,0,' + alpha.toFixed(3) + ')';
      ctx.fillRect(-afastamento - larg / 2, -compr / 2, larg, compr);
      ctx.fillRect(afastamento - larg / 2, -compr / 2, larg, compr);
      ctx.restore();
    }
  }

  // Desenhado dentro do translate da câmera (ver _tqDesenhar) — ladrilha
  // a imagem em vez de esticar uma cópia só do tamanho do mundo: com o
  // mundo bem maior que a tela (TQ_MUNDO_ESCALA), esticar borraria a
  // textura; repetindo, cada ladrilho fica do mesmo tamanho visual que
  // o chão sempre teve.
  //
  // Duas otimizações (o mundo 16x maior deixou isso lento — sensação de
  // lag constante, não só em picos):
  //  1) o CanvasPattern (createPattern + setTransform) era recriado TODO
  //     quadro — agora só se a imagem ou a escala (_tqH, muda ao
  //     redimensionar/girar a tela) tiverem mudado desde a última vez.
  //  2) só pinta a fatia do mundo que a câmera está mostrando agora (+
  //     uma folga pro tremor de tela), não o mundo inteiro — o resto
  //     nem aparece na tela, então pintar tudo (16x mais área que antes
  //     de existir mundo grande) só gastava tempo à toa a cada quadro.
  var _tqChaoPatternCache = null; // { pat, img, h }
  var TQ_CHAO_FOLGA_PX = 32; // cobre o deslocamento do screen shake sem deixar fresta na borda
  function _tqDesenharChao() {
    var ctx = _tqCtx;
    var vx = _tqCamera.x * _tqH - TQ_CHAO_FOLGA_PX, vy = _tqCamera.y * _tqH - TQ_CHAO_FOLGA_PX;
    var vw = TQ_VIEWPORT_LARGURA * _tqH + TQ_CHAO_FOLGA_PX * 2, vh = TQ_VIEWPORT_ALTURA * _tqH + TQ_CHAO_FOLGA_PX * 2;
    var reg = _tqAsset('chao-arena.webp');
    if (reg && reg.ok && reg.img && reg.w && reg.h) {
      try {
        if (!_tqChaoPatternCache || _tqChaoPatternCache.img !== reg.img || _tqChaoPatternCache.h !== _tqH) {
          var pat = ctx.createPattern(reg.img, 'repeat');
          if (pat && pat.setTransform) {
            var escala = Math.max(TQ_VIEWPORT_LARGURA * _tqH / reg.w, TQ_VIEWPORT_ALTURA * _tqH / reg.h);
            pat.setTransform(new DOMMatrix([escala, 0, 0, escala, 0, 0]));
            _tqChaoPatternCache = { pat: pat, img: reg.img, h: _tqH };
          } else {
            _tqChaoPatternCache = null;
          }
        }
        if (_tqChaoPatternCache) {
          ctx.fillStyle = _tqChaoPatternCache.pat;
          ctx.fillRect(vx, vy, vw, vh);
          return;
        }
      } catch (e) {}
      // Sem suporte a pattern.setTransform (raro, browser antigo): cai
      // pra imagem única esticada cobrindo o mundo inteiro (funciona,
      // só fica mais borrada) — caminho tão raro que não vale otimizar.
      ctx.drawImage(reg.img, 0, 0, MUNDO_LARGURA * _tqH, MUNDO_ALTURA * _tqH);
      return;
    }
    ctx.fillStyle = '#3a3d42';
    ctx.fillRect(vx, vy, vw, vh);
  }

  // Moitas: elipse verde translúcida — desenhada depois do rastro e
  // antes das paredes/tanques (fica no chão, sob quem passa por cima).
  // Puramente visual: quem esconde é a checagem em _tqEmMoita.
  function _tqDesenharMoitas() {
    var moitas = _TQ_MAPAS[_tqMapaAtualIdx].moitas;
    if (!moitas.length) return;
    var ctx = _tqCtx;
    var reg = _tqAsset('mato.webp');
    ctx.save();
    ctx.fillStyle = 'rgba(46,125,50,0.55)';
    ctx.strokeStyle = 'rgba(27,79,31,0.65)';
    ctx.lineWidth = 2;
    for (var i = 0; i < moitas.length; i++) {
      var m = moitas[i];
      var cx = (m.x + m.w / 2) * _tqH, cy = (m.y + m.h / 2) * _tqH;
      var rx = (m.w / 2) * _tqH, ry = (m.h / 2) * _tqH;
      if (reg && reg.ok && reg.img) {
        ctx.drawImage(reg.img, cx - rx, cy - ry, rx * 2, ry * 2);
      } else {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function _tqDesenharParedes() {
    var ctx = _tqCtx;
    var regTijolo = _tqAsset('parede-tijolo.webp');
    var regEscombro = _tqAsset('parede-escombros.webp');
    var regMetal = _tqAsset('parede-metal.webp');
    for (var i = 0; i < _tqParedes.length; i++) {
      var p = _tqParedes[i];
      var px = p.x * _tqH, py = p.y * _tqH, pw = p.w * _tqH, ph = p.h * _tqH;
      if (p.tipo === 'metal') {
        // Metálica: nunca vira escombro (é sempre a mesma aparência,
        // ver comentário no cabeçalho) — mesmo esquema de fallback
        // vetorial das outras paredes se a imagem faltar/falhar.
        if (regMetal && regMetal.ok && regMetal.img) {
          ctx.drawImage(regMetal.img, px, py, pw, ph);
        } else {
          ctx.fillStyle = '#7a828c';
          ctx.fillRect(px, py, pw, ph);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          if (pw >= ph) ctx.fillRect(px, py + ph * 0.4, pw, ph * 0.2);
          else ctx.fillRect(px + pw * 0.4, py, pw * 0.2, ph);
          ctx.strokeStyle = '#4a4f56';
          ctx.lineWidth = 2;
          ctx.strokeRect(px, py, pw, ph);
        }
        continue;
      }
      var reg = p.destruida ? regEscombro : regTijolo;
      if (reg && reg.ok && reg.img) {
        ctx.drawImage(reg.img, px, py, pw, ph);
      } else {
        ctx.fillStyle = p.destruida ? 'rgba(120,90,70,0.35)' : '#8a4a3a';
        ctx.fillRect(px, py, pw, ph);
      }
    }
  }

  // Barris explosivos: usa barril.webp quando carregado, com o mesmo
  // fallback vetorial (cilindro escuro + faixa de perigo) de antes se
  // faltar/falhar. Some sem deixar escombro quando destruído (a
  // explosão em si é o efeito visual, ver _tqDesenharExplosoes).
  // Desenhado depois das caixas, antes dos tanques.
  function _tqDesenharBarris() {
    if (!_tqBarris.length) return;
    var ctx = _tqCtx;
    var r = TQ_BARRIL_RAIO * _tqH;
    var reg = _tqAsset('barril.webp');
    for (var i = 0; i < _tqBarris.length; i++) {
      var b = _tqBarris[i];
      if (b.destruido) continue;
      ctx.save();
      ctx.translate(b.x * _tqH, b.y * _tqH);
      if (reg && reg.ok && reg.img && reg.w && reg.h) {
        var largura = r * 2 * 1.3; // um pouco maior que o raio de colisão, mesmo critério do tanque
        var altura = largura * (reg.h / reg.w);
        ctx.drawImage(reg.img, -largura / 2, -altura / 2, largura, altura);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = '#3a2a1a';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1a1210';
        ctx.stroke();
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#ffb020';
        ctx.fillRect(-r, -r * 0.28, r * 2, r * 0.56);
        ctx.restore();
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Explosão de barril: puramente visual e local (não sincronizada —
  // cada lado dispara a própria via _tqDispararExplosaoVisual, ver
  // cabeçalho do arquivo) — um anel que cresce e desaparece em
  // TQ_EXPLOSAO_DUR segundos.
  function _tqDesenharExplosoes() {
    if (!_tqExplosoes.length) return;
    var ctx = _tqCtx;
    for (var i = 0; i < _tqExplosoes.length; i++) {
      var ex = _tqExplosoes[i];
      var prog = Math.min(1, ex.t / TQ_EXPLOSAO_DUR);
      var raio = TQ_BARRIL_RAIO_EXPLOSAO * prog * _tqH;
      var alpha = 1 - prog;
      ctx.save();
      ctx.translate(ex.x * _tqH, ex.y * _tqH);
      ctx.beginPath();
      ctx.arc(0, 0, raio, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,150,40,' + alpha.toFixed(3) + ')';
      ctx.lineWidth = 5 * (1 - prog * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, raio * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,80,20,' + (alpha * 0.35).toFixed(3) + ')';
      ctx.fill();
      ctx.restore();
    }
  }

  function _tqDesenharProjetil(pr) {
    var ctx = _tqCtx;
    var cor = pr.dono === 'anfitriao' ? TQ_COR_ANFITRIAO : TQ_COR_CONVIDADO;
    var x = pr.x * _tqH, y = pr.y * _tqH;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, TQ_RAIO_PROJETIL * _tqH * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = cor;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
  }

  // Pivô vertical do sprite (fração da altura, de cima pra baixo) —
  // os dois tanques têm o cano apontando pra cima na imagem-fonte,
  // então giram em torno do CENTRO DO CASCO (não do centro da
  // imagem, que inclui o cano saindo pra cima de forma assimétrica).
  var TQ_PIVO_Y = 0.63;
  function _tqDesenharTanque(t, arquivo, corFallback, recuo, comEscudo) {
    var ctx = _tqCtx;
    var reg = _tqAsset(arquivo);
    var cx = t.x * _tqH, cy = t.y * _tqH;
    var diametroTela = TQ_RAIO_TANQUE * 2 * _tqH;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t.ang);
    // Recuo do canhão: empurra o desenho pra TRÁS (oposto de onde
    // mira) por um instante ao atirar. Local: y positivo já é "atrás"
    // aqui, porque o sprite é desenhado apontando pro -Y (ver comentário
    // do pivô abaixo) e t.ang=0 mira pro norte.
    if (recuo > 0) ctx.translate(0, diametroTela * 0.16 * recuo);

    if (reg && reg.ok && reg.img && reg.w && reg.h) {
      var altura = diametroTela / (TQ_PIVO_Y * 1.32); // casco ocupa ~1.32x o raio em altura
      var largura = altura * (reg.w / reg.h);
      ctx.drawImage(reg.img, -largura / 2, -altura * TQ_PIVO_Y, largura, altura);
    } else {
      ctx.fillStyle = corFallback;
      ctx.beginPath();
      ctx.arc(0, 0, diametroTela / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-diametroTela * 0.08, -diametroTela * 0.65, diametroTela * 0.16, diametroTela * 0.6);
    }
    ctx.restore();

    // Escudo (power-up): anel azul ao redor do tanque, fora do save/
    // rotate acima (é simétrico, não precisa girar com o casco).
    if (comEscudo) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.arc(0, 0, diametroTela * 0.62, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(58,160,255,0.85)';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(58,160,255,0.8)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    }

    // HP em pips acima do tanque — só pra classes com mais de 1 HP
    // (Pesado), pra mostrar quantos tiros ainda aguenta.
    var classe = _tqClasseDoTanque(t);
    if (classe.hpMax > 1) {
      ctx.save();
      var n = classe.hpMax, espaco = diametroTela * 0.32;
      var startX = cx - ((n - 1) * espaco) / 2, y = cy - diametroTela * 1.05;
      for (var i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * espaco, y, diametroTela * 0.09, 0, Math.PI * 2);
        ctx.fillStyle = i < t.hp ? '#ffb020' : 'rgba(255,255,255,0.18)';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function _tqDesenharAvisoRodada() {
    var ctx = _tqCtx;
    var euGanhei = _tqPausaVencedor === (_tqSouAnfitriao ? 'anfitriao' : 'convidado');
    // pv/pm (vencedor/motivo) chegam pela rede pro convidado (ver "e"
    // em _tqReceberMensagem) — sem isso esse aviso sempre achava que o
    // convidado tinha perdido, mesmo quando ele venceu.
    var nomeAdversario = _tqModo === 'solo' ? 'O computador' : (_tqApelidoAdversario || 'Adversário');
    var texto;
    if (_tqPausaMotivo === 'zona') {
      texto = euGanhei ? 'Você controlou o pedaço!' : nomeAdversario + ' controlou o pedaço!';
    } else if (_tqPausaMotivo === 'batata') {
      texto = euGanhei ? 'A batata estourou no adversário!' : 'A batata estourou em você!';
    } else if (_tqModo === 'solo') {
      texto = euGanhei ? 'Você acertou!' : nomeAdversario + ' acertou!';
    } else {
      texto = euGanhei ? 'Você venceu a rodada!' : nomeAdversario + ' venceu a rodada!';
    }
    ctx.save();
    ctx.font = "700 16px 'Syne', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.fillText(texto, _tqW / 2, _tqH * 0.5);
    ctx.restore();
  }

  // Rei do Pedaço: círculo do "pedaço" no chão + arco de progresso
  // mostrando quem está mais perto de vencer por controle. Espaço de
  // MUNDO (translada com a câmera, igual moitas/paredes) — desenhado
  // antes das paredes, fica no chão sob quem passa por cima.
  function _tqDesenharZona() {
    if (_tqModoJogo !== 'rei' || !_tqZonaCentro) return;
    var ctx = _tqCtx;
    var cx = _tqZonaCentro.x * _tqH, cy = _tqZonaCentro.y * _tqH, r = TQ_ZONA_RAIO * _tqH;
    var liderTempo = Math.max(_tqZonaTempoAnfitriao, _tqZonaTempoConvidado);
    var liderCor = _tqZonaTempoAnfitriao >= _tqZonaTempoConvidado ? TQ_COR_ANFITRIAO : TQ_COR_CONVIDADO;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,208,74,0.12)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,208,74,0.55)';
    ctx.stroke();
    if (liderTempo > 0) {
      var frac = Math.min(1, liderTempo / TQ_ZONA_TEMPO_VITORIA);
      ctx.beginPath();
      ctx.arc(cx, cy, r - 5, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.strokeStyle = liderCor;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Batata Quente: ícone pulsante sobre o tanque que está com ela —
  // espaço de MUNDO (chamado de dentro do translate da câmera, junto
  // com os tanques).
  function _tqDesenharBatataIcone(t) {
    var ctx = _tqCtx;
    var cx = t.x * _tqH, cy = t.y * _tqH;
    var diametroTela = TQ_RAIO_TANQUE * 2 * _tqH;
    var pulso = 1 + 0.12 * Math.sin(performance.now() / 120);
    ctx.save();
    ctx.translate(cx, cy - diametroTela * 1.05);
    ctx.scale(pulso, pulso);
    ctx.beginPath();
    ctx.arc(0, 0, diametroTela * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = '#c9862f';
    ctx.fill();
    ctx.strokeStyle = '#7a4d16';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // Batata Quente: contagem regressiva no topo da tela — espaço de
  // TELA (fora do translate da câmera), igual ao aviso de fim de
  // rodada.
  function _tqDesenharBatataHUD() {
    if (_tqModoJogo !== 'batata' || _tqEstado !== 'jogando' || _tqRodadaEstado !== 'jogando') return;
    var ctx = _tqCtx;
    ctx.save();
    ctx.font = "700 15px 'Syne', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillStyle = _tqBatataTimer <= 5 ? '#ff4757' : 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 6;
    ctx.fillText('🥔 ' + Math.max(0, Math.ceil(_tqBatataTimer)) + 's', _tqW / 2, _tqH * 0.08);
    ctx.restore();
  }
})();
