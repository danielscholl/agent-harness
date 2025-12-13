# Codebase Analysis for Version Upgrades

**Created:** 2025-12-13
**Purpose:** Identify all usage patterns for Zod, LangChain, OpenTelemetry, and Jest before major version upgrades
**Related:** `version-upgrade-plan.md`

---

## Executive Summary

This analysis identifies all usage patterns of libraries targeted for major version upgrades:
- **Zod 3.x → 4.x**: Schema validation throughout config system
- **LangChain 0.3.x → 1.x**: Model abstractions, tool integration, message handling
- **OpenTelemetry 1.x → 2.x**: Telemetry setup and span management
- **Jest 29.x → 30.x**: Test infrastructure and mocking patterns

The codebase is well-structured with clear separation of concerns, making upgrades tractable.

---

## 1. Zod Usage Analysis

### 1.1 Core Patterns

#### Schema Definitions (`src/config/schema.ts`)
**Lines: 1-280**

**Pattern:** Define schemas, infer types with `z.infer<>`

```typescript
// Current Zod 3.x pattern
export const OpenAIProviderConfigSchema = z.object({
  apiKey: z.string().optional().describe('OpenAI API key'),
  model: z.string().default(DEFAULT_OPENAI_MODEL).describe('Model name to use'),
  baseUrl: z.string().url().optional().describe('Custom base URL'),
});

export type OpenAIProviderConfig = z.infer<typeof OpenAIProviderConfigSchema>;
```

**Files using this pattern:**
- `/Users/danielscholl/source/agent_cli/agent-base-v2/src/config/schema.ts` (primary)
- `/Users/danielscholl/source/agent_cli/agent-base-v2/src/tools/base.ts` (tool schemas)

**Zod 3.x APIs used:**
- `z.object()` - Object schemas
- `z.string()` - String validation
- `z.number()` - Number validation
- `z.boolean()` - Boolean validation
- `z.array()` - Array schemas
- `z.enum()` - Enum validation
- `z.infer<>` - Type inference
- `.optional()` - Optional fields
- `.default()` - Default values
- `.describe()` - Field descriptions
- `.url()` - URL validation
- `.positive()` - Number constraints
- `.int()` - Integer validation
- `.min()` / `.max()` - Range validation

#### Validation and Parsing

**Pattern 1: Safe parsing with error handling**
```typescript
// src/config/schema.ts:278
export function parseConfig(input: unknown): z.SafeParseReturnType<unknown, AppConfig> {
  return AppConfigSchema.safeParse(input);
}

// Usage in src/config/manager.ts:276, 303
const validation = AppConfigSchema.safeParse(config);
if (!validation.success) {
  // handle error
}
```

**Pattern 2: Direct parsing (throws on error)**
```typescript
// src/config/schema.ts:269
export function getDefaultConfig(): AppConfig {
  return AppConfigSchema.parse({});
}
```

**Pattern 3: ZodError handling in tools**
```typescript
// src/tools/base.ts:73-75
if (e instanceof ZodError) {
  const issues = e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  return errorResponse('VALIDATION_ERROR', `Validation failed: ${issues}`);
}
```

### 1.2 All Files Using Zod

| File | Usage | LOC | Critical? |
|------|-------|-----|-----------|
| `src/config/schema.ts` | 17 schemas, type inference | 280 | YES |
| `src/tools/base.ts` | Tool input schemas, ZodError handling | 112 | YES |
| `src/tools/hello.ts` | Example tool schemas | 99 | NO |
| `src/config/__tests__/schema.test.ts` | Schema validation tests | 375 | YES |
| `src/tools/__tests__/base.test.ts` | Tool validation tests | 472 | YES |

### 1.3 Migration Impact Assessment

**High Risk:**
- All config schemas must be updated to Zod 4 API
- Type inference patterns may change
- Error handling for ZodError may need updates

**Medium Risk:**
- Tool schema patterns (may need API adjustments)
- Default value handling

**Low Risk:**
- Test files (update assertions as needed)

---

## 2. LangChain Usage Analysis

### 2.1 Core Patterns

#### Imports and Types

**Core module imports:**
```typescript
// src/model/llm.ts:6-8
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage, AIMessageChunk } from '@langchain/core/messages';
import { HumanMessage } from '@langchain/core/messages';

// src/agent/agent.ts:9-22
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  isAIMessage,
  isHumanMessage,
  isSystemMessage,
  isToolMessage,
} from '@langchain/core/messages';
import type { BaseMessage, AIMessageChunk } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Runnable } from '@langchain/core/runnables';
```

**OpenAI provider:**
```typescript
// src/model/providers/openai.ts:6
import { ChatOpenAI } from '@langchain/openai';
```

**Tool creation:**
```typescript
// src/tools/base.ts:6-8
import { tool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { StructuredToolInterface } from '@langchain/core/tools';
```

#### Message Handling Patterns

**Message creation and conversion:**
```typescript
// src/agent/agent.ts:116-153
private convertMessages(messages: Message[]): BaseMessage[] {
  const result: BaseMessage[] = [];
  for (const msg of messages) {
    switch (msg.role) {
      case 'system':
        result.push(new SystemMessage(msg.content));
        break;
      case 'user':
        result.push(new HumanMessage(msg.content));
        break;
      case 'assistant':
        result.push(new AIMessage(msg.content));
        break;
      case 'tool':
        result.push(new ToolMessage({
          content: msg.content,
          tool_call_id: msg.toolCallId,
          name: msg.name,
        }));
        break;
    }
  }
  return result;
}
```

**Type guards for messages:**
```typescript
// src/agent/agent.ts:515-529
private getMessageRole(message: BaseMessage): Message['role'] {
  if (isSystemMessage(message)) return 'system';
  if (isHumanMessage(message)) return 'user';
  if (isAIMessage(message)) return 'assistant';
  if (isToolMessage(message)) return 'tool';
  return 'user';
}
```

#### Model Invocation Patterns

**Pattern 1: Simple invoke with response handling**
```typescript
// src/model/llm.ts:133-176
async invoke(
  input: string | BaseMessage[],
  options?: LLMCallOptions
): Promise<ModelResponse<InvokeResult>> {
  const clientResult = this.getClient();
  if (!clientResult.success) return clientResult;

  const client = clientResult.result;
  const messages = this.toMessages(input);

  // Apply call options using bind (deprecated)
  let modelToUse = client;
  if (options !== undefined) {
    const bindOptions: Record<string, unknown> = {};
    if (options.temperature !== undefined) bindOptions.temperature = options.temperature;
    if (options.maxTokens !== undefined) bindOptions.max_tokens = options.maxTokens;

    if (Object.keys(bindOptions).length > 0) {
      // Note: bind is deprecated but withConfig doesn't support temperature/max_tokens
      modelToUse = client.bind(bindOptions) as BaseChatModel;
    }
  }

  const response = await modelToUse.invoke(messages);
  const content = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);
  const usage = extractTokenUsage(response.response_metadata);

  return successResponse({ content, usage }, 'LLM invocation successful');
}
```

**Pattern 2: Streaming with async iteration**
```typescript
// src/model/llm.ts:185-226
async stream(
  input: string | BaseMessage[],
  options?: LLMCallOptions
): Promise<ModelResponse<StreamResult>> {
  const clientResult = this.getClient();
  if (!clientResult.success) return clientResult;

  const client = clientResult.result;
  const messages = this.toMessages(input);

  // Same bind pattern as invoke
  let modelToUse = client;
  if (options !== undefined) {
    // ... bind logic ...
    modelToUse = client.bind(bindOptions) as BaseChatModel;
  }

  const stream = await modelToUse.stream(messages);
  const wrappedStream = this.wrapStreamWithCallbacks(stream);

  return successResponse(wrappedStream, 'Stream started successfully');
}

// Callback wrapper for stream
private wrapStreamWithCallbacks(
  stream: AsyncIterable<AIMessageChunk>
): AsyncIterable<AIMessageChunk> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<AIMessageChunk> {
      const iterator = stream[Symbol.asyncIterator]();
      return {
        async next(): Promise<IteratorResult<AIMessageChunk>> {
          const result = await iterator.next();
          if (result.done === true) {
            callbacks?.onStreamEnd?.(lastUsage);
            return result;
          }
          const chunk = result.value;
          const content = typeof chunk.content === 'string' ? chunk.content : '';
          if (content !== '') callbacks?.onStreamChunk?.(content);
          return result;
        },
      };
    },
  };
}
```

#### Tool Integration Patterns

**Tool creation wrapper:**
```typescript
// src/tools/base.ts:59-87
export function createTool<TInput extends z.ZodRawShape, TResult>(
  options: CreateToolOptions<TInput, TResult>
): StructuredToolInterface {
  const { name, description, schema, execute } = options;

  return tool(
    async (
      input: z.infer<z.ZodObject<TInput>>,
      config?: RunnableConfig
    ): Promise<ToolResponse<TResult>> => {
      try {
        return await execute(input, config);
      } catch (e) {
        if (e instanceof ZodError) {
          const issues = e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
          return errorResponse('VALIDATION_ERROR', `Validation failed: ${issues}`);
        }
        const message = e instanceof Error ? e.message : 'Unknown error occurred';
        return errorResponse('UNKNOWN', message);
      }
    },
    { name, description, schema }
  );
}
```

**Tool binding to model:**
```typescript
// src/agent/agent.ts:180-207
private getModelWithTools(): Runnable<BaseMessage[], AIMessage> | null {
  if (this.tools.length === 0) return null;

  const modelResponse = this.llmClient.getModel();
  if (!modelResponse.success) return null;

  const model = modelResponse.result;

  // Check if model supports tool binding
  if (!('bindTools' in model)) return null;

  // Bind tools to model
  return (model as BaseChatModel & {
    bindTools: (tools: StructuredToolInterface[]) => Runnable<BaseMessage[], AIMessage>;
  }).bindTools(this.tools);
}
```

**Tool execution:**
```typescript
// src/agent/agent.ts:212-255
private async executeTool(
  toolCall: ToolCall,
  ctx: SpanContext
): Promise<{ name: string; result: ToolResponse; id: string }> {
  const tool = this.tools.find((t) => t.name === toolCall.name);

  if (!tool) {
    return {
      name: toolCall.name,
      id: toolCall.id,
      result: {
        success: false,
        error: 'NOT_FOUND',
        message: `Tool '${toolCall.name}' not found`,
      },
    };
  }

  this.callbacks?.onToolStart?.(ctx, toolCall.name, toolCall.args);

  try {
    const result = (await tool.invoke(toolCall.args)) as ToolResponse;
    this.callbacks?.onToolEnd?.(ctx, toolCall.name, result);
    return { name: toolCall.name, id: toolCall.id, result };
  } catch (error) {
    const errorResult: ToolResponse = {
      success: false,
      error: 'UNKNOWN',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    this.callbacks?.onToolEnd?.(ctx, toolCall.name, errorResult);
    return { name: toolCall.name, id: toolCall.id, result: errorResult };
  }
}
```

#### Metadata Extraction

**Token usage extraction:**
```typescript
// src/model/base.ts:83-109
export function extractTokenUsage(
  metadata: Record<string, unknown> | undefined
): TokenUsage | undefined {
  if (!metadata) return undefined;

  // OpenAI format (snake_case or camelCase)
  const usage = metadata.usage as Record<string, number> | undefined;
  if (usage) {
    return {
      promptTokens: usage.prompt_tokens ?? usage.promptTokens ?? 0,
      completionTokens: usage.completion_tokens ?? usage.completionTokens ?? 0,
      totalTokens: usage.total_tokens ?? usage.totalTokens ?? 0,
    };
  }

  // Check for token_usage format (some providers)
  const tokenUsage = metadata.token_usage as Record<string, number> | undefined;
  if (tokenUsage) {
    return {
      promptTokens: tokenUsage.prompt_tokens ?? 0,
      completionTokens: tokenUsage.completion_tokens ?? 0,
      totalTokens: tokenUsage.total_tokens ?? 0,
    };
  }

  return undefined;
}
```

### 2.2 All Files Using LangChain

| File | LangChain Usage | LOC | Critical? |
|------|-----------------|-----|-----------|
| `src/model/llm.ts` | LLMClient core (invoke, stream, bind) | 320 | **YES** |
| `src/agent/agent.ts` | Message handling, tool binding, AIMessage | 614 | **YES** |
| `src/model/providers/openai.ts` | ChatOpenAI instantiation | 44 | **YES** |
| `src/tools/base.ts` | tool() wrapper, StructuredToolInterface | 112 | **YES** |
| `src/model/types.ts` | Type imports for BaseChatModel, messages | 115 | YES |
| `src/agent/types.ts` | StructuredToolInterface type | 101 | YES |
| `src/model/base.ts` | Metadata extraction | 110 | YES |
| Test files | Mocking LangChain classes | ~800 | YES |

### 2.3 Deprecated API Usage

**⚠️ CRITICAL: `.bind()` is deprecated**

Used in:
- `src/model/llm.ts:156` (invoke method)
- `src/model/llm.ts:208` (stream method)

```typescript
// Current pattern (DEPRECATED in LangChain 1.x)
modelToUse = client.bind(bindOptions) as BaseChatModel;

// Need to migrate to LangChain 1.x pattern
// Check: https://js.langchain.com/docs/how_to/configure/
```

### 2.4 Migration Impact Assessment

**High Risk - Must Update:**
1. **`.bind()` deprecation** - Replace with LangChain 1.x config pattern
2. **Message constructors** - May have API changes in 1.x
3. **Tool binding** - `bindTools()` API may change
4. **Provider factories** - ChatOpenAI constructor may have new options

**Medium Risk - Review Needed:**
1. **Content handling** - Response content structure changes
2. **Metadata access** - `response_metadata` field access patterns
3. **Streaming API** - Async iterator contract changes

**Low Risk - Likely Compatible:**
1. **Type imports** - Should remain stable
2. **Message type guards** - Core API unlikely to change

---

## 3. OpenTelemetry Usage Analysis

### 3.1 Core Patterns

#### Setup and Initialization

**Imports:**
```typescript
// src/telemetry/setup.ts:11-18
import { trace, metrics, diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import type { Tracer, Meter } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
```

**Provider setup pattern:**
```typescript
// src/telemetry/setup.ts:175-218
// Create exporter based on type
let exporter: SpanExporter;
switch (exporterType) {
  case 'otlp':
    exporter = new OTLPTraceExporter({ url: endpoint });
    break;
  case 'console':
    exporter = new ConsoleSpanExporter();
    break;
}

// Create resource and provider
const resource = new Resource({
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]: serviceVersion,
});

tracerProvider = new BasicTracerProvider({
  resource,
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});

tracerProvider.register();

// Enable debug logging if DEBUG_OTEL is set
if (process.env['DEBUG_OTEL'] === 'true') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}
```

**Tracer and Meter access:**
```typescript
// src/telemetry/setup.ts:232-248
export function getTracer(name?: string, version?: string): Tracer {
  const tracerName = name ?? initResult?.serviceName ?? DEFAULT_SERVICE_NAME;
  return trace.getTracer(tracerName, version);
}

export function getMeter(name?: string, version?: string): Meter {
  const meterName = name ?? initResult?.serviceName ?? DEFAULT_SERVICE_NAME;
  return metrics.getMeter(meterName, version);
}
```

#### Endpoint Availability Check

**Pattern: Fast HTTP check before OTLP setup**
```typescript
// src/telemetry/setup.ts:49-87
async function isEndpointReachable(
  endpoint: string,
  timeoutMs: number = ENDPOINT_CHECK_TIMEOUT_MS
): Promise<boolean> {
  try {
    const url = new URL(endpoint);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Check the origin only - OTLP collectors only accept POST on /v1/traces
      await fetch(url.origin, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      // Any response (even 4xx/5xx) means endpoint is reachable
      return true;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  } catch {
    // Invalid URL
    return false;
  }
}
```

### 3.2 All Files Using OpenTelemetry

| File | OpenTelemetry Usage | LOC | Critical? |
|------|---------------------|-----|-----------|
| `src/telemetry/setup.ts` | Core setup, provider, exporter | 310 | **YES** |
| `src/telemetry/types.ts` | Type definitions for Tracer, Meter | 133 | YES |
| `src/telemetry/__tests__/setup.test.ts` | Tracer/span usage in tests | ~450 | YES |
| `src/agent/types.ts` | SpanContext type definition | 101 | NO |

### 3.3 OpenTelemetry Package Versions

**Current (1.x):**
- `@opentelemetry/api`: ^1.9.0 (stays at 1.x - stable API)
- `@opentelemetry/sdk-trace-base`: ^1.30.0 → **2.2.0**
- `@opentelemetry/resources`: ^1.30.0 → **2.2.0**
- `@opentelemetry/exporter-trace-otlp-http`: ^0.57.0 → **0.208.0**
- `@opentelemetry/semantic-conventions`: ^1.28.0 → **1.38.0**

### 3.4 Migration Impact Assessment

**High Risk - Must Review:**
1. **BasicTracerProvider constructor** - Options may change in SDK 2.x
2. **SimpleSpanProcessor** - Constructor signature
3. **OTLPTraceExporter** - Configuration options (URL vs endpoint)
4. **Resource creation** - Semantic conventions attributes

**Medium Risk:**
1. **Exporter version jump** - 0.57 → 0.208 is massive, check breaking changes
2. **Diagnostic logging** - DiagLogger API stability

**Low Risk - Likely Stable:**
1. **@opentelemetry/api** - Staying at 1.x, stable
2. **trace.getTracer()** / **metrics.getMeter()** - Core API stable
3. **Span operations** - startSpan, setAttribute, end (test usage)

---

## 4. Jest Usage Analysis

### 4.1 Core Test Patterns

#### Test Structure

**Standard pattern:**
```typescript
// src/tools/__tests__/base.test.ts:1-5
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { z } from 'zod';
import { successResponse, errorResponse, createTool } from '../index.js';

describe('Tool Response Types', () => {
  describe('successResponse', () => {
    it('creates a success response with result and message', () => {
      const result = { greeting: 'Hello!' };
      const response = successResponse(result, 'Greeting created');

      expect(response).toEqual({
        success: true,
        result: { greeting: 'Hello!' },
        message: 'Greeting created',
      });
    });
  });
});
```

#### Mocking Patterns

**Pattern 1: Simple jest.fn() mocks**
```typescript
// src/agent/__tests__/agent.test.ts:17-23
const mockInvoke = jest.fn<() => Promise<ModelResponse>>();
const mockStream = jest.fn<() => Promise<ModelResponse>>();
const mockGetModel = jest.fn<() => ModelResponse<BaseChatModel>>();
const mockGetModelName = jest.fn<() => string>();
const mockGetProviderName = jest.fn<() => string>();
```

**Pattern 2: jest.unstable_mockModule for ESM**
```typescript
// src/agent/__tests__/agent.test.ts:26-61
jest.unstable_mockModule('node:fs/promises', () => ({
  readFile: jest.fn<() => Promise<string>>().mockResolvedValue('System prompt'),
  access: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('node:os', () => ({
  homedir: jest.fn<() => string>().mockReturnValue('/home/user'),
}));

jest.unstable_mockModule('../../model/llm.js', () => {
  return {
    LLMClient: jest.fn<() => MockLLMClient>().mockImplementation(() => ({
      invoke: mockInvoke,
      stream: mockStream,
      getModel: mockGetModel,
      getModelName: mockGetModelName,
      getProviderName: mockGetProviderName,
    })),
  };
});
```

**Pattern 3: Mock lifecycle management**
```typescript
// src/tools/__tests__/base.test.ts:144-146
beforeEach(() => {
  jest.clearAllMocks();
});
```

**Pattern 4: Mock return values and implementations**
```typescript
// src/model/__tests__/llm.test.ts:72-84
function createMockModel(invokeResponse: MockResponse = mockInvokeResponse): {
  invoke: jest.MockedFunction<() => Promise<MockResponse>>;
  stream: jest.MockedFunction<() => Promise<AsyncIterable<MockChunk>>>;
  bind: jest.MockedFunction<(options: Record<string, unknown>) => unknown>;
} {
  return {
    invoke: jest.fn<() => Promise<MockResponse>>().mockResolvedValue(invokeResponse),
    stream: jest.fn<() => Promise<AsyncIterable<MockChunk>>>()
      .mockResolvedValue(createMockStream(['Hello', ' world', '!'])),
    bind: jest.fn<(options: Record<string, unknown>) => unknown>().mockReturnThis(),
  };
}
```

#### Test Utilities

**Pattern: Creating mock async iterators**
```typescript
// src/model/__tests__/llm.test.ts:18-37
function createMockStream(chunks: string[]): AsyncIterable<MockChunk> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<MockChunk> {
      let index = 0;
      return {
        next(): Promise<IteratorResult<MockChunk>> {
          if (index < chunks.length) {
            const chunk = chunks[index] ?? '';
            index++;
            return Promise.resolve({
              done: false,
              value: { content: chunk, response_metadata: {} },
            });
          }
          return Promise.resolve({ done: true, value: undefined });
        },
      };
    },
  };
}
```

### 4.2 Jest Configuration

**Current config:** `jest.config.js`
```javascript
/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/tests/**/*.test.ts',
    '**/tests/**/*.test.tsx',
  ],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1', // Handle .js -> .ts/.tsx imports
  },

  transformIgnorePatterns: [
    'node_modules/(?!(ink-testing-library|ink|cli-truncate|...)/)',
  ],

  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.tsx',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    'src/model/**/*.ts': { branches: 80, functions: 85, lines: 85, statements: 85 },
    'src/config/**/*.ts': { branches: 80, functions: 85, lines: 85, statements: 85 },
    'src/tools/**/*.ts': { branches: 80, functions: 85, lines: 85, statements: 85 },
  },

  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  testTimeout: 10000,
  verbose: true,
};
```

**Package.json test scripts:**
```json
{
  "test": "NODE_OPTIONS='--experimental-vm-modules' jest --passWithNoTests",
  "test:coverage": "NODE_OPTIONS='--experimental-vm-modules' jest --coverage --passWithNoTests",
  "test:watch": "jest --watch"
}
```

### 4.3 All Test Files

| File | Jest Features | LOC | Critical? |
|------|---------------|-----|-----------|
| `src/tools/__tests__/base.test.ts` | describe, it, expect, jest.fn, beforeEach | 472 | YES |
| `src/model/__tests__/llm.test.ts` | jest.unstable_mockModule, jest.fn typing | 363 | **YES** |
| `src/config/__tests__/schema.test.ts` | describe, it, expect, .safeParse | 375 | YES |
| `src/agent/__tests__/agent.test.ts` | jest.unstable_mockModule, complex mocking | ~600 | **YES** |
| `src/telemetry/__tests__/setup.test.ts` | global fetch mocking, jest.fn | ~450 | YES |
| Others | Standard patterns | ~500 | YES |

### 4.4 Jest-Specific Dependencies

**Current:**
- `jest`: ^29.7.0 → **30.2.0** (major)
- `@jest/globals`: ^29.7.0 → **30.2.0** (major)
- `@types/jest`: ^29.5.0 → **30.0.0** (major)
- `ts-jest`: ^29.2.0 → ^29.4.6 (minor - supports both Jest 29 and 30)

### 4.5 Migration Impact Assessment

**High Risk - Must Review:**
1. **jest.unstable_mockModule** - May stabilize or change in Jest 30
2. **ESM support** - Configuration may change
3. **Type definitions** - @types/jest 30.x may have breaking changes

**Medium Risk:**
1. **Mock typing** - jest.fn<>() generics may change
2. **Coverage configuration** - Threshold format may change
3. **Transform configuration** - ts-jest ESM handling

**Low Risk - Likely Stable:**
1. **Basic test structure** - describe, it, expect
2. **Assertions** - toEqual, toBe, etc.
3. **Lifecycle hooks** - beforeEach, afterEach

---

## 5. Additional Patterns and Abstractions

### 5.1 Custom Wrappers

**ToolResponse wrapper (no external dependency changes):**
- `src/tools/base.ts` - Wraps LangChain `tool()` with ToolResponse contract
- Migration impact: Only if LangChain `tool()` API changes

**ModelResponse wrapper (no external dependency changes):**
- `src/model/types.ts` - Wraps LangChain responses in structured format
- Migration impact: Only if response metadata format changes

### 5.2 Type Inference Patterns

**Zod-based type inference:**
```typescript
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type OpenAIProviderConfig = z.infer<typeof OpenAIProviderConfigSchema>;
```
**Migration risk:** High - Zod 4.x may change `z.infer<>` behavior

**LangChain type imports:**
```typescript
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { StructuredToolInterface } from '@langchain/core/tools';
```
**Migration risk:** Low - Core types likely stable

---

## 6. Critical Files for Each Upgrade

### Zod 3 → 4 Migration
1. **`src/config/schema.ts`** (280 LOC) - All schema definitions
2. **`src/tools/base.ts`** (112 LOC) - Tool schemas, ZodError handling
3. **`src/config/manager.ts`** - safeParse usage
4. **All test files** - Schema validation assertions

### LangChain 0.3 → 1.x Migration
1. **`src/model/llm.ts`** (320 LOC) - .bind() deprecation, invoke/stream
2. **`src/agent/agent.ts`** (614 LOC) - Message handling, tool binding
3. **`src/model/providers/openai.ts`** (44 LOC) - ChatOpenAI instantiation
4. **`src/tools/base.ts`** (112 LOC) - tool() wrapper
5. **Test mocks** - Update LangChain class mocking

### OpenTelemetry 1.x → 2.x Migration
1. **`src/telemetry/setup.ts`** (310 LOC) - Provider, exporter setup
2. **`src/telemetry/types.ts`** (133 LOC) - Type imports
3. **Test files** - Span/tracer usage

### Jest 29 → 30 Migration
1. **`jest.config.js`** - Configuration updates
2. **All test files** - jest.unstable_mockModule stability
3. **`package.json`** - Update test scripts if needed

---

## 7. Recommended Migration Order

Based on dependency analysis:

1. **Jest 29 → 30** (Infrastructure first)
   - Update test runner before changing tested code
   - Ensures test stability during other migrations

2. **Zod 3 → 4** (Foundation)
   - Config system depends on this
   - Affects type inference throughout codebase

3. **LangChain 0.3 → 1.x** (Core functionality)
   - Biggest code impact (.bind() deprecation)
   - Requires careful testing of LLM operations

4. **OpenTelemetry 1.x → 2.x** (Observability)
   - Isolated from core logic
   - Can be done last with minimal risk

---

## 8. Test Coverage Verification

Before migration, ensure these critical paths have test coverage:

### Zod Validation
- [x] Schema parsing success cases
- [x] Schema parsing failure cases
- [x] Default value application
- [x] Optional field handling
- [x] ZodError message extraction

### LangChain Operations
- [x] Model invocation
- [x] Streaming responses
- [x] Tool binding
- [x] Message conversion
- [x] Error handling
- [x] Token usage extraction

### OpenTelemetry
- [x] Provider initialization
- [x] Tracer creation
- [x] Endpoint reachability check
- [x] Exporter selection (OTLP, console, none)

### Jest Patterns
- [x] ESM module mocking
- [x] Async iterator mocking
- [x] Mock lifecycle (clearAllMocks)
- [x] Type-safe jest.fn()

---

## 9. Key API Compatibility Checks

### Must verify before upgrading:

**Zod 4.x:**
- [ ] `z.object()` API unchanged
- [ ] `z.infer<>` syntax unchanged
- [ ] `.safeParse()` return type compatible
- [ ] `.parse()` error handling unchanged
- [ ] `.default()` and `.optional()` chaining works
- [ ] ZodError structure compatible

**LangChain 1.x:**
- [ ] `.bind()` replacement identified
- [ ] `tool()` function signature unchanged
- [ ] Message constructors compatible
- [ ] `bindTools()` API unchanged
- [ ] `response_metadata` access pattern works
- [ ] Streaming async iterator protocol unchanged

**OpenTelemetry 2.x:**
- [ ] BasicTracerProvider constructor compatible
- [ ] SimpleSpanProcessor constructor compatible
- [ ] OTLPTraceExporter options compatible
- [ ] Resource creation unchanged
- [ ] trace.getTracer() API stable
- [ ] Semantic conventions attributes compatible

**Jest 30.x:**
- [ ] jest.unstable_mockModule status (stable vs deprecated)
- [ ] jest.fn() generic typing unchanged
- [ ] ESM transform configuration compatible
- [ ] Coverage configuration unchanged
- [ ] @jest/globals imports unchanged

---

## 10. Migration Readiness Checklist

Before starting any migration:

- [x] Full test suite passes on current versions
- [x] All test files identified and catalogued
- [x] All usage patterns documented
- [ ] Changelog/migration guides reviewed for each library
- [ ] Breaking changes identified in upgrade paths
- [ ] Rollback plan prepared (git branches, version pins)
- [ ] Local development environment matches engine requirements (Node >=20.11.0)

---

## Appendix A: File Inventory

### All Files Using Target Libraries

**Zod (5 files):**
- src/config/schema.ts (280 LOC) ⭐
- src/tools/base.ts (112 LOC) ⭐
- src/tools/hello.ts (99 LOC)
- src/config/__tests__/schema.test.ts (375 LOC) ⭐
- src/tools/__tests__/base.test.ts (472 LOC) ⭐

**LangChain (13 files):**
- src/model/llm.ts (320 LOC) ⭐⭐
- src/agent/agent.ts (614 LOC) ⭐⭐
- src/model/providers/openai.ts (44 LOC) ⭐
- src/tools/base.ts (112 LOC) ⭐
- src/model/types.ts (115 LOC)
- src/agent/types.ts (101 LOC)
- src/model/base.ts (110 LOC)
- src/model/__tests__/llm.test.ts (363 LOC) ⭐
- src/agent/__tests__/agent.test.ts (~600 LOC) ⭐
- src/model/__tests__/openai.test.ts
- src/model/__tests__/registry.test.ts
- src/model/__tests__/base.test.ts
- src/tools/__tests__/hello.test.ts

**OpenTelemetry (4 files):**
- src/telemetry/setup.ts (310 LOC) ⭐⭐
- src/telemetry/types.ts (133 LOC)
- src/telemetry/__tests__/setup.test.ts (~450 LOC) ⭐
- src/agent/types.ts (101 LOC)

**Jest (All test files - 19 files):**
- src/tools/__tests__/base.test.ts (472 LOC) ⭐
- src/model/__tests__/llm.test.ts (363 LOC) ⭐⭐
- src/config/__tests__/schema.test.ts (375 LOC) ⭐
- src/agent/__tests__/agent.test.ts (~600 LOC) ⭐⭐
- src/telemetry/__tests__/setup.test.ts (~450 LOC) ⭐
- src/config/__tests__/env.test.ts
- src/config/__tests__/manager.test.ts
- src/model/__tests__/base.test.ts
- src/model/__tests__/registry.test.ts
- src/model/__tests__/openai.test.ts
- src/agent/__tests__/callbacks.test.ts
- src/agent/__tests__/prompts.test.ts
- src/errors/__tests__/index.test.ts
- src/tools/__tests__/hello.test.ts
- src/components/__tests__/App.test.tsx
- jest.config.js ⭐⭐

⭐ = High priority for migration
⭐⭐ = Critical - must review carefully

---

## Appendix B: External Documentation Links

See `version-upgrade-plan.md` for comprehensive documentation links.

Key migration guides:
- Zod 4: https://zod.dev/v4/changelog
- LangChain 1.0: https://blog.langchain.com/langchain-langgraph-1dot0/
- OpenTelemetry 2.x: https://github.com/open-telemetry/opentelemetry-js/blob/main/MIGRATION.md
- Jest 30: https://github.com/jestjs/jest/releases

---

**End of Analysis**
