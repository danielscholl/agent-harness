/**
 * Unit tests for Local provider factory.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock @langchain/openai before importing
interface MockOpenAIConfig {
  model: string;
  openAIApiKey?: string;
  configuration?: { baseURL?: string };
}

const mockChatOpenAI = jest
  .fn<(config: MockOpenAIConfig) => { model: string; _type: string }>()
  .mockImplementation((config) => ({
    model: config.model,
    _type: 'chat_model',
  }));

jest.unstable_mockModule('@langchain/openai', () => ({
  ChatOpenAI: mockChatOpenAI,
}));

// Import after mocking
const { createLocalClient } = await import('../providers/local.js');

describe('createLocalClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates ChatOpenAI with default baseUrl and model', () => {
    const result = createLocalClient({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result).toBeDefined();
      expect(result.message).toContain('ai/phi4');
    }
    expect(mockChatOpenAI).toHaveBeenCalledWith({
      model: 'ai/phi4',
      openAIApiKey: 'not-needed',
      configuration: { baseURL: 'http://model-runner.docker.internal/' },
    });
  });

  it('creates ChatOpenAI with custom baseUrl', () => {
    const result = createLocalClient({
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.2',
    });

    expect(result.success).toBe(true);
    expect(mockChatOpenAI).toHaveBeenCalledWith({
      model: 'llama3.2',
      openAIApiKey: 'not-needed',
      configuration: { baseURL: 'http://localhost:11434/v1' },
    });
  });

  it('creates ChatOpenAI with custom model', () => {
    const result = createLocalClient({
      model: 'ai/llama3.2',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message).toContain('ai/llama3.2');
    }
  });

  it('handles Record<string, unknown> config type', () => {
    const config: Record<string, unknown> = {
      model: 'ai/mistral',
      baseUrl: 'http://custom.local:8080/v1',
    };

    const result = createLocalClient(config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message).toContain('ai/mistral');
    }
  });

  it('uses defaults when fields are undefined', () => {
    const config: Record<string, unknown> = {};

    const result = createLocalClient(config);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message).toContain('ai/phi4');
    }
    expect(mockChatOpenAI).toHaveBeenCalledWith({
      model: 'ai/phi4',
      openAIApiKey: 'not-needed',
      configuration: { baseURL: 'http://model-runner.docker.internal/' },
    });
  });

  it('passes correct parameters to ChatOpenAI including openAIApiKey', () => {
    createLocalClient({
      model: 'ai/phi4',
      baseUrl: 'http://model-runner.docker.internal/',
    });

    expect(mockChatOpenAI).toHaveBeenCalledWith({
      model: 'ai/phi4',
      openAIApiKey: 'not-needed',
      configuration: { baseURL: 'http://model-runner.docker.internal/' },
    });
  });

  it('returns error when ChatOpenAI constructor throws', () => {
    mockChatOpenAI.mockImplementationOnce(() => {
      throw new Error('Connection refused');
    });

    const result = createLocalClient({
      model: 'ai/phi4',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('NETWORK_ERROR');
      expect(result.message).toBe('Connection refused');
    }
  });

  it('handles non-Error thrown objects', () => {
    mockChatOpenAI.mockImplementationOnce(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'string error';
    });

    const result = createLocalClient({
      model: 'ai/phi4',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe('Failed to create Local client');
    }
  });

  it('works with Ollama-style baseUrl', () => {
    const result = createLocalClient({
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.2',
    });

    expect(result.success).toBe(true);
    expect(mockChatOpenAI).toHaveBeenCalledWith({
      model: 'llama3.2',
      openAIApiKey: 'not-needed',
      configuration: { baseURL: 'http://localhost:11434/v1' },
    });
  });

  it('works with LM Studio-style baseUrl', () => {
    const result = createLocalClient({
      baseUrl: 'http://localhost:1234/v1',
      model: 'local-model',
    });

    expect(result.success).toBe(true);
    expect(mockChatOpenAI).toHaveBeenCalledWith({
      model: 'local-model',
      openAIApiKey: 'not-needed',
      configuration: { baseURL: 'http://localhost:1234/v1' },
    });
  });

  it('uses default baseUrl when empty string provided', () => {
    const result = createLocalClient({
      baseUrl: '',
      model: 'ai/phi4',
    });

    expect(result.success).toBe(true);
    expect(mockChatOpenAI).toHaveBeenCalledWith({
      model: 'ai/phi4',
      openAIApiKey: 'not-needed',
      configuration: { baseURL: 'http://model-runner.docker.internal/' },
    });
  });

  it('uses default model when empty string provided', () => {
    const result = createLocalClient({
      baseUrl: 'http://localhost:11434/v1',
      model: '',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message).toContain('ai/phi4');
    }
    expect(mockChatOpenAI).toHaveBeenCalledWith({
      model: 'ai/phi4',
      openAIApiKey: 'not-needed',
      configuration: { baseURL: 'http://localhost:11434/v1' },
    });
  });

  it('uses all defaults when both baseUrl and model are empty strings', () => {
    const result = createLocalClient({
      baseUrl: '',
      model: '',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message).toContain('ai/phi4');
    }
    expect(mockChatOpenAI).toHaveBeenCalledWith({
      model: 'ai/phi4',
      openAIApiKey: 'not-needed',
      configuration: { baseURL: 'http://model-runner.docker.internal/' },
    });
  });
});
