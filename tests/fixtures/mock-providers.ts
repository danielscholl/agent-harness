/**
 * Mock provider helpers for consistent LLM mocking across tests.
 * Provides reusable mock setups for different providers.
 */

import { jest } from '@jest/globals';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AIMessage } from '@langchain/core/messages';
import type { ModelResponse } from '../../src/model/types.js';
import {
  createMockModel,
  createToolCallingModel,
  createFailingModel,
  createRetryableModel,
  type MockModel,
} from './factories.js';
import {
  type MockLLMResponse,
  SIMPLE_GREETING_RESPONSE,
  RATE_LIMIT_ERROR,
  AUTH_ERROR,
  createMockStream,
} from './llm-responses.js';

// -----------------------------------------------------------------------------
// Registry Mock Helpers
// -----------------------------------------------------------------------------

/**
 * Mock registry functions matching src/model/registry.ts exports.
 */
export interface MockRegistry {
  isProviderSupported: jest.MockedFunction<(name: string) => boolean>;
  getProviderFactory: jest.MockedFunction<
    () => ((config: Record<string, unknown>) => ModelResponse<BaseChatModel>) | undefined
  >;
  getSupportedProviders: jest.MockedFunction<() => string[]>;
}

/**
 * Create mock registry functions for provider testing.
 */
export function createMockRegistry(): MockRegistry {
  return {
    isProviderSupported: jest.fn<(name: string) => boolean>(),
    getProviderFactory:
      jest.fn<
        () => ((config: Record<string, unknown>) => ModelResponse<BaseChatModel>) | undefined
      >(),
    getSupportedProviders: jest.fn<() => string[]>(),
  };
}

/**
 * Configure registry mock for a supported provider.
 */
export function setupSupportedProvider(
  registry: MockRegistry,
  mockModel: MockModel,
  providerNames: string[] = ['openai']
): void {
  registry.isProviderSupported.mockReturnValue(true);
  registry.getProviderFactory.mockReturnValue(() => ({
    success: true as const,
    result: mockModel as unknown as BaseChatModel,
    message: 'Client created',
  }));
  registry.getSupportedProviders.mockReturnValue(providerNames);
}

/**
 * Configure registry mock for an unsupported provider.
 */
export function setupUnsupportedProvider(registry: MockRegistry): void {
  registry.isProviderSupported.mockReturnValue(false);
  registry.getProviderFactory.mockReturnValue(undefined);
  registry.getSupportedProviders.mockReturnValue([]);
}

/**
 * Configure registry mock for a provider that fails to initialize.
 */
export function setupProviderFailure(
  registry: MockRegistry,
  errorCode: string = 'PROVIDER_NOT_CONFIGURED',
  message: string = 'Provider not configured'
): void {
  registry.isProviderSupported.mockReturnValue(true);
  registry.getProviderFactory.mockReturnValue(() => ({
    success: false as const,
    error: errorCode as 'PROVIDER_NOT_CONFIGURED',
    message,
  }));
}

// -----------------------------------------------------------------------------
// LLMClient Mock Helpers
// -----------------------------------------------------------------------------

/**
 * Mock LLMClient class matching src/model/llm.ts.
 */
export interface MockLLMClient {
  invoke: jest.MockedFunction<() => Promise<unknown>>;
  stream: jest.MockedFunction<() => Promise<unknown>>;
  getModel: jest.MockedFunction<() => unknown>;
  getModelName: jest.MockedFunction<() => string>;
  getProviderName: jest.MockedFunction<() => string>;
}

/**
 * Create a mock LLMClient instance.
 */
export function createMockLLMClient(
  invokeResponse: MockLLMResponse = SIMPLE_GREETING_RESPONSE,
  modelName: string = 'gpt-4o',
  providerName: string = 'openai'
): MockLLMClient {
  const mockModel = createMockModel(invokeResponse);

  return {
    invoke: jest.fn().mockResolvedValue({
      success: true,
      result: { content: invokeResponse.content },
      message: 'Success',
    }),
    stream: jest.fn().mockResolvedValue({
      success: true,
      result: createMockStream(['Hello', ' world', '!']),
      message: 'Stream started',
    }),
    getModel: jest.fn().mockReturnValue({
      success: true,
      result: mockModel as unknown as BaseChatModel,
      message: 'Model retrieved',
    }),
    getModelName: jest.fn().mockReturnValue(modelName),
    getProviderName: jest.fn().mockReturnValue(providerName),
  };
}

/**
 * Create a mock LLMClient that returns tool calls.
 */
export function createToolCallingLLMClient(
  toolCallResponse: AIMessage,
  finalResponse: AIMessage,
  modelName: string = 'gpt-4o'
): MockLLMClient {
  const mockModel = createToolCallingModel(toolCallResponse, finalResponse);

  return {
    invoke: jest.fn().mockResolvedValue({
      success: true,
      result: { content: '' },
      message: 'Success',
    }),
    stream: jest.fn().mockResolvedValue({
      success: true,
      result: createMockStream(['Done']),
      message: 'Stream started',
    }),
    getModel: jest.fn().mockReturnValue({
      success: true,
      result: mockModel as unknown as BaseChatModel,
      message: 'Model retrieved',
    }),
    getModelName: jest.fn().mockReturnValue(modelName),
    getProviderName: jest.fn().mockReturnValue('openai'),
  };
}

/**
 * Create a mock LLMClient that fails on invoke.
 */
export function createFailingLLMClient(
  errorCode: string = 'RATE_LIMITED',
  message: string = 'Rate limit exceeded'
): MockLLMClient {
  return {
    invoke: jest.fn().mockResolvedValue({
      success: false,
      error: errorCode,
      message,
    }),
    stream: jest.fn().mockResolvedValue({
      success: false,
      error: errorCode,
      message,
    }),
    getModel: jest.fn().mockReturnValue({
      success: false,
      error: errorCode,
      message,
    }),
    getModelName: jest.fn().mockReturnValue('gpt-4o'),
    getProviderName: jest.fn().mockReturnValue('openai'),
  };
}

// -----------------------------------------------------------------------------
// Module Mock Setup Helpers
// -----------------------------------------------------------------------------

/**
 * Create the mock module for jest.unstable_mockModule('../registry.js').
 * Returns the object to use as the module mock.
 */
export function createRegistryMockModule(registry: MockRegistry): Record<string, unknown> {
  return {
    isProviderSupported: registry.isProviderSupported,
    getProviderFactory: registry.getProviderFactory,
    getSupportedProviders: registry.getSupportedProviders,
  };
}

/**
 * Create the mock module for jest.unstable_mockModule('../model/llm.js').
 * Returns the object to use as the module mock.
 */
export function createLLMClientMockModule(mockClient: MockLLMClient): Record<string, unknown> {
  return {
    LLMClient: class MockLLMClientClass {
      invoke = mockClient.invoke;
      stream = mockClient.stream;
      getModel = mockClient.getModel;
      getModelName = mockClient.getModelName;
      getProviderName = mockClient.getProviderName;
    },
  };
}

// -----------------------------------------------------------------------------
// Provider-Specific Mock Setups
// -----------------------------------------------------------------------------

/**
 * Setup for OpenAI provider tests.
 */
export function setupOpenAIMocks(
  registry: MockRegistry,
  response: MockLLMResponse = SIMPLE_GREETING_RESPONSE
): MockModel {
  const mockModel = createMockModel(response);
  setupSupportedProvider(registry, mockModel, ['openai']);
  return mockModel;
}

/**
 * Setup for Anthropic provider tests.
 */
export function setupAnthropicMocks(
  registry: MockRegistry,
  response: MockLLMResponse = SIMPLE_GREETING_RESPONSE
): MockModel {
  const mockModel = createMockModel(response);
  setupSupportedProvider(registry, mockModel, ['anthropic']);
  return mockModel;
}

/**
 * Setup for Azure provider tests.
 */
export function setupAzureMocks(
  registry: MockRegistry,
  response: MockLLMResponse = SIMPLE_GREETING_RESPONSE
): MockModel {
  const mockModel = createMockModel(response);
  setupSupportedProvider(registry, mockModel, ['azure']);
  return mockModel;
}

/**
 * Setup for rate limiting scenario.
 */
export function setupRateLimitMocks(registry: MockRegistry): MockModel {
  const mockModel = createFailingModel(RATE_LIMIT_ERROR);
  setupSupportedProvider(registry, mockModel, ['openai']);
  return mockModel;
}

/**
 * Setup for auth failure scenario.
 */
export function setupAuthFailureMocks(registry: MockRegistry): MockModel {
  const mockModel = createFailingModel(AUTH_ERROR);
  setupSupportedProvider(registry, mockModel, ['openai']);
  return mockModel;
}

/**
 * Setup for retry scenario (fails N times then succeeds).
 */
export function setupRetryMocks(
  registry: MockRegistry,
  failuresBeforeSuccess: number = 2
): MockModel {
  const mockModel = createRetryableModel(failuresBeforeSuccess, RATE_LIMIT_ERROR);
  setupSupportedProvider(registry, mockModel, ['openai']);
  return mockModel;
}
