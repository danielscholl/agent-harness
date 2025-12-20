/**
 * Test fixtures exports.
 * Central export point for all test fixtures and factories.
 */

// LLM Response Fixtures
export {
  // Types
  type MockLLMResponse,
  type MockStreamChunk,
  // Simple responses
  SIMPLE_GREETING_RESPONSE,
  ACKNOWLEDGMENT_RESPONSE,
  COMPLETION_RESPONSE,
  COMPLEX_CONTENT_RESPONSE,
  NO_USAGE_RESPONSE,
  // Tool call helpers
  createToolCallResponse,
  GREETING_TOOL_CALL,
  HELLO_TOOL_CALL,
  FILE_READ_TOOL_CALL,
  MULTI_TOOL_CALL,
  EMPTY_ARGS_TOOL_CALL,
  // Streaming helpers
  createMockStream,
  createMockAIMessageStream,
  GREETING_STREAM_CHUNKS,
  CODE_EXPLANATION_CHUNKS,
  createErrorStream,
  // Error fixtures
  createMockAPIError,
  RATE_LIMIT_ERROR,
  AUTH_ERROR,
  MODEL_NOT_FOUND_ERROR,
  CONTEXT_LENGTH_ERROR,
  NETWORK_ERROR,
  TIMEOUT_ERROR,
  // Conversation fixtures
  SIMPLE_CONVERSATION,
  TOOL_CONVERSATION,
  MULTI_TURN_CONVERSATION,
} from './llm-responses.js';

// Factory Functions
export {
  // Configuration factories
  createTestConfig,
  createAnthropicConfig,
  createAzureConfig,
  createRetryConfig,
  createMemoryConfig,
  // Callback factories
  createTrackingCallbacks,
  createMockLLMCallbacks,
  // Message factories
  createMessage,
  createConversationHistory,
  // Tool response factories
  createSuccessResponse,
  createErrorResponse,
  createToolResponse,
  // Model response factories
  createModelSuccess,
  createModelError,
  // Mock model factories
  type MockModel,
  createMockModel,
  createToolCallingModel,
  createFailingModel,
  createRetryableModel,
  // Span context factory
  createSpanContext,
  // Test data factories
  createTestFileContent,
  createTestJSON,
} from './factories.js';

// Mock Provider Helpers
export {
  // Registry mocks
  type MockRegistry,
  createMockRegistry,
  setupSupportedProvider,
  setupUnsupportedProvider,
  setupProviderFailure,
  // LLMClient mocks
  type MockLLMClient,
  createMockLLMClient,
  createToolCallingLLMClient,
  createFailingLLMClient,
  // Module mock helpers
  createRegistryMockModule,
  createLLMClientMockModule,
  // Provider-specific setups
  setupOpenAIMocks,
  setupAnthropicMocks,
  setupAzureMocks,
  setupRateLimitMocks,
  setupAuthFailureMocks,
  setupRetryMocks,
} from './mock-providers.js';
