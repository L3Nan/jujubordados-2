import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "35fefc248ad6890262eab694bfbd2250",
  worker: defineWorker({
    name: "jujubordados-2",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-16",
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ name: "jujubordados-production" }),
    },
  }),
});
