/* Caça Folclore — módulo do hub.
   O jogo é um HTML único em /Jogos/caca-folclore/index.html (canvas, pixel art).
   Aqui só montamos um iframe dentro de #cacafolclore-root e o destruímos ao sair,
   para o loop do jogo parar de verdade. Contrato do hub: { preparar, parar }. */
(function () {
  'use strict';
  var URL_JOGO = '/Jogos/caca-folclore/index.html';
  var quadro = null;

  function raiz() { return document.getElementById('cacafolclore-root'); }

  window.CacaFolcloreGame = {
    preparar: function () {
      var r = raiz();
      if (!r) return;
      if (quadro && quadro.parentNode === r) return;
      r.innerHTML = '';
      quadro = document.createElement('iframe');
      quadro.className = 'cf-quadro';
      quadro.title = 'Caça Folclore';
      quadro.setAttribute('allow', 'fullscreen');
      quadro.src = URL_JOGO;
      r.appendChild(quadro);
    },
    parar: function () {
      var r = raiz();
      if (quadro) { try { quadro.src = 'about:blank'; } catch (e) {} }
      quadro = null;
      if (r) r.innerHTML = '';
    }
  };
})();
