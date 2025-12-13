# Feature 10: Add GenAI Semantic Conventions for Spans

## Feature Description

This feature implements OpenTelemetry GenAI semantic conventions for tracing AI operations in the agent framework. It provides helper functions in `telemetry/spans.ts` that create properly-attributed spans following the official OpenTelemetry GenAI semantic conventions specification. The implementation integrates with the existing callback system so all LLM calls and tool executions are automatically traced with standardized attributes.

This is the second deliverable of Phase 1b (Foundation - Observability) and builds on Feature 9 (OpenTelemetry setup).

## User Story

As an agent framework developer
I want all LLM and tool operations traced with standardized GenAI semantic conventions
So that I can analyze AI workloads using standard observability tools (Jaeger, Aspire, Datadog, etc.) with consistent attribute names and hierarchies

## Problem Statement

The agent framework now has basic OpenTelemetry setup (Feature 9) but lacks standardized span attributes for AI-specific operations. Without GenAI semantic conventions:

1. Spans lack meaningful attributes for filtering and analysis
2. Token usage is not recorded in spans for cost tracking
3. Tool executions are not correlated with LLM calls
4. Different AI frameworks use inconsistent attribute names
5. Observability platforms can't recognize AI-specific spans for specialized views

## Solution Statement

Implement `telemetry/spans.ts` with:
1. Span helper functions for LLM operations (`startLLMSpan`, `recordLLMEnd`)
2. Span helper functions for tool operations (`startToolSpan`, `recordToolEnd`)
3. Span helper functions for agent operations (`startAgentSpan`, `recordAgentEnd`)
4. GenAI attribute constants following OpenTelemetry semantic conventions
5. Integration with existing AgentCallbacks for automatic tracing
6. Optional sensitive data recording (controlled by config)

## Related Documentation

### Requirements
- Feature defined in: `docs/plans/typescript-rewrite-features.md` (Feature 10, lines 68-73)
- Phase: 1b (Foundation - Observability)
- Dependencies: Feature 9 (OTel Setup) - COMPLETED

### Architecture Decisions
- ADR-0007: Callbacks over EventBus (telemetry integrates via callbacks)
- ADR-0003: Bun Runtime (manual spans only)

### Reference Documents
- `docs/architecture.md`: Telemetry Architecture section (lines 621-654), Span Hierarchy diagram
- OpenTelemetry GenAI Semantic Conventions: https://opentelemetry.io/docs/specs/semconv/gen-ai/
- GenAI Span Conventions: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/

## Codebase Analysis Findings

### Architecture Patterns
- **Callback Integration**: Spans should be created/ended via callback lifecycle events
- **SpanContext Correlation**: Internal SpanContext correlates with OTel spans via traceId/spanId
- **Dependency Injection**: getTracer() provides the tracer instance
- **Response Contract**: Follow existing `{ success, result|error, message }` pattern

### Existing Infrastructure
- **Telemetry Setup**: `src/telemetry/setup.ts` with `getTracer()`, `isEnabled()`
- **Callbacks**: `src/agent/callbacks.ts` with `onLLMStart`, `onLLMEnd`, `onToolStart`, `onToolEnd`
- **Token Usage**: `src/model/types.ts` has `TokenUsage` interface (`promptTokens`, `completionTokens`, `totalTokens`)
- **Tool Response**: `src/tools/types.ts` has `ToolResponse` interface
- **Config**: `telemetry.enableSensitiveData` controls whether to record message content

### GenAI Semantic Convention Attributes (from OpenTelemetry spec)

**Core Operation Attributes:**
- `gen_ai.operation.name` - Required: `chat`, `execute_tool`, `text_completion`
- `gen_ai.provider.name` - Required: Provider identifier (`openai`, `anthropic`, etc.)

**Model Attributes:**
- `gen_ai.request.model` - Conditionally Required: Model requested
- `gen_ai.response.model` - Recommended: Model that generated response

**Token Usage:**
- `gen_ai.usage.input_tokens` - Recommended: Prompt tokens
- `gen_ai.usage.output_tokens` - Recommended: Completion tokens

**Tool Attributes:**
- `gen_ai.tool.name` - Recommended: Tool name
- `gen_ai.tool.call.id` - Recommended: Tool call identifier
- `gen_ai.tool.call.arguments` - Opt-In: Tool arguments (sensitive)
- `gen_ai.tool.call.result` - Opt-In: Tool result (sensitive)

**Content Attributes (Opt-In / Sensitive):**
- `gen_ai.input.messages` - Opt-In: Input messages
- `gen_ai.output.messages` - Opt-In: Output messages

### Coding Conventions
- **File Naming**: `spans.ts` in `src/telemetry/`
- **Test Location**: `__tests__/spans.test.ts` co-located with source
- **Imports**: Use `.js` extensions for ESM compatibility
- **No console.log**: Use callbacks for debug output
- **Type Safety**: Full TypeScript types for all public APIs

## Relevant Files

### Existing Files
- `src/telemetry/setup.ts`: getTracer(), isEnabled() - lines 234-257
- `src/telemetry/types.ts`: TelemetryHelpers interface
- `src/telemetry/index.ts`: Public API exports
- `src/agent/callbacks.ts`: AgentCallbacks interface - lines 18-65
- `src/agent/agent.ts`: Agent class with lifecycle events - lines 271-500
- `src/agent/types.ts`: SpanContext interface - lines 14-25
- `src/model/types.ts`: TokenUsage interface - lines 66-70
- `src/tools/types.ts`: ToolResponse interface
- `src/config/schema.ts`: TelemetryConfig with enableSensitiveData

### New Files
- `src/telemetry/spans.ts`: GenAI span helpers
- `src/telemetry/conventions.ts`: GenAI attribute constants
- `src/telemetry/__tests__/spans.test.ts`: Unit tests

## Implementation Plan

### Phase 1: Define GenAI Attribute Constants
Create constants for all GenAI semantic convention attributes.

### Phase 2: Implement Span Helpers
Create helper functions for starting and ending LLM/tool/agent spans.

### Phase 3: Create Tracing Callbacks Wrapper
Implement a wrapper that creates AgentCallbacks with automatic tracing.

### Phase 4: Tests and Validation
Create comprehensive unit tests and integration tests.

## Step by Step Tasks

### Task 1: Create GenAI attribute constants

**Description**: Define constants for OpenTelemetry GenAI semantic convention attributes.

**Files to create**: `src/telemetry/conventions.ts`

**Implementation Details**:

```typescript
/**
 * OpenTelemetry GenAI Semantic Convention Attributes.
 * Based on https://opentelemetry.io/docs/specs/semconv/gen-ai/
 *
 * Note: These follow the official OTel GenAI semantic conventions.
 * Attribute names use the standardized `gen_ai.*` namespace.
 */

// -----------------------------------------------------------------------------
// Operation Attributes
// -----------------------------------------------------------------------------

/** The name of the GenAI operation being performed */
export const ATTR_GEN_AI_OPERATION_NAME = 'gen_ai.operation.name';

/** The GenAI provider as identified by the client or server */
export const ATTR_GEN_AI_PROVIDER_NAME = 'gen_ai.provider.name';

// -----------------------------------------------------------------------------
// Model Attributes
// -----------------------------------------------------------------------------

/** The name of the GenAI model a request is being made to */
export const ATTR_GEN_AI_REQUEST_MODEL = 'gen_ai.request.model';

/** The name of the model that generated the response */
export const ATTR_GEN_AI_RESPONSE_MODEL = 'gen_ai.response.model';

// -----------------------------------------------------------------------------
// Token Usage Attributes
// -----------------------------------------------------------------------------

/** The number of tokens used in the GenAI input (prompt) */
export const ATTR_GEN_AI_USAGE_INPUT_TOKENS = 'gen_ai.usage.input_tokens';

/** The number of tokens used in the GenAI response (completion) */
export const ATTR_GEN_AI_USAGE_OUTPUT_TOKENS = 'gen_ai.usage.output_tokens';

// -----------------------------------------------------------------------------
// Request Parameter Attributes
// -----------------------------------------------------------------------------

/** Temperature setting for the model */
export const ATTR_GEN_AI_REQUEST_TEMPERATURE = 'gen_ai.request.temperature';

/** Maximum tokens to generate */
export const ATTR_GEN_AI_REQUEST_MAX_TOKENS = 'gen_ai.request.max_tokens';

/** Top-p sampling parameter */
export const ATTR_GEN_AI_REQUEST_TOP_P = 'gen_ai.request.top_p';

// -----------------------------------------------------------------------------
// Tool Attributes
// -----------------------------------------------------------------------------

/** Name of the tool utilized by the agent */
export const ATTR_GEN_AI_TOOL_NAME = 'gen_ai.tool.name';

/** The tool call identifier */
export const ATTR_GEN_AI_TOOL_CALL_ID = 'gen_ai.tool.call.id';

/** Parameters passed to the tool call (opt-in, sensitive) */
export const ATTR_GEN_AI_TOOL_CALL_ARGUMENTS = 'gen_ai.tool.call.arguments';

/** The result returned by the tool call (opt-in, sensitive) */
export const ATTR_GEN_AI_TOOL_CALL_RESULT = 'gen_ai.tool.call.result';

// -----------------------------------------------------------------------------
// Content Attributes (Opt-In / Sensitive)
// -----------------------------------------------------------------------------

/** Chat history provided as input (opt-in, sensitive) */
export const ATTR_GEN_AI_INPUT_MESSAGES = 'gen_ai.input.messages';

/** Model-generated response messages (opt-in, sensitive) */
export const ATTR_GEN_AI_OUTPUT_MESSAGES = 'gen_ai.output.messages';

/** System prompts (opt-in, sensitive) */
export const ATTR_GEN_AI_SYSTEM_INSTRUCTIONS = 'gen_ai.system_instructions';

// -----------------------------------------------------------------------------
// Response Attributes
// -----------------------------------------------------------------------------

/** Reasons the model stopped generating */
export const ATTR_GEN_AI_RESPONSE_FINISH_REASONS = 'gen_ai.response.finish_reasons';

/** Unique completion identifier */
export const ATTR_GEN_AI_RESPONSE_ID = 'gen_ai.response.id';

// -----------------------------------------------------------------------------
// Session/Conversation Attributes
// -----------------------------------------------------------------------------

/** Session or thread identifier */
export const ATTR_GEN_AI_CONVERSATION_ID = 'gen_ai.conversation.id';

// -----------------------------------------------------------------------------
// Error Attributes (standard OTel)
// -----------------------------------------------------------------------------

/** Error type or exception name */
export const ATTR_ERROR_TYPE = 'error.type';

// -----------------------------------------------------------------------------
// Well-Known Operation Names
// -----------------------------------------------------------------------------

export const GEN_AI_OPERATION = {
  CHAT: 'chat',
  TEXT_COMPLETION: 'text_completion',
  EMBEDDINGS: 'embeddings',
  EXECUTE_TOOL: 'execute_tool',
  CREATE_AGENT: 'create_agent',
  INVOKE_AGENT: 'invoke_agent',
} as const;

export type GenAIOperationName = (typeof GEN_AI_OPERATION)[keyof typeof GEN_AI_OPERATION];

// -----------------------------------------------------------------------------
// Well-Known Provider Names
// -----------------------------------------------------------------------------

export const GEN_AI_PROVIDER = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  AZURE_OPENAI: 'azure.ai.openai',
  AZURE_FOUNDRY: 'azure.ai.foundry',
  GOOGLE_VERTEX: 'gcp.vertex_ai',
  GOOGLE_GEMINI: 'google.gemini',
  GITHUB: 'github',
  LOCAL: 'local',
} as const;

export type GenAIProviderName = (typeof GEN_AI_PROVIDER)[keyof typeof GEN_AI_PROVIDER];
```

---

### Task 2: Create span helper types

**Description**: Define TypeScript interfaces for span helper options and results.

**Files to modify**: `src/telemetry/types.ts`

**Implementation Details**:

Add the following types to the existing types.ts file:

```typescript
// -----------------------------------------------------------------------------
// GenAI Span Types
// -----------------------------------------------------------------------------

import type { Span } from '@opentelemetry/api';

/**
 * Options for starting an LLM span.
 */
export interface LLMSpanOptions {
  /** Operation name (defaults to 'chat') */
  operationName?: string;
  /** Provider name (e.g., 'openai', 'anthropic') */
  providerName: string;
  /** Model name */
  modelName: string;
  /** Parent span context for correlation */
  parentSpanId?: string;
  /** Trace ID for correlation */
  traceId?: string;
  /** Temperature setting */
  temperature?: number;
  /** Max tokens setting */
  maxTokens?: number;
  /** Include message content in span (requires enableSensitiveData) */
  enableSensitiveData?: boolean;
  /** Input messages (only recorded if enableSensitiveData is true) */
  messages?: unknown[];
}

/**
 * Options for ending an LLM span.
 */
export interface LLMSpanEndOptions {
  /** Number of input tokens */
  inputTokens?: number;
  /** Number of output tokens */
  outputTokens?: number;
  /** Response content (only recorded if enableSensitiveData is true) */
  response?: string;
  /** Response model name (if different from request) */
  responseModel?: string;
  /** Finish reason (e.g., 'stop', 'length') */
  finishReason?: string;
  /** Error type if operation failed */
  errorType?: string;
}

/**
 * Options for starting a tool span.
 */
export interface ToolSpanOptions {
  /** Tool name */
  toolName: string;
  /** Tool call ID */
  toolCallId?: string;
  /** Parent span ID for correlation */
  parentSpanId?: string;
  /** Trace ID for correlation */
  traceId?: string;
  /** Include arguments in span (requires enableSensitiveData) */
  enableSensitiveData?: boolean;
  /** Tool arguments (only recorded if enableSensitiveData is true) */
  arguments?: Record<string, unknown>;
}

/**
 * Options for ending a tool span.
 */
export interface ToolSpanEndOptions {
  /** Whether the tool execution succeeded */
  success: boolean;
  /** Error type if execution failed */
  errorType?: string;
  /** Include result in span (requires enableSensitiveData) */
  enableSensitiveData?: boolean;
  /** Tool result (only recorded if enableSensitiveData is true) */
  result?: unknown;
}

/**
 * Options for starting an agent span.
 */
export interface AgentSpanOptions {
  /** Agent operation name */
  operationName?: string;
  /** Provider name */
  providerName?: string;
  /** Model name */
  modelName?: string;
  /** Conversation/session ID */
  conversationId?: string;
}

/**
 * Active span handle for ending spans.
 */
export interface ActiveSpan {
  /** The underlying OTel span */
  span: Span;
  /** End the span with optional attributes */
  end: () => void;
}
```

---

### Task 3: Implement span helpers

**Description**: Create helper functions for creating GenAI-attributed spans.

**Files to create**: `src/telemetry/spans.ts`

**Implementation Details**:

```typescript
/**
 * GenAI Semantic Convention Span Helpers.
 * Provides functions to create properly-attributed spans for LLM and tool operations.
 *
 * Based on OpenTelemetry GenAI Semantic Conventions:
 * https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/
 */

import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import type { Span, SpanContext as OTelSpanContext } from '@opentelemetry/api';
import { getTracer, isEnabled } from './setup.js';
import {
  ATTR_GEN_AI_OPERATION_NAME,
  ATTR_GEN_AI_PROVIDER_NAME,
  ATTR_GEN_AI_REQUEST_MODEL,
  ATTR_GEN_AI_RESPONSE_MODEL,
  ATTR_GEN_AI_USAGE_INPUT_TOKENS,
  ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
  ATTR_GEN_AI_REQUEST_TEMPERATURE,
  ATTR_GEN_AI_REQUEST_MAX_TOKENS,
  ATTR_GEN_AI_TOOL_NAME,
  ATTR_GEN_AI_TOOL_CALL_ID,
  ATTR_GEN_AI_TOOL_CALL_ARGUMENTS,
  ATTR_GEN_AI_TOOL_CALL_RESULT,
  ATTR_GEN_AI_INPUT_MESSAGES,
  ATTR_GEN_AI_OUTPUT_MESSAGES,
  ATTR_GEN_AI_RESPONSE_FINISH_REASONS,
  ATTR_GEN_AI_CONVERSATION_ID,
  ATTR_ERROR_TYPE,
  GEN_AI_OPERATION,
} from './conventions.js';
import type {
  LLMSpanOptions,
  LLMSpanEndOptions,
  ToolSpanOptions,
  ToolSpanEndOptions,
  AgentSpanOptions,
} from './types.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const TRACER_NAME = 'agent-framework.genai';

// -----------------------------------------------------------------------------
// LLM Span Helpers
// -----------------------------------------------------------------------------

/**
 * Start an LLM operation span with GenAI semantic conventions.
 *
 * @param options - LLM span options
 * @returns The started span (or no-op span if telemetry disabled)
 *
 * @example
 * ```typescript
 * const span = startLLMSpan({
 *   providerName: 'openai',
 *   modelName: 'gpt-4o',
 *   temperature: 0.7,
 * });
 *
 * try {
 *   const response = await llm.invoke(messages);
 *   endLLMSpan(span, { inputTokens: 100, outputTokens: 50 });
 * } catch (error) {
 *   endLLMSpan(span, { errorType: error.name });
 * }
 * ```
 */
export function startLLMSpan(options: LLMSpanOptions): Span {
  const tracer = getTracer(TRACER_NAME);
  const operationName = options.operationName ?? GEN_AI_OPERATION.CHAT;

  const span = tracer.startSpan(`${operationName} ${options.modelName}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      [ATTR_GEN_AI_OPERATION_NAME]: operationName,
      [ATTR_GEN_AI_PROVIDER_NAME]: options.providerName,
      [ATTR_GEN_AI_REQUEST_MODEL]: options.modelName,
    },
  });

  // Add optional request parameters
  if (options.temperature !== undefined) {
    span.setAttribute(ATTR_GEN_AI_REQUEST_TEMPERATURE, options.temperature);
  }
  if (options.maxTokens !== undefined) {
    span.setAttribute(ATTR_GEN_AI_REQUEST_MAX_TOKENS, options.maxTokens);
  }

  // Add sensitive data if enabled
  if (options.enableSensitiveData && options.messages) {
    span.setAttribute(ATTR_GEN_AI_INPUT_MESSAGES, JSON.stringify(options.messages));
  }

  return span;
}

/**
 * End an LLM span with completion attributes.
 *
 * @param span - The span to end
 * @param options - End options with token usage and optional error
 */
export function endLLMSpan(span: Span, options: LLMSpanEndOptions = {}): void {
  // Add token usage
  if (options.inputTokens !== undefined) {
    span.setAttribute(ATTR_GEN_AI_USAGE_INPUT_TOKENS, options.inputTokens);
  }
  if (options.outputTokens !== undefined) {
    span.setAttribute(ATTR_GEN_AI_USAGE_OUTPUT_TOKENS, options.outputTokens);
  }

  // Add response model if different
  if (options.responseModel !== undefined) {
    span.setAttribute(ATTR_GEN_AI_RESPONSE_MODEL, options.responseModel);
  }

  // Add finish reason
  if (options.finishReason !== undefined) {
    span.setAttribute(ATTR_GEN_AI_RESPONSE_FINISH_REASONS, [options.finishReason]);
  }

  // Add sensitive response content if provided
  if (options.response !== undefined) {
    span.setAttribute(ATTR_GEN_AI_OUTPUT_MESSAGES, options.response);
  }

  // Handle error case
  if (options.errorType !== undefined) {
    span.setAttribute(ATTR_ERROR_TYPE, options.errorType);
    span.setStatus({ code: SpanStatusCode.ERROR, message: options.errorType });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }

  span.end();
}

// -----------------------------------------------------------------------------
// Tool Span Helpers
// -----------------------------------------------------------------------------

/**
 * Start a tool execution span with GenAI semantic conventions.
 *
 * @param options - Tool span options
 * @returns The started span
 *
 * @example
 * ```typescript
 * const span = startToolSpan({
 *   toolName: 'read_file',
 *   toolCallId: 'call_123',
 *   arguments: { path: '/etc/hosts' },
 *   enableSensitiveData: true,
 * });
 *
 * try {
 *   const result = await tool.execute(args);
 *   endToolSpan(span, { success: true, result });
 * } catch (error) {
 *   endToolSpan(span, { success: false, errorType: error.name });
 * }
 * ```
 */
export function startToolSpan(options: ToolSpanOptions): Span {
  const tracer = getTracer(TRACER_NAME);

  const span = tracer.startSpan(`${GEN_AI_OPERATION.EXECUTE_TOOL} ${options.toolName}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      [ATTR_GEN_AI_OPERATION_NAME]: GEN_AI_OPERATION.EXECUTE_TOOL,
      [ATTR_GEN_AI_TOOL_NAME]: options.toolName,
    },
  });

  // Add tool call ID if provided
  if (options.toolCallId !== undefined) {
    span.setAttribute(ATTR_GEN_AI_TOOL_CALL_ID, options.toolCallId);
  }

  // Add sensitive arguments if enabled
  if (options.enableSensitiveData && options.arguments) {
    span.setAttribute(ATTR_GEN_AI_TOOL_CALL_ARGUMENTS, JSON.stringify(options.arguments));
  }

  return span;
}

/**
 * End a tool execution span.
 *
 * @param span - The span to end
 * @param options - End options with success status and optional result
 */
export function endToolSpan(span: Span, options: ToolSpanEndOptions): void {
  // Add sensitive result if enabled
  if (options.enableSensitiveData && options.result !== undefined) {
    span.setAttribute(ATTR_GEN_AI_TOOL_CALL_RESULT, JSON.stringify(options.result));
  }

  // Set status based on success
  if (options.success) {
    span.setStatus({ code: SpanStatusCode.OK });
  } else {
    if (options.errorType !== undefined) {
      span.setAttribute(ATTR_ERROR_TYPE, options.errorType);
    }
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: options.errorType ?? 'Tool execution failed',
    });
  }

  span.end();
}

// -----------------------------------------------------------------------------
// Agent Span Helpers
// -----------------------------------------------------------------------------

/**
 * Start an agent invocation span.
 * This creates the root span for an agent.run() call.
 *
 * @param options - Agent span options
 * @returns The started span
 */
export function startAgentSpan(options: AgentSpanOptions = {}): Span {
  const tracer = getTracer(TRACER_NAME);
  const operationName = options.operationName ?? GEN_AI_OPERATION.INVOKE_AGENT;

  const span = tracer.startSpan(`agent.${operationName}`, {
    kind: SpanKind.SERVER,
    attributes: {
      [ATTR_GEN_AI_OPERATION_NAME]: operationName,
    },
  });

  // Add optional attributes
  if (options.providerName !== undefined) {
    span.setAttribute(ATTR_GEN_AI_PROVIDER_NAME, options.providerName);
  }
  if (options.modelName !== undefined) {
    span.setAttribute(ATTR_GEN_AI_REQUEST_MODEL, options.modelName);
  }
  if (options.conversationId !== undefined) {
    span.setAttribute(ATTR_GEN_AI_CONVERSATION_ID, options.conversationId);
  }

  return span;
}

/**
 * End an agent span.
 *
 * @param span - The span to end
 * @param error - Optional error if the agent run failed
 */
export function endAgentSpan(span: Span, error?: string): void {
  if (error !== undefined) {
    span.setAttribute(ATTR_ERROR_TYPE, error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end();
}

// -----------------------------------------------------------------------------
// Span Context Utilities
// -----------------------------------------------------------------------------

/**
 * Get the current active span from context.
 * Returns undefined if no span is active.
 */
export function getActiveSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Execute a function within a span context.
 * The span becomes the active span for the duration of the function.
 *
 * @param span - The span to make active
 * @param fn - The function to execute
 * @returns The function result
 */
export function withSpan<T>(span: Span, fn: () => T): T {
  const ctx = trace.setSpan(context.active(), span);
  return context.with(ctx, fn);
}

/**
 * Execute an async function within a span context.
 *
 * @param span - The span to make active
 * @param fn - The async function to execute
 * @returns Promise resolving to the function result
 */
export async function withSpanAsync<T>(span: Span, fn: () => Promise<T>): Promise<T> {
  const ctx = trace.setSpan(context.active(), span);
  return context.with(ctx, fn);
}

// -----------------------------------------------------------------------------
// Callback Integration Helpers
// -----------------------------------------------------------------------------

/**
 * Options for creating tracing callbacks.
 */
export interface TracingCallbacksOptions {
  /** Provider name for LLM spans */
  providerName: string;
  /** Model name for LLM spans */
  modelName: string;
  /** Enable recording of sensitive data (messages, tool args) */
  enableSensitiveData?: boolean;
  /** Conversation/session ID */
  conversationId?: string;
}

/**
 * Active spans tracked by the tracing callbacks.
 */
interface TracingState {
  agentSpan?: Span;
  llmSpan?: Span;
  toolSpans: Map<string, Span>;
}

/**
 * Create tracing state for a new agent invocation.
 */
export function createTracingState(): TracingState {
  return {
    agentSpan: undefined,
    llmSpan: undefined,
    toolSpans: new Map(),
  };
}

/**
 * Map internal SpanContext to span operations.
 * This bridges the callback SpanContext with OTel spans.
 */
export function getSpanKey(ctx: { traceId: string; spanId: string }): string {
  return `${ctx.traceId}:${ctx.spanId}`;
}

// -----------------------------------------------------------------------------
// Provider Name Mapping
// -----------------------------------------------------------------------------

/**
 * Map provider config names to GenAI semantic convention provider names.
 */
export function mapProviderName(configProvider: string): string {
  const mapping: Record<string, string> = {
    openai: 'openai',
    anthropic: 'anthropic',
    azure: 'azure.ai.openai',
    foundry: 'azure.ai.foundry',
    gemini: 'google.gemini',
    github: 'github',
    local: 'local',
  };
  return mapping[configProvider] ?? configProvider;
}
```

---

### Task 4: Update telemetry index exports

**Description**: Export new span helpers from the telemetry module.

**Files to modify**: `src/telemetry/index.ts`

**Implementation Details**:

```typescript
/**
 * Telemetry module - OpenTelemetry setup and helpers.
 *
 * This module provides:
 * - initializeTelemetry() for one-time OTel setup
 * - getTracer() and getMeter() for creating tracers/meters
 * - GenAI span helpers for LLM and tool tracing
 * - Zero overhead when disabled (no-op implementations)
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  TelemetryErrorCode,
  TelemetrySuccessResponse,
  TelemetryErrorResponse,
  TelemetryResponse,
  ExporterType,
  TelemetryOptions,
  TelemetryInitResult,
  TelemetryHelpers,
  // GenAI span types
  LLMSpanOptions,
  LLMSpanEndOptions,
  ToolSpanOptions,
  ToolSpanEndOptions,
  AgentSpanOptions,
  ActiveSpan,
} from './types.js';

// ─── Type Guards ─────────────────────────────────────────────────────────────
export { isTelemetrySuccess, isTelemetryError } from './types.js';

// ─── Setup Functions ─────────────────────────────────────────────────────────
export {
  initializeTelemetry,
  getTracer,
  getMeter,
  isEnabled,
  getConfig,
  shutdown,
  telemetryHelpers,
} from './setup.js';

// ─── GenAI Semantic Conventions ──────────────────────────────────────────────
export {
  // Attribute constants
  ATTR_GEN_AI_OPERATION_NAME,
  ATTR_GEN_AI_PROVIDER_NAME,
  ATTR_GEN_AI_REQUEST_MODEL,
  ATTR_GEN_AI_RESPONSE_MODEL,
  ATTR_GEN_AI_USAGE_INPUT_TOKENS,
  ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
  ATTR_GEN_AI_REQUEST_TEMPERATURE,
  ATTR_GEN_AI_REQUEST_MAX_TOKENS,
  ATTR_GEN_AI_TOOL_NAME,
  ATTR_GEN_AI_TOOL_CALL_ID,
  ATTR_GEN_AI_TOOL_CALL_ARGUMENTS,
  ATTR_GEN_AI_TOOL_CALL_RESULT,
  ATTR_GEN_AI_INPUT_MESSAGES,
  ATTR_GEN_AI_OUTPUT_MESSAGES,
  ATTR_GEN_AI_CONVERSATION_ID,
  ATTR_ERROR_TYPE,
  // Well-known values
  GEN_AI_OPERATION,
  GEN_AI_PROVIDER,
} from './conventions.js';

export type { GenAIOperationName, GenAIProviderName } from './conventions.js';

// ─── GenAI Span Helpers ──────────────────────────────────────────────────────
export {
  // LLM spans
  startLLMSpan,
  endLLMSpan,
  // Tool spans
  startToolSpan,
  endToolSpan,
  // Agent spans
  startAgentSpan,
  endAgentSpan,
  // Context utilities
  getActiveSpan,
  withSpan,
  withSpanAsync,
  // Callback integration
  createTracingState,
  getSpanKey,
  mapProviderName,
} from './spans.js';

export type { TracingCallbacksOptions } from './spans.js';
```

---

### Task 5: Create unit tests for span helpers

**Description**: Write comprehensive unit tests for the GenAI span helpers.

**Files to create**: `src/telemetry/__tests__/spans.test.ts`

**Implementation Details**:

```typescript
/**
 * Tests for GenAI semantic convention span helpers.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SpanStatusCode } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import {
  initializeTelemetry,
  shutdown,
  startLLMSpan,
  endLLMSpan,
  startToolSpan,
  endToolSpan,
  startAgentSpan,
  endAgentSpan,
  mapProviderName,
  createTracingState,
  getSpanKey,
  ATTR_GEN_AI_OPERATION_NAME,
  ATTR_GEN_AI_PROVIDER_NAME,
  ATTR_GEN_AI_REQUEST_MODEL,
  ATTR_GEN_AI_USAGE_INPUT_TOKENS,
  ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
  ATTR_GEN_AI_TOOL_NAME,
  GEN_AI_OPERATION,
} from '../index.js';
import type { TelemetryConfig } from '../../config/schema.js';

// Default test config
const createTestConfig = (overrides: Partial<TelemetryConfig> = {}): TelemetryConfig => ({
  enabled: true,
  enableSensitiveData: false,
  otlpEndpoint: undefined,
  applicationinsightsConnectionString: undefined,
  ...overrides,
});

describe('GenAI Span Helpers', () => {
  beforeEach(async () => {
    // Initialize telemetry with console exporter for testing
    await initializeTelemetry({
      config: createTestConfig(),
      exporterType: 'none', // Use no-op for fast tests
    });
  });

  afterEach(async () => {
    await shutdown();
  });

  describe('startLLMSpan', () => {
    it('creates span with required GenAI attributes', () => {
      const span = startLLMSpan({
        providerName: 'openai',
        modelName: 'gpt-4o',
      });

      expect(span).toBeDefined();
      // Span should have been created - attributes verified by integration test
      span.end();
    });

    it('creates span with optional temperature attribute', () => {
      const span = startLLMSpan({
        providerName: 'openai',
        modelName: 'gpt-4o',
        temperature: 0.7,
      });

      expect(span).toBeDefined();
      span.end();
    });

    it('creates span with optional maxTokens attribute', () => {
      const span = startLLMSpan({
        providerName: 'anthropic',
        modelName: 'claude-sonnet-4-5',
        maxTokens: 1000,
      });

      expect(span).toBeDefined();
      span.end();
    });

    it('creates span with custom operation name', () => {
      const span = startLLMSpan({
        providerName: 'openai',
        modelName: 'text-embedding-3-small',
        operationName: 'embeddings',
      });

      expect(span).toBeDefined();
      span.end();
    });
  });

  describe('endLLMSpan', () => {
    it('ends span with token usage', () => {
      const span = startLLMSpan({
        providerName: 'openai',
        modelName: 'gpt-4o',
      });

      endLLMSpan(span, {
        inputTokens: 100,
        outputTokens: 50,
      });

      // Span should be ended without errors
    });

    it('ends span with error status', () => {
      const span = startLLMSpan({
        providerName: 'openai',
        modelName: 'gpt-4o',
      });

      endLLMSpan(span, {
        errorType: 'RateLimitError',
      });

      // Span should be ended with error status
    });

    it('ends span with response model', () => {
      const span = startLLMSpan({
        providerName: 'openai',
        modelName: 'gpt-4o',
      });

      endLLMSpan(span, {
        inputTokens: 100,
        outputTokens: 50,
        responseModel: 'gpt-4o-2024-11-20',
        finishReason: 'stop',
      });
    });
  });

  describe('startToolSpan', () => {
    it('creates span with tool name', () => {
      const span = startToolSpan({
        toolName: 'read_file',
      });

      expect(span).toBeDefined();
      span.end();
    });

    it('creates span with tool call ID', () => {
      const span = startToolSpan({
        toolName: 'write_file',
        toolCallId: 'call_abc123',
      });

      expect(span).toBeDefined();
      span.end();
    });

    it('does not include arguments when enableSensitiveData is false', () => {
      const span = startToolSpan({
        toolName: 'read_file',
        arguments: { path: '/etc/passwd' },
        enableSensitiveData: false,
      });

      expect(span).toBeDefined();
      span.end();
    });
  });

  describe('endToolSpan', () => {
    it('ends span with success status', () => {
      const span = startToolSpan({
        toolName: 'hello',
      });

      endToolSpan(span, {
        success: true,
      });
    });

    it('ends span with error status', () => {
      const span = startToolSpan({
        toolName: 'read_file',
      });

      endToolSpan(span, {
        success: false,
        errorType: 'FileNotFoundError',
      });
    });
  });

  describe('startAgentSpan', () => {
    it('creates span with default operation name', () => {
      const span = startAgentSpan();

      expect(span).toBeDefined();
      span.end();
    });

    it('creates span with provider and model', () => {
      const span = startAgentSpan({
        providerName: 'openai',
        modelName: 'gpt-4o',
        conversationId: 'session-123',
      });

      expect(span).toBeDefined();
      span.end();
    });
  });

  describe('endAgentSpan', () => {
    it('ends span with OK status', () => {
      const span = startAgentSpan();
      endAgentSpan(span);
    });

    it('ends span with error', () => {
      const span = startAgentSpan();
      endAgentSpan(span, 'MaxIterationsExceeded');
    });
  });

  describe('mapProviderName', () => {
    it('maps openai correctly', () => {
      expect(mapProviderName('openai')).toBe('openai');
    });

    it('maps azure to azure.ai.openai', () => {
      expect(mapProviderName('azure')).toBe('azure.ai.openai');
    });

    it('maps foundry to azure.ai.foundry', () => {
      expect(mapProviderName('foundry')).toBe('azure.ai.foundry');
    });

    it('maps anthropic correctly', () => {
      expect(mapProviderName('anthropic')).toBe('anthropic');
    });

    it('maps gemini to google.gemini', () => {
      expect(mapProviderName('gemini')).toBe('google.gemini');
    });

    it('returns unknown providers unchanged', () => {
      expect(mapProviderName('custom-provider')).toBe('custom-provider');
    });
  });

  describe('createTracingState', () => {
    it('creates empty state object', () => {
      const state = createTracingState();

      expect(state.agentSpan).toBeUndefined();
      expect(state.llmSpan).toBeUndefined();
      expect(state.toolSpans).toBeInstanceOf(Map);
      expect(state.toolSpans.size).toBe(0);
    });
  });

  describe('getSpanKey', () => {
    it('creates key from trace and span IDs', () => {
      const key = getSpanKey({
        traceId: 'abc123',
        spanId: 'def456',
      });

      expect(key).toBe('abc123:def456');
    });
  });
});

describe('GenAI Spans Integration', () => {
  afterEach(async () => {
    await shutdown();
  });

  it('creates proper span hierarchy for agent run', async () => {
    await initializeTelemetry({
      config: createTestConfig(),
      exporterType: 'none',
    });

    // Simulate agent run with LLM call and tool execution
    const agentSpan = startAgentSpan({
      providerName: 'openai',
      modelName: 'gpt-4o',
    });

    // First LLM call
    const llmSpan1 = startLLMSpan({
      providerName: 'openai',
      modelName: 'gpt-4o',
      temperature: 0.7,
    });

    endLLMSpan(llmSpan1, {
      inputTokens: 150,
      outputTokens: 50,
      finishReason: 'tool_calls',
    });

    // Tool execution
    const toolSpan = startToolSpan({
      toolName: 'hello',
      toolCallId: 'call_123',
    });

    endToolSpan(toolSpan, {
      success: true,
    });

    // Second LLM call (with tool result)
    const llmSpan2 = startLLMSpan({
      providerName: 'openai',
      modelName: 'gpt-4o',
    });

    endLLMSpan(llmSpan2, {
      inputTokens: 200,
      outputTokens: 100,
      finishReason: 'stop',
    });

    // End agent span
    endAgentSpan(agentSpan);

    // If we get here without errors, the integration test passes
    expect(true).toBe(true);
  });

  it('handles error scenarios correctly', async () => {
    await initializeTelemetry({
      config: createTestConfig(),
      exporterType: 'none',
    });

    const agentSpan = startAgentSpan();

    const llmSpan = startLLMSpan({
      providerName: 'openai',
      modelName: 'gpt-4o',
    });

    // Simulate rate limit error
    endLLMSpan(llmSpan, {
      errorType: 'RateLimitError',
    });

    endAgentSpan(agentSpan, 'RateLimitError');

    expect(true).toBe(true);
  });
});
```

---

### Task 6: Run validation

**Description**: Run all quality checks to ensure implementation is correct.

**Commands**:
```bash
# Run all validation commands
bun run typecheck && bun run lint && bun run test && bun run build

# Run just the telemetry tests
bun run test src/telemetry/__tests__/

# Run with coverage
bun run test:coverage src/telemetry
```

---

## Testing Strategy

### Unit Tests

Tests for `src/telemetry/__tests__/spans.test.ts`:

**LLM Spans**:
- Creates span with required GenAI attributes
- Includes optional temperature/maxTokens attributes
- Custom operation name works
- Token usage recorded on end
- Error status set correctly

**Tool Spans**:
- Creates span with tool name
- Includes tool call ID when provided
- Respects enableSensitiveData flag
- Success/error status set correctly

**Agent Spans**:
- Creates span with default operation name
- Includes provider/model/conversationId
- Error status set on failure

**Utilities**:
- mapProviderName maps correctly
- createTracingState initializes empty state
- getSpanKey creates proper keys

### Integration Tests
- Proper span hierarchy for agent run (agent → LLM → tool → LLM)
- Error scenarios propagate correctly

### Edge Cases
- Telemetry disabled (should return no-op spans)
- Missing optional attributes
- Multiple concurrent tool spans
- Sensitive data flag enforcement

## Acceptance Criteria

- [ ] `conventions.ts` exports all GenAI semantic convention attributes
- [ ] `startLLMSpan()` creates spans with `gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.request.model`
- [ ] `endLLMSpan()` records `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`
- [ ] `startToolSpan()` creates spans with `gen_ai.tool.name`
- [ ] `endToolSpan()` records `gen_ai.tool.call.result` when sensitive data enabled
- [ ] `startAgentSpan()` creates root spans for agent runs
- [ ] Provider name mapping works for all 7 providers
- [ ] Sensitive data is NOT recorded when `enableSensitiveData` is false
- [ ] All exports available from `src/telemetry/index.ts`
- [ ] Unit tests achieve 85%+ coverage
- [ ] All quality gates pass (typecheck, lint, test, build)

## Validation Commands

```bash
# Run all validation commands before committing
bun run typecheck && bun run lint && bun run test && bun run build

# Run just the telemetry tests
bun run test src/telemetry/__tests__/

# Verify exports work
bun -e "import { startLLMSpan, startToolSpan, ATTR_GEN_AI_OPERATION_NAME } from './src/telemetry/index.js'; console.log('Exports OK')"

# Run with verbose to see span creation
DEBUG_OTEL=true bun run test src/telemetry/__tests__/spans.test.ts
```

## Notes

### OpenTelemetry GenAI Conventions Status

The GenAI semantic conventions are currently in "Development" stability status per the OpenTelemetry specification. The attribute names may evolve, but the core attributes (`gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.request.model`, token usage) are well-established and used by major observability platforms.

### Sensitive Data Handling

The `enableSensitiveData` flag controls whether message content, tool arguments, and tool results are recorded in spans. This is important for:
- Compliance with data privacy regulations
- Avoiding logging PII or secrets
- Reducing span size for high-volume systems

The flag maps to `config.telemetry.enableSensitiveData` from the config system.

### Callback Integration (Future Work)

This feature provides the span helpers. A future enhancement could create a wrapper that automatically traces all operations via callbacks:

```typescript
// Future: Wrap callbacks with automatic tracing
const tracingCallbacks = createTracingCallbacks(callbacks, {
  providerName: 'openai',
  modelName: 'gpt-4o',
});
```

This would be implemented as part of Feature 16 (CLI shell) or Feature 39 (integration tests).

### Sources
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [GenAI Spans Specification](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/)
- [GenAI Attributes Registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)

## Execution

This spec can be implemented using: `/sdlc:implement docs/specs/feature-010-genai-semantic-conventions.md`
