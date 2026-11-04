/* ESLint do AngatubaON — roda com "npm run lint" e no GitHub Actions.

   Os scripts do app não são módulos: o que um arquivo declara no topo
   (function x / const x / let x / var x / class x na coluna 0) ou pendura
   em window.x vira global pros outros. Sem bundler, o jeito do ESLint
   saber disso é ler essas declarações de todos os arquivos e tratá-las
   como globais do projeto.

   "no-undef" fica como aviso (não falha o build): o app chama muita
   coisa de forma protegida (typeof x === 'function' && x()), que é
   válido. As outras regras pegam bug de verdade e falham o build. */

import globals from "globals";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const IGNORAR = new Set(["node_modules", ".git", ".github", "Claude outputs",
  "ferramentas", "testes", "sfx-bruto", "test-results", "playwright-report"]);

function andar(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome) || nome.startsWith(".")) continue;
    const p = dir === "." ? nome : join(dir, nome).split("\\").join("/");
    if (statSync(p).isDirectory()) andar(p, out);
    else if (p.endsWith(".js") && !p.endsWith(".min.js") && p !== "app_min.js"
      && p !== "service-worker.js") out.push(p);
  }
  return out;
}

const arquivosApp = andar(".");
const doProjeto = {};
const reTopo = /^(?:async\s+)?(?:function\*?\s+([\w$]+)|(?:const|let|var|class)\s+([\w$]+))/gm;
for (const f of arquivosApp) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(reTopo)) doProjeto[m[1] || m[2]] = "writable";
  for (const m of src.matchAll(/window\.([\w$]+)\s*=(?!=)/g)) doProjeto[m[1]] = "writable";
}

const regras = {
  "no-undef": "warn",
  "no-dupe-keys": "error",
  "no-duplicate-case": "error",
  "no-unreachable": "error",
  "no-const-assign": "error",
  "no-dupe-else-if": "error",
  "no-self-assign": "error",
  "no-unsafe-finally": "error",
  "no-func-assign": "error",
  "use-isnan": "error",
  "valid-typeof": "error"
};

export default [
  {
    ignores: ["**/*.min.js", "app_min.js", "node_modules/**", "Claude outputs/**",
      "ferramentas/**", "testes/**", "sfx-bruto/**", "test-results/**",
      "playwright-report/**", "*.config.mjs"]
  },
  {
    files: arquivosApp,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.browser, ...doProjeto, firebase: "readonly", QRCode: "readonly" }
    },
    rules: regras
  },
  {
    files: ["service-worker.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.serviceworker, firebase: "readonly" }
    },
    rules: regras
  }
];
