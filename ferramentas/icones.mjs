/* ── Ícones só com o que o app usa ───────────────────────────────────
   Chamado pelo build.mjs (não precisa rodar à mão).

   Antes o index.html puxava do CDN o Tabler Icons inteiro (CSS de 204 KB
   + fonte de 447 KB, com mais de 5 mil ícones) e o Font Awesome inteiro
   (CSS de 100 KB + 3 fontes, ~300 KB), e o app usa poucas centenas. As
   duas folhas bloqueiam a primeira pintura, e no 4G fraco isso era a
   maior parte da espera para a tela aparecer.

   Agora o build lê o código do app, junta todo nome "ti-xxx" e "fa-xxx"
   que aparece escrito, e gera em /fonts/icones/:
     icones.css    só as regras desses ícones (+ as utilitárias do FA)
     tabler.woff2, fa-solid.woff2, fa-regular.woff2, fa-brands.woff2
                   fontes cortadas só com esses desenhos

   As fontes completas ficam em ferramentas/icones/ (de onde se corta).

   ⚠ Ícone montado por pedaços ('fa-' + nome, 'fa-star' + '-half-stroke')
   não aparece como nome inteiro no código: ponha o nome completo em
   EXTRAS abaixo, senão ele sai em branco. */

import subsetFont from "subset-font";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// Nomes que o código monta por pedaços (não aparecem inteiros).
const EXTRAS = [
  // app.js
  "fa-expand-alt", "fa-info-circle",        // fa-${isPago ? 'expand-alt' : 'info-circle'}
  "fa-check-circle", "fa-circle",           // fa-${on?'check-':''}circle
  "fa-check", "fa-hourglass-half",          // 'fa fa-' + (euPronto ? 'check' : 'hourglass-half')
  // Biblioteca/hub.js
  "fa-star", "fa-star-half-stroke",         // 'fa-star' + (meia ? '-half-stroke' : '')
  "fa-chevron-up", "fa-chevron-down",       // 'fa-chevron-' + (aberto ? 'up' : 'down')
  "fa-stop", "fa-play", "fa-pause",         // 'fa-' + (on ? 'stop' : 'play'), (tocando ? 'pause' : 'play')
];
// Onde o código monta nome de ícone por pedaços. O build avisa se aparecer
// um lugar novo, para conferir se o EXTRAS acima cobre os nomes dele.
const RE_PEDACO = /\b(?:fa|ti)-(?:[a-z0-9-]*['"`]\s*\+|\$\{)/g;
const PEDACOS_CONHECIDOS = 10;

const FONTE = "ferramentas/icones";
const SAIDA = "fonts/icones";
const IGNORAR = new Set(["node_modules", ".git", ".github", "Claude outputs",
  "ferramentas", "testes", "sfx-bruto", "test-results", "playwright-report", "icones"]);
const RE_NOME = /\b(?:fa|ti)-[a-z0-9]+(?:-[a-z0-9]+)*/g;
const RE_COD_CSS = /content\s*:\s*["']\\([0-9a-fA-F]{4,5})["']/g;

const hash8 = b => createHash("sha1").update(b).digest("hex").slice(0, 8);

function andar(raiz, dir, out) {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome) || nome.startsWith(".")) continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) andar(raiz, p, out);
    else if (/\.(js|html|css|json)$/.test(nome)) out.push(p);
  }
  return out;
}

// Divide um CSS minificado em regras do nível de cima, respeitando
// blocos aninhados (@media, @keyframes): [{ sel, corpo }].
function regras(css) {
  const out = [];
  let i = 0;
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  while (i < css.length) {
    const a = css.indexOf("{", i);
    if (a < 0) break;
    let d = 1, j = a + 1;
    while (j < css.length && d) { if (css[j] === "{") d++; else if (css[j] === "}") d--; j++; }
    out.push({ sel: css.slice(i, a).trim(), corpo: css.slice(a + 1, j - 1) });
    i = j;
  }
  return out;
}

// Regra de ícone: ".fa-x:before,.fa-y:before{content:"\f123"}".
function filtrarIcones(css, prefixo, usados, cods) {
  const RE_SEL = new RegExp(`^\\.(${prefixo}-[a-z0-9-]+)::?before$`);
  let out = "";
  for (const { sel, corpo } of regras(css)) {
    const m = corpo.match(/^content:\s*"\\([0-9a-fA-F]{4,5})"$/);
    const sels = sel.split(",").map(s => s.trim());
    if (m && sels.every(s => RE_SEL.test(s))) {
      const ficam = sels.filter(s => usados.has(s.match(RE_SEL)[1]));
      if (!ficam.length) continue;
      cods.add(parseInt(m[1], 16));
      out += `${ficam.join(",")}{${corpo}}`;
    } else {
      out += `${sel}{${corpo}}`;
    }
  }
  return out;
}

export async function gerarIcones(RAIZ) {
  const ler = p => readFileSync(join(RAIZ, p));
  const usados = new Set(EXTRAS);
  const codsCss = new Set(); // ícones do FA escritos direto no CSS (content:"\f001")
  const pedacos = [];
  for (const p of andar(RAIZ, RAIZ, [])) {
    const r = relative(RAIZ, p).split(sep).join("/");
    if (r.startsWith(SAIDA + "/")) continue;
    const txt = readFileSync(p, "utf8");
    for (const m of txt.matchAll(RE_NOME)) usados.add(m[0]);
    if (!/\.min\.js$|^app_min\.js$/.test(r)) {
      for (const m of txt.matchAll(RE_PEDACO)) {
        pedacos.push(`${r}:${txt.slice(0, m.index).split("\n").length}`);
      }
    }
    if (r.endsWith(".css")) for (const m of txt.matchAll(RE_COD_CSS)) codsCss.add(parseInt(m[1], 16));
  }

  // Tabler
  const codsTi = new Set();
  let cssTi = filtrarIcones(ler(`${FONTE}/tabler-3.44.0.min.css`).toString(), "ti", usados, codsTi);
  const woffTi = await subsetFont(ler(`${FONTE}/tabler-3.44.0.woff2`), String.fromCodePoint(...codsTi), { targetFormat: "woff2" });
  cssTi = cssTi.replace(/@font-face\{[^}]*\}/, () =>
    `@font-face{font-family:"tabler-icons";font-style:normal;font-weight:400;font-display:block;src:url(tabler.woff2?v=${hash8(woffTi)}) format("woff2")}`);

  // Font Awesome: solid e regular dividem a família "Font Awesome 6 Free".
  const codsFa = new Set(codsCss);
  let cssFa = filtrarIcones(ler(`${FONTE}/fa-6.5.0.min.css`).toString(), "fa", usados, codsFa);
  const texto = String.fromCodePoint(...codsFa);
  const woffFa = {};
  for (const [nome, arq] of [["solid", "solid-900"], ["regular", "regular-400"], ["brands", "brands-400"]]) {
    woffFa[nome] = await subsetFont(ler(`${FONTE}/fa-6.5.0-${arq}.woff2`), texto, { targetFormat: "woff2" });
  }
  cssFa = cssFa.replace(/@font-face\{[^}]*\}/g, bloco => {
    // As famílias de compatibilidade (FA 5 / FontAwesome 4) o app não usa.
    if (!/font-family:"Font Awesome 6 (Free|Brands)"/.test(bloco)) return "";
    const m = bloco.match(/fa-(solid|regular|brands)-\d+\.woff2/);
    return bloco.replace(/src:[^;}]+/, `src:url(fa-${m[1]}.woff2?v=${hash8(woffFa[m[1]])}) format("woff2")`);
  });

  const css = "/* Gerado por ferramentas/icones.mjs (npm run build). Não edite à mão.\n" +
    "   Font Awesome Free 6.5.0 (fontawesome.com/license/free) · Tabler Icons 3.44.0 (MIT) */\n" +
    cssFa + "\n" + cssTi + "\n";

  return {
    arquivos: [
      [`${SAIDA}/icones.css`, Buffer.from(css)],
      [`${SAIDA}/tabler.woff2`, woffTi],
      [`${SAIDA}/fa-solid.woff2`, woffFa.solid],
      [`${SAIDA}/fa-regular.woff2`, woffFa.regular],
      [`${SAIDA}/fa-brands.woff2`, woffFa.brands],
    ],
    resumo: `${codsFa.size} ícones Font Awesome, ${codsTi.size} Tabler`,
    aviso: pedacos.length !== PEDACOS_CONHECIDOS
      ? `Nome de ícone montado por pedaços em ${pedacos.length} lugares (eram ${PEDACOS_CONHECIDOS}): ` +
        `${pedacos.join(", ")}. Confira se os nomes estão no EXTRAS de ferramentas/icones.mjs ` +
        `e atualize PEDACOS_CONHECIDOS.`
      : "",
  };
}
