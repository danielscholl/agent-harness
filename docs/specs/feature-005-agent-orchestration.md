# Feature 5: Core Agent Orchestration Loop

## Feature Description

Port the core Agent class from Python (`./agent-base/src/agent/agent.py`) to TypeScript (`src/agent/agent.ts`). This implements the central orchestration loop that receives user queries, assembles messages with system prompts, invokes the LLM via the Model Layer, executes tool calls, and returns final answers. The Agent is the heart of the framework - the only layer that calls the Model Layer.

## User Story

As a **developer using the agent framework**
I want **a typed Agent class that orchestrates LLM calls and tool execution**
So that **I can build conversational AI applications with multi-provider support and extensible tooling**

## Problem Statement

The TypeScript framework has the Model Layer (`src/model/llm.ts`) and Tools Layer (`src/tools/`) in place, but lacks the orchestration layer that ties them together. Without the Agent class, there's no way to:
- Load and apply system prompts with placeholder replacement
- Assemble conversation messages (system + history + user query)
- Bind tools to the LLM for function calling
- Execute the query → LLM → tool → response loop
- Stream responses to the UI via callbacks

## Solution Statement

Implement a TypeScript `Agent` class that:
1. **Receives configuration** via dependency injection (config, callbacks, tools)
2. **Loads system prompts** with three-tier fallback (env → user file → package default)
3. **Replaces placeholders** (`{{MODEL}}`, `{{DATA_DIR}}`, etc.) in prompts
4. **Assembles messages** combining system prompt, history, and user query
5. **Binds tools** to the LangChain model for function calling
6. **Executes the main loop** with streaming support via callbacks
7. **Returns structured answers** with graceful error handling

## Related Documentation

### Requirements
- `docs/plans/typescript-rewrite.md` - Architecture plan (Phase 1a deliverables)
- `docs/plans/typescript-rewrite-features.md` - Feature 5 specification

### Architecture Decisions
- `docs/decisions/0007-callbacks-over-eventbus.md` - Callbacks pattern (ADR)
- `docs/decisions/0002-llm-integration-langchain.md` - LangChain integration
- `docs/architecture.md` - Layer diagram showing Agent → Model flow

### Related Specs
- `docs/specs/feature-006-typed-callbacks.md` - AgentCallbacks interface (dependency)

## Codebase Analysis Findings

### Architecture Patterns
- **Dependency Injection**: All components receive deps via constructor `XxxOptions` interfaces
- **Response Unions**: Discriminated unions (`ModelResponse<T>`, `ToolResponse<T>`) for success/error
- **Optional Callback Invocation**: Pattern `this.callbacks?.onEvent?.()` throughout
- **Private Readonly Fields**: Dependencies stored as `private readonly` with defaults

### Existing Infrastructure

**Model Layer** (`src/model/llm.ts`):
```typescript
class LLMClient {
  constructor(options: LLMClientOptions);
  async invoke(input: string | BaseMessage[], options?: LLMCallOptions): Promise<ModelResponse<InvokeResult>>;
  async stream(input: string | BaseMessage[], options?: LLMCallOptions): Promise<ModelResponse<StreamResult>>;
  getModelName(): string;
  getProviderName(): ProviderName;
}
```

**Tools Layer** (`src/tools/base.ts`):
```typescript
function createTool<TInput, TResult>(options: CreateToolOptions): StructuredToolInterface;
// Returns LangChain-compatible tool with Zod validation
```

**Config Layer** (`src/config/schema.ts`):
```typescript
type AppConfig = {
  providers: { default: ProviderName; openai?: {...}; ... };
  agent: { dataDir: string; systemPromptFile?: string; ... };
  // ...
}
```

### Python Reference (`./agent-base/src/agent/agent.py`)
Key responsibilities to port:
1. `__init__`: Load config, create chat client, initialize tools
2. `_load_system_prompt`: Three-tier loading with YAML stripping and placeholder replacement
3. `_create_agent`: Bind tools and instructions to LangChain agent
4. `run`: Execute query and return response
5. `run_stream`: Execute with streaming response

### Integration Points

1. **LLMClient**: Agent creates and holds an `LLMClient` instance
2. **Tools**: Agent receives tools via constructor, binds them to model
3. **Callbacks**: Agent receives `AgentCallbacks`, invokes at lifecycle points
4. **Config**: Agent reads from `AppConfig` for prompts, model settings

## Archon Project

**Project ID**: `4bf7b480-29e3-4081-97fe-a50169c521d5`

## Relevant Files

### Existing Files
- `src/model/llm.ts`: LLMClient for LLM operations
- `src/model/types.ts`: ModelResponse, TokenUsage, LLMCallbacks
- `src/tools/base.ts`: createTool factory
- `src/tools/types.ts`: ToolResponse contract
- `src/config/schema.ts`: AppConfig type
- `src/config/manager.ts`: ConfigManager for loading config

### New Files
- `src/agent/agent.ts`: Core Agent class
- `src/agent/types.ts`: AgentOptions, Message, SpanContext types
- `src/agent/callbacks.ts`: AgentCallbacks interface
- `src/agent/prompts.ts`: System prompt loading utilities
- `src/agent/index.ts`: Public exports
- `src/agent/__tests__/agent.test.ts`: Unit tests
- `src/prompts/system.md`: Default system prompt template

## Implementation Plan

### Phase 1: Foundation (Types and Callbacks)
Create the type definitions and callback interface that the Agent will use. This establishes the contract for Agent construction and event emission.

### Phase 2: System Prompt Loading
Implement the three-tier prompt loading system with placeholder replacement. This is the first actual runtime logic.

### Phase 3: Core Agent Implementation
Build the Agent class with constructor, message assembly, and the main `run()` method that orchestrates LLM calls and tool execution.

### Phase 4: Streaming Support
Add `runStream()` method with async generator pattern for streaming responses.

### Phase 5: Testing and Integration
Write comprehensive tests and ensure integration with existing layers.

## Step by Step Tasks

### Task 1: Create Agent Types (`src/agent/types.ts`)
- **Description**: Define core types for Agent operation
- **Files to create**: `src/agent/types.ts`
- **Details**:
  ```typescript
  // SpanContext for telemetry correlation
  interface SpanContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  }

  // Message format for conversation history
  interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    toolCallId?: string;
  }

  // Agent constructor options
  interface AgentOptions {
    config: AppConfig;
    callbacks?: AgentCallbacks;
    tools?: StructuredToolInterface[];
    systemPrompt?: string; // Override loaded prompt
  }

  // Permission scope for tool permissions
  type PermissionScope = 'fs-read' | 'fs-write' | 'fs-delete' | 'shell-run';
  ```

### Task 2: Create AgentCallbacks Interface (`src/agent/callbacks.ts`)
- **Description**: Define the callback interface for Agent lifecycle events
- **Files to create**: `src/agent/callbacks.ts`
- **Details**:
  - Agent lifecycle: `onAgentStart`, `onAgentEnd`
  - LLM interaction: `onLLMStart`, `onLLMStream`, `onLLMEnd`
  - Tool execution: `onToolStart`, `onToolEnd`
  - UI feedback: `onSpinnerStart`, `onSpinnerStop`, `onAnswerStream`
  - Debug: `onDebug`, `onTrace`
  - Helper functions: `createSpanContext()`, `createChildSpanContext()`

### Task 3: Create System Prompt Utilities (`src/agent/prompts.ts`)
- **Description**: Implement three-tier prompt loading with placeholder replacement
- **Files to create**: `src/agent/prompts.ts`, `src/prompts/system.md`
- **Details**:
  ```typescript
  interface PromptOptions {
    config: AppConfig;
    model: string;
    provider: string;
  }

  // Load prompt with three-tier fallback:
  // 1. config.agent.systemPromptFile (env override)
  // 2. ~/.agent/system.md (user default)
  // 3. Package default (src/prompts/system.md)
  async function loadSystemPrompt(options: PromptOptions): Promise<string>;

  // Replace placeholders: {{MODEL}}, {{DATA_DIR}}, {{PROVIDER}}, etc.
  function replacePlaceholders(prompt: string, values: Record<string, string>): string;

  // Strip YAML front matter from markdown files
  function stripYamlFrontMatter(content: string): string;
  ```

### Task 4: Create Default System Prompt (`src/prompts/system.md`)
- **Description**: Port the default system prompt from Python
- **Files to create**: `src/prompts/system.md`
- **Details**: Include YAML front matter and placeholders matching Python version

### Task 5: Implement Core Agent Class (`src/agent/agent.ts`)
- **Description**: Build the main Agent class with constructor and run() method
- **Files to create**: `src/agent/agent.ts`
- **Details**:
  ```typescript
  class Agent {
    private readonly config: AppConfig;
    private readonly callbacks?: AgentCallbacks;
    private readonly tools: StructuredToolInterface[];
    private readonly llmClient: LLMClient;
    private readonly systemPrompt: string;

    constructor(options: AgentOptions);

    // Assemble messages for LLM call
    private assembleMessages(query: string, history?: Message[]): BaseMessage[];

    // Bind tools to model for function calling
    private getModelWithTools(): BaseChatModel;

    // Create span context for telemetry
    private createSpanContext(parentCtx?: SpanContext): SpanContext;

    // Execute a single tool call
    private async executeTool(
      toolCall: ToolCall,
      ctx: SpanContext
    ): Promise<ToolResponse>;

    // Main orchestration loop
    async run(query: string, history?: Message[]): Promise<string>;
  }
  ```

### Task 6: Implement Agent Run Loop Logic
- **Description**: Complete the run() method with full orchestration
- **Files to modify**: `src/agent/agent.ts`
- **Details**:
  - Emit `onAgentStart` callback
  - Assemble messages (system + history + query)
  - Loop: invoke LLM → process tool calls → re-invoke until done
  - Emit callbacks at each step (onLLMStart/End, onToolStart/End)
  - Handle errors with graceful degradation
  - Emit `onAgentEnd` with final answer
  - Support max iterations to prevent infinite loops

### Task 7: Add Streaming Support (`runStream`)
- **Description**: Implement streaming response method
- **Files to modify**: `src/agent/agent.ts`
- **Details**:
  ```typescript
  // Returns async generator for streaming
  async *runStream(query: string, history?: Message[]): AsyncGenerator<string>;
  ```
  - Use LLMClient.stream() method
  - Emit onLLMStream callbacks for each chunk
  - **Note**: Tool calling is not supported in streaming mode (use `run()` for tool execution)
  - onAnswerStream callback is declared but streaming tools would require significant complexity

### Task 8: Create Public Exports (`src/agent/index.ts`)
- **Description**: Set up clean public API exports
- **Files to create**: `src/agent/index.ts`
- **Details**:
  - Export Agent class
  - Export types: AgentOptions, AgentCallbacks, Message, SpanContext
  - Export helpers: createSpanContext, loadSystemPrompt

### Task 9: Write Unit Tests
- **Description**: Comprehensive tests for Agent functionality
- **Files to create**: `src/agent/__tests__/agent.test.ts`, `src/agent/__tests__/prompts.test.ts`
- **Details**:
  - Test Agent construction with mock config
  - Test system prompt loading (all three tiers)
  - Test placeholder replacement
  - Test callback invocation at lifecycle points
  - Test tool execution flow
  - Test error handling and graceful degradation
  - Test streaming response
  - Mock LLMClient for deterministic results

### Task 10: Integration Testing
- **Description**: Test Agent with real components (mocked LLM)
- **Files to create**: `tests/integration/agent-integration.test.ts`
- **Details**:
  - Test full flow: query → LLM → tool → response
  - Verify callback sequence
  - Test with HelloTool from tools layer
  - Ensure type safety across layers

## Testing Strategy

### Unit Tests
- `agent.test.ts`: Agent constructor, run(), runStream()
- `prompts.test.ts`: Prompt loading, placeholder replacement, YAML stripping
- `callbacks.test.ts`: SpanContext helpers, callback invocation patterns

### Integration Tests
- Agent + LLMClient (mocked provider)
- Agent + Tools (HelloTool)
- Full callback flow verification

### Edge Cases
- Missing system prompt file (fallback to default)
- Undefined callbacks (no crashes)
- Tool execution errors (return error response)
- LLM parsing failures (graceful degradation)
- Max iteration limit reached
- Empty tool list (no function calling)

## Acceptance Criteria

- [ ] Agent class implemented with constructor and run() method
- [ ] System prompt loading with three-tier fallback works
- [ ] Placeholder replacement ({{MODEL}}, {{DATA_DIR}}, etc.) works
- [ ] Tools bound to LLM model for function calling
- [ ] Callbacks invoked at all lifecycle points
- [ ] Streaming response via runStream() works
- [ ] Errors handled gracefully (no crashes)
- [ ] Unit tests pass with 85%+ coverage
- [ ] TypeScript strict mode passes
- [ ] Integration test verifies full flow

## Validation Commands

```bash
# Type checking
bun run typecheck

# Linting
bun run lint

# Run all tests
bun run test

# Run agent-specific tests with coverage
bun run test -- --coverage --collectCoverageFrom='src/agent/**/*.ts'

# Build verification
bun run build
```

## Interface Specifications

### Agent Class

```typescript
// src/agent/agent.ts

import type { StructuredToolInterface } from '@langchain/core/tools';
import type { AppConfig } from '../config/schema.js';
import type { AgentCallbacks, SpanContext, Message, AgentOptions } from './types.js';

/**
 * Core agent that orchestrates LLM calls, tool execution, and answer generation.
 *
 * The Agent is the heart of the framework - the only layer that invokes the Model Layer.
 * It receives queries, assembles messages, binds tools, and coordinates the full
 * query → LLM → tool → response cycle.
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   config: appConfig,
 *   callbacks: {
 *     onLLMStart: (ctx, model) => console.log(`Calling ${model}...`),
 *     onToolStart: (ctx, name) => console.log(`Running ${name}...`),
 *   },
 *   tools: [helloTool, fileSystemTool],
 * });
 *
 * const answer = await agent.run('Say hello to Alice');
 * console.log(answer); // "Hello, Alice!"
 *
 * // Or with streaming:
 * for await (const chunk of agent.runStream('Tell me a story')) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */
export class Agent {
  private readonly config: AppConfig;
  private readonly callbacks?: AgentCallbacks;
  private readonly tools: StructuredToolInterface[];
  private readonly llmClient: LLMClient;
  private systemPrompt: string;

  constructor(options: AgentOptions);

  /**
   * Run agent with a query and return the final answer.
   * Executes the full loop: LLM call → tool execution → final response.
   *
   * @param query - User's input query
   * @param history - Optional conversation history
   * @returns Final answer string
   */
  async run(query: string, history?: Message[]): Promise<string>;

  /**
   * Run agent with streaming response.
   * Yields response chunks as they arrive from the LLM.
   *
   * @param query - User's input query
   * @param history - Optional conversation history
   * @yields Response chunks as strings
   */
  async *runStream(query: string, history?: Message[]): AsyncGenerator<string>;

  /**
   * Get the current model name.
   */
  getModelName(): string;

  /**
   * Get the current provider name.
   */
  getProviderName(): string;
}
```

### AgentCallbacks Interface

```typescript
// src/agent/callbacks.ts

import type { SpanContext, Message, PermissionScope } from './types.js';
import type { TokenUsage } from '../model/types.js';
import type { ToolResponse } from '../tools/types.js';

/**
 * Callbacks for agent lifecycle events.
 * All callbacks are optional with SpanContext for telemetry correlation.
 */
export interface AgentCallbacks {
  // ─── Agent Lifecycle ─────────────────────────────────────────────────
  onAgentStart?: (ctx: SpanContext, query: string) => void;
  onAgentEnd?: (ctx: SpanContext, answer: string) => void;

  // ─── LLM Interaction ─────────────────────────────────────────────────
  onLLMStart?: (ctx: SpanContext, model: string, messages: Message[]) => void;
  onLLMStream?: (ctx: SpanContext, chunk: string) => void;
  onLLMEnd?: (ctx: SpanContext, response: string, usage?: TokenUsage) => void;

  // ─── Tool Execution ──────────────────────────────────────────────────
  onToolStart?: (ctx: SpanContext, toolName: string, args: Record<string, unknown>) => void;
  onToolEnd?: (ctx: SpanContext, toolName: string, result: ToolResponse) => void;

  // ─── UI Feedback ─────────────────────────────────────────────────────
  onSpinnerStart?: (message: string) => void;
  onSpinnerStop?: () => void;
  onAnswerStream?: (stream: AsyncGenerator<string>) => void;

  // ─── Debug/Logging ───────────────────────────────────────────────────
  onDebug?: (message: string, data?: unknown) => void;
  onTrace?: (message: string, data?: unknown) => void;
}
```

### System Prompt Loading

```typescript
// src/agent/prompts.ts

/**
 * Load system prompt with three-tier fallback:
 * 1. config.agent.systemPromptFile (explicit env override)
 * 2. ~/.agent/system.md (user's default)
 * 3. Package default (src/prompts/system.md)
 *
 * Strips YAML front matter and replaces placeholders.
 */
export async function loadSystemPrompt(options: {
  config: AppConfig;
  model: string;
  provider: string;
}): Promise<string>;

/**
 * Replace placeholders in prompt content.
 * Supported: {{MODEL}}, {{PROVIDER}}, {{DATA_DIR}}, {{SESSION_DIR}}, {{MEMORY_ENABLED}}
 */
export function replacePlaceholders(
  content: string,
  values: Record<string, string>
): string;

/**
 * Strip YAML front matter from markdown content.
 */
export function stripYamlFrontMatter(content: string): string;
```

## Callback Flow Diagram

```
Agent.run(query)
    │
    ├─► onAgentStart(ctx, query)
    │
    ├─► onSpinnerStart("Thinking...")
    │
    ├─► assembleMessages(query, history)
    │
    ├─► [LOOP START]
    │   │
    │   ├─► onLLMStart(ctx, model, messages)
    │   │
    │   ├─► llmClient.invoke(messages)
    │   │       │
    │   │       └─► [if streaming] onLLMStream(ctx, chunk)
    │   │
    │   ├─► onLLMEnd(ctx, response, usage)
    │   │
    │   ├─► [if tool_calls]
    │   │       │
    │   │       ├─► onToolStart(ctx, toolName, args)
    │   │       │
    │   │       ├─► tool.execute(args)
    │   │       │
    │   │       ├─► onToolEnd(ctx, toolName, result)
    │   │       │
    │   │       └─► [add tool result to messages, continue loop]
    │   │
    │   └─► [no tool_calls → exit loop]
    │
    ├─► onSpinnerStop()
    │
    └─► onAgentEnd(ctx, answer)
```

## Notes

### Design Decisions

1. **Tools via Constructor**: Tools passed in options rather than discovered automatically. This allows testing with specific tool sets and explicit control.

2. **History as Parameter**: Message history passed to run() rather than stored internally. This allows the CLI layer to manage history and enables stateless agent usage.

3. **LLMClient Internally Created**: Agent creates its own LLMClient from config. This simplifies the API while allowing testing via config mocking.

4. **Graceful Degradation**: Following CLAUDE.md principles - if prompt loading fails, use fallback. If history selection fails, proceed without. Never crash on non-critical failures.

5. **Max Iterations**: Prevent infinite tool-call loops with configurable limit (default: 10).

### Dependencies

Feature 5 depends on:
- Feature 4: LLM abstraction (`src/model/llm.ts`) - **Complete**
- Feature 3: Tool wrapper (`src/tools/base.ts`) - **Complete**
- Feature 2: Config system (`src/config/`) - **Complete**

Feature 6 (Typed Callbacks) can be implemented concurrently or as part of this feature since the spec is available.

### Post-MVP Enhancements

- Context providers for memory injection (Phase 3)
- Skill documentation injection (Phase 4)
- Session management (Phase 3)
- Telemetry span creation (Phase 1b)

## Execution

This spec can be implemented using: `/sdlc:implement docs/specs/feature-005-agent-orchestration.md`
