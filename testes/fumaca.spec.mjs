// Testes de fumaça: pegam o tipo de quebra que derruba o app inteiro
// (erro de JS na carga, service worker que não registra, arquivo
// essencial faltando). Rodar antes de publicar: "npm run testar".
import { test, expect } from "@playwright/test";

test("a home carrega sem erro de JavaScript", async ({ page }) => {
  const erros = [];
  page.on("pageerror", e => erros.push(e.message));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveTitle(/angatuba/i);
  expect(erros, "erros de JS na carga:\n" + erros.join("\n")).toEqual([]);
});

test("o service worker registra e ativa", async ({ page }) => {
  await page.goto("/");
  const ativo = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(r => setTimeout(() => r(null), 15000))
    ]);
    return !!(reg && reg.active);
  });
  expect(ativo).toBe(true);
});

for (const arquivo of ["/manifest.json", "/offline.html", "/app_min.js", "/styles.css", "/service-worker.js"]) {
  test(`${arquivo} responde`, async ({ request }) => {
    const r = await request.get(arquivo);
    expect(r.status()).toBe(200);
  });
}
