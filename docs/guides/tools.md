# Tool Development Guide

This guide provides detailed patterns and examples for implementing tools in the TypeScript agent framework. For the governing rules, see [CLAUDE.md](../../CLAUDE.md).

---

## Tool Response Contract

All tools return a structured `ToolResponse` type. This provides uniform error handling and predictable LLM consumption.

### Type Definitions

```typescript
type ToolErrorCode =
  | 'VALIDATION_ERROR'
  | 'IO_ERROR'
  | 'CONFIG_ERROR'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'LLM_ASSIST_REQUIRED'
  | 'UNKNOWN';

interface SuccessResponse<T = unknown> {
  success: true;
  result: T;
  message: string;
}

interface ErrorResponse {
  success: false;
  error: ToolErrorCode;
  message: string;
}

type ToolResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;
```

### Usage Notes

- **Public interface**: Tools MUST return `ToolResponse`, never throw
- **Internal implementation**: MAY throw `ToolError`/`AgentError` - catch at boundary
- **Type safety**: Prefer `ToolResponse<SpecificType>` over plain `ToolResponse`
- **LLM assist**: Return `error: 'LLM_ASSIST_REQUIRED'` when tool needs LLM help

---

## Basic Tool Implementation

Tools use LangChain's `tool` function with Zod schemas for input validation.

```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolResponse } from '../tools/base.js';

// Define input schema with descriptions
const HelloInputSchema = z.object({
  name: z.string().describe('Name to greet'),
});

// Define result type for type safety
interface HelloResult {
  greeting: string;
}

export const helloTool = tool(
  async (input): Promise<ToolResponse<HelloResult>> => {
    try {
      return {
        success: true,
        result: { greeting: `Hello, ${input.name}!` },
        message: `Greeted ${input.name}`,
      };
    } catch (e) {
      return {
        success: false,
        error: 'UNKNOWN',
        message: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  },
  {
    name: 'hello',
    description: 'Greet a user by name',  // Keep under 40 tokens
    schema: HelloInputSchema,
  }
);
```

---

## Error Handling Patterns

### Catching Internal Errors

Tools may throw internally but must catch at the boundary:

```typescript
import { ToolError } from '../errors/index.js';

export const readFileTool = tool(
  async (input): Promise<ToolResponse<FileContent>> => {
    try {
      // Internal code may throw
      const content = await readFileInternal(input.path);
      return {
        success: true,
        result: { content, path: input.path },
        message: `Read ${input.path}`,
      };
    } catch (e) {
      // Catch and convert to ToolResponse at boundary
      if (e instanceof ToolError) {
        return {
          success: false,
          error: e.code as ToolErrorCode,
          message: e.message,
        };
      }
      return {
        success: false,
        error: 'IO_ERROR',
        message: e instanceof Error ? e.message : 'Failed to read file',
      };
    }
  },
  {
    name: 'read_file',
    description: 'Read contents of a file',
    schema: ReadFileInputSchema,
  }
);
```

### Requesting LLM Assistance

When a tool needs LLM help to complete its task:

```typescript
export const summarizeTool = tool(
  async (input): Promise<ToolResponse> => {
    const content = await fetchContent(input.url);

    if (content.length > MAX_PROCESSABLE_LENGTH) {
      // Tool cannot handle this alone - request LLM help
      return {
        success: false,
        error: 'LLM_ASSIST_REQUIRED',
        message: `Content too large (${content.length} chars). Please summarize: ${content.slice(0, 1000)}...`,
      };
    }

    return {
      success: true,
      result: { summary: processContent(content) },
      message: 'Content processed',
    };
  },
  {
    name: 'summarize',
    description: 'Summarize content from a URL',
    schema: SummarizeInputSchema,
  }
);
```

The Agent Layer interprets `LLM_ASSIST_REQUIRED` and takes appropriate action.

---

## Permission-Aware Tools

Tools with side effects must check permissions:

```typescript
import { PermissionScope } from '../types/permissions.js';

const WriteFileInputSchema = z.object({
  path: z.string().describe('File path to write'),
  content: z.string().describe('Content to write'),
});

export const writeFileTool = tool(
  async (input, config): Promise<ToolResponse> => {
    const callbacks = config?.callbacks;

    // Request permission via callback
    const permitted = await callbacks?.onPermissionRequest?.({
      scope: 'fs-write' as PermissionScope,
      resource: input.path,
      action: 'write file',
    });

    if (!permitted) {
      return {
        success: false,
        error: 'PERMISSION_DENIED',
        message: `Write permission denied for ${input.path}`,
      };
    }

    try {
      await writeFile(input.path, input.content);
      return {
        success: true,
        result: { path: input.path, bytes: input.content.length },
        message: `Wrote ${input.content.length} bytes to ${input.path}`,
      };
    } catch (e) {
      return {
        success: false,
        error: 'IO_ERROR',
        message: e instanceof Error ? e.message : 'Write failed',
      };
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file (requires permission)',
    schema: WriteFileInputSchema,
  }
);
```

---

## Tool Documentation Standards

### Description Guidelines

- **Simple tools**: 10-20 tokens - what it does in one sentence
- **Complex tools**: 25-40 tokens - purpose, constraints, defaults
- **Include**: what it does, critical constraints, prerequisites
- **Exclude**: code examples, response structures, detailed parameter docs

### Using Zod Descriptions

Parameter documentation goes in Zod `.describe()`:

```typescript
const SearchInputSchema = z.object({
  query: z.string().describe('Search query string'),
  limit: z.number().min(1).max(100).default(10).describe('Max results (1-100)'),
  caseSensitive: z.boolean().default(false).describe('Case-sensitive matching'),
});

export const searchTool = tool(
  async (input): Promise<ToolResponse<SearchResult[]>> => {
    // implementation
  },
  {
    name: 'search',
    description: 'Search codebase for matching content',  // Brief, under 40 tokens
    schema: SearchInputSchema,
  }
);
```

---

## Context Storage

Tools producing large outputs should use context storage:

```typescript
import { ContextManager } from '../utils/context.js';

export const searchCodeTool = tool(
  async (input, config): Promise<ToolResponse> => {
    const results = await performSearch(input.query);
    const contextManager = config?.configurable?.contextManager as ContextManager;

    // Small results: return directly
    if (JSON.stringify(results).length < 32 * 1024) {
      return {
        success: true,
        result: results,
        message: `Found ${results.length} matches`,
      };
    }

    // Large results: persist to context
    const contextId = await contextManager.save({
      tool: 'search_code',
      args: input,
      result: results,
    });

    return {
      success: true,
      result: {
        contextId,
        summary: `Found ${results.length} matches`,
        preview: results.slice(0, 5),
      },
      message: `Results saved to context ${contextId}`,
    };
  },
  {
    name: 'search_code',
    description: 'Search codebase with regex pattern',
    schema: SearchCodeInputSchema,
  }
);
```

---

## Testing Tools

See [testing.md](./testing.md) for complete testing patterns. Quick example:

```typescript
import { helloTool } from '../hello.js';

describe('helloTool', () => {
  it('returns greeting for valid name', async () => {
    const result = await helloTool.invoke({ name: 'World' });

    expect(result).toEqual({
      success: true,
      result: { greeting: 'Hello, World!' },
      message: 'Greeted World',
    });
  });

  it('handles empty name gracefully', async () => {
    const result = await helloTool.invoke({ name: '' });

    expect(result.success).toBe(true);
  });
});
```

---

## Checklist

Before submitting a new tool:

- [ ] Returns `ToolResponse<SpecificType>` at public boundary
- [ ] All errors caught and converted to `ErrorResponse`
- [ ] Zod schema with `.describe()` on all parameters
- [ ] Description under 40 tokens
- [ ] Permissions requested for side effects
- [ ] Large outputs use context storage
- [ ] Unit tests with mocked dependencies
- [ ] No direct LLM calls (use `LLM_ASSIST_REQUIRED` if needed)
