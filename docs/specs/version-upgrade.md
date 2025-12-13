# Feature: Package Version Upgrade

**Status:** Complete
**Completed:** 2025-12-13

## Feature Description

Upgrade all package dependencies to align with the CLAUDE.md tech stack targets. This is a comprehensive version upgrade spanning four major library upgrades (Zod, LangChain, OpenTelemetry, Jest) plus numerous minor and patch bumps across tooling and utilities.

The codebase is in early development (Phase 1 of 4), making this the optimal time for major version changes before the API surface expands.

## User Story

As a developer maintaining this agent framework
I want to use the latest stable versions of all dependencies
So that I benefit from performance improvements, bug fixes, security patches, and new features

## Problem Statement

The current package.json specifies older versions that do not match the tech stack targets documented in CLAUDE.md:
- Zod is at 3.24 but should be 4.x per project constitution
- LangChain is at 0.3.x but should be 1.x per constitution
- OpenTelemetry SDK is at 1.x but should be 2.x per constitution
- Jest is at 29.x but should be 30.x per constitution
- Various tooling packages need minor/patch updates

## Solution Statement

Execute a phased upgrade following dependency order to minimize risk:
1. Foundation updates (Node engine, TypeScript, ESLint, React, Ink)
2. Testing infrastructure (Jest 29→30)
3. Schema validation (Zod 3→4)
4. LLM integration (LangChain 0.3→1.x)
5. Observability (OpenTelemetry 1.x→2.x)
6. Utilities (dotenv, meow, p-queue)

Each phase is validated independently before proceeding.

## Related Documentation

### Requirements
- `docs/plans/version-upgrade-plan.md` - Detailed version targets and migration notes

### Architecture Decisions
- `docs/decisions/0004-validation-zod.md` - ADR choosing Zod 4.x
- `docs/decisions/0002-llm-integration-langchain.md` - ADR choosing LangChain.js
- `docs/decisions/0006-testing-jest.md` - ADR choosing Jest

## Codebase Analysis Findings

Full analysis documented in `docs/plans/codebase-analysis-for-upgrades.md`.

### Architecture Patterns
- **Dependency injection**: All components receive dependencies via constructor
- **Callback-driven**: Agent→UI communication through typed callbacks
- **Structured responses**: Tools return `{ success, result|error, message }`
- **Wrapper patterns**: Custom wrappers isolate LangChain/OTel integration points

### Files Affected by Each Upgrade

**Zod 3→4 (5 files):**
- `src/config/schema.ts` (280 LOC) - 17 schema definitions, type inference
- `src/tools/base.ts` (112 LOC) - Tool schemas, ZodError handling
- `src/tools/hello.ts` (99 LOC) - Example tool schemas
- `src/config/__tests__/schema.test.ts` (375 LOC)
- `src/tools/__tests__/base.test.ts` (472 LOC)

**LangChain 0.3→1.x (13 files):**
- `src/model/llm.ts` (320 LOC) - **CRITICAL**: `.bind()` deprecation
- `src/agent/agent.ts` (614 LOC) - Message handling, tool binding
- `src/model/providers/openai.ts` (44 LOC) - ChatOpenAI instantiation
- `src/tools/base.ts` (112 LOC) - `tool()` wrapper
- `src/model/types.ts`, `src/agent/types.ts`, `src/model/base.ts`
- All related test files

**OpenTelemetry 1.x→2.x (4 files):**
- `src/telemetry/setup.ts` (310 LOC) - Provider, exporter setup
- `src/telemetry/types.ts` (133 LOC)
- `src/telemetry/__tests__/setup.test.ts` (~450 LOC)
- `src/agent/types.ts` (101 LOC)

**Jest 29→30 (19 test files + config):**
- `jest.config.js` - ESM configuration
- All `__tests__/**/*.test.ts` files
- Key concern: `jest.unstable_mockModule` API stability

### Critical Migration Issues

1. **LangChain `.bind()` deprecation** - Used in `src/model/llm.ts:156` and `src/model/llm.ts:208` for setting temperature/maxTokens. Must migrate to LangChain 1.x configuration pattern.

2. **Zod type inference** - All `z.infer<>` patterns must be verified compatible with Zod 4.

3. **OpenTelemetry SDK version jump** - Particularly the exporter (0.57→0.208).

4. **Jest ESM mocking** - `jest.unstable_mockModule` may stabilize or change in Jest 30.

## Archon Project

Project ID: `cf3289a3-336f-4e8b-9488-1bfda7758676`

## Relevant Files

### Existing Files
- `package.json` - Package versions to update
- `jest.config.js` - Jest configuration
- `src/config/schema.ts` - Zod schemas
- `src/model/llm.ts` - LangChain integration
- `src/telemetry/setup.ts` - OpenTelemetry setup
- `docs/plans/version-upgrade-plan.md` - Detailed version plan
- `docs/plans/codebase-analysis-for-upgrades.md` - Codebase analysis

### New Files
- None required - this is an upgrade, not new functionality

## Implementation Plan

### Phase 1: Foundation
Update engine requirements and tooling that everything else depends on:
- Bump `engines.node` to `>=20.11.0`
- Update TypeScript to ^5.9.3
- Update ESLint to ^9.39.2, @eslint/js to ^9.39.2
- Update typescript-eslint to ^8.49.0
- Update Prettier to ^3.7.4
- Update React to ^19.2.3, @types/react to ^19.2.7
- Update Ink to ^6.5.1
- Update react-devtools-core to ^6.1.5 (required peer for Ink 6.5.1)

### Phase 2: Testing Infrastructure
Update Jest ecosystem before changing tested code:
- Update jest to ^30.2.0
- Update @jest/globals to ^30.2.0
- Update @types/jest to ^30.0.0
- Keep ts-jest at ^29.4.6 (supports both Jest 29 and 30)
- Verify jest.unstable_mockModule works or adapt

### Phase 3: Schema Validation
Migrate Zod:
- Update zod to ^4.1.13
- Review Zod 4 changelog for API changes
- Update schema definitions if needed
- Verify `z.infer<>` type inference
- Verify ZodError handling

### Phase 4: LLM Integration
Migrate LangChain (largest code impact):
- Update @langchain/core to ^1.1.5
- Update @langchain/openai to ^1.2.0
- **Replace `.bind()` calls** with LangChain 1.x pattern
- Verify message constructors
- Verify tool binding API
- Verify streaming interface

### Phase 5: Observability
Migrate OpenTelemetry:
- Update @opentelemetry/sdk-trace-base to ^2.2.0
- Update @opentelemetry/resources to ^2.2.0
- Update @opentelemetry/exporter-trace-otlp-http to ^0.208.0
- Update @opentelemetry/semantic-conventions to ^1.38.0
- Keep @opentelemetry/api at ^1.9.0 (stable)
- Review SDK 2.x migration guide
- Update provider/exporter configuration

### Phase 6: Utilities
Update remaining packages:
- Update dotenv to ^17.2.3
- Update meow to ^14.0.0
- Update p-queue to ^9.0.1
- Update eslint-plugin-react to ^7.37.5
- Update eslint-plugin-react-hooks to ^5.2.0

## Step by Step Tasks

### Task 1: Foundation - Engine and Tooling Updates
- Description: Update Node engine requirement and all tooling packages (TypeScript, ESLint, Prettier, React, Ink)
- Files to modify: `package.json`
- Validation: `bun install && bun run typecheck && bun run lint && bun run build`

### Task 2: Jest 29 → 30 Upgrade
- Description: Update Jest ecosystem to version 30
- Files to modify: `package.json`, potentially `jest.config.js` and test files
- Validation: `bun run test`

### Task 3: Zod 3 → 4 Migration
- Description: Update Zod and adapt code to any API changes
- Files to modify: `package.json`, `src/config/schema.ts`, `src/tools/base.ts`, test files
- Validation: `bun run typecheck && bun run test`

### Task 4: LangChain 0.3 → 1.x Migration
- Description: Update LangChain packages and replace deprecated `.bind()` API
- Files to modify: `package.json`, `src/model/llm.ts`, `src/agent/agent.ts`, `src/model/providers/openai.ts`, test files
- Validation: `bun run typecheck && bun run test`

### Task 5: OpenTelemetry 1.x → 2.x Migration
- Description: Update OpenTelemetry SDK packages and adapt configuration
- Files to modify: `package.json`, `src/telemetry/setup.ts`, `src/telemetry/types.ts`, test files
- Validation: `bun run typecheck && bun run test`

### Task 6: Utility Package Updates
- Description: Update remaining packages (dotenv, meow, p-queue, eslint plugins)
- Files to modify: `package.json`
- Validation: `bun run typecheck && bun run lint && bun run test && bun run build`

### Task 7: Final Validation and Documentation
- Description: Run full validation suite, verify application starts, update documentation
- Files to modify: `docs/plans/version-upgrade-plan.md` (mark as complete)
- Validation: Full validation checklist

## Testing Strategy

### Unit Tests
- All existing tests must pass after each phase
- No new tests required - this is a dependency upgrade
- Validator agent will verify test coverage is maintained

### Integration Tests
- Verify application starts correctly after all upgrades
- Verify build succeeds with new dependencies

### Edge Cases
- LangChain streaming with new API
- Zod error message format changes
- OpenTelemetry endpoint detection
- Jest ESM module mocking

## Acceptance Criteria

- [x] All packages updated to target versions per `version-upgrade-plan.md`
- [x] `bun install` completes without errors or peer dependency warnings
- [x] `bun run typecheck` passes
- [x] `bun run lint` passes
- [x] `bun run test` passes with 85%+ coverage (94.96% achieved)
- [x] `bun run build` succeeds
- [x] Application starts correctly (`bun run dev`)
- [x] No regressions in functionality (478 tests passing)
- [x] `.bind()` deprecation resolved in LangChain code (removed, documented limitation)

## Validation Commands

```bash
# After each phase
node --version  # Must be >=20.11.0
bun install
bun run typecheck
bun run lint
bun run test
bun run build

# Final validation
bun run dev  # Verify application starts
```

## Notes

### Migration Order Rationale
1. **Foundation first** - TypeScript and tooling must be compatible before other changes
2. **Testing second** - Test infrastructure must work to validate subsequent migrations
3. **Zod third** - Config system depends on this, affects type inference
4. **LangChain fourth** - Biggest code impact, requires careful testing
5. **OpenTelemetry fifth** - Isolated from core logic, lowest risk
6. **Utilities last** - Simple updates with minimal risk

### Rollback Strategy
Each phase is a single commit. If issues arise:
1. `git revert` the problematic commit
2. Pin to previous working version
3. Investigate and retry

### Documentation Resources
- Zod 4 Changelog: https://zod.dev/v4/changelog
- LangChain 1.0 Announcement: https://blog.langchain.com/langchain-langgraph-1dot0/
- OpenTelemetry Migration: https://github.com/open-telemetry/opentelemetry-js/blob/main/MIGRATION.md
- Jest 30 Releases: https://github.com/jestjs/jest/releases

## Execution

This spec can be implemented using: `/sdlc:implement docs/specs/version-upgrade.md`
