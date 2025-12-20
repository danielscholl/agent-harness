/**
 * Factory functions for test objects.
 * Creates test objects with sensible defaults that can be overridden.
 */

import type { AIMessage } from '@langchain/core/messages';
import type { AppConfig } from '../../src/config/schema.js';
import { getDefaultConfig } from '../../src/config/schema.js';
import type { SpanContext } from '../../src/agent/types.js';
import type { AgentCallbacks } from '../../src/agent/callbacks.js';
import type {
  ToolResponse,
  SuccessResponse,
  ErrorResponse,
  ToolErrorCode,
} from '../../src/tools/types.js';
import type {
  ModelResponse,
  TokenUsage,
  LLMCallbacks,
  RetryContext,
} from '../../src/model/types.js';
import type { MockLLMResponse, MockStreamChunk } from './llm-responses.js';
import { createMockStream, SIMPLE_GREETING_RESPONSE } from './llm-responses.js';

// -----------------------------------------------------------------------------
// Configuration Factories
// -----------------------------------------------------------------------------

/**
 * Create a test configuration with OpenAI defaults.
 */
export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const base = getDefaultConfig();
  base.providers.openai = { apiKey: 'test-key', model: 'gpt-4o' };
  base.providers.default = 'openai';
  return { ...base, ...overrides };
}

/**
 * Create a test configuration for Anthropic.
 */
export function createAnthropicConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const config = createTestConfig();
  config.providers.default = 'anthropic';
  config.providers.anthropic = { apiKey: 'test-key', model: 'claude-3-opus' };
  return { ...config, ...overrides };
}

/**
 * Create a test configuration for Azure OpenAI.
 */
export function createAzureConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const config = createTestConfig();
  config.providers.default = 'azure';
  config.providers.azure = {
    deployment: 'my-gpt4',
    endpoint: 'https://test.openai.azure.com',
    apiVersion: '2024-06-01',
  };
  return { ...config, ...overrides };
}

/**
 * Create a test configuration with retry settings.
 */
export function createRetryConfig(
  retrySettings: Partial<AppConfig['retry']> = {},
  baseOverrides: Partial<AppConfig> = {}
): AppConfig {
  const config = createTestConfig(baseOverrides);
  config.retry = {
    enabled: true,
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    enableJitter: false,
    ...retrySettings,
  };
  return config;
}

/**
 * Create a test configuration with memory enabled.
 */
export function createMemoryConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const config = createTestConfig(overrides);
  config.memory.enabled = true;
  config.memory.type = 'local';
  return config;
}

// -----------------------------------------------------------------------------
// Callback Factories
// -----------------------------------------------------------------------------

/**
 * Create tracking callbacks that log invocations to arrays.
 */
export function createTrackingCallbacks(): {
  callbacks: AgentCallbacks;
  log: string[];
  traceIds: string[];
  spanIds: string[];
} {
  const log: string[] = [];
  const traceIds: string[] = [];
  const spanIds: string[] = [];

  const callbacks: AgentCallbacks = {
    onAgentStart: (ctx: SpanContext, query: string) => {
      log.push(`onAgentStart: ${query}`);
      traceIds.push(ctx.traceId);
    },
    onAgentEnd: (ctx: SpanContext, answer: string) => {
      log.push(`onAgentEnd: ${answer.substring(0, 50)}`);
      traceIds.push(ctx.traceId);
    },
    onLLMStart: (ctx: SpanContext, model: string) => {
      log.push(`onLLMStart: ${model}`);
      traceIds.push(ctx.traceId);
      spanIds.push(ctx.spanId);
    },
    onLLMEnd: (ctx: SpanContext, response: string) => {
      log.push(`onLLMEnd: ${response.substring(0, 30)}`);
      traceIds.push(ctx.traceId);
    },
    onToolStart: (ctx: SpanContext, name: string) => {
      log.push(`onToolStart: ${name}`);
      traceIds.push(ctx.traceId);
    },
    onToolEnd: (ctx: SpanContext, name: string) => {
      log.push(`onToolEnd: ${name}`);
      traceIds.push(ctx.traceId);
    },
    onSpinnerStart: (msg: string) => {
      log.push(`onSpinnerStart: ${msg}`);
    },
    onSpinnerStop: () => {
      log.push('onSpinnerStop');
    },
    onDebug: (msg: string) => {
      log.push(`onDebug: ${msg}`);
    },
  };

  return { callbacks, log, traceIds, spanIds };
}

/**
 * Create mock LLM callbacks for testing.
 */
export function createMockLLMCallbacks(): {
  callbacks: LLMCallbacks;
  calls: {
    streamStart: number;
    chunks: string[];
    streamEnd: { usage?: TokenUsage }[];
    errors: Array<{ error: string; message: string }>;
    retries: RetryContext[];
  };
} {
  const calls = {
    streamStart: 0,
    chunks: [] as string[],
    streamEnd: [] as { usage?: TokenUsage }[],
    errors: [] as Array<{ error: string; message: string }>,
    retries: [] as RetryContext[],
  };

  const callbacks: LLMCallbacks = {
    onStreamStart: () => {
      calls.streamStart++;
    },
    onStreamChunk: (chunk: string) => {
      calls.chunks.push(chunk);
    },
    onStreamEnd: (usage?: TokenUsage) => {
      calls.streamEnd.push({ usage });
    },
    onError: (error: string, message: string) => {
      calls.errors.push({ error, message });
    },
    onRetry: (context: RetryContext) => {
      calls.retries.push(context);
    },
  };

  return { callbacks, calls };
}

// -----------------------------------------------------------------------------
// Message Factories
// -----------------------------------------------------------------------------

/**
 * Create a test conversation history entry.
 */
export function createMessage(
  role: 'user' | 'assistant' | 'system' = 'user',
  content: string = 'Test message'
): { role: 'user' | 'assistant' | 'system'; content: string } {
  return { role, content };
}

/**
 * Create a conversation history.
 */
export function createConversationHistory(
  messages: Array<{ role?: 'user' | 'assistant' | 'system'; content?: string }> = []
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  return messages.map((msg, i) => ({
    role: msg.role ?? (i % 2 === 0 ? 'user' : 'assistant'),
    content: msg.content ?? `Message ${String(i + 1)}`,
  }));
}

// -----------------------------------------------------------------------------
// Tool Response Factories
// -----------------------------------------------------------------------------

/**
 * Create a successful tool response.
 */
export function createSuccessResponse<T>(
  result: T,
  message: string = 'Success'
): SuccessResponse<T> {
  return { success: true, result, message };
}

/**
 * Create an error tool response.
 */
export function createErrorResponse(
  error: ToolErrorCode = 'UNKNOWN',
  message: string = 'An error occurred'
): ErrorResponse {
  return { success: false, error, message };
}

/**
 * Create a tool response (success or error).
 */
export function createToolResponse<T>(
  success: true,
  result: T,
  message?: string
): SuccessResponse<T>;
export function createToolResponse(
  success: false,
  error: ToolErrorCode,
  message?: string
): ErrorResponse;
export function createToolResponse<T>(
  success: boolean,
  resultOrError: T | ToolErrorCode,
  message: string = success ? 'Success' : 'Error'
): ToolResponse<T> {
  if (success) {
    return { success: true, result: resultOrError as T, message };
  }
  return { success: false, error: resultOrError as ToolErrorCode, message };
}

// -----------------------------------------------------------------------------
// Model Response Factories
// -----------------------------------------------------------------------------

/**
 * Create a successful model response.
 */
export function createModelSuccess<T>(result: T, message: string = 'Success'): ModelResponse<T> {
  return { success: true, result, message };
}

/**
 * Create an error model response.
 */
export function createModelError(
  error: string = 'UNKNOWN',
  message: string = 'An error occurred'
): ModelResponse<never> {
  return { success: false, error: error as 'UNKNOWN', message };
}

// -----------------------------------------------------------------------------
// Mock Model Factories
// -----------------------------------------------------------------------------

/**
 * Mock model interface matching LangChain BaseChatModel.
 */
export interface MockModel {
  invoke: jest.MockedFunction<(input: unknown) => Promise<MockLLMResponse>>;
  stream: jest.MockedFunction<(input: unknown) => Promise<AsyncIterable<MockStreamChunk>>>;
  bind: jest.MockedFunction<(options: Record<string, unknown>) => unknown>;
  bindTools?: jest.MockedFunction<(tools: unknown[]) => MockModel>;
}

/**
 * Create a mock LLM model for testing.
 */
export function createMockModel(
  invokeResponse: MockLLMResponse = SIMPLE_GREETING_RESPONSE,
  streamChunks: string[] = ['Hello', ' world', '!']
): MockModel {
  const mockModel: MockModel = {
    invoke: jest
      .fn<(input: unknown) => Promise<MockLLMResponse>>()
      .mockResolvedValue(invokeResponse),
    stream: jest
      .fn<(input: unknown) => Promise<AsyncIterable<MockStreamChunk>>>()
      .mockResolvedValue(createMockStream(streamChunks)),
    bind: jest.fn<(options: Record<string, unknown>) => unknown>().mockReturnThis(),
  };

  // Add bindTools that returns the same mock
  mockModel.bindTools = jest.fn<(tools: unknown[]) => MockModel>().mockReturnValue(mockModel);

  return mockModel;
}

/**
 * Create a mock model that returns tool calls then a final response.
 */
export function createToolCallingModel(
  toolCallResponse: AIMessage,
  finalResponse: AIMessage
): MockModel {
  const invoke = jest
    .fn<() => Promise<AIMessage>>()
    .mockResolvedValueOnce(toolCallResponse)
    .mockResolvedValueOnce(finalResponse);

  const mockModel: MockModel = {
    invoke: invoke as unknown as MockModel['invoke'],
    stream: jest.fn().mockResolvedValue(createMockStream(['Done'])),
    bind: jest.fn().mockReturnThis(),
  };

  mockModel.bindTools = jest.fn().mockReturnValue(mockModel);

  return mockModel;
}

/**
 * Create a mock model that fails with specific error.
 */
export function createFailingModel(error: Error): MockModel {
  const mockModel: MockModel = {
    invoke: jest.fn().mockRejectedValue(error),
    stream: jest.fn().mockRejectedValue(error),
    bind: jest.fn().mockReturnThis(),
  };

  mockModel.bindTools = jest.fn().mockReturnValue(mockModel);

  return mockModel;
}

/**
 * Create a mock model that fails N times then succeeds.
 */
export function createRetryableModel(
  failuresBeforeSuccess: number,
  error: Error,
  successResponse: MockLLMResponse = SIMPLE_GREETING_RESPONSE
): MockModel {
  let callCount = 0;

  const invoke = jest.fn().mockImplementation(() => {
    callCount++;
    if (callCount <= failuresBeforeSuccess) {
      return Promise.reject(error);
    }
    return Promise.resolve(successResponse);
  });

  const mockModel: MockModel = {
    invoke: invoke as MockModel['invoke'],
    stream: jest.fn().mockResolvedValue(createMockStream(['Success'])),
    bind: jest.fn().mockReturnThis(),
  };

  mockModel.bindTools = jest.fn().mockReturnValue(mockModel);

  return mockModel;
}

// -----------------------------------------------------------------------------
// Span Context Factory
// -----------------------------------------------------------------------------

/**
 * Create a test span context.
 */
export function createSpanContext(overrides: Partial<SpanContext> = {}): SpanContext {
  return {
    traceId: 'test-trace-id',
    spanId: 'test-span-id',
    parentSpanId: undefined,
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// Test Data Factories
// -----------------------------------------------------------------------------

/**
 * Create test file content.
 */
export function createTestFileContent(lines: number = 10): string {
  return Array.from({ length: lines }, (_, i) => `Line ${String(i + 1)}`).join('\n');
}

/**
 * Create a test JSON object.
 */
export function createTestJSON<T extends Record<string, unknown>>(
  data: T = { key: 'value' } as T
): T {
  return data;
}
