---
title: jsdom test files require fileURLToPath(import.meta.url), not new URL(..., import.meta.url)
date: 2026-09-23
change: design-system-and-app-shell
tags: [vitest, jsdom, paths]
---
Under `// @vitest-environment jsdom` the global `URL` is jsdom's, so `fileURLToPath(new URL(".", import.meta.url))` throws "The URL must be of scheme file" — including inside any helper the test imports (e.g. `src/source-scan.testing.ts`); derive paths with `dirname(fileURLToPath(import.meta.url))` instead.
