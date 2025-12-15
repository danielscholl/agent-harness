# Feature 24: Implement Local (Docker Model Runner) Provider

## Feature Description

Add local inference capability via Docker Desktop's Model Runner, which exposes an OpenAI-compatible API at `http://model-runner.docker.internal/`. This provider enables users to run LLM inference locally without requiring API keys or external network access, leveraging models running in Docker Desktop's built-in Model Runner feature.

The implementation reuses LangChain's `ChatOpenAI` class with a custom base URL, following the same pattern as the existing OpenAI provider but configured for local inference.

## User Story

As a developer using the agent framework,
I want to use Docker Desktop's Model Runner for local LLM inference,
So that I can run the agent without external API dependencies, reduce costs, and work offline.

## Problem Statement

Currently, the agent framework requires external LLM providers (OpenAI, Anthropic, Azure, etc.) which:
- Require API keys and paid subscriptions
- Depend on network connectivity
- May raise data privacy concerns for sensitive workloads
- Incur costs per token

Docker Desktop's Model Runner provides a local alternative that is free, private, and works offline.

## Solution Statement

Implement a `local` provider that:
1. Uses LangChain's `ChatOpenAI` class with a custom base URL
2. Defaults to Docker Model Runner's endpoint (`http://model-runner.docker.internal/`)
3. Supports configurable base URL for alternative local servers (Ollama, LM Studio, etc.)
4. Requires no API key authentication
5. Supports streaming out of the box via LangChain

## Related Documentation

### Requirements
- None in docs/design/ (first local provider implementation)

### Architecture Decisions
- ADR-0002: LLM Integration with LangChain.js - establishes pattern for provider factories

### Feature List Reference
- `docs/plans/typescript-rewrite-features.md` lines 160-161

## Codebase Analysis Findings

### Architecture Patterns
- **Provider Factory Pattern**: Each provider exports a `create[Provider]Client` function
- **Registry Pattern**: Providers registered in `PROVIDER_REGISTRY` map
- **Response Contract**: All factories return `ModelResponse<BaseChatModel>`
- **Error Mapping**: Use `mapErrorToCode()` from base utilities

### Naming Conventions
- Provider files: `src/model/providers/[name].ts`
- Test files: `src/model/__tests__/[name].test.ts`
- Factory functions: `create[Name]Client`
- Config schemas: `[Name]ProviderConfigSchema`
- Constants: `DEFAULT_[NAME]_[FIELD]`

### Similar Implementations
- **OpenAI Provider** (`src/model/providers/openai.ts`): Direct template - uses `ChatOpenAI` with optional `baseUrl`
- **Anthropic Provider** (`src/model/providers/anthropic.ts`): Simple factory pattern
- **Azure Provider** (`src/model/providers/azure-openai.ts`): Shows validation pattern

### Integration Patterns
- Provider registered in `src/model/registry.ts`
- Config schema already exists in `src/config/schema.ts` (LocalProviderConfigSchema)
- Constants already exist in `src/config/constants.ts` (need update for Docker Model Runner)

### Testing Approach
- Mock `@langchain/openai` with `jest.unstable_mockModule`
- Test default values, custom configs, error handling
- Use type guards for narrowing `ModelResponse`

## Archon Project

Project ID: `4b4a5d48-5c9d-4e8c-8f1d-f25dced8fbe4`

## Relevant Files

### Existing Files to Modify
- `src/config/constants.ts`: Update `DEFAULT_LOCAL_BASE_URL` and `DEFAULT_LOCAL_MODEL` for Docker Model Runner
- `src/model/registry.ts`: Add import and register `local` provider

### New Files to Create
- `src/model/providers/local.ts`: Local provider factory implementation
- `src/model/__tests__/local.test.ts`: Unit tests for local provider

### Reference Files (Read Only)
- `src/model/providers/openai.ts`: Template for implementation
- `src/model/base.ts`: Response factories and error mapping
- `src/model/types.ts`: Type definitions
- `src/config/schema.ts`: LocalProviderConfigSchema (already exists)
- `src/model/__tests__/openai.test.ts`: Test pattern template

## Implementation Plan

### Phase 1: Foundation
Update configuration constants to target Docker Model Runner instead of Ollama defaults.

### Phase 2: Core Implementation
Create the local provider factory following the OpenAI provider pattern, using `ChatOpenAI` with custom base URL.

### Phase 3: Integration
Register the provider in the registry and create comprehensive unit tests.

## Step by Step Tasks

### Task 1: Update Default Constants
- **Description**: Change default local provider URL from Ollama to Docker Model Runner
- **Files to modify**: `src/config/constants.ts`
- **Changes**:
  - Update `DEFAULT_LOCAL_BASE_URL` to `'http://model-runner.docker.internal/'`
  - Update `DEFAULT_LOCAL_MODEL` to `'ai/phi4'` (Docker Model Runner format)

### Task 2: Create Local Provider Factory
- **Description**: Implement `createLocalClient` factory function
- **Files to create**: `src/model/providers/local.ts`
- **Implementation details**:
  - Import `ChatOpenAI` from `@langchain/openai`
  - Import types from `../../config/schema.js` and `../types.js`
  - Import helpers from `../base.js`
  - Import constants from `../../config/constants.js`
  - Create `createLocalClient` function accepting `LocalProviderConfig | Record<string, unknown>`
  - Use `ChatOpenAI` with `openAIApiKey: 'not-needed'` (no auth required)
  - Set `configuration.baseURL` to the configured base URL
  - Return `ModelResponse<BaseChatModel>`

### Task 3: Register Provider in Registry
- **Description**: Add local provider to the provider registry
- **Files to modify**: `src/model/registry.ts`
- **Changes**:
  - Add import: `import { createLocalClient } from './providers/local.js';`
  - Add to `PROVIDER_REGISTRY`: `local: createLocalClient,`

### Task 4: Create Unit Tests
- **Description**: Write comprehensive unit tests for the local provider
- **Files to create**: `src/model/__tests__/local.test.ts`
- **Test cases**:
  - Creates client with default baseUrl and model
  - Creates client with custom baseUrl
  - Creates client with custom model
  - Handles `Record<string, unknown>` config type
  - Uses defaults when fields are undefined
  - Passes correct parameters to ChatOpenAI (including `openAIApiKey: 'not-needed'`)
  - Returns error when ChatOpenAI constructor throws
  - Handles non-Error thrown objects

### Task 5: Run Quality Checks
- **Description**: Verify implementation passes all quality gates
- **Commands**:
  ```bash
  bun run typecheck
  bun run lint
  bun run test
  bun run build
  ```

## Testing Strategy

### Unit Tests
Tests in `src/model/__tests__/local.test.ts` covering:
1. **Default configuration**: Verify Docker Model Runner URL and model are used
2. **Custom configuration**: Override baseUrl and model
3. **Mixed configuration**: Some defaults, some custom
4. **Error handling**: Constructor failures, invalid configs
5. **Type compatibility**: `Record<string, unknown>` input handling

### Integration Tests
Manual testing with Docker Desktop Model Runner:
1. Configure `providers.default: 'local'` in settings
2. Ensure Docker Desktop is running with Model Runner enabled
3. Run agent and verify model responses
4. Test streaming functionality

### Edge Cases
- Empty string baseUrl (should use default)
- Undefined model (should use default)
- Network errors (Docker not running)
- Model not found errors

## Acceptance Criteria

- [x] `createLocalClient` factory function exists in `src/model/providers/local.ts`
- [x] Factory returns `ModelResponse<BaseChatModel>` with proper success/error handling
- [x] Provider registered in `src/model/registry.ts` as `local`
- [x] Default baseUrl is `http://model-runner.docker.internal/`
- [x] Default model is `ai/phi4`
- [x] No API key required (uses placeholder value)
- [x] All unit tests pass with 85%+ coverage
- [x] TypeScript strict mode passes
- [x] ESLint and Prettier pass
- [x] Build succeeds

## Validation Commands

```bash
# Run all quality checks
bun run typecheck && bun run lint && bun run test && bun run build

# Run specific tests
bun run test src/model/__tests__/local.test.ts

# Type check only
bun run typecheck

# Lint only
bun run lint

# Build only
bun run build
```

## Notes

### Docker Model Runner Details
- Docker Desktop 4.40+ includes Model Runner feature
- Exposes OpenAI-compatible API at `http://model-runner.docker.internal/`
- Models prefixed with `ai/` (e.g., `ai/phi4`, `ai/llama3.2`)
- No authentication required
- Supports streaming natively

### Alternative Local Servers
The local provider can also be used with:
- **Ollama**: Set `baseUrl: 'http://localhost:11434/v1'`
- **LM Studio**: Set `baseUrl: 'http://localhost:1234/v1'`
- **LocalAI**: Set `baseUrl: 'http://localhost:8080/v1'`

### Future Considerations
- Health check tool to verify Docker Model Runner is running
- Model discovery endpoint integration
- Automatic fallback to cloud provider if local unavailable

## Execution

This spec can be implemented using: `/sdlc:implement docs/specs/feature-024-local-docker-model-runner.md`
