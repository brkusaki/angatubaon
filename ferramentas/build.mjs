#!/usr/bin/env node
/* ── Build do AngatubaON ─────────────────────────────────────────────
   npm run build         minifica, confere os globais e sobe o SW
   npm run build:checar  só confere, sem gravar nada (é o que o GitHub
                         Actions roda a cada push)

   O que faz, na ordem:
   1. Acha todo par "X.js" + "X.min.js" do repositório (mais o caso
      especial app.js -> app_min.js) e minifica com terser -c -m, as
      mesmas opções usadas até hoje (o resultado sai byte a byte igual).
   2. Compara os globais window.* do minificado novo com o antigo. Se
      algum SUMIU, para tudo e avisa (use --forcar se a remoção foi de
      propósito).
   3. Se algum .js/.css/.html mudou desde o último build, sobe a versão
      do CACHE em service-worker.js (angatubaon-vNNN -> vNNN+1).

   O estado do último build (hash de cada fonte + versão do SW) fica em
   ferramentas/build-estado.json, que vai pro repositório junto. */

import { minify } from "terser";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECAR = process.argv.includes("--checar");
const FORCAR = process.argv.includes("--forcar");
const ARQ_ESTADO = join(RAIZ, "ferramentas", "build-estado.json");
const ARQ_SW = join(RAIZ, "service-worker.js");
const RE_CACHE = /const CACHE = 'angatubaon-v(\d+)';/;

// Pastas que não são o app publicado (ou são material bruto).
const IGNORAR = new Set(["node_modules", ".git", ".github", "Claude outputs",
  "ferramentas", "testes", "sfx-bruto", "test-results", "playwright-report"]);

const rel = p => relative(RAIZ, p).split(sep).join("/");
// Normaliza CRLF -> LF: no Windows o git pode trocar o fim de linha, e o
// hash/comparação não pode depender disso.
const lf = s => s.replace(/\r\n/g, "\n");
const ler = p => lf(readFileSync(p, "utf8"));
const hash = s => createHash("sha1").update(s).digest("hex").slice(0, 16);

function andar(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome) || nome.startsWith(".")) continue;
    const p = join(dir, nome);
    const st = statSync(p);
    if (st.isDirectory()) andar(p, out);
    else out.push(p);
  }
  return out;
}

function globais(codigo) {
  const s = new Set();
  for (const m of codigo.matchAll(/window\.([\w$]+)\s*=(?!=)/g)) s.add(m[1]);
  for (const m of codigo.matchAll(/window\[["']([\w$]+)["']\]\s*=(?!=)/g)) s.add(m[1]);
  return s;
}

const arquivos = andar(RAIZ);

// 1. Pares fonte -> minificado
const pares = [];
for (const p of arquivos) {
  if (!p.endsWith(".js") || p.endsWith(".min.js")) continue;
  const min = p.slice(0, -3) + ".min.js";
  if (existsSync(min)) pares.push([p, min]);
}
const appJs = join(RAIZ, "app.js"), appMin = join(RAIZ, "app_min.js");
if (existsSync(appJs) && existsSync(appMin)) pares.push([appJs, appMin]);

let erros = 0;
const atualizados = [];

for (const [fonte, destino] of pares) {
  let novo;
  try {
    novo = (await minify(ler(fonte), { compress: {}, mangle: {} })).code;
  } catch (e) {
    console.error(`✖ ${rel(fonte)}: erro de sintaxe — ${e.message} (linha ${e.line}, coluna ${e.col})`);
    erros++;
    continue;
  }
  const antigo = ler(destino);
  if (novo === antigo) continue;

  const gAnt = globais(antigo), gNovo = globais(novo);
  const sumiram = [...gAnt].filter(g => !gNovo.has(g));
  const novos = [...gNovo].filter(g => !gAnt.has(g));
  if (sumiram.length && !FORCAR) {
    console.error(`✖ ${rel(destino)}: globais que SUMIRAM: ${sumiram.map(g => "window." + g).join(", ")}`);
    console.error(`  Se foi de propósito, rode de novo com --forcar.`);
    erros++;
    continue;
  }
  if (novos.length) console.log(`  ${rel(destino)}: globais novos: ${novos.map(g => "window." + g).join(", ")}`);
  if (sumiram.length) console.log(`  ${rel(destino)}: globais removidos (--forcar): ${sumiram.join(", ")}`);

  if (CHECAR) {
    console.error(`✖ ${rel(destino)} está desatualizado em relação a ${rel(fonte)} — rode "npm run build".`);
    erros++;
  } else {
    atualizados.push([destino, novo]);
  }
}

// 3. Versão do SW
const fontes = arquivos
  .filter(p => /\.(js|css|html)$/.test(p) && !p.endsWith(".min.js") && p !== appMin && p !== ARQ_SW)
  .sort();
const hashes = {};
for (const p of fontes) hashes[rel(p)] = hash(ler(p));

const sw = ler(ARQ_SW);
const mCache = sw.match(RE_CACHE);
if (!mCache) {
  console.error("✖ Não achei \"const CACHE = 'angatubaon-vNNN';\" em service-worker.js.");
  process.exit(1);
}
const versaoAtual = Number(mCache[1]);
let versaoNova = versaoAtual, motivoSW = "";
const estado = existsSync(ARQ_ESTADO) ? JSON.parse(readFileSync(ARQ_ESTADO, "utf8")) : null;

// Só conta arquivo novo ou alterado. Arquivo que está no estado mas não
// aqui é ignorado: no PC existem arquivos que não vão pro GitHub, e o
// GitHub Actions só enxerga o que foi publicado.
const mudaram = estado
  ? Object.keys(hashes).filter(k => estado.hashes[k] !== hashes[k])
  : [];

if (!estado) {
  console.log(`  Primeiro build: estado registrado com o SW em v${versaoAtual} (nada foi subido).`);
} else if (mudaram.length) {
  const lista = mudaram.slice(0, 8).join(", ") + (mudaram.length > 8 ? ` e mais ${mudaram.length - 8}` : "");
  if (CHECAR) {
    if (versaoAtual === estado.versaoSW) {
      console.error(`✖ Mudaram ${lista}, mas o CACHE do service-worker.js continua em v${versaoAtual} — rode "npm run build".`);
      erros++;
    } else {
      console.log(`  Fontes mudaram e o SW já foi para v${versaoAtual}; rode "npm run build" para atualizar o estado.`);
    }
  } else if (versaoAtual === estado.versaoSW) {
    versaoNova = versaoAtual + 1;
    motivoSW = lista;
  } else {
    console.log(`  SW já estava em v${versaoAtual} (subido à mão); mantido.`);
  }
}

if (erros) {
  console.error(`\n${erros} problema(s). Nenhum arquivo foi alterado.`);
  process.exit(1);
}

// Só grava depois que tudo passou: ou entra tudo, ou nada.
if (!CHECAR) {
  for (const [destino, novo] of atualizados) {
    writeFileSync(destino, novo);
    console.log(`✔ ${rel(destino)} regenerado`);
  }
  if (versaoNova !== versaoAtual) {
    const swOriginal = readFileSync(ARQ_SW, "utf8"); // preserva o fim de linha original
    writeFileSync(ARQ_SW, swOriginal.replace(RE_CACHE, `const CACHE = 'angatubaon-v${versaoNova}';`));
    console.log(`✔ service-worker.js: CACHE v${versaoAtual} -> v${versaoNova} (mudaram: ${motivoSW})`);
  }
  writeFileSync(ARQ_ESTADO, JSON.stringify({ versaoSW: versaoNova, hashes }, null, 1) + "\n");
  if (!atualizados.length && !mudaram.length && estado) console.log("✔ Tudo em dia, nada para fazer.");
} else {
  console.log("✔ Minificados em dia e versão do SW conferida.");
}
