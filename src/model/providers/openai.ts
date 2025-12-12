/**
 * OpenAI provider factory.
 * Creates ChatOpenAI instances from provider configuration.
 */

import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { OpenAIProviderConfig } from '../../config/schema.js';
import type { ModelResponse } from '../types.js';
import { successResponse, errorResponse, mapErrorToCode } from '../base.js';

/**
 * Create a ChatOpenAI instance from provider config.
 *
 * @param config - OpenAI provider configuration
 * @returns ModelResponse with ChatOpenAI or error
 */
export function createOpenAIClient(
  config: OpenAIProviderConfig | Record<string, unknown>
): ModelResponse<BaseChatModel> {
  try {
    const typedConfig = config as OpenAIProviderConfig;

    // API key can come from config or OPENAI_API_KEY env var
    const apiKey = typedConfig.apiKey;
    // Model has a default from schema, but we handle Record<string,unknown> input too
    const model: string = typedConfig.model;
    const baseUrl = typedConfig.baseUrl;

    // Create ChatOpenAI instance
    const client = new ChatOpenAI({
      model,
      openAIApiKey: apiKey,
      configuration: baseUrl !== undefined && baseUrl !== '' ? { baseURL: baseUrl } : undefined,
    });

    return successResponse(client as BaseChatModel, `OpenAI client created with model: ${model}`);
  } catch (error) {
    const errorCode = mapErrorToCode(error);
    const message = error instanceof Error ? error.message : 'Failed to create OpenAI client';
    return errorResponse(errorCode, message);
  }
}
