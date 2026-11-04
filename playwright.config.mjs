// Testes de fumaça do AngatubaON: "npm run testar".
// Sobe o site local na porta 4173 e abre num celular simulado.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "testes",
  timeout: 30_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: [{ name: "celular", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npx http-server -p 4173 -c-1 -s .",
    url: "http://localhost:4173",
    reuseExistingServer: true
  }
});
