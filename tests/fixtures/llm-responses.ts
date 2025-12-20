/**
 * Mock LLM response fixtures for deterministic testing.
 * Provides reusable responses for various scenarios.
 */

import { AIMessage, AIMessageChunk } from '@langchain/core/messages';

// -----------------------------------------------------------------------------
// Basic Response Types
// -----------------------------------------------------------------------------

/**
 * Mock response format matching LangChain BaseChatModel.invoke() return.
 */
export interface MockLLMResponse {
  content: string | Array<{ type: string; text: string }>;
  response_metadata: {
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
}

/**
 * Mock chunk format for streaming responses.
 */
export interface MockStreamChunk {
  content: string;
  response_metadata: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Simple Response Fixtures
// -----------------------------------------------------------------------------

/**
 * Basic greeting response.
 */
export const SIMPLE_GREETING_RESPONSE: MockLLMResponse = {
  content: 'Hello! How can I help you today?',
  response_metadata: {
    usage: {
      prompt_tokens: 15,
      completion_tokens: 10,
      total_tokens: 25,
    },
  },
};

/**
 * Acknowledgment response.
 */
export const ACKNOWLEDGMENT_RESPONSE: MockLLMResponse = {
  content: 'I understand. Let me help you with that.',
  response_metadata: {
    usage: {
      prompt_tokens: 20,
      completion_tokens: 12,
      total_tokens: 32,
    },
  },
};

/**
 * Completion response (for after tool execution).
 */
export const COMPLETION_RESPONSE: MockLLMResponse = {
  content: 'I have completed the task successfully.',
  response_metadata: {
    usage: {
      prompt_tokens: 30,
      completion_tokens: 8,
      total_tokens: 38,
    },
  },
};

/**
 * Response with complex content (non-string).
 */
export const COMPLEX_CONTENT_RESPONSE: MockLLMResponse = {
  content: [{ type: 'text', text: 'This is a complex response.' }],
  response_metadata: {},
};

/**
 * Response with no usage metadata.
 */
export const NO_USAGE_RESPONSE: MockLLMResponse = {
  content: 'A response without usage information.',
  response_metadata: {},
};

// -----------------------------------------------------------------------------
// Tool Call Response Fixtures
// -----------------------------------------------------------------------------

/**
 * Create an AIMessage with tool calls.
 */
export function createToolCallResponse(
  toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>
): AIMessage {
  return new AIMessage({
    content: '',
    tool_calls: toolCalls,
  });
}

/**
 * Single greeting tool call.
 */
export const GREETING_TOOL_CALL = createToolCallResponse([
  { id: 'call_001', name: 'greet', args: { name: 'World' } },
]);

/**
 * Hello tool call.
 */
export const HELLO_TOOL_CALL = createToolCallResponse([
  { id: 'call_002', name: 'hello', args: { name: 'Alice' } },
]);

/**
 * File read tool call.
 */
export const FILE_READ_TOOL_CALL = createToolCallResponse([
  { id: 'call_003', name: 'readFile', args: { path: '/tmp/test.txt' } },
]);

/**
 * Multiple tool calls in sequence.
 */
export const MULTI_TOOL_CALL = createToolCallResponse([
  { id: 'call_004', name: 'readFile', args: { path: '/tmp/config.json' } },
  { id: 'call_005', name: 'writeFile', args: { path: '/tmp/output.txt', content: 'result' } },
]);

/**
 * Tool call with empty args.
 */
export const EMPTY_ARGS_TOOL_CALL = createToolCallResponse([
  { id: 'call_006', name: 'getCurrentTime', args: {} },
]);

// -----------------------------------------------------------------------------
// Streaming Response Fixtures
// -----------------------------------------------------------------------------

/**
 * Create a mock async iterator for streaming chunks.
 */
export function createMockStream(chunks: string[]): AsyncIterable<MockStreamChunk> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<MockStreamChunk> {
      let index = 0;
      return {
        next(): Promise<IteratorResult<MockStreamChunk>> {
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

/**
 * Create a mock async iterator with AIMessageChunk (LangChain format).
 */
export function createMockAIMessageStream(chunks: string[]): AsyncIterable<AIMessageChunk> {
  return {
    *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield new AIMessageChunk({ content: chunk });
      }
    },
  } as AsyncIterable<AIMessageChunk>;
}

/**
 * Simple greeting stream chunks.
 */
export const GREETING_STREAM_CHUNKS = ['Hello', '! ', 'How ', 'can ', 'I ', 'help ', 'you', '?'];

/**
 * Code explanation stream chunks.
 */
export const CODE_EXPLANATION_CHUNKS = [
  'This ',
  'function ',
  'takes ',
  'a ',
  'string ',
  'and ',
  'returns ',
  'its ',
  'length.',
];

/**
 * Error-prone stream that throws during iteration.
 */
export function createErrorStream(errorAfterChunks: number): AsyncIterable<MockStreamChunk> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<MockStreamChunk> {
      let count = 0;
      return {
        next(): Promise<IteratorResult<MockStreamChunk>> {
          count++;
          if (count <= errorAfterChunks) {
            return Promise.resolve({
              done: false,
              value: { content: `Chunk ${String(count)}`, response_metadata: {} },
            });
          }
          return Promise.reject(new Error('Stream interrupted'));
        },
      };
    },
  };
}

// -----------------------------------------------------------------------------
// Error Response Fixtures
// -----------------------------------------------------------------------------

/**
 * Create a mock error with status code (for API errors).
 */
export function createMockAPIError(message: string, status: number): Error {
  return Object.assign(new Error(message), {
    status,
    response: { status },
  });
}

/**
 * Rate limit error (429).
 */
export const RATE_LIMIT_ERROR = createMockAPIError('Rate limit exceeded', 429);

/**
 * Authentication error (401).
 */
export const AUTH_ERROR = createMockAPIError('API key invalid', 401);

/**
 * Model not found error (404).
 */
export const MODEL_NOT_FOUND_ERROR = createMockAPIError('Model not found', 404);

/**
 * Context length exceeded error (400).
 */
export const CONTEXT_LENGTH_ERROR = createMockAPIError('Context length exceeded', 400);

/**
 * Network error.
 */
export const NETWORK_ERROR = new Error('Network error');

/**
 * Timeout error.
 */
export const TIMEOUT_ERROR = new Error('Request timed out');

// -----------------------------------------------------------------------------
// Conversation History Fixtures
// -----------------------------------------------------------------------------

/**
 * Simple conversation history.
 */
export const SIMPLE_CONVERSATION = [
  { role: 'user' as const, content: 'Hello' },
  { role: 'assistant' as const, content: 'Hi there!' },
];

/**
 * Conversation with tool usage.
 */
export const TOOL_CONVERSATION = [
  { role: 'user' as const, content: 'What is the weather?' },
  { role: 'assistant' as const, content: 'Let me check that for you.' },
  { role: 'user' as const, content: 'Thanks!' },
];

/**
 * Multi-turn conversation.
 */
export const MULTI_TURN_CONVERSATION = [
  { role: 'user' as const, content: 'My name is Alice' },
  { role: 'assistant' as const, content: 'Nice to meet you, Alice!' },
  { role: 'user' as const, content: 'What is my name?' },
  { role: 'assistant' as const, content: 'Your name is Alice.' },
];
