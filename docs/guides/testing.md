# Testing Guide

This guide provides detailed patterns and examples for testing in the TypeScript agent framework. For the governing rules, see [CLAUDE.md](../../CLAUDE.md).

---

## Test Runner Configuration

- **Framework**: Jest + ts-jest
- **Command**: `bun run test` (aliased in package.json)
- **DO NOT** use Bun's native `bun test` runner - we use Jest for mocking and coverage

### Why Jest over Bun Test

- Mature mocking ecosystem
- Coverage reporting
- Snapshot testing
- Better IDE integration
- Consistent with existing patterns

---

## Test Organization

Tests are co-located with source files in `__tests__` directories:

```
src/
├── agent/
│   ├── agent.ts
│   └── __tests__/
│       └── agent.test.ts
├── tools/
│   ├── base.ts
│   ├── hello.ts
│   └── __tests__/
│       ├── base.test.ts
│       └── hello.test.ts
├── model/
│   ├── llm.ts
│   └── __tests__/
│       └── llm.test.ts
tests/
├── fixtures/           # Shared test utilities
│   ├── index.ts        # Central export point
│   ├── llm-responses.ts # Mock LLM response fixtures
│   ├── factories.ts    # Factory functions for test objects
│   └── mock-providers.ts # Mock provider helpers
└── integration/        # Cross-module tests
    ├── agent-integration.test.ts
    └── telemetry-integration.test.ts
```

### Special Directories

- **Integration tests**: `tests/integration/` - Cross-module tests
- **Shared fixtures**: `tests/fixtures/` - Mock data, factories, and provider mocks

---

## Mocking LLM Providers

**Critical Rule**: Never make real API calls in tests. Mock all providers.

### ESM Module Mocking

This project uses ESM modules, which require `jest.unstable_mockModule` instead of the CJS `jest.mock`. Module mocks must be set up **before** importing the module under test.

```typescript
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { SIMPLE_GREETING_RESPONSE } from '../fixtures/llm-responses.js';

// 1. Create mock functions BEFORE mocking
const mockInvoke = jest.fn();
const mockStream = jest.fn();

// 2. Mock the module BEFORE importing modules that use it
jest.unstable_mockModule('../../src/model/llm.js', () => ({
  LLMClient: class MockLLMClient {
    invoke = mockInvoke;
    stream = mockStream;
    getModelName = () => 'gpt-4o';
    getProviderName = () => 'openai';
  },
}));

// 3. Dynamic import AFTER mocking
const { Agent } = await import('../../src/agent/agent.js');

describe('Agent', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mock implementation
    mockInvoke.mockResolvedValue({
      success: true,
      result: { content: SIMPLE_GREETING_RESPONSE.content },
      message: 'Success',
    });
  });

  it('processes user query through LLM', async () => {
    const agent = new Agent({ model: 'gpt-4o' });
    const result = await agent.run('Hello');

    expect(mockInvoke).toHaveBeenCalled();
  });
});
```

**Key ESM Mocking Rules:**
- Use `jest.unstable_mockModule()` (not `jest.mock()`)
- Create mock functions before the mock module definition
- Use dynamic `await import()` for modules that depend on the mock
- Place mocks at the top of the file, before any imports of modules under test

### Mocking Streaming Responses

```typescript
import { AIMessageChunk } from '@langchain/core/messages';

function createMockStream(chunks: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield new AIMessageChunk({ content: chunk });
      }
    },
  };
}

MockChatOpenAI.mockImplementation(() => ({
  stream: jest.fn().mockResolvedValue(
    createMockStream(['Hello', ' ', 'World', '!'])
  ),
}) as unknown as ChatOpenAI);
```

### Mocking Tool Calls

```typescript
import { AIMessage } from '@langchain/core/messages';

const mockToolCallResponse = new AIMessage({
  content: '',
  tool_calls: [
    {
      id: 'call_123',
      name: 'hello',
      args: { name: 'World' },
    },
  ],
});

MockChatOpenAI.mockImplementation(() => ({
  invoke: jest.fn().mockResolvedValue(mockToolCallResponse),
  bindTools: jest.fn().mockReturnThis(),
}) as unknown as ChatOpenAI);
```

---

## Shared Test Fixtures

The `tests/fixtures/` directory provides reusable utilities for consistent testing across the codebase.

### LLM Response Fixtures

Use pre-built fixtures from `llm-responses.ts`:

```typescript
import {
  // Pre-defined responses
  SIMPLE_GREETING_RESPONSE,
  ACKNOWLEDGMENT_RESPONSE,
  COMPLETION_RESPONSE,
  // Tool call helpers
  createToolCallResponse,
  HELLO_TOOL_CALL,
  // Streaming helpers
  createMockStream,
  GREETING_STREAM_CHUNKS,
  // Error fixtures
  RATE_LIMIT_ERROR,
  AUTH_ERROR,
  NETWORK_ERROR,
} from '../../tests/fixtures/index.js';

// Use pre-defined response
const response = SIMPLE_GREETING_RESPONSE;

// Create streaming response
const stream = createMockStream(['Hello', ' ', 'World']);

// Create tool call response
const toolCallResponse = createToolCallResponse([
  { id: 'call_123', name: 'hello', args: { name: 'Alice' } }
]);

// Use error fixtures for failure scenarios
const rateLimitError = RATE_LIMIT_ERROR;
```

### Factory Functions

Create test objects with sensible defaults from `factories.ts`:

```typescript
import {
  createTestConfig,
  createTrackingCallbacks,
  createMockModel,
  createSuccessResponse,
  createErrorResponse,
} from '../../tests/fixtures/index.js';

// Create config with defaults and overrides
const config = createTestConfig({
  providers: { default: 'anthropic' }
});

// Create callbacks that track invocations
const { callbacks, log, traceIds } = createTrackingCallbacks();
await agent.run('Hello');
expect(log).toContain('onAgentStart: Hello');

// Create mock model for Agent tests
const mockModel = createMockModel(SIMPLE_GREETING_RESPONSE);

// Create tool responses
const success = createSuccessResponse({ data: 'test' }, 'Operation completed');
const error = createErrorResponse('IO_ERROR', 'File not found');
```

### Mock Provider Helpers

For consistent provider mocking from `mock-providers.ts`:

```typescript
import {
  createMockRegistry,
  setupSupportedProvider,
  createMockLLMClient,
  setupOpenAIMocks,
  createMockModel,
} from '../../tests/fixtures/index.js';
import { SIMPLE_GREETING_RESPONSE } from '../../tests/fixtures/llm-responses.js';

// Create mock registry
const registry = createMockRegistry();

// Setup supported provider with mock model
const mockModel = createMockModel(SIMPLE_GREETING_RESPONSE);
setupSupportedProvider(registry, mockModel, ['openai']);

// Or use provider-specific setup (combines the above steps)
setupOpenAIMocks(registry, SIMPLE_GREETING_RESPONSE);

// Create mock LLMClient for direct injection into tests
const mockClient = createMockLLMClient(SIMPLE_GREETING_RESPONSE);
```

---

## Testing Tools

### Direct Tool Testing

```typescript
import { helloTool } from '../hello.js';

describe('helloTool', () => {
  it('returns success response for valid input', async () => {
    const result = await helloTool.invoke({ name: 'World' });

    expect(result).toEqual({
      success: true,
      result: { greeting: 'Hello, World!' },
      message: 'Greeted World',
    });
  });

  it('handles special characters in name', async () => {
    const result = await helloTool.invoke({ name: 'O\'Brien' });

    expect(result.success).toBe(true);
    expect(result.result.greeting).toContain('O\'Brien');
  });
});
```

### Testing Tool Error Handling

```typescript
import { readFileTool } from '../filesystem.js';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

describe('readFileTool', () => {
  it('returns IO_ERROR when file not found', async () => {
    (fs.readFile as jest.Mock).mockRejectedValue(
      new Error('ENOENT: no such file')
    );

    const result = await readFileTool.invoke({ path: '/nonexistent' });

    expect(result).toEqual({
      success: false,
      error: 'IO_ERROR',
      message: expect.stringContaining('ENOENT'),
    });
  });

  it('returns PERMISSION_DENIED for restricted paths', async () => {
    const result = await readFileTool.invoke(
      { path: '~/.ssh/id_rsa' },
      { callbacks: { onPermissionRequest: () => false } }
    );

    expect(result.error).toBe('PERMISSION_DENIED');
  });
});
```

---

## Testing Callbacks

### Capturing Callback Invocations

```typescript
import { Agent } from '../agent.js';
import type { AgentCallbacks } from '../callbacks.js';

describe('Agent callbacks', () => {
  it('invokes onLLMStart before LLM call', async () => {
    const callbacks: AgentCallbacks = {
      onLLMStart: jest.fn(),
      onLLMEnd: jest.fn(),
    };

    const agent = new Agent({ model: 'gpt-4o', callbacks });
    await agent.run('Hello');

    expect(callbacks.onLLMStart).toHaveBeenCalledWith(
      expect.any(Object), // SpanContext
      'gpt-4o',
      expect.arrayContaining([
        expect.objectContaining({ role: 'user' }),
      ])
    );
  });

  it('invokes onToolStart and onToolEnd for tool calls', async () => {
    const callbacks: AgentCallbacks = {
      onToolStart: jest.fn(),
      onToolEnd: jest.fn(),
    };

    // Mock LLM to return tool call
    MockChatOpenAI.mockImplementation(() => ({
      invoke: jest.fn()
        .mockResolvedValueOnce(mockToolCallResponse)
        .mockResolvedValueOnce({ content: 'Done' }),
      bindTools: jest.fn().mockReturnThis(),
    }) as unknown as ChatOpenAI);

    const agent = new Agent({ model: 'gpt-4o', callbacks });
    await agent.run('Greet me');

    expect(callbacks.onToolStart).toHaveBeenCalledWith(
      expect.any(Object), // SpanContext
      'hello',
      { name: 'World' }
    );
    expect(callbacks.onToolEnd).toHaveBeenCalledWith(
      expect.any(Object), // SpanContext
      'hello',
      expect.objectContaining({ success: true })
    );
  });
});
```

---

## Testing Configuration

### Mocking Config Manager

```typescript
import { ConfigManager } from '../config/manager.js';
import type { AppConfig } from '../config/schema.js';

jest.mock('../config/manager.js');

const mockConfig: Partial<AppConfig> = {
  providers: {
    enabled: ['openai'],
    openai: { model: 'gpt-4o' },
  },
};

(ConfigManager.load as jest.Mock).mockResolvedValue(mockConfig);
```

### Testing with Different Configs

```typescript
describe('Agent with different providers', () => {
  it.each([
    ['openai', 'gpt-4o'],
    ['anthropic', 'claude-3-opus'],
    ['google', 'gemini-pro'],
  ])('initializes %s provider with model %s', async (provider, model) => {
    const config = createTestConfig({ provider, model });
    const agent = new Agent(config);

    expect(agent.modelName).toBe(model);
  });
});
```

---

## Factory Functions Reference

All factory functions are in `tests/fixtures/factories.ts`:

**Configuration:**
- `createTestConfig(overrides?)` - OpenAI config with 'test-key'
- `createAnthropicConfig(overrides?)` - Anthropic config
- `createAzureConfig(overrides?)` - Azure OpenAI config
- `createRetryConfig(retrySettings?, baseOverrides?)` - Config with retry enabled
- `createMemoryConfig(overrides?)` - Config with memory enabled

**Callbacks:**
- `createTrackingCallbacks()` - Returns `{ callbacks, log, traceIds, spanIds }`

**Messages:**
- `createMessage(role?, content?)` - Single message
- `createConversationHistory(messages?)` - Conversation array

**Tool Responses:**
- `createSuccessResponse(result, message?)` - Success ToolResponse
- `createErrorResponse(error?, message?)` - Error ToolResponse
- `createToolResponse(success, resultOrError, message?)` - Generic response

**Model Responses:**
- `createModelSuccess(result, message?)` - Success ModelResponse
- `createModelError(error?, message?)` - Error ModelResponse

**Mock Models:**
- `createMockModel(response?, streamChunks?)` - Basic mock model
- `createToolCallingModel(toolCall, finalResponse)` - Tool-calling model
- `createFailingModel(error)` - Always-failing model
- `createRetryableModel(failures, error, successResponse?)` - Fails N times then succeeds

**Other:**
- `createSpanContext(overrides?)` - Test SpanContext
- `createTestFileContent(lines?)` - Multi-line test content

---

## Integration Tests

Integration tests live in `tests/integration/` and test cross-module flows. They use ESM mocking to inject mock LLM responses.

```typescript
// tests/integration/agent-tool-flow.test.ts

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  createTestConfig,
  createTrackingCallbacks,
} from '../fixtures/factories.js';
import { SIMPLE_GREETING_RESPONSE, createMockStream } from '../fixtures/llm-responses.js';

// Create mock functions
const mockInvoke = jest.fn();
const mockStream = jest.fn();

// Mock the LLM module BEFORE importing Agent
jest.unstable_mockModule('../../src/model/llm.js', () => ({
  LLMClient: class MockLLMClient {
    invoke = mockInvoke;
    stream = mockStream;
    getModelName = () => 'gpt-4o';
    getProviderName = () => 'openai';
  },
}));

// Dynamic imports AFTER mocking
const { Agent } = await import('../../src/agent/agent.js');
const { helloTool } = await import('../../src/tools/hello.js');

describe('Agent tool execution flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Configure mock to return greeting response
    mockInvoke.mockResolvedValue({
      success: true,
      result: { content: SIMPLE_GREETING_RESPONSE.content },
      message: 'Success',
    });

    mockStream.mockResolvedValue({
      success: true,
      result: createMockStream(['Hello', ' world', '!']),
      message: 'Stream started',
    });
  });

  it('executes full query → LLM → tool → response cycle', async () => {
    const { callbacks, log } = createTrackingCallbacks();
    const config = createTestConfig();

    const agent = new Agent({
      config,
      callbacks,
      tools: [helloTool],
    });

    const result = await agent.run('Say hello to Alice');

    // Verify LLM was called
    expect(mockInvoke).toHaveBeenCalled();

    // Verify callbacks were invoked
    expect(log.some(l => l.includes('onAgentStart'))).toBe(true);
    expect(log.some(l => l.includes('onLLMStart'))).toBe(true);
    expect(log.some(l => l.includes('onLLMEnd'))).toBe(true);
  });
});
```

**Key Integration Test Patterns:**
- Mock at the module level using `jest.unstable_mockModule`
- Use dynamic imports for all modules that depend on mocks
- Configure mock behavior in `beforeEach` for test isolation
- Use `createTrackingCallbacks()` to capture callback invocations

---

## Coverage Requirements

- **Target**: 85% coverage for core business logic modules
- **Focus on**: Agent, model, tools, config, telemetry
- **Lower threshold for**: React components, CLI presentation layer

### Running Coverage

```bash
bun run test --coverage
```

### Coverage Configuration

The project uses per-path thresholds to enforce coverage on core modules while allowing flexibility for UI components:

```javascript
// jest.config.js
export default {
  coverageThreshold: {
    // Core modules enforce 85% coverage
    'src/model/**/*.ts': {
      branches: 78,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'src/config/**/*.ts': {
      branches: 45, // types.ts has V8-specific branch
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'src/tools/**/*.ts': {
      branches: 78,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.tsx',
  ],
};
```

### Coverage Priorities

1. **Critical (must be 85%+)**: `src/model/`, `src/config/`, `src/tools/`, `src/agent/`
2. **Important**: `src/telemetry/`, `src/skills/`, `src/errors/`
3. **Best effort**: `src/cli/`, `src/components/` (React/presentation layer)

---

## Test Isolation

### Clear Mocks Between Tests

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

### Isolate Filesystem Tests

```typescript
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Filesystem tools', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'agent-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('writes file to test directory', async () => {
    const path = join(testDir, 'test.txt');
    await writeFileTool.invoke({ path, content: 'Hello' });

    const content = await readFile(path, 'utf-8');
    expect(content).toBe('Hello');
  });
});
```

---

## Checklist

Before submitting tests:

- [ ] No real API calls - all providers mocked
- [ ] Mocks cleared in `beforeEach`
- [ ] Factory functions used for test objects
- [ ] Error paths tested, not just happy paths
- [ ] Integration tests for cross-module flows
- [ ] Coverage meets 85% threshold
- [ ] Tests are deterministic (no flaky tests)
