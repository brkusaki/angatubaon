// Liga os conectores Chrome DevTools MCP e Blender MCP no app do Claude.
// Feche o app do Claude (inclusive o ícone perto do relógio) e rode:
//   node ferramentas\conectores.mjs
// Faz backup do arquivo antes e não mexe em mais nada da configuração.
import { existsSync, readdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { join } from "node:path";

const { APPDATA = "", LOCALAPPDATA = "" } = process.env;
const candidatos = [join(APPDATA, "Claude", "claude_desktop_config.json")];
for (const base of [join(LOCALAPPDATA, "Claude-Data"), join(LOCALAPPDATA, "Packages")]) {
  if (!existsSync(base)) continue;
  for (const d of readdirSync(base)) {
    candidatos.push(join(base, d, "claude_desktop_config.json"));
    candidatos.push(join(base, d, "LocalCache", "Roaming", "Claude", "claude_desktop_config.json"));
  }
}
const achados = candidatos.filter(p => existsSync(p))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
if (!achados.length) {
  console.error("Não achei o claude_desktop_config.json. Abra o app do Claude > Configurações > Desenvolvedor > Editar configuração e rode de novo.");
  process.exit(1);
}

const arq = achados[0];
const cfg = JSON.parse(readFileSync(arq, "utf8").replace(/^﻿/, ""));
cfg.mcpServers ??= {};
const novos = {
  "chrome-devtools": { command: "cmd", args: ["/c", "npx", "-y", "chrome-devtools-mcp@latest"] },
  "blender": { command: "uvx", args: ["blender-mcp"] }
};
const adicionados = [];
for (const [nome, def] of Object.entries(novos)) {
  if (!cfg.mcpServers[nome]) { cfg.mcpServers[nome] = def; adicionados.push(nome); }
}
if (!adicionados.length) {
  console.log(`Os dois conectores já estavam em ${arq}.`);
  process.exit(0);
}
copyFileSync(arq, arq + ".bak");
writeFileSync(arq, JSON.stringify(cfg, null, 2));
console.log(`Arquivo: ${arq}`);
console.log(`Backup:  ${arq}.bak`);
console.log(`Adicionados: ${adicionados.join(", ")}. Abra o app do Claude de novo.`);
