---
title: tokens.css token additions always require updating tokens.test.ts JUMPHOUR_TOKENS and contrast.test.ts FLOORS
date: 2026-09-24
change: fix-control-state-contrast
tags: [tokens, contrast, tests, coupling]
---
A new token in tokens.css fails tokens.test.ts until it is added to JUMPHOUR_TOKENS (never PROTOTYPE_TOKENS) in all three blocks; any new FLOORS pair also shifts the exact-list negative case in contrast.test.ts, and a literal color in any component .css now fails the literal-color guard.
