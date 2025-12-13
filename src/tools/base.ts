/**
 * Helper functions and factory for creating LangChain-compatible tools.
 * Provides the createTool factory that wraps LangChain's tool() function.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import type { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z, ZodError } from 'zod';
import type { ToolResponse, ToolErrorCode, SuccessResponse, ErrorResponse } from './types.js';

/**
 * Create a success response.
 * @param result - The result data
 * @param message - Human-readable success message
 */
export function successResponse<T>(result: T, message: string): SuccessResponse<T> {
  return { success: true, result, message };
}

/**
 * Create an error response.
 * @param error - The error code
 * @param message - Human-readable error message
 */
export function errorResponse(error: ToolErrorCode, message: string): ErrorResponse {
  return { success: false, error, message };
}

/**
 * Options for creating a tool.
 * TInput is the inferred input type from the schema.
 * TResult is the result type in the ToolResponse.
 */
export interface CreateToolOptions<TInput, TResult> {
  /** Tool name (used for LangChain binding) */
  name: string;
  /** Tool description (keep under 40 tokens for LLM consumption) */
  description: string;
  /** Zod schema for input validation - use z.object({...}) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any>;
  /** Tool execution function */
  execute: (input: TInput, config?: RunnableConfig) => Promise<ToolResponse<TResult>>;
}

/**
 * Create a LangChain-compatible tool with the ToolResponse contract.
 *
 * This factory wraps LangChain's tool() function to enforce:
 * - Zod schema validation for inputs (handled by LangChain layer)
 * - ToolResponse return type
 * - Error catching at boundaries (execute function never throws)
 *
 * Note: Schema validation errors are thrown by LangChain before execute() is called.
 * The execute() function itself will never throw - all errors are caught and
 * converted to error responses.
 */
export function createTool<TInput, TResult>(
  options: CreateToolOptions<TInput, TResult>
): StructuredToolInterface {
  const { name, description, schema, execute } = options;

  // Use explicit function signature matching DynamicStructuredTool's func parameter
  const toolFn = async (
    input: unknown,
    _runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig
  ): Promise<ToolResponse<TResult>> => {
    try {
      // Input is already validated by LangChain's tool() wrapper
      return await execute(input as TInput, config);
    } catch (e) {
      // Catch any uncaught errors from execute and convert to error response
      if (e instanceof ZodError) {
        const issues = e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        return errorResponse('VALIDATION_ERROR', `Validation failed: ${issues}`);
      }
      const message = e instanceof Error ? e.message : 'Unknown error occurred';
      return errorResponse('UNKNOWN', message);
    }
  };

  // Use DynamicStructuredTool directly to avoid type inference issues with tool() helper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolInstance = new DynamicStructuredTool<any>({
    name,
    description,
    schema,
    func: toolFn,
  });
  return toolInstance as unknown as StructuredToolInterface;
}

/**
 * Wrap an existing sync or async function to return ToolResponse.
 * Useful for converting existing functions to tool-compatible format.
 *
 * @param fn - Sync or async function to wrap
 * @param successMessage - Function to generate success message from result
 * @param errorCode - Error code to use on failure (default: 'UNKNOWN')
 */
export function wrapWithToolResponse<TInput, TResult>(
  fn: (input: TInput) => TResult | Promise<TResult>,
  successMessage: (result: TResult) => string,
  errorCode: ToolErrorCode = 'UNKNOWN'
): (input: TInput) => Promise<ToolResponse<TResult>> {
  return async (input: TInput): Promise<ToolResponse<TResult>> => {
    try {
      const result = await fn(input);
      return successResponse(result, successMessage(result));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Operation failed';
      return errorResponse(errorCode, message);
    }
  };
}
