# Version Upgrade Plan

**Created:** 2025-12-13
**Status:** Complete
**Completed:** 2025-12-13
**Goal:** Align package.json with CLAUDE.md tech stack targets

---

## Summary

This plan upgrades all dependencies to match the project constitution's tech stack requirements. The codebase is in early development (phase 1 of 4), making this the optimal time for major version upgrades.

---

## Target Versions

### Engine Requirements

```json
{
  "engines": {
    "node": ">=20.11.0",
    "bun": ">=1.0.0"
  }
}
```

**Rationale:** ESLint 9.39.x requires >=20.9.0, OpenTelemetry 2.x requires >=20.6.0, typescript-eslint 8.49.x requires >=20.11.0. Node 20.11.0 is within Node 20 LTS (maintained until April 2026).

**Note:** Later upgraded to `>=24.0.0` and `>=1.3.4` respectively - see `docs/specs/version-upgrade-node-bun.md`.

### Production Dependencies

| Package | Current | Target | Notes |
|---------|---------|--------|-------|
| react | ^19.0.0 | ^19.2.3 | Minor bump |
| ink | ^6.0.0 | ^6.5.1 | Minor bump |
| zod | ^3.24.0 | ^4.1.13 | **Major upgrade** - per CLAUDE.md |
| @langchain/core | ^0.3.0 | ^1.1.5 | **Major upgrade** - per CLAUDE.md |
| @langchain/openai | ^0.3.0 | ^1.2.0 | **Major upgrade** - per CLAUDE.md |
| @opentelemetry/api | ^1.9.0 | ^1.9.0 | No change |
| @opentelemetry/sdk-trace-base | ^1.30.0 | ^2.2.0 | **Major upgrade** - per CLAUDE.md |
| @opentelemetry/resources | ^1.30.0 | ^2.2.0 | **Major upgrade** |
| @opentelemetry/exporter-trace-otlp-http | ^0.57.0 | ^0.208.0 | **Major upgrade** |
| @opentelemetry/semantic-conventions | ^1.28.0 | ^1.38.0 | Minor bump |
| dotenv | ^16.4.0 | ^17.2.3 | Major bump, low risk |
| meow | ^13.2.0 | ^14.0.0 | Major bump, low risk |
| p-queue | ^8.0.0 | ^9.0.1 | Major bump, low risk |

### Development Dependencies

| Package | Current | Target | Notes |
|---------|---------|--------|-------|
| @eslint/js | ^9.0.0 | ^9.39.2 | Minor bump |
| @jest/globals | ^29.7.0 | ^30.2.0 | **Major upgrade** - per CLAUDE.md |
| @types/jest | ^29.5.0 | ^30.0.0 | **Major upgrade** - aligns with Jest 30 |
| @types/node | ^22.0.0 | ^22.0.0 | No change - provides latest Node types |
| @types/react | ^19.0.0 | ^19.2.7 | Minor bump |
| eslint | ^9.0.0 | ^9.39.2 | Minor bump |
| eslint-plugin-react | ^7.37.0 | ^7.37.5 | Patch bump |
| eslint-plugin-react-hooks | ^5.0.0 | ^5.2.0 | Minor bump |
| husky | ^9.1.7 | ^9.1.7 | No change |
| ink-testing-library | ^4.0.0 | ^4.0.0 | No change |
| jest | ^29.7.0 | ^30.2.0 | **Major upgrade** - per CLAUDE.md |
| lint-staged | ^16.2.7 | ^16.2.7 | No change |
| prettier | ^3.4.0 | ^3.7.4 | Minor bump |
| react-devtools-core | ^5.3.2 | ^6.1.5 | Major bump - required by Ink 6.5.1 peer |
| ts-jest | ^29.2.0 | ^29.4.6 | Minor bump - supports Jest 29 and 30 |
| typescript | ^5.7.0 | ^5.9.3 | Minor bump |
| typescript-eslint | ^8.0.0 | ^8.49.0 | Minor bump |

---

## Not Upgrading

| Package | Current | Latest | Reason |
|---------|---------|--------|--------|
| eslint-plugin-react-hooks | ^5.2.0 | 7.0.1 | Skipped v6.x entirely; stability unclear. Staying on 5.2.0. |

---

## Migration Notes

### Zod 3.x → 4.x

Zod 4 is a complete rewrite with API changes:
- Review: https://zod.dev/v4/changelog
- Update all schema definitions to new API
- Test all validation paths

### LangChain 0.3.x → 1.x

LangChain 1.0 redesigned for agent patterns:
- Review: https://github.com/langchain-ai/langchainjs/releases
- Standardized content blocks
- Updated model instantiation patterns
- All @langchain/* packages must align on same core version

### OpenTelemetry 1.x → 2.x

SDK 2.x has configuration changes:
- Review: https://github.com/open-telemetry/opentelemetry-js/blob/main/MIGRATION.md
- Update all OTel packages together
- API package stays at 1.9.0 (stable)

### Jest 29.x → 30.x

Jest 30 has new features and config changes:
- Review: https://github.com/jestjs/jest/releases
- ts-jest 29.4.6 supports both Jest 29 and 30
- Update @types/jest to 30.x
- Update @jest/globals to 30.x

---

## Final package.json Targets

```json
{
  "engines": {
    "node": ">=24.0.0",
    "bun": ">=1.3.4"
  },
  "dependencies": {
    "react": "^19.2.3",
    "ink": "^6.5.1",
    "zod": "^4.1.13",
    "@langchain/core": "^1.1.5",
    "@langchain/openai": "^1.2.0",
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/sdk-trace-base": "^2.2.0",
    "@opentelemetry/resources": "^2.2.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.208.0",
    "@opentelemetry/semantic-conventions": "^1.38.0",
    "dotenv": "^17.2.3",
    "meow": "^14.0.0",
    "p-queue": "^9.0.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.2",
    "@jest/globals": "^30.2.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.2.7",
    "eslint": "^9.39.2",
    "eslint-plugin-react": "^7.37.5",
    "eslint-plugin-react-hooks": "^5.2.0",
    "husky": "^9.1.7",
    "ink-testing-library": "^4.0.0",
    "jest": "^30.2.0",
    "lint-staged": "^16.2.7",
    "prettier": "^3.7.4",
    "react-devtools-core": "^6.1.5",
    "ts-jest": "^29.4.6",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.49.0"
  }
}
```

---

## Implementation Order

The upgrades should be done in this order to manage risk:

### Step 1: Foundation (Single Commit)

Update engine and tooling that everything else depends on:
- Bump `engines.node` (later upgraded to `>=24.0.0` - see version-upgrade-node-bun)
- Update TypeScript, ESLint, Prettier, typescript-eslint
- Update React, Ink, react-devtools-core
- Run validation

### Step 2: Testing Infrastructure (Single Commit)

Update Jest ecosystem:
- Update jest to ^30.2.0
- Update @jest/globals to ^30.2.0
- Update @types/jest to ^30.0.0
- Fix any test configuration issues
- Run validation

### Step 3: Schema Validation (Single Commit)

Migrate Zod:
- Update zod to ^4.1.13
- Update all schema definitions to Zod 4 API
- Run validation

### Step 4: LLM Integration (Single Commit)

Migrate LangChain:
- Update @langchain/core to ^1.1.5
- Update @langchain/openai to ^1.2.0
- Update model instantiation code
- Run validation

### Step 5: Observability (Single Commit)

Migrate OpenTelemetry:
- Update @opentelemetry/sdk-trace-base to ^2.2.0
- Update @opentelemetry/resources to ^2.2.0
- Update @opentelemetry/exporter-trace-otlp-http to ^0.208.0
- Update @opentelemetry/semantic-conventions to ^1.38.0
- Update telemetry configuration code
- Run validation

### Step 6: Utilities (Single Commit)

Update remaining packages:
- Update dotenv to ^17.2.3
- Update meow to ^14.0.0
- Update p-queue to ^9.0.1
- Run validation

---

## Validation Checklist

After each step:

- [x] Verify local Node version is >=24.0.0 (`node --version`) (upgraded from 20.11.0)
- [x] `bun install` completes without errors or peer dependency warnings
- [x] `bun run typecheck` passes
- [x] `bun run lint` passes
- [x] `bun run test` passes (478 tests)
- [x] `bun run build` succeeds

After all steps:

- [x] Application starts correctly
- [ ] LLM provider connections work (requires API key testing)
- [ ] Telemetry exports correctly (requires OTLP endpoint testing)

**Test Coverage Results:**
- Statements: 94.96%
- Branches: 86.63%
- Functions: 97.74%
- Lines: 95.12%

---

## Documentation & Resources

### React + Ink

| Resource | URL |
|----------|-----|
| React Documentation | https://react.dev/ |
| React 19 Upgrade Guide | https://react.dev/blog/2024/04/25/react-19-upgrade-guide |
| React GitHub Releases | https://github.com/facebook/react/releases |
| Ink Documentation | https://github.com/vadimdemedes/ink#readme |
| Ink GitHub | https://github.com/vadimdemedes/ink |

### LangChain.js

| Resource | URL |
|----------|-----|
| LangChain.js Documentation | https://js.langchain.com/docs/ |
| LangChain.js API Reference | https://api.js.langchain.com/ |
| LangChain 1.0 Announcement | https://blog.langchain.com/langchain-langgraph-1dot0/ |
| LangChain.js GitHub | https://github.com/langchain-ai/langchainjs |
| LangChain.js Releases | https://github.com/langchain-ai/langchainjs/releases |

### OpenTelemetry

| Resource | URL |
|----------|-----|
| OpenTelemetry JS Documentation | https://opentelemetry.io/docs/languages/js/ |
| OpenTelemetry JS Getting Started | https://opentelemetry.io/docs/languages/js/getting-started/nodejs/ |
| OpenTelemetry JS GitHub | https://github.com/open-telemetry/opentelemetry-js |
| SDK Migration Guide (1.x to 2.x) | https://github.com/open-telemetry/opentelemetry-js/blob/main/MIGRATION.md |

### Zod

| Resource | URL |
|----------|-----|
| Zod Documentation | https://zod.dev/ |
| Zod 4 Changelog | https://zod.dev/v4/changelog |
| Zod GitHub | https://github.com/colinhacks/zod |

### Jest

| Resource | URL |
|----------|-----|
| Jest Documentation | https://jestjs.io/docs/getting-started |
| Jest GitHub Releases | https://github.com/jestjs/jest/releases |
| ts-jest Documentation | https://kulshekhar.github.io/ts-jest/ |

### TypeScript + ESLint

| Resource | URL |
|----------|-----|
| TypeScript Documentation | https://www.typescriptlang.org/docs/ |
| TypeScript Releases | https://github.com/microsoft/TypeScript/releases |
| ESLint Documentation | https://eslint.org/docs/latest/ |
| typescript-eslint Documentation | https://typescript-eslint.io/ |

### Utility Libraries

| Library | Documentation |
|---------|---------------|
| dotenv | https://github.com/motdotla/dotenv#readme |
| meow | https://github.com/sindresorhus/meow#readme |
| p-queue | https://github.com/sindresorhus/p-queue#readme |

### Package Tools

| Resource | URL |
|----------|-----|
| npm Registry | https://www.npmjs.com/ |
| Bundlephobia (bundle size) | https://bundlephobia.com/ |
| Socket.dev (security) | https://socket.dev/ |
