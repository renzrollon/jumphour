# Project memory

## Common Failure Modes

- [jsdom test files require fileURLToPath(import.meta.url), not new URL(..., import.meta.url)](failure-modes/jsdom-url-fileurltopath.md) — jsdom's global URL is rejected by node:url; applies to helpers imported by jsdom tests

## Module Coupling
- [tokens.css token additions always require updating tokens.test.ts JUMPHOUR_TOKENS and contrast.test.ts FLOORS](coupling/tokens-css-token-lists.md) — new tokens go in JUMPHOUR_TOKENS; new pairs shift the exact-list negative case; literal colors fail the guard
