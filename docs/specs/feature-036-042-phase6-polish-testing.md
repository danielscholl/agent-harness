# Feature: Phase 6 - Polish + Testing

## Feature Description

Phase 6 brings the TypeScript agent framework to production readiness through comprehensive testing infrastructure, refined error handling, polished UX, and complete documentation. This phase consolidates the work from Phases 1-5 by establishing robust test patterns, creating mock fixtures for deterministic testing, implementing the finalized system prompt template system, and ensuring all error paths provide clear, actionable messages.

The phase encompasses Features 36, 37, 39, 40, 41, and 42 from the TypeScript rewrite feature list, covering:
- Jest test infrastructure with fixtures and patterns
- Integration tests for the complete agent loop
- System prompt three-tier loading system finalization
- CLAUDE.md governance document alignment
- README and migration documentation
- Error handling and UX polish

## User Story

As a **developer using the agent framework**
I want to have **comprehensive test coverage, clear error messages, and complete documentation**
So that I can **confidently build production applications with predictable behavior and easy debugging**

As a **contributor to the framework**
I want to have **established test patterns and fixtures**
So that I can **write consistent, reliable tests for new features**

## Problem Statement

The framework has reached functional completion through Phases 1-5, but lacks:
1. **Standardized test fixtures** - Tests currently create mocks ad-hoc without shared patterns
2. **Integration test coverage** - Agent loop needs end-to-end tests with telemetry assertions
3. **Complete documentation** - README needs installation, usage, migration, and telemetry guides
4. **UX polish** - Error messages could be clearer, CLI help could be more comprehensive
5. **CLAUDE.md synchronization** - Governance doc may have drifted from implementation reality

## Solution Statement

Implement a comprehensive Phase 6 deliverable that:
1. Creates `tests/fixtures/` with reusable LLM response mocks and factory functions
2. Expands integration tests to cover full agent flow with span context assertions
3. Finalizes `agent/prompts.ts` with documented three-tier loading
4. Audits and updates CLAUDE.md to reflect implementation reality
5. Writes complete README with installation, configuration, provider examples, and migration guide
6. Reviews all error paths for actionable messages and graceful degradation

## Related Documentation

### Requirements
- [typescript-rewrite-features.md](../plans/typescript-rewrite-features.md) - Features 36-42

### Architecture Decisions
- [0006-testing-jest.md](../decisions/0006-testing-jest.md) - Jest over Bun Test decision
- [0007-callbacks-over-eventbus.md](../decisions/0007-callbacks-over-eventbus.md) - Callback patterns
- [0004-validation-zod.md](../decisions/0004-validation-zod.md) - Zod validation patterns

## Codebase Analysis Findings

### Testing Patterns
- **Framework**: Jest 30 + ts-jest with ESM support
- **Organization**: Co-located tests in `src/**/__tests__/`, integration tests in `tests/integration/`
- **Coverage**: Per-path thresholds in `jest.config.js` (85% target for most modules)
- **Mocking**: Uses `jest.unstable_mockModule()` for ESM module mocking
- **Mock patterns**: Factory functions like `createMockModel()` and `createMockStream()` in existing tests

### Agent Loop Architecture
- **Entry point**: `Agent.run()` in `src/agent/agent.ts`
- **Flow**: query → assembleMessages → getModelWithTools → invoke loop → tool execution → response
- **Max iterations**: Default 10, configurable via `maxIterations` option
- **Span context**: Created via `createSpanContext()` and `createChildSpanContext()`
- **Tool execution**: Via `executeTool()` with proper callback emission

### System Prompt Loading
- **Location**: `src/agent/prompts.ts`
- **Three-tier order**: env (config.agent.systemPromptFile) → user (~/.agent/system.md) → package (src/prompts/system.md)
- **Features implemented**: YAML front matter stripping, placeholder replacement ({{MODEL}}, {{PROVIDER}}, {{DATA_DIR}}, {{MEMORY_ENABLED}})
- **Skills integration**: `loadSkillsContext()` for skill XML generation

### Error Handling
- **Location**: `src/errors/index.ts`
- **Error codes**: `AgentErrorCode` union type covering provider, tool, and agent-specific errors
- **Helper functions**: `errorResponse()`, `getUserFriendlyMessage()`, type guards
- **Graceful degradation**: Agent continues on non-fatal errors, logs via callbacks

### Existing Test Coverage
Current test files found:
- `src/agent/__tests__/agent.test.ts` - Agent class tests
- `src/agent/__tests__/prompts.test.ts` - Prompt loading tests
- `src/agent/__tests__/callbacks.test.ts` - Callback tests
- `src/model/__tests__/llm.test.ts` - LLM client with comprehensive mock patterns
- `src/tools/__tests__/*.test.ts` - Tool tests including filesystem (101 tests)
- `src/skills/__tests__/*.test.ts` - Skills loader, manifest, parser tests
- `tests/integration/agent-integration.test.ts` - Basic integration tests

## Archon Project

project_id: `df7a901e-d819-46f4-8206-c3967efec677`

## Relevant Files

### Existing Files to Modify/Review
- `src/agent/prompts.ts`: Finalize three-tier loading documentation
- `src/agent/agent.ts`: Review error handling paths
- `src/errors/index.ts`: Ensure comprehensive error codes and user-friendly messages
- `CLAUDE.md`: Audit for alignment with implementation
- `README.md`: Expand with complete documentation
- `jest.config.js`: Ensure coverage thresholds are properly configured
- `docs/guides/testing.md`: Update with new patterns and fixtures

### New Files to Create
- `tests/fixtures/llm-responses.ts`: Mock LLM response fixtures
- `tests/fixtures/factories.ts`: Test factory functions
- `tests/fixtures/index.ts`: Fixture exports
- `tests/integration/agent-flow.test.ts`: Extended agent flow integration tests
- `tests/integration/telemetry.test.ts`: Telemetry span assertion tests
- `docs/MIGRATION.md`: Python to TypeScript migration guide

## Implementation Plan

### Phase 1: Test Infrastructure (Feature 36)
Establish comprehensive test infrastructure with fixtures and patterns.

**Key deliverables:**
- Create `tests/fixtures/` directory with mock LLM responses
- Implement factory functions for common test objects
- Document test patterns in `docs/guides/testing.md`
- Ensure all existing tests follow established patterns

### Phase 2: Integration Tests (Feature 37)
Add integration tests exercising the full agent flow with telemetry.

**Key deliverables:**
- Extend `tests/integration/agent-integration.test.ts` with more scenarios
- Add telemetry span assertion tests
- Test tool call sequences and error recovery
- Verify callback invocation order

### Phase 3: System Prompt Finalization (Feature 39)
Document and finalize the system prompt template system.

**Key deliverables:**
- Add comprehensive JSDoc to `src/agent/prompts.ts`
- Document placeholder syntax and available variables
- Create example custom prompts in documentation
- Test edge cases in prompt loading

### Phase 4: Documentation (Features 40, 41)
Complete all documentation including CLAUDE.md alignment.

**Key deliverables:**
- Audit CLAUDE.md against current implementation
- Expand README with installation, configuration, usage
- Create provider-specific examples
- Write migration guide from Python

### Phase 5: Error Handling and UX Polish (Feature 42)
Review and improve all error paths and CLI UX.

**Key deliverables:**
- Audit all error messages for clarity
- Ensure graceful degradation when providers unavailable
- Verify keyboard interrupt handling
- Improve CLI help text

## Step by Step Tasks

### Task 1: Create Test Fixture Infrastructure
- **Description**: Create `tests/fixtures/` directory with mock LLM response fixtures and factory functions that can be reused across all tests
- **Files to create**:
  - `tests/fixtures/llm-responses.ts` - Mock AIMessage, tool call responses, streaming chunks
  - `tests/fixtures/factories.ts` - Factory functions for configs, messages, tool responses
  - `tests/fixtures/index.ts` - Re-exports all fixtures
- **Archon task**: Will be created during implementation

### Task 2: Create Mock Provider Helpers
- **Description**: Create helper functions for mocking LLM providers consistently across tests
- **Files to modify/create**:
  - `tests/fixtures/mock-providers.ts` - Mock implementations for OpenAI, Anthropic, etc.
- **Archon task**: Will be created during implementation

### Task 3: Extend Agent Integration Tests
- **Description**: Add comprehensive integration tests for the agent loop covering tool chains, error recovery, and conversation history
- **Files to modify**:
  - `tests/integration/agent-integration.test.ts` - Add new test scenarios
- **Archon task**: Will be created during implementation

### Task 4: Add Telemetry Integration Tests
- **Description**: Create integration tests that verify telemetry span creation and propagation
- **Files to create**:
  - `tests/integration/telemetry-integration.test.ts` - Span hierarchy, GenAI conventions
- **Archon task**: Will be created during implementation

### Task 5: Document System Prompt Loading
- **Description**: Add comprehensive documentation to prompts.ts and create user-facing docs
- **Files to modify**:
  - `src/agent/prompts.ts` - Add JSDoc with examples
  - `docs/guides/prompts.md` - Create new guide (if needed)
- **Archon task**: Will be created during implementation

### Task 6: Audit CLAUDE.md Alignment
- **Description**: Review CLAUDE.md governance document and update to reflect implementation reality
- **Files to modify**:
  - `CLAUDE.md` - Update any outdated sections
- **Archon task**: Will be created during implementation

### Task 7: Expand README Documentation
- **Description**: Write comprehensive README with installation, configuration, provider examples, and usage
- **Files to modify**:
  - `README.md` - Expand with detailed sections
- **Archon task**: Will be created during implementation

### Task 8: Create Migration Guide
- **Description**: Document migration path from Python agent-base to TypeScript version
- **Files to create**:
  - `docs/MIGRATION.md` - Migration guide with config mapping
- **Archon task**: Will be created during implementation

### Task 9: Review Error Messages
- **Description**: Audit all error paths and improve message clarity
- **Files to modify**:
  - `src/errors/index.ts` - Improve getUserFriendlyMessage()
  - Various source files with error handling
- **Archon task**: Will be created during implementation

### Task 10: Polish CLI UX
- **Description**: Improve CLI help text, tool error display, and graceful degradation
- **Files to modify**:
  - `src/cli/*.tsx` - CLI components
  - `src/cli/commands/*.tsx` - Command handlers
- **Archon task**: Will be created during implementation

### Task 11: Verify Coverage Thresholds
- **Description**: Run full test suite with coverage and ensure 85% minimum is met
- **Commands**: `bun run test --coverage`
- **Archon task**: Will be created during implementation

### Task 12: Update Testing Guide
- **Description**: Update docs/guides/testing.md with new patterns and fixtures
- **Files to modify**:
  - `docs/guides/testing.md` - Add fixture usage examples
- **Archon task**: Will be created during implementation

## Testing Strategy

### Unit Tests
Tests for individual components will be co-located in `src/**/__tests__/`:

- **Prompt loading tests**: `src/agent/__tests__/prompts.test.ts`
  - Three-tier fallback behavior
  - Placeholder replacement
  - YAML front matter stripping
  - Missing file handling

- **Error handling tests**: `src/errors/__tests__/index.test.ts`
  - All error codes produce valid responses
  - User-friendly messages are helpful
  - Type guards work correctly

### Integration Tests
Integration tests in `tests/integration/`:

- **Agent flow tests**: `tests/integration/agent-flow.test.ts`
  - Full query → LLM → tool → response cycle
  - Multi-tool execution sequences
  - Error recovery and continuation
  - Conversation history handling

- **Telemetry tests**: `tests/integration/telemetry-integration.test.ts`
  - Span hierarchy (agent → LLM → tool)
  - Trace ID propagation
  - Token usage attributes
  - GenAI semantic conventions

### Edge Cases
- Empty system prompt file
- Missing provider configuration
- Tool that returns LLM_ASSIST_REQUIRED
- Rate limiting during tool execution
- Stream interruption handling
- Maximum iterations exceeded
- Invalid conversation history

## Acceptance Criteria

- [ ] `tests/fixtures/` directory exists with reusable mocks and factories
- [ ] All tests use fixtures instead of inline mock definitions
- [ ] Integration tests cover full agent flow with ≥5 scenarios
- [ ] Telemetry integration tests verify span hierarchy and attributes
- [ ] `src/agent/prompts.ts` has comprehensive JSDoc documentation
- [ ] CLAUDE.md reflects current implementation (no outdated references)
- [ ] README includes: prerequisites, installation, quick start, configuration, providers, usage examples
- [ ] Migration guide exists with Python → TypeScript config mapping
- [ ] All error messages are actionable and user-friendly
- [ ] CLI help text is comprehensive for all commands
- [ ] Test coverage meets 85% threshold across all modules
- [ ] All quality gates pass: `bun run typecheck && bun run lint && bun run test && bun run build`

## Validation Commands

```bash
# Run full quality gate suite
bun run typecheck && bun run lint && bun run test && bun run build

# Run tests with coverage report
bun run test --coverage

# Run only integration tests
bun run test tests/integration/

# Run specific test file
bun run test src/agent/__tests__/prompts.test.ts

# Type check only
bun run typecheck

# Lint check only
bun run lint

# Build to verify output
bun run build
```

## Notes

### Patterns Discovered by Codebase Analysis

1. **ESM Module Mocking**: Use `jest.unstable_mockModule()` before dynamic imports
2. **Mock Factory Pattern**: Create mock objects via factory functions with configurable responses
3. **Async Iterator Mocking**: Implement `[Symbol.asyncIterator]` for streaming responses
4. **Callback Tracking**: Use arrays to capture callback invocation order
5. **Config Override Pattern**: Use `getDefaultConfig()` and modify specific fields

### Future Considerations

- **Feature 38 (Python migration tool)**: Not included in this spec; separate implementation
- **True streaming-with-tools**: Depends on LangChain improvements; currently tools block streaming
- **Coverage improvements**: Some modules have lower branch coverage due to V8-specific code paths

### Implementation Order Recommendation

1. **Start with fixtures** (Task 1-2) - Foundation for all other tests
2. **Integration tests** (Task 3-4) - Validates core functionality
3. **Documentation** (Task 5-8) - Can be done in parallel with testing
4. **Polish** (Task 9-11) - Final refinements
5. **Guide updates** (Task 12) - After patterns are established

## Execution

This spec can be implemented using: `/implement docs/specs/feature-036-042-phase6-polish-testing.md`
