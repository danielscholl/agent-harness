# Feature 4: Multi-Provider LLM Abstraction with OpenAI

## Feature Description

This feature implements the multi-provider LLM abstraction layer in `src/model/llm.ts`. It establishes the foundational pattern for routing LLM calls through a config-based provider selection system. The provider is determined by `config.providers.default` (e.g., "openai"), not by parsing model name prefixes.

The initial implementation focuses on OpenAI (`@langchain/openai`) with full support for:
- Config-based provider routing via a registry pattern
- Basic streaming support for real-time response generation
- Integration with the existing configuration system (Feature 2)
- Structured response types following the project's response contract pattern

This establishes the architecture that will be extended in later features to support Anthropic, Gemini, Azure, and other providers.

## User Story

As an agent framework developer
I want a config-based LLM abstraction layer with OpenAI support
So that I can make LLM calls through a unified interface that can be extended to multiple providers

## Problem Statement

The agent framework needs:
1. A provider-agnostic interface for LLM operations (invoke, stream)
2. Config-based provider selection (not model prefix parsing)
3. A registry pattern for adding providers incrementally
4. Proper error handling following the project's structured response pattern
5. Streaming support for real-time response generation
6. Type-safe integration with LangChain.js `BaseChatModel`

Without this foundation:
- The agent cannot make LLM calls
- Adding providers later would require architectural changes
- Error handling would be inconsistent with the rest of the codebase
- Streaming would need to be retrofitted

## Solution Statement

Implement a `model/` module with:
1. **Type definitions** (`types.ts`): `ModelResponse<T>`, `ModelErrorCode`, `LLMCallbacks`, interfaces
2. **OpenAI provider factory** (`providers/openai.ts`): Creates `ChatOpenAI` instances from config
3. **Provider registry** (`registry.ts`): Maps provider names to factory functions
4. **Main client** (`llm.ts`): `LLMClient` class with `invoke()` and `stream()` methods
5. **Index exports** (`index.ts`): Clean public API
6. **Comprehensive tests** (`__tests__/`): 85% coverage minimum

The solution follows the established patterns from `src/config/` and `src/tools/` modules.

## Related Documentation

### Requirements
- Feature defined in: `docs/plans/typescript-rewrite-features.md` (Feature 4)
- Phase: 1a (Foundation - Core)
- Dependencies: Feature 2 (Config), Feature 3 (Tool wrapper - for response patterns)

### Architecture Decisions
- ADR-0002: LangChain.js for LLM Integration - defines provider packages and factory pattern
- ADR-0004: Zod for Validation - applies to config validation
- ADR-0007: Callbacks over EventBus - streaming callbacks follow this pattern

### Reference Documents
- `docs/architecture.md`: Provider Architecture section (lines 137-206)
- `docs/architecture.md`: Model Layer description
- LangChain.js documentation: ChatOpenAI usage patterns

## Codebase Analysis Findings

### Architecture Patterns

**Dependency Injection Pattern** (from `src/config/manager.ts`):
```typescript
export class ConfigManager {
  private readonly fileSystem: IFileSystem;
  private readonly envReader: IEnvReader;
  private readonly callbacks?: ConfigCallbacks;

  constructor(options: ConfigManagerOptions = {}) {
    this.fileSystem = options.fileSystem ?? new NodeFileSystem();
    this.envReader = options.envReader ?? new ProcessEnvReader();
    this.callbacks = options.callbacks;
  }
}
```

**Module Export Pattern** (from `src/config/index.ts`):
- Constants first
- Schemas and validators
- Main class and utilities
- Types exported separately

### Coding Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Interfaces | `I` prefix for injectable deps | `IFileSystem`, `IEnvReader` |
| Types (from Zod) | PascalCase, no prefix | `AppConfig`, `ProviderConfig` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_OPENAI_MODEL` |
| Functions | camelCase | `loadConfig`, `createTool` |
| Classes | PascalCase | `ConfigManager`, `LLMClient` |
| Private fields | readonly when possible | `private readonly config` |

### Response Contract Pattern (from `src/tools/types.ts`)

```typescript
export type ToolResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export interface SuccessResponse<T = unknown> {
  success: true;
  result: T;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: ToolErrorCode;
  message: string;
}
```

### Configuration Access Pattern

Provider config is accessed via `config.providers[providerName]` after loading:
```typescript
const providerName = config.providers.default;  // e.g., 'openai'
const providerConfig = config.providers[providerName];  // e.g., { apiKey, model }
```

### Testing Patterns (from `src/config/__tests__/manager.test.ts`)

- Mock implementations of interfaces
- `beforeEach` setup with fresh mocks
- Test both success and error paths
- Handle non-Error throws
- Test callbacks invocation

## Archon Project

**Project ID**: `1b0d4ab3-ce54-4b55-8d1e-3c44c794f47f`

## Relevant Files

### Existing Files
- `src/config/schema.ts`: Provider configuration schemas (lines 40-139)
- `src/config/constants.ts`: Default models and provider names
- `src/config/manager.ts`: Config loading patterns to follow
- `src/tools/types.ts`: Response contract pattern template
- `src/tools/base.ts`: Helper function patterns
- `package.json`: Has `@langchain/openai: ^0.3.0` dependency

### New Files
- `src/model/types.ts`: ModelResponse, ModelErrorCode, interfaces
- `src/model/providers/openai.ts`: OpenAI factory function
- `src/model/registry.ts`: Provider registry
- `src/model/llm.ts`: Main LLMClient class
- `src/model/index.ts`: Public API exports
- `src/model/__tests__/llm.test.ts`: Unit tests
- `src/model/__tests__/openai.test.ts`: OpenAI provider tests

## Implementation Plan

### Phase 1: Type Definitions
Create type definitions for the model layer that align with existing response patterns.

### Phase 2: OpenAI Provider Factory
Implement the OpenAI provider factory that creates ChatOpenAI instances from config.

### Phase 3: Provider Registry
Create the registry that maps provider names to factory functions.

### Phase 4: LLM Client
Implement the main LLMClient class with invoke() and stream() methods.

### Phase 5: Tests and Validation
Write comprehensive tests with mocked LangChain models.

## Step by Step Tasks

### Task 1: Create types.ts with ModelResponse and interfaces

**Description**: Define core type definitions for the model layer, following the ToolResponse pattern.

**Files to create**: `src/model/types.ts`

**Implementation Details**:

```typescript
// src/model/types.ts

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AIMessageChunk } from '@langchain/core/messages';
import type { IterableReadableStream } from '@langchain/core/utils/stream';

/**
 * Error codes for model operations.
 * Aligned with ToolErrorCode but specific to LLM operations.
 */
export type ModelErrorCode =
  | 'PROVIDER_NOT_CONFIGURED'  // Provider config missing
  | 'PROVIDER_NOT_SUPPORTED'   // Unknown provider name
  | 'AUTHENTICATION_ERROR'     // API key invalid or missing
  | 'RATE_LIMITED'             // Rate limit exceeded
  | 'MODEL_NOT_FOUND'          // Model name not available
  | 'CONTEXT_LENGTH_EXCEEDED'  // Input too long
  | 'NETWORK_ERROR'            // Connection failed
  | 'TIMEOUT'                  // Request timed out
  | 'INVALID_RESPONSE'         // Malformed response
  | 'UNKNOWN';                 // Unexpected errors

/**
 * Success response from a model operation.
 */
export interface ModelSuccessResponse<T = unknown> {
  success: true;
  result: T;
  message: string;
}

/**
 * Error response from a model operation.
 */
export interface ModelErrorResponse {
  success: false;
  error: ModelErrorCode;
  message: string;
}

/**
 * Discriminated union for model responses.
 * Model operations return this type at public boundaries.
 */
export type ModelResponse<T = unknown> = ModelSuccessResponse<T> | ModelErrorResponse;

/**
 * Type guard for success responses.
 */
export function isModelSuccess<T>(
  response: ModelResponse<T>
): response is ModelSuccessResponse<T> {
  return response.success;
}

/**
 * Type guard for error responses.
 */
export function isModelError(
  response: ModelResponse<unknown>
): response is ModelErrorResponse {
  return !response.success;
}

/**
 * Token usage information from an LLM call.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Result from a successful invoke operation.
 */
export interface InvokeResult {
  content: string;
  usage?: TokenUsage;
}

/**
 * Callbacks for LLM operations.
 * Follows the callbacks pattern from architecture.md.
 */
export interface LLMCallbacks {
  /** Called when streaming starts */
  onStreamStart?: () => void;
  /** Called for each streamed chunk */
  onStreamChunk?: (chunk: string) => void;
  /** Called when streaming ends */
  onStreamEnd?: (usage?: TokenUsage) => void;
  /** Called on errors */
  onError?: (error: ModelErrorCode, message: string) => void;
}

/**
 * Options for LLM client operations.
 */
export interface LLMCallOptions {
  /** Override the model for this call */
  model?: string;
  /** Temperature for generation (0-1) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Provider factory function type.
 * Creates a LangChain BaseChatModel from provider config.
 */
export type ProviderFactory = (
  config: Record<string, unknown>
) => ModelResponse<BaseChatModel>;

/**
 * Stream result type - async iterable of chunks.
 */
export type StreamResult = IterableReadableStream<AIMessageChunk>;
```

---

### Task 2: Create helper functions in base.ts

**Description**: Create helper functions for responses (following tools/base.ts pattern).

**Files to create**: `src/model/base.ts`

**Implementation Details**:

```typescript
// src/model/base.ts

import type {
  ModelResponse,
  ModelErrorCode,
  ModelSuccessResponse,
  ModelErrorResponse,
  TokenUsage,
} from './types.js';

/**
 * Create a success response.
 */
export function successResponse<T>(result: T, message: string): ModelSuccessResponse<T> {
  return { success: true, result, message };
}

/**
 * Create an error response.
 */
export function errorResponse(error: ModelErrorCode, message: string): ModelErrorResponse {
  return { success: false, error, message };
}

/**
 * Map common LLM errors to ModelErrorCode.
 */
export function mapErrorToCode(error: unknown): ModelErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('api key') || message.includes('authentication') || message.includes('unauthorized')) {
      return 'AUTHENTICATION_ERROR';
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return 'RATE_LIMITED';
    }
    if (message.includes('model') && message.includes('not found')) {
      return 'MODEL_NOT_FOUND';
    }
    if (message.includes('context length') || message.includes('too long') || message.includes('token limit')) {
      return 'CONTEXT_LENGTH_EXCEEDED';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT';
    }
    if (message.includes('network') || message.includes('econnrefused') || message.includes('fetch failed')) {
      return 'NETWORK_ERROR';
    }
  }
  return 'UNKNOWN';
}

/**
 * Extract token usage from LangChain response metadata.
 */
export function extractTokenUsage(metadata: Record<string, unknown> | undefined): TokenUsage | undefined {
  if (!metadata) return undefined;

  // OpenAI format
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

---

### Task 3: Create OpenAI provider factory

**Description**: Implement the OpenAI provider factory using @langchain/openai.

**Files to create**: `src/model/providers/openai.ts`

**Implementation Details**:

```typescript
// src/model/providers/openai.ts

import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { OpenAIProviderConfig } from '../../config/schema.js';
import type { ModelResponse } from '../types.js';
import { successResponse, errorResponse } from '../base.js';

/**
 * Create a ChatOpenAI instance from provider config.
 *
 * @param config - OpenAI provider configuration
 * @returns ModelResponse with ChatOpenAI or error
 */
export function createOpenAIClient(
  config: OpenAIProviderConfig
): ModelResponse<BaseChatModel> {
  try {
    // API key can come from config or OPENAI_API_KEY env var
    const apiKey = config.apiKey;

    // Create ChatOpenAI instance
    const client = new ChatOpenAI({
      model: config.model,
      openAIApiKey: apiKey,
      configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
    });

    return successResponse(
      client as BaseChatModel,
      `OpenAI client created with model: ${config.model}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create OpenAI client';
    return errorResponse('AUTHENTICATION_ERROR', message);
  }
}
```

---

### Task 4: Create provider registry

**Description**: Create the registry that maps provider names to factory functions.

**Files to create**: `src/model/registry.ts`

**Implementation Details**:

```typescript
// src/model/registry.ts

import type { ProviderName } from '../config/constants.js';
import type { ProviderFactory } from './types.js';
import { createOpenAIClient } from './providers/openai.js';

/**
 * Registry mapping provider names to their factory functions.
 *
 * Providers are added incrementally:
 * - Feature 4: OpenAI (this feature)
 * - Feature 12: Anthropic
 * - Feature 13: Gemini
 * - Feature 14: Azure OpenAI
 * - Feature 25: GitHub Models
 * - Feature 26: Local (Docker)
 * - Feature 31: Azure AI Foundry
 */
export const PROVIDER_REGISTRY: Partial<Record<ProviderName, ProviderFactory>> = {
  openai: createOpenAIClient,
  // Future providers will be added here:
  // anthropic: createAnthropicClient,
  // gemini: createGeminiClient,
  // azure: createAzureOpenAIClient,
  // github: createGitHubClient,
  // local: createLocalClient,
  // foundry: createFoundryClient,
};

/**
 * Get the factory function for a provider.
 *
 * @param providerName - Name of the provider
 * @returns Factory function or undefined if not supported
 */
export function getProviderFactory(providerName: ProviderName): ProviderFactory | undefined {
  return PROVIDER_REGISTRY[providerName];
}

/**
 * Check if a provider is supported.
 *
 * @param providerName - Name of the provider
 * @returns true if the provider has a registered factory
 */
export function isProviderSupported(providerName: ProviderName): boolean {
  return providerName in PROVIDER_REGISTRY;
}

/**
 * Get list of supported provider names.
 */
export function getSupportedProviders(): ProviderName[] {
  return Object.keys(PROVIDER_REGISTRY) as ProviderName[];
}
```

---

### Task 5: Create LLMClient class

**Description**: Implement the main LLMClient class with invoke() and stream() methods.

**Files to create**: `src/model/llm.ts`

**Implementation Details**:

```typescript
// src/model/llm.ts

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { AppConfig } from '../config/schema.js';
import type { ProviderName } from '../config/constants.js';
import type {
  ModelResponse,
  InvokeResult,
  LLMCallbacks,
  LLMCallOptions,
  StreamResult,
  TokenUsage,
} from './types.js';
import { successResponse, errorResponse, mapErrorToCode, extractTokenUsage } from './base.js';
import { getProviderFactory, isProviderSupported } from './registry.js';

/**
 * Options for creating an LLMClient.
 */
export interface LLMClientOptions {
  /** Application configuration */
  config: AppConfig;
  /** Optional callbacks for streaming events */
  callbacks?: LLMCallbacks;
}

/**
 * LLMClient provides a unified interface for LLM operations.
 *
 * Provider selection is based on config.providers.default, not model prefix parsing.
 * This class follows the dependency injection pattern from the config module.
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const client = new LLMClient({ config: config.result! });
 *
 * // Simple invocation
 * const result = await client.invoke('Hello, world!');
 * if (result.success) {
 *   console.log(result.result.content);
 * }
 *
 * // Streaming
 * const stream = await client.stream('Tell me a story');
 * if (stream.success) {
 *   for await (const chunk of stream.result) {
 *     process.stdout.write(chunk.content);
 *   }
 * }
 * ```
 */
export class LLMClient {
  private readonly config: AppConfig;
  private readonly callbacks?: LLMCallbacks;
  private client: BaseChatModel | null = null;
  private currentProvider: ProviderName | null = null;

  constructor(options: LLMClientOptions) {
    this.config = options.config;
    this.callbacks = options.callbacks;
  }

  /**
   * Get or create the LangChain chat model client.
   * Lazily initializes the client on first use.
   */
  private getClient(): ModelResponse<BaseChatModel> {
    const providerName = this.config.providers.default;

    // Return cached client if provider hasn't changed
    if (this.client && this.currentProvider === providerName) {
      return successResponse(this.client, 'Using cached client');
    }

    // Check if provider is supported
    if (!isProviderSupported(providerName)) {
      return errorResponse(
        'PROVIDER_NOT_SUPPORTED',
        `Provider '${providerName}' is not yet supported. Supported providers: openai`
      );
    }

    // Get provider config
    const providerConfig = this.config.providers[providerName];
    if (!providerConfig) {
      return errorResponse(
        'PROVIDER_NOT_CONFIGURED',
        `Provider '${providerName}' is set as default but not configured`
      );
    }

    // Get factory and create client
    const factory = getProviderFactory(providerName);
    if (!factory) {
      return errorResponse(
        'PROVIDER_NOT_SUPPORTED',
        `No factory registered for provider '${providerName}'`
      );
    }

    const result = factory(providerConfig);
    if (result.success) {
      this.client = result.result;
      this.currentProvider = providerName;
    }

    return result;
  }

  /**
   * Convert a simple string or messages array to LangChain messages.
   */
  private toMessages(input: string | BaseMessage[]): BaseMessage[] {
    if (typeof input === 'string') {
      return [new HumanMessage(input)];
    }
    return input;
  }

  /**
   * Invoke the LLM with a prompt and get a complete response.
   *
   * @param input - Prompt string or array of messages
   * @param options - Optional call options (temperature, maxTokens, etc.)
   * @returns ModelResponse with content and token usage
   */
  async invoke(
    input: string | BaseMessage[],
    options?: LLMCallOptions
  ): Promise<ModelResponse<InvokeResult>> {
    const clientResult = this.getClient();
    if (!clientResult.success) {
      return clientResult;
    }

    const client = clientResult.result;
    const messages = this.toMessages(input);

    try {
      // Apply call options if provided
      let modelToUse = client;
      if (options) {
        const bindOptions: Record<string, unknown> = {};
        if (options.temperature !== undefined) bindOptions.temperature = options.temperature;
        if (options.maxTokens !== undefined) bindOptions.max_tokens = options.maxTokens;

        if (Object.keys(bindOptions).length > 0) {
          modelToUse = client.bind(bindOptions) as BaseChatModel;
        }
      }

      const response = await modelToUse.invoke(messages);

      // Extract content - handle both string and complex content
      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Extract token usage from response metadata
      const usage = extractTokenUsage(response.response_metadata);

      return successResponse(
        { content, usage },
        'LLM invocation successful'
      );
    } catch (error) {
      const errorCode = mapErrorToCode(error);
      const message = error instanceof Error ? error.message : 'Unknown error during invocation';
      this.callbacks?.onError?.(errorCode, message);
      return errorResponse(errorCode, message);
    }
  }

  /**
   * Stream the LLM response chunk by chunk.
   *
   * @param input - Prompt string or array of messages
   * @param options - Optional call options
   * @returns ModelResponse with async iterable of chunks
   */
  async stream(
    input: string | BaseMessage[],
    options?: LLMCallOptions
  ): Promise<ModelResponse<StreamResult>> {
    const clientResult = this.getClient();
    if (!clientResult.success) {
      return clientResult;
    }

    const client = clientResult.result;
    const messages = this.toMessages(input);

    try {
      // Apply call options if provided
      let modelToUse = client;
      if (options) {
        const bindOptions: Record<string, unknown> = {};
        if (options.temperature !== undefined) bindOptions.temperature = options.temperature;
        if (options.maxTokens !== undefined) bindOptions.max_tokens = options.maxTokens;

        if (Object.keys(bindOptions).length > 0) {
          modelToUse = client.bind(bindOptions) as BaseChatModel;
        }
      }

      this.callbacks?.onStreamStart?.();

      const stream = await modelToUse.stream(messages);

      // Wrap the stream to emit callbacks
      const wrappedStream = this.wrapStreamWithCallbacks(stream);

      return successResponse(
        wrappedStream as StreamResult,
        'Stream started successfully'
      );
    } catch (error) {
      const errorCode = mapErrorToCode(error);
      const message = error instanceof Error ? error.message : 'Unknown error starting stream';
      this.callbacks?.onError?.(errorCode, message);
      return errorResponse(errorCode, message);
    }
  }

  /**
   * Wrap a stream to emit callbacks for each chunk.
   */
  private wrapStreamWithCallbacks(
    stream: AsyncIterable<import('@langchain/core/messages').AIMessageChunk>
  ): AsyncIterable<import('@langchain/core/messages').AIMessageChunk> {
    const callbacks = this.callbacks;

    return {
      [Symbol.asyncIterator]: async function* () {
        let lastUsage: TokenUsage | undefined;

        for await (const chunk of stream) {
          // Extract content for callback
          const content = typeof chunk.content === 'string'
            ? chunk.content
            : '';

          if (content) {
            callbacks?.onStreamChunk?.(content);
          }

          // Try to extract usage from chunk metadata
          if (chunk.response_metadata) {
            lastUsage = extractTokenUsage(chunk.response_metadata);
          }

          yield chunk;
        }

        callbacks?.onStreamEnd?.(lastUsage);
      },
    };
  }

  /**
   * Get the current provider name.
   */
  getProviderName(): ProviderName {
    return this.config.providers.default;
  }

  /**
   * Get the current model name.
   */
  getModelName(): string {
    const providerName = this.config.providers.default;
    const providerConfig = this.config.providers[providerName];

    // Different providers use different field names for model
    if (providerName === 'azure') {
      return (providerConfig as Record<string, unknown>)?.deployment as string ?? 'unknown';
    }
    if (providerName === 'foundry') {
      return (providerConfig as Record<string, unknown>)?.modelDeployment as string ?? 'unknown';
    }
    return (providerConfig as Record<string, unknown>)?.model as string ?? 'unknown';
  }
}
```

---

### Task 6: Create index.ts with public exports

**Description**: Create the module's public API with clean exports.

**Files to create**: `src/model/index.ts`

**Implementation Details**:

```typescript
// src/model/index.ts

/**
 * Model module - Multi-provider LLM abstraction layer.
 *
 * This module provides:
 * - LLMClient class for invoking and streaming LLM responses
 * - Provider registry for config-based provider selection
 * - Type definitions for model operations
 *
 * Provider selection is based on config.providers.default, not model prefix parsing.
 *
 * @example
 * ```typescript
 * import { LLMClient } from './model/index.js';
 * import { loadConfig } from './config/index.js';
 *
 * const configResult = await loadConfig();
 * if (!configResult.success) throw new Error(configResult.message);
 *
 * const client = new LLMClient({ config: configResult.result });
 * const result = await client.invoke('Hello!');
 *
 * if (result.success) {
 *   console.log(result.result.content);
 * }
 * ```
 */

// Type exports
export type {
  ModelResponse,
  ModelSuccessResponse,
  ModelErrorResponse,
  ModelErrorCode,
  TokenUsage,
  InvokeResult,
  LLMCallbacks,
  LLMCallOptions,
  ProviderFactory,
  StreamResult,
} from './types.js';

// Type guards
export { isModelSuccess, isModelError } from './types.js';

// Helper functions
export { successResponse, errorResponse, mapErrorToCode, extractTokenUsage } from './base.js';

// Registry functions
export { getProviderFactory, isProviderSupported, getSupportedProviders, PROVIDER_REGISTRY } from './registry.js';

// Main client
export { LLMClient } from './llm.js';
export type { LLMClientOptions } from './llm.js';

// Provider factories (for direct access if needed)
export { createOpenAIClient } from './providers/openai.js';
```

---

### Task 7: Create unit tests for types and helpers

**Description**: Write tests for type guards and helper functions.

**Files to create**: `src/model/__tests__/base.test.ts`

**Implementation Details**:

```typescript
// src/model/__tests__/base.test.ts

import { describe, it, expect } from '@jest/globals';
import {
  successResponse,
  errorResponse,
  mapErrorToCode,
  extractTokenUsage,
} from '../base.js';
import { isModelSuccess, isModelError } from '../types.js';
import type { ModelErrorCode } from '../types.js';

describe('Model Response Helpers', () => {
  describe('successResponse', () => {
    it('creates a success response with result and message', () => {
      const response = successResponse({ content: 'Hello' }, 'Success');

      expect(response).toEqual({
        success: true,
        result: { content: 'Hello' },
        message: 'Success',
      });
    });

    it('preserves generic type in result', () => {
      interface CustomResult { count: number; items: string[] }
      const result: CustomResult = { count: 2, items: ['a', 'b'] };
      const response = successResponse<CustomResult>(result, 'Found items');

      expect(response.result.count).toBe(2);
      expect(response.result.items).toHaveLength(2);
    });
  });

  describe('errorResponse', () => {
    it('creates an error response with code and message', () => {
      const response = errorResponse('NETWORK_ERROR', 'Connection failed');

      expect(response).toEqual({
        success: false,
        error: 'NETWORK_ERROR',
        message: 'Connection failed',
      });
    });

    it.each<ModelErrorCode>([
      'PROVIDER_NOT_CONFIGURED',
      'PROVIDER_NOT_SUPPORTED',
      'AUTHENTICATION_ERROR',
      'RATE_LIMITED',
      'MODEL_NOT_FOUND',
      'CONTEXT_LENGTH_EXCEEDED',
      'NETWORK_ERROR',
      'TIMEOUT',
      'INVALID_RESPONSE',
      'UNKNOWN',
    ])('accepts error code: %s', (errorCode) => {
      const response = errorResponse(errorCode, 'Test error');
      expect(response.error).toBe(errorCode);
    });
  });

  describe('type guards', () => {
    describe('isModelSuccess', () => {
      it('returns true for success responses', () => {
        const response = successResponse({ data: 1 }, 'OK');
        expect(isModelSuccess(response)).toBe(true);
      });

      it('returns false for error responses', () => {
        const response = errorResponse('NETWORK_ERROR', 'Failed');
        expect(isModelSuccess(response)).toBe(false);
      });
    });

    describe('isModelError', () => {
      it('returns true for error responses', () => {
        const response = errorResponse('UNKNOWN', 'Error');
        expect(isModelError(response)).toBe(true);
      });

      it('returns false for success responses', () => {
        const response = successResponse('result', 'OK');
        expect(isModelError(response)).toBe(false);
      });
    });
  });
});

describe('mapErrorToCode', () => {
  it('maps API key errors to AUTHENTICATION_ERROR', () => {
    expect(mapErrorToCode(new Error('Invalid API key'))).toBe('AUTHENTICATION_ERROR');
    expect(mapErrorToCode(new Error('Authentication failed'))).toBe('AUTHENTICATION_ERROR');
    expect(mapErrorToCode(new Error('Unauthorized access'))).toBe('AUTHENTICATION_ERROR');
  });

  it('maps rate limit errors to RATE_LIMITED', () => {
    expect(mapErrorToCode(new Error('Rate limit exceeded'))).toBe('RATE_LIMITED');
    expect(mapErrorToCode(new Error('Error 429: Too many requests'))).toBe('RATE_LIMITED');
  });

  it('maps model not found errors to MODEL_NOT_FOUND', () => {
    expect(mapErrorToCode(new Error('Model gpt-5 not found'))).toBe('MODEL_NOT_FOUND');
  });

  it('maps context length errors to CONTEXT_LENGTH_EXCEEDED', () => {
    expect(mapErrorToCode(new Error('Context length exceeded'))).toBe('CONTEXT_LENGTH_EXCEEDED');
    expect(mapErrorToCode(new Error('Input too long'))).toBe('CONTEXT_LENGTH_EXCEEDED');
    expect(mapErrorToCode(new Error('Token limit reached'))).toBe('CONTEXT_LENGTH_EXCEEDED');
  });

  it('maps timeout errors to TIMEOUT', () => {
    expect(mapErrorToCode(new Error('Request timeout'))).toBe('TIMEOUT');
    expect(mapErrorToCode(new Error('Operation timed out'))).toBe('TIMEOUT');
  });

  it('maps network errors to NETWORK_ERROR', () => {
    expect(mapErrorToCode(new Error('Network error'))).toBe('NETWORK_ERROR');
    expect(mapErrorToCode(new Error('ECONNREFUSED'))).toBe('NETWORK_ERROR');
    expect(mapErrorToCode(new Error('Fetch failed'))).toBe('NETWORK_ERROR');
  });

  it('returns UNKNOWN for unrecognized errors', () => {
    expect(mapErrorToCode(new Error('Something went wrong'))).toBe('UNKNOWN');
    expect(mapErrorToCode('string error')).toBe('UNKNOWN');
    expect(mapErrorToCode(null)).toBe('UNKNOWN');
  });
});

describe('extractTokenUsage', () => {
  it('extracts OpenAI format token usage', () => {
    const metadata = {
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    };

    expect(extractTokenUsage(metadata)).toEqual({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    });
  });

  it('extracts camelCase format token usage', () => {
    const metadata = {
      usage: {
        promptTokens: 15,
        completionTokens: 25,
        totalTokens: 40,
      },
    };

    expect(extractTokenUsage(metadata)).toEqual({
      promptTokens: 15,
      completionTokens: 25,
      totalTokens: 40,
    });
  });

  it('extracts token_usage format', () => {
    const metadata = {
      token_usage: {
        prompt_tokens: 5,
        completion_tokens: 10,
        total_tokens: 15,
      },
    };

    expect(extractTokenUsage(metadata)).toEqual({
      promptTokens: 5,
      completionTokens: 10,
      totalTokens: 15,
    });
  });

  it('returns undefined for missing metadata', () => {
    expect(extractTokenUsage(undefined)).toBeUndefined();
  });

  it('returns undefined for metadata without usage', () => {
    expect(extractTokenUsage({})).toBeUndefined();
    expect(extractTokenUsage({ other: 'data' })).toBeUndefined();
  });
});
```

---

### Task 8: Create unit tests for LLMClient

**Description**: Write comprehensive tests for LLMClient with mocked LangChain models.

**Files to create**: `src/model/__tests__/llm.test.ts`

**Implementation Details**:

```typescript
// src/model/__tests__/llm.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LLMClient } from '../llm.js';
import { getDefaultConfig } from '../../config/schema.js';
import type { AppConfig } from '../../config/schema.js';
import type { LLMCallbacks } from '../types.js';
import * as registry from '../registry.js';

// Mock the registry module
jest.mock('../registry.js', () => ({
  getProviderFactory: jest.fn(),
  isProviderSupported: jest.fn(),
}));

// Mock ChatOpenAI response
const mockInvokeResponse = {
  content: 'Hello! How can I help you?',
  response_metadata: {
    usage: {
      prompt_tokens: 10,
      completion_tokens: 15,
      total_tokens: 25,
    },
  },
};

// Create mock async iterator for streaming
function createMockStream(chunks: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield {
          content: chunk,
          response_metadata: {},
        };
      }
    },
  };
}

// Mock BaseChatModel
function createMockModel(invokeResponse = mockInvokeResponse) {
  return {
    invoke: jest.fn().mockResolvedValue(invokeResponse),
    stream: jest.fn().mockResolvedValue(createMockStream(['Hello', ' world', '!'])),
    bind: jest.fn().mockReturnThis(),
  };
}

describe('LLMClient', () => {
  let config: AppConfig;
  let mockModel: ReturnType<typeof createMockModel>;
  const mockedRegistry = registry as jest.Mocked<typeof registry>;

  beforeEach(() => {
    config = getDefaultConfig();
    config.providers.openai = { apiKey: 'test-key', model: 'gpt-4o' };
    config.providers.default = 'openai';

    mockModel = createMockModel();

    // Reset mocks
    jest.clearAllMocks();

    // Setup registry mocks
    mockedRegistry.isProviderSupported.mockReturnValue(true);
    mockedRegistry.getProviderFactory.mockReturnValue(() => ({
      success: true,
      result: mockModel,
      message: 'Client created',
    }));
  });

  describe('constructor', () => {
    it('creates client with config', () => {
      const client = new LLMClient({ config });
      expect(client).toBeInstanceOf(LLMClient);
    });

    it('accepts optional callbacks', () => {
      const callbacks: LLMCallbacks = {
        onStreamStart: jest.fn(),
        onStreamChunk: jest.fn(),
        onStreamEnd: jest.fn(),
        onError: jest.fn(),
      };

      const client = new LLMClient({ config, callbacks });
      expect(client).toBeInstanceOf(LLMClient);
    });
  });

  describe('invoke', () => {
    it('invokes the model with a string prompt', async () => {
      const client = new LLMClient({ config });
      const result = await client.invoke('Hello');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result.content).toBe('Hello! How can I help you?');
        expect(result.result.usage).toEqual({
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25,
        });
      }
    });

    it('returns error when provider is not supported', async () => {
      mockedRegistry.isProviderSupported.mockReturnValue(false);

      const client = new LLMClient({ config });
      const result = await client.invoke('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('PROVIDER_NOT_SUPPORTED');
      }
    });

    it('returns error when provider is not configured', async () => {
      config.providers.anthropic = undefined;
      config.providers.default = 'anthropic';
      mockedRegistry.isProviderSupported.mockReturnValue(true);
      mockedRegistry.getProviderFactory.mockReturnValue(() => ({
        success: false,
        error: 'PROVIDER_NOT_CONFIGURED',
        message: 'Provider not configured',
      }));

      const client = new LLMClient({ config });
      const result = await client.invoke('Hello');

      expect(result.success).toBe(false);
    });

    it('caches the client across invocations', async () => {
      const client = new LLMClient({ config });

      await client.invoke('Hello');
      await client.invoke('World');

      // Factory should only be called once
      expect(mockedRegistry.getProviderFactory).toHaveBeenCalledTimes(1);
    });

    it('handles model errors gracefully', async () => {
      mockModel.invoke.mockRejectedValue(new Error('API key invalid'));

      const callbacks: LLMCallbacks = { onError: jest.fn() };
      const client = new LLMClient({ config, callbacks });
      const result = await client.invoke('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('AUTHENTICATION_ERROR');
      }
      expect(callbacks.onError).toHaveBeenCalledWith('AUTHENTICATION_ERROR', 'API key invalid');
    });

    it('applies call options', async () => {
      const client = new LLMClient({ config });
      await client.invoke('Hello', { temperature: 0.5, maxTokens: 100 });

      expect(mockModel.bind).toHaveBeenCalledWith({
        temperature: 0.5,
        max_tokens: 100,
      });
    });
  });

  describe('stream', () => {
    it('streams response chunks', async () => {
      const callbacks: LLMCallbacks = {
        onStreamStart: jest.fn(),
        onStreamChunk: jest.fn(),
        onStreamEnd: jest.fn(),
      };

      const client = new LLMClient({ config, callbacks });
      const result = await client.stream('Tell me a story');

      expect(result.success).toBe(true);
      expect(callbacks.onStreamStart).toHaveBeenCalled();

      if (result.success) {
        const chunks: string[] = [];
        for await (const chunk of result.result) {
          if (typeof chunk.content === 'string') {
            chunks.push(chunk.content);
          }
        }

        expect(chunks).toEqual(['Hello', ' world', '!']);
        expect(callbacks.onStreamChunk).toHaveBeenCalledTimes(3);
        expect(callbacks.onStreamEnd).toHaveBeenCalled();
      }
    });

    it('returns error on stream failure', async () => {
      mockModel.stream.mockRejectedValue(new Error('Network error'));

      const callbacks: LLMCallbacks = { onError: jest.fn() };
      const client = new LLMClient({ config, callbacks });
      const result = await client.stream('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('NETWORK_ERROR');
      }
      expect(callbacks.onError).toHaveBeenCalled();
    });
  });

  describe('getProviderName', () => {
    it('returns the current provider name', () => {
      const client = new LLMClient({ config });
      expect(client.getProviderName()).toBe('openai');
    });
  });

  describe('getModelName', () => {
    it('returns the model name for OpenAI', () => {
      const client = new LLMClient({ config });
      expect(client.getModelName()).toBe('gpt-4o');
    });

    it('returns deployment for Azure', () => {
      config.providers.default = 'azure';
      config.providers.azure = { deployment: 'my-gpt4', apiVersion: '2024-06-01' };

      const client = new LLMClient({ config });
      expect(client.getModelName()).toBe('my-gpt4');
    });

    it('returns modelDeployment for Foundry', () => {
      config.providers.default = 'foundry';
      config.providers.foundry = { modelDeployment: 'my-model' };

      const client = new LLMClient({ config });
      expect(client.getModelName()).toBe('my-model');
    });
  });
});
```

---

### Task 9: Create unit tests for OpenAI provider

**Description**: Write tests for the OpenAI provider factory.

**Files to create**: `src/model/__tests__/openai.test.ts`

**Implementation Details**:

```typescript
// src/model/__tests__/openai.test.ts

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createOpenAIClient } from '../providers/openai.js';

// Mock @langchain/openai
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation((config) => ({
    model: config.model,
    _type: 'chat_model',
  })),
}));

describe('createOpenAIClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates ChatOpenAI with model from config', () => {
    const result = createOpenAIClient({
      model: 'gpt-4o',
      apiKey: 'test-key',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result).toBeDefined();
      expect(result.message).toContain('gpt-4o');
    }
  });

  it('creates ChatOpenAI with custom baseUrl', () => {
    const result = createOpenAIClient({
      model: 'gpt-4o',
      apiKey: 'test-key',
      baseUrl: 'https://custom.openai.com/v1',
    });

    expect(result.success).toBe(true);
  });

  it('creates ChatOpenAI without apiKey (uses env var)', () => {
    const result = createOpenAIClient({
      model: 'gpt-4o',
    });

    expect(result.success).toBe(true);
  });

  it('uses default model when not specified', () => {
    const result = createOpenAIClient({});

    expect(result.success).toBe(true);
  });
});
```

---

### Task 10: Create unit tests for registry

**Description**: Write tests for the provider registry.

**Files to create**: `src/model/__tests__/registry.test.ts`

**Implementation Details**:

```typescript
// src/model/__tests__/registry.test.ts

import { describe, it, expect } from '@jest/globals';
import {
  PROVIDER_REGISTRY,
  getProviderFactory,
  isProviderSupported,
  getSupportedProviders,
} from '../registry.js';

describe('Provider Registry', () => {
  describe('PROVIDER_REGISTRY', () => {
    it('has openai provider registered', () => {
      expect(PROVIDER_REGISTRY.openai).toBeDefined();
    });

    it('openai factory is a function', () => {
      expect(typeof PROVIDER_REGISTRY.openai).toBe('function');
    });
  });

  describe('getProviderFactory', () => {
    it('returns factory for supported provider', () => {
      const factory = getProviderFactory('openai');
      expect(factory).toBeDefined();
      expect(typeof factory).toBe('function');
    });

    it('returns undefined for unsupported provider', () => {
      const factory = getProviderFactory('anthropic');
      expect(factory).toBeUndefined();
    });
  });

  describe('isProviderSupported', () => {
    it('returns true for openai', () => {
      expect(isProviderSupported('openai')).toBe(true);
    });

    it('returns false for anthropic (not yet implemented)', () => {
      expect(isProviderSupported('anthropic')).toBe(false);
    });

    it('returns false for gemini (not yet implemented)', () => {
      expect(isProviderSupported('gemini')).toBe(false);
    });
  });

  describe('getSupportedProviders', () => {
    it('returns array of supported provider names', () => {
      const providers = getSupportedProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers).toContain('openai');
    });

    it('only includes registered providers', () => {
      const providers = getSupportedProviders();
      expect(providers).not.toContain('anthropic');
      expect(providers).not.toContain('gemini');
    });
  });
});
```

---

### Task 11: Run validation and fix any issues

**Description**: Run all quality checks and ensure everything passes.

**Commands**:
```bash
# Run all validation commands
bun run typecheck && bun run lint && bun run test && bun run build
```

**Acceptance**:
- TypeScript compiles without errors
- ESLint passes with no warnings
- All tests pass
- Coverage meets 85% threshold for model module
- Build succeeds

## Testing Strategy

### Unit Tests

Tests organized in `src/model/__tests__/`:
- `base.test.ts`: Helper functions and type guards
- `llm.test.ts`: LLMClient class with mocked LangChain models
- `openai.test.ts`: OpenAI provider factory
- `registry.test.ts`: Provider registry functions

### Mock Patterns

**MockBaseChatModel**:
```typescript
const mockModel = {
  invoke: jest.fn().mockResolvedValue({
    content: 'Response',
    response_metadata: { usage: { prompt_tokens: 10, completion_tokens: 20 } },
  }),
  stream: jest.fn().mockResolvedValue(createMockStream(['chunk1', 'chunk2'])),
  bind: jest.fn().mockReturnThis(),
};
```

### Edge Cases

- Provider not configured
- Provider not supported
- API key authentication failures
- Rate limit errors
- Network errors
- Timeout errors
- Empty responses
- Non-string content responses
- Missing token usage metadata

## Acceptance Criteria

- [ ] `ModelResponse<T>` type defined as discriminated union
- [ ] `ModelErrorCode` includes all relevant error codes
- [ ] `successResponse()` and `errorResponse()` helpers implemented
- [ ] `mapErrorToCode()` correctly categorizes LLM errors
- [ ] `extractTokenUsage()` extracts usage from various metadata formats
- [ ] `createOpenAIClient()` factory creates ChatOpenAI from config
- [ ] Provider registry maps provider names to factories
- [ ] `LLMClient.invoke()` returns complete responses
- [ ] `LLMClient.stream()` returns async iterable with callbacks
- [ ] Client is cached and reused across invocations
- [ ] Call options (temperature, maxTokens) are applied correctly
- [ ] All tests pass with 85%+ coverage
- [ ] All quality gates pass (typecheck, lint, test, build)

## Validation Commands

```bash
# Run all validation commands before committing
bun run typecheck && bun run lint && bun run test && bun run build

# Run just the model tests
bun run test src/model

# Run with coverage
bun run test --coverage src/model
```

## Notes

### Provider Selection Pattern

Providers are selected by name in `config.providers.default`, not by parsing model name prefixes. This design:
- Keeps provider selection explicit and configurable
- Avoids ambiguity when model names overlap across providers
- Allows the same model name to be used with different providers (e.g., local vs cloud)

### Error Mapping

The `mapErrorToCode()` function uses keyword matching on error messages to categorize errors. This is inherently fragile but provides better UX than returning `UNKNOWN` for all errors. As providers are added, error patterns should be documented and tested.

### Streaming Architecture

Streaming uses LangChain's `stream()` method which returns an async iterable. The `LLMClient` wraps this to:
1. Emit callbacks for UI updates
2. Extract token usage from final chunk metadata
3. Handle errors gracefully

### Future Provider Implementation

Each new provider (Features 12-14, 25-26, 31) will:
1. Add a factory function in `providers/<name>.ts`
2. Register in `PROVIDER_REGISTRY`
3. Add provider-specific tests
4. Handle provider-specific error patterns in `mapErrorToCode()`

### Token Usage Extraction

Different providers return token usage in different formats. The `extractTokenUsage()` function handles:
- OpenAI snake_case format (`prompt_tokens`)
- CamelCase format (`promptTokens`)
- Alternative `token_usage` key

## Execution

This spec can be implemented using: `/sdlc:implement docs/specs/feature-004-multi-provider-llm-abstraction.md`
