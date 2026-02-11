const esbuild = require("esbuild")

const files = [
  "extension/popup.tsx",
  "extension/background.ts",
  "extension/content/blocklist-guard.ts",
  "extension/content/webmail-scrapers.ts",
]

esbuild
  .build({
    entryPoints: files,
    bundle: true,
    outdir: "extension/dist",
    outbase: "extension",
    minify: true,
    sourcemap: true,
    target: ["chrome100"],
    loader: { ".tsx": "tsx", ".ts": "ts" },
    platform: "browser",
  })
  .catch(() => process.exit(1))
