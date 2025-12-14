/**
 * Tools module - LangChain tool wrapper and response contract.
 *
 * This module provides:
 * - ToolResponse<T> type for uniform tool responses
 * - Helper functions for creating success/error responses
 * - createTool factory for LangChain-compatible tools
 */

// Type exports
export type { ToolErrorCode, ToolResponse, SuccessResponse, ErrorResponse } from './types.js';

// Type guards
export { isSuccessResponse, isErrorResponse } from './types.js';

// Helper functions
export { successResponse, errorResponse, createTool, wrapWithToolResponse } from './base.js';

// Types for tool creation
export type { CreateToolOptions } from './base.js';

// Hello tools (reference implementation)
export { helloWorldTool, greetUserTool } from './hello.js';

// Filesystem tools
export {
  // Tools
  getPathInfoTool,
  listDirectoryTool,
  readFileTool,
  searchTextTool,
  writeFileTool,
  applyTextEditTool,
  createDirectoryTool,
  applyFilePatchTool,
  // Utilities
  getWorkspaceRoot,
  getWorkspaceRootReal,
  resolveWorkspacePath,
  resolveWorkspacePathSafe,
  isFilesystemWritesEnabled,
  mapSystemErrorToToolError,
  // Constants
  DEFAULT_MAX_READ_BYTES,
  DEFAULT_MAX_WRITE_BYTES,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_LINES,
  DEFAULT_MAX_MATCHES,
  MAX_ENTRIES_CAP,
  MAX_LINES_CAP,
  SNIPPET_MAX_LENGTH,
  BINARY_CHECK_SIZE,
} from './filesystem.js';

// Filesystem result types
export type {
  PathInfoResult,
  DirectoryEntry,
  ListDirectoryResult,
  ReadFileResult,
  SearchMatch,
  SearchTextResult,
  WriteFileResult,
  ApplyTextEditResult,
  CreateDirectoryResult,
  ApplyFilePatchResult,
} from './filesystem.js';
