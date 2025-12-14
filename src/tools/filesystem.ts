/**
 * FileSystem tools for safe, sandboxed file operations.
 *
 * Provides structured filesystem tools that enable agents to inspect
 * and modify files in a controlled workspace without arbitrary shell execution.
 *
 * Key Features:
 * - Workspace sandboxing with path traversal protection
 * - Structured directory listing and file reading
 * - Text search with literal and regex support
 * - Guarded write operations
 * - Surgical text editing with safety checks
 * - Cross-platform path handling
 */

import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { z } from 'zod';
import { createTool, successResponse, errorResponse } from './base.js';
import type { ToolResponse, ToolErrorCode } from './types.js';

// =============================================================================
// Constants
// =============================================================================

/** Default max bytes to read from a file (1MB) */
export const DEFAULT_MAX_READ_BYTES = 1024 * 1024;

/** Default max bytes to write to a file (1MB) */
export const DEFAULT_MAX_WRITE_BYTES = 1024 * 1024;

/** Default max directory entries to return */
export const DEFAULT_MAX_ENTRIES = 200;

/** Maximum directory entries cap */
export const MAX_ENTRIES_CAP = 500;

/** Default max lines to read */
export const DEFAULT_MAX_LINES = 200;

/** Maximum lines cap */
export const MAX_LINES_CAP = 1000;

/** Default max search matches */
export const DEFAULT_MAX_MATCHES = 50;

/** Snippet truncation length */
export const SNIPPET_MAX_LENGTH = 200;

/** Binary detection sample size */
export const BINARY_CHECK_SIZE = 8192;

// =============================================================================
// Types
// =============================================================================

/** Path info result */
export interface PathInfoResult {
  exists: boolean;
  type: 'file' | 'directory' | 'symlink' | 'other' | null;
  size: number | null;
  modified: number | null;
  isReadable: boolean;
  isWritable: boolean;
  absolutePath: string;
}

/** Directory entry */
export interface DirectoryEntry {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  size: number | null;
}

/** List directory result */
export interface ListDirectoryResult {
  entries: DirectoryEntry[];
  truncated: boolean;
}

/** Read file result */
export interface ReadFileResult {
  path: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  truncated: boolean;
  nextStartLine: number | null;
  content: string;
  encodingErrors: boolean;
}

/** Search match */
export interface SearchMatch {
  file: string;
  line: number;
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

/** Search text result */
export interface SearchTextResult {
  query: string;
  useRegex: boolean;
  filesSearched: number;
  matches: SearchMatch[];
  truncated: boolean;
}

/** Write file result */
export interface WriteFileResult {
  path: string;
  bytesWritten: number;
  mode: 'create' | 'overwrite' | 'append';
  existedBefore: boolean;
}

/** Apply text edit result */
export interface ApplyTextEditResult {
  path: string;
  bytesWritten: number;
  replacements: number;
  originalSize: number;
  newSize: number;
  linesChanged: number;
}

/** Create directory result */
export interface CreateDirectoryResult {
  path: string;
  created: boolean;
  parentsCreated: number;
}

/** Apply file patch result */
export interface ApplyFilePatchResult {
  path: string;
  dryRun: boolean;
  hunksApplied: number;
  linesAdded: number;
  linesRemoved: number;
  originalSize: number;
  newSize: number;
  sha256Before: string;
  sha256After: string;
}

/** Parsed unified diff hunk */
interface ParsedHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  contextBefore: string[];
  removals: string[];
  additions: string[];
  contextAfter: string[];
}

/** Patch parse error with context */
interface PatchParseError {
  type: 'parse_error' | 'context_mismatch' | 'hunk_failed';
  message: string;
  hunkIndex?: number;
  excerpt?: string;
}

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Get workspace root from environment or current directory.
 * Priority: AGENT_WORKSPACE_ROOT env var > process.cwd()
 */
export function getWorkspaceRoot(): string {
  const envRoot = process.env['AGENT_WORKSPACE_ROOT'];
  if (envRoot !== undefined && envRoot !== '') {
    // Expand ~ to home directory
    const expanded = envRoot.startsWith('~') ? path.join(os.homedir(), envRoot.slice(1)) : envRoot;
    return path.resolve(expanded);
  }
  return process.cwd();
}

/**
 * Get workspace root resolved to its real path (follows symlinks).
 * Async version needed because realpath is async.
 */
export async function getWorkspaceRootReal(): Promise<string> {
  const workspace = getWorkspaceRoot();
  try {
    return await fs.realpath(workspace);
  } catch {
    return path.resolve(workspace);
  }
}

/**
 * Check if filesystem writes are enabled.
 * Checks AGENT_FILESYSTEM_WRITES_ENABLED env var (defaults to true).
 * This should be set by the Agent layer based on config.agent.filesystemWritesEnabled.
 */
export function isFilesystemWritesEnabled(): boolean {
  const envValue = process.env['AGENT_FILESYSTEM_WRITES_ENABLED'];
  // Default to true if not set, false only if explicitly set to 'false' or '0'
  if (envValue === undefined || envValue === '') {
    return true;
  }
  return envValue.toLowerCase() !== 'false' && envValue !== '0';
}

/**
 * Check write permission and return error if writes are disabled.
 */
function checkWritePermission(): ToolResponse<never> | null {
  if (!isFilesystemWritesEnabled()) {
    return errorResponse(
      'PERMISSION_DENIED',
      'Filesystem writes are disabled. Set AGENT_FILESYSTEM_WRITES_ENABLED=true or update config.agent.filesystemWritesEnabled.'
    );
  }
  return null;
}

/**
 * Resolve and validate a path within workspace boundaries.
 * Returns resolved path or error response.
 * Note: This performs basic path validation but does NOT follow symlinks.
 * For symlink-safe validation, use resolveWorkspacePathSafe() which verifies realpath.
 */
export function resolveWorkspacePath(
  relativePath: string,
  workspaceRoot?: string
): string | ToolResponse<never> {
  const workspace = workspaceRoot ?? getWorkspaceRoot();

  // Check for path traversal attempts
  const pathParts = relativePath.split(/[/\\]/);
  if (pathParts.includes('..')) {
    return errorResponse(
      'PERMISSION_DENIED',
      `Path contains '..' component: ${relativePath}. Path traversal is not allowed.`
    );
  }

  // Resolve the path
  const requestedPath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(workspace, relativePath);
  const resolved = path.resolve(requestedPath);

  // Ensure resolved path is within workspace
  const normalizedWorkspace = path.resolve(workspace);
  if (!resolved.startsWith(normalizedWorkspace + path.sep) && resolved !== normalizedWorkspace) {
    return errorResponse('PERMISSION_DENIED', `Path resolves outside workspace: ${relativePath}`);
  }

  return resolved;
}

/**
 * Resolve and validate a path with symlink safety.
 * After resolving the path, follows symlinks and verifies the real path is within workspace.
 * This prevents symlink escape attacks where a symlink points outside the workspace.
 *
 * @param relativePath - Path relative to workspace
 * @param workspaceRoot - Optional workspace root override
 * @param requireExists - If true, returns error if path doesn't exist (needed for realpath)
 * @returns Resolved path, or error response if validation fails
 */
export async function resolveWorkspacePathSafe(
  relativePath: string,
  workspaceRoot?: string,
  requireExists: boolean = false
): Promise<string | ToolResponse<never>> {
  // First do basic path validation
  const basicResult = resolveWorkspacePath(relativePath, workspaceRoot);
  if (typeof basicResult !== 'string') {
    return basicResult;
  }

  const workspace = workspaceRoot ?? getWorkspaceRoot();

  // Resolve workspace to real path (handles symlinks like /var -> /private/var on macOS)
  let realWorkspace: string;
  try {
    realWorkspace = await fs.realpath(workspace);
  } catch {
    // Workspace doesn't exist - use normalized path
    realWorkspace = path.resolve(workspace);
  }

  // Try to get the real path (follows symlinks)
  try {
    const realPath = await fs.realpath(basicResult);

    // Verify real path is within workspace (using real workspace path)
    if (!realPath.startsWith(realWorkspace + path.sep) && realPath !== realWorkspace) {
      return errorResponse(
        'PERMISSION_DENIED',
        `Symlink resolves outside workspace: ${relativePath}`
      );
    }

    return realPath;
  } catch (error) {
    // Path doesn't exist - realpath can't resolve it
    if (requireExists) {
      const mapped = mapSystemErrorToToolError(error);
      return errorResponse(mapped.code, `Path does not exist: ${relativePath}`);
    }

    // For paths that don't exist yet (writes), we need to verify parent exists and is safe
    // Check each parent directory until we find one that exists
    let checkPath = basicResult;
    while (checkPath !== realWorkspace && checkPath !== path.dirname(checkPath)) {
      const parentPath = path.dirname(checkPath);
      try {
        const parentReal = await fs.realpath(parentPath);
        // Verify parent's real path is within workspace
        if (!parentReal.startsWith(realWorkspace + path.sep) && parentReal !== realWorkspace) {
          return errorResponse(
            'PERMISSION_DENIED',
            `Parent directory symlink resolves outside workspace: ${relativePath}`
          );
        }
        // Parent is safe, return the original resolved path
        return basicResult;
      } catch {
        // Parent doesn't exist either, check grandparent
        checkPath = parentPath;
      }
    }

    // Reached workspace root or filesystem root - path is safe
    return basicResult;
  }
}

/**
 * Map Node.js system errors to tool error codes.
 */
export function mapSystemErrorToToolError(error: unknown): {
  code: ToolErrorCode;
  message: string;
} {
  // Handle Error instances (including SystemError with code property)
  if (error !== null && error !== undefined && typeof error === 'object') {
    // Check for code property first (most reliable for Node.js system errors)
    const errorObj = error as { code?: string; message?: string };
    const code = errorObj.code;
    const message = error instanceof Error ? error.message : (errorObj.message ?? 'Unknown error');

    // Also check message for error codes (fallback for some environments)
    // Matches "ENOENT:", "Error: ENOENT:", etc.
    const messageCode = message.match(
      /(ENOENT|EACCES|EPERM|EISDIR|ENOTDIR|EMFILE|ENFILE|ENOSPC):/
    )?.[1];
    const effectiveCode = code ?? messageCode;

    switch (effectiveCode) {
      case 'ENOENT':
        return { code: 'NOT_FOUND', message };
      case 'EACCES':
      case 'EPERM':
        return { code: 'PERMISSION_DENIED', message };
      case 'EISDIR':
      case 'ENOTDIR':
        return { code: 'VALIDATION_ERROR', message };
      case 'EMFILE':
      case 'ENFILE':
      case 'ENOSPC':
        return { code: 'IO_ERROR', message };
      default:
        // If we have an Error object, return IO_ERROR for unknown codes
        if (error instanceof Error || code !== undefined) {
          return { code: 'IO_ERROR', message };
        }
    }
  }
  return { code: 'UNKNOWN', message: String(error) };
}

/**
 * Check if file is binary by looking for null bytes in first 8KB.
 */
async function isBinaryFileHandle(fd: fs.FileHandle): Promise<boolean> {
  const buffer = Buffer.alloc(BINARY_CHECK_SIZE);
  const { bytesRead } = await fd.read(buffer, 0, BINARY_CHECK_SIZE, 0);
  const sample = buffer.subarray(0, bytesRead);
  return sample.includes(0);
}

// =============================================================================
// Tool Implementations
// =============================================================================

// --- get_path_info ---

const GetPathInfoInputSchema = z.object({
  path: z.string().default('.').describe('Path relative to workspace root'),
});

/**
 * Get file/directory metadata within workspace.
 * Returns exists, type, size, permissions, timestamps.
 */
export const getPathInfoTool = createTool<z.infer<typeof GetPathInfoInputSchema>, PathInfoResult>({
  name: 'get_path_info',
  description: 'Get file/directory metadata. Returns exists, type, size, modified, permissions.',
  schema: GetPathInfoInputSchema,
  execute: async (input): Promise<ToolResponse<PathInfoResult>> => {
    // Use basic path resolution first (don't require exists for path_info)
    const resolved = await resolveWorkspacePathSafe(input.path);
    if (typeof resolved !== 'string') {
      return resolved;
    }

    try {
      // Check if path exists using lstat (doesn't follow symlinks)
      let stats: fsSync.Stats;
      let isSymlink = false;
      try {
        const lstats = await fs.lstat(resolved);
        isSymlink = lstats.isSymbolicLink();
        // If symlink, get stats of target for size/type
        stats = isSymlink ? await fs.stat(resolved) : lstats;
      } catch {
        // Path doesn't exist
        const info: PathInfoResult = {
          exists: false,
          type: null,
          size: null,
          modified: null,
          isReadable: false,
          isWritable: false,
          absolutePath: resolved,
        };
        return successResponse(info, `Path does not exist: ${input.path}`);
      }

      // Determine type
      let type: PathInfoResult['type'];
      if (isSymlink) {
        type = 'symlink';
      } else if (stats.isFile()) {
        type = 'file';
      } else if (stats.isDirectory()) {
        type = 'directory';
      } else {
        type = 'other';
      }

      // Check permissions
      let isReadable = false;
      let isWritable = false;
      try {
        await fs.access(resolved, fsSync.constants.R_OK);
        isReadable = true;
      } catch {
        // Not readable
      }
      try {
        await fs.access(resolved, fsSync.constants.W_OK);
        isWritable = true;
      } catch {
        // Not writable
      }

      const info: PathInfoResult = {
        exists: true,
        type,
        size: stats.isFile() ? stats.size : null,
        modified: stats.mtimeMs,
        isReadable,
        isWritable,
        absolutePath: resolved,
      };

      return successResponse(info, `Retrieved metadata for: ${input.path}`);
    } catch (error) {
      const mapped = mapSystemErrorToToolError(error);
      return errorResponse(mapped.code, `Error accessing ${input.path}: ${mapped.message}`);
    }
  },
});

// --- list_directory ---

const ListDirectoryInputSchema = z.object({
  path: z.string().default('.').describe('Directory path relative to workspace'),
  recursive: z.boolean().default(false).describe('Recursively list subdirectories'),
  maxEntries: z.number().default(DEFAULT_MAX_ENTRIES).describe('Maximum entries to return'),
  includeHidden: z.boolean().default(false).describe('Include hidden files (dotfiles)'),
});

/**
 * List directory contents with metadata.
 * Supports recursive traversal. Default: 200 entries max.
 */
export const listDirectoryTool = createTool<
  z.infer<typeof ListDirectoryInputSchema>,
  ListDirectoryResult
>({
  name: 'list_directory',
  description:
    'List directory contents with metadata. Supports recursive mode. Default 200 entries.',
  schema: ListDirectoryInputSchema,
  execute: async (input): Promise<ToolResponse<ListDirectoryResult>> => {
    // Require path exists for listing
    const resolved = await resolveWorkspacePathSafe(input.path, undefined, true);
    if (typeof resolved !== 'string') {
      return resolved;
    }

    // Cap maxEntries
    const maxEntries = Math.min(input.maxEntries, MAX_ENTRIES_CAP);
    // Use real workspace root for relative path calculation (resolved paths are real)
    const workspaceRoot = await getWorkspaceRootReal();

    try {
      // Check path exists and is directory
      const stats = await fs.stat(resolved);
      if (!stats.isDirectory()) {
        return errorResponse('VALIDATION_ERROR', `Path is not a directory: ${input.path}`);
      }

      const entries: DirectoryEntry[] = [];
      let truncated = false;

      if (input.recursive) {
        // Recursive walk using async generator
        async function* walk(
          dir: string
        ): AsyncGenerator<{ entryPath: string; isDir: boolean; size: number | null }> {
          const dirents = await fs.readdir(dir, { withFileTypes: true });
          for (const dirent of dirents) {
            if (!input.includeHidden && dirent.name.startsWith('.')) continue;

            const entryPath = path.join(dir, dirent.name);
            if (dirent.isDirectory()) {
              yield { entryPath, isDir: true, size: null };
              yield* walk(entryPath);
            } else if (dirent.isFile()) {
              let size: number | null = null;
              try {
                const s = await fs.stat(entryPath);
                size = s.size;
              } catch {
                // Ignore stat errors
              }
              yield { entryPath, isDir: false, size };
            }
          }
        }

        for await (const { entryPath, isDir, size } of walk(resolved)) {
          if (entries.length >= maxEntries) {
            truncated = true;
            break;
          }
          const relativePath = path.relative(workspaceRoot, entryPath);
          entries.push({
            name: path.basename(entryPath),
            relativePath,
            type: isDir ? 'directory' : 'file',
            size,
          });
        }
      } else {
        // Non-recursive listing
        const dirents = await fs.readdir(resolved, { withFileTypes: true });
        for (const dirent of dirents) {
          if (entries.length >= maxEntries) {
            truncated = true;
            break;
          }
          if (!input.includeHidden && dirent.name.startsWith('.')) continue;

          const entryPath = path.join(resolved, dirent.name);
          const relativePath = path.relative(workspaceRoot, entryPath);

          if (dirent.isDirectory()) {
            entries.push({
              name: dirent.name,
              relativePath,
              type: 'directory',
              size: null,
            });
          } else if (dirent.isFile()) {
            let size: number | null = null;
            try {
              const s = await fs.stat(entryPath);
              size = s.size;
            } catch {
              // Ignore stat errors
            }
            entries.push({
              name: dirent.name,
              relativePath,
              type: 'file',
              size,
            });
          }
        }
      }

      return successResponse(
        { entries, truncated },
        `Listed ${String(entries.length)} entries from: ${input.path}`
      );
    } catch (error) {
      const mapped = mapSystemErrorToToolError(error);
      return errorResponse(mapped.code, `Error listing ${input.path}: ${mapped.message}`);
    }
  },
});

// --- read_file ---

const ReadFileInputSchema = z.object({
  path: z.string().describe('File path relative to workspace'),
  startLine: z.number().default(1).describe('Starting line number (1-based)'),
  maxLines: z.number().default(DEFAULT_MAX_LINES).describe('Maximum lines to read'),
});

/**
 * Read text file by line range.
 * Returns content with truncation flag for large files.
 */
export const readFileTool = createTool<z.infer<typeof ReadFileInputSchema>, ReadFileResult>({
  name: 'read_file',
  description: 'Read file before and after edits to verify changes. Default: first 200 lines.',
  schema: ReadFileInputSchema,
  execute: async (input): Promise<ToolResponse<ReadFileResult>> => {
    // Require file exists for reading
    const resolved = await resolveWorkspacePathSafe(input.path, undefined, true);
    if (typeof resolved !== 'string') {
      return resolved;
    }

    // Cap maxLines
    const maxLines = Math.min(input.maxLines, MAX_LINES_CAP);
    const startLine = Math.max(1, input.startLine);

    try {
      const fd = await fs.open(resolved, 'r');
      let content: string;
      try {
        // Check file exists
        const stats = await fd.stat();
        if (!stats.isFile()) {
          return errorResponse('VALIDATION_ERROR', `Path is not a file: ${input.path}`);
        }

        // Check file size
        if (stats.size > DEFAULT_MAX_READ_BYTES) {
          return errorResponse(
            'VALIDATION_ERROR',
            `File size (${String(stats.size)} bytes) exceeds max read limit (${String(DEFAULT_MAX_READ_BYTES)} bytes): ${input.path}`
          );
        }

        // Check for binary
        if (await isBinaryFileHandle(fd)) {
          return errorResponse(
            'VALIDATION_ERROR',
            `File appears to be binary (contains null bytes): ${input.path}`
          );
        }

        // Read file content via the same file descriptor used for checks.
        content = (await fd.readFile()).toString('utf8');
      } finally {
        await fd.close();
      }
      const lines = content.split('\n');
      const totalLines = lines.length;

      // Validate start line
      if (startLine > totalLines && totalLines > 0) {
        return errorResponse(
          'VALIDATION_ERROR',
          `startLine (${String(startLine)}) exceeds file length (${String(totalLines)} lines): ${input.path}`
        );
      }

      // Extract lines (1-based to 0-based)
      const startIdx = startLine - 1;
      const endIdx = Math.min(startIdx + maxLines, totalLines);
      const selectedLines = lines.slice(startIdx, endIdx);
      const selectedContent = selectedLines.join('\n');

      // Check truncation
      const truncated = endIdx < totalLines;
      const nextStartLine = truncated ? endIdx + 1 : null;

      // Check for encoding errors (replacement character)
      const encodingErrors = selectedContent.includes('\ufffd');

      const result: ReadFileResult = {
        path: input.path,
        startLine,
        endLine: endIdx,
        totalLines,
        truncated,
        nextStartLine,
        content: selectedContent,
        encodingErrors,
      };

      return successResponse(
        result,
        `Read ${String(selectedLines.length)} lines from ${input.path} (lines ${String(startLine)}-${String(endIdx)})`
      );
    } catch (error) {
      const mapped = mapSystemErrorToToolError(error);
      return errorResponse(mapped.code, `Error reading ${input.path}: ${mapped.message}`);
    }
  },
});

// --- search_text ---

const SearchTextInputSchema = z.object({
  query: z.string().describe('Search pattern (literal or regex)'),
  path: z.string().default('.').describe('Directory or file to search'),
  glob: z.string().default('**/*').describe("File pattern (e.g., '*.ts', 'src/**/*.ts')"),
  maxMatches: z.number().default(DEFAULT_MAX_MATCHES).describe('Maximum matches to return'),
  useRegex: z.boolean().default(false).describe('Enable regex mode'),
  caseSensitive: z.boolean().default(true).describe('Case-sensitive search'),
});

/**
 * Search text patterns across files.
 * Supports literal and regex modes. Returns matches with file, line, snippet.
 */
export const searchTextTool = createTool<z.infer<typeof SearchTextInputSchema>, SearchTextResult>({
  name: 'search_text',
  description: 'Search text patterns across files. Supports literal/regex modes. Max 50 matches.',
  schema: SearchTextInputSchema,
  execute: async (input): Promise<ToolResponse<SearchTextResult>> => {
    // Require path exists for searching
    const resolvedResult = await resolveWorkspacePathSafe(input.path, undefined, true);
    if (typeof resolvedResult !== 'string') {
      return resolvedResult;
    }
    // Use const for type narrowing in nested functions
    const resolved: string = resolvedResult;

    // Use real workspace root for relative path calculation (resolved paths are real)
    const workspaceRoot = await getWorkspaceRootReal();

    // Compile regex if needed
    let regex: RegExp | null = null;
    if (input.useRegex) {
      try {
        regex = new RegExp(input.query, input.caseSensitive ? 'g' : 'gi');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResponse(
          'VALIDATION_ERROR',
          `Invalid regex pattern '${input.query}': ${message}`
        );
      }
    }

    const matches: SearchMatch[] = [];
    let filesSearched = 0;
    let truncated = false;

    try {
      const stats = await fs.stat(resolved);
      const filesToSearch: string[] = [];

      if (stats.isFile()) {
        filesToSearch.push(resolved);
      } else if (stats.isDirectory()) {
        // Collect files matching glob
        // Simple glob matching - for ** patterns, use recursive readdir
        async function collectFiles(dir: string): Promise<void> {
          const dirents = await fs.readdir(dir, { withFileTypes: true });
          for (const dirent of dirents) {
            const entryPath = path.join(dir, dirent.name);
            if (dirent.isDirectory()) {
              // Skip hidden directories
              if (!dirent.name.startsWith('.')) {
                await collectFiles(entryPath);
              }
            } else if (dirent.isFile()) {
              // Simple glob matching
              const relativePath = path.relative(resolved, entryPath);
              if (matchGlob(relativePath, input.glob)) {
                filesToSearch.push(entryPath);
              }
            }
          }
        }
        await collectFiles(resolved);
      } else {
        return errorResponse(
          'VALIDATION_ERROR',
          `Path is neither file nor directory: ${input.path}`
        );
      }

      // Search files
      for (const filePath of filesToSearch) {
        if (matches.length >= input.maxMatches) {
          truncated = true;
          break;
        }

        filesSearched++;

        try {
          const fd = await fs.open(filePath, 'r');
          let content = '';
          try {
            // Skip oversized files (use read limit as max search file size)
            const fileStats = await fd.stat();
            if (fileStats.size > DEFAULT_MAX_READ_BYTES) continue;

            // Skip binary files
            if (await isBinaryFileHandle(fd)) continue;

            // Read content via the same file descriptor used for checks.
            content = (await fd.readFile()).toString('utf8');
          } finally {
            await fd.close();
          }

          const lines = content.split('\n');

          for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            if (matches.length >= input.maxMatches) {
              truncated = true;
              break;
            }

            const line = lines[lineNum] as string;

            // Truncate snippet once for all matches on this line
            let snippet = line.trim();
            if (snippet.length > SNIPPET_MAX_LENGTH) {
              snippet = snippet.slice(0, SNIPPET_MAX_LENGTH) + '...';
            }

            const relativePath = path.relative(workspaceRoot, filePath);

            if (input.useRegex && regex !== null) {
              // Find all regex matches on this line
              regex.lastIndex = 0;
              let match: RegExpExecArray | null;
              while ((match = regex.exec(line)) !== null) {
                if (matches.length >= input.maxMatches) {
                  truncated = true;
                  break;
                }
                matches.push({
                  file: relativePath,
                  line: lineNum + 1, // 1-based
                  snippet,
                  matchStart: match.index,
                  matchEnd: match.index + match[0].length,
                });
                // For non-global regex, break to avoid infinite loop
                if (!regex.global) break;
              }
            } else {
              // Literal search - find all occurrences
              const searchLine = input.caseSensitive ? line : line.toLowerCase();
              const searchQuery = input.caseSensitive ? input.query : input.query.toLowerCase();
              let searchStart = 0;
              let matchStart: number;

              while ((matchStart = searchLine.indexOf(searchQuery, searchStart)) !== -1) {
                if (matches.length >= input.maxMatches) {
                  truncated = true;
                  break;
                }
                matches.push({
                  file: relativePath,
                  line: lineNum + 1, // 1-based
                  snippet,
                  matchStart,
                  matchEnd: matchStart + searchQuery.length,
                });
                searchStart = matchStart + 1;
              }
            }
          }
        } catch {
          // Skip files we can't read
          continue;
        }
      }

      return successResponse(
        {
          query: input.query,
          useRegex: input.useRegex,
          filesSearched,
          matches,
          truncated,
        },
        `Found ${String(matches.length)} matches in ${String(filesSearched)} files`
      );
    } catch (error) {
      const mapped = mapSystemErrorToToolError(error);
      return errorResponse(mapped.code, `Error searching ${input.path}: ${mapped.message}`);
    }
  },
});

/**
 * Simple glob matching supporting * and ** patterns.
 */
function matchGlob(filePath: string, pattern: string): boolean {
  // Handle common cases
  if (pattern === '*' || pattern === '**/*') return true;

  // Convert glob to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*\*/g, '{{GLOBSTAR}}') // Temp placeholder for **
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/{{GLOBSTAR}}/g, '.*') // ** matches anything
    .replace(/\?/g, '.'); // ? matches single char

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

// --- write_file ---

const WriteFileInputSchema = z.object({
  path: z.string().describe('File path relative to workspace'),
  content: z.string().describe('Content to write'),
  mode: z.enum(['create', 'overwrite', 'append']).default('create').describe('Write mode'),
});

/**
 * Create or modify files with safety checks.
 * Supports create/overwrite/append modes.
 */
export const writeFileTool = createTool<z.infer<typeof WriteFileInputSchema>, WriteFileResult>({
  name: 'write_file',
  description: 'Write file with create/overwrite/append modes. Returns bytes written.',
  schema: WriteFileInputSchema,
  execute: async (input): Promise<ToolResponse<WriteFileResult>> => {
    // Check if writes are enabled
    const writeCheck = checkWritePermission();
    if (writeCheck !== null) {
      return writeCheck;
    }

    // Path may not exist yet for writes - don't require exists
    const resolved = await resolveWorkspacePathSafe(input.path);
    if (typeof resolved !== 'string') {
      return resolved;
    }

    // Check content size
    const contentBytes = Buffer.byteLength(input.content, 'utf-8');
    if (contentBytes > DEFAULT_MAX_WRITE_BYTES) {
      return errorResponse(
        'VALIDATION_ERROR',
        `Content size (${String(contentBytes)} bytes) exceeds max write limit (${String(DEFAULT_MAX_WRITE_BYTES)} bytes)`
      );
    }

    try {
      // Check if file exists
      let existedBefore = false;
      try {
        await fs.stat(resolved);
        existedBefore = true;
      } catch {
        // File doesn't exist
      }

      // Mode validation
      if (input.mode === 'create' && existedBefore) {
        return errorResponse(
          'VALIDATION_ERROR',
          `File already exists (mode=create): ${input.path}. Use mode='overwrite' or 'append'.`
        );
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(resolved);
      await fs.mkdir(parentDir, { recursive: true });

      // Perform write
      if (input.mode === 'append') {
        // Append mode: direct write (atomic not needed - adding to existing)
        await fs.appendFile(resolved, input.content, { encoding: 'utf-8' });
      } else {
        // Create/overwrite mode: atomic write via temp file + rename
        const tempPath = path.join(
          parentDir,
          `.${path.basename(resolved)}.tmp.${String(Date.now())}`
        );
        await fs.writeFile(tempPath, input.content, { encoding: 'utf-8' });
        try {
          await fs.rename(tempPath, resolved);
        } catch {
          // Cleanup temp file on rename failure
          try {
            await fs.unlink(tempPath);
          } catch {
            // Ignore cleanup errors
          }
          throw new Error(`Failed to rename temp file to ${input.path}`);
        }
      }

      return successResponse(
        {
          path: input.path,
          bytesWritten: contentBytes,
          mode: input.mode,
          existedBefore,
        },
        `Wrote ${String(contentBytes)} bytes to ${input.path} (mode=${input.mode})`
      );
    } catch (error) {
      const mapped = mapSystemErrorToToolError(error);
      return errorResponse(mapped.code, `Error writing ${input.path}: ${mapped.message}`);
    }
  },
});

// --- apply_text_edit ---

const ApplyTextEditInputSchema = z.object({
  path: z.string().describe('File path relative to workspace'),
  expectedText: z.string().describe('Exact text to find and replace'),
  replacementText: z.string().describe('Replacement text'),
  replaceAll: z.boolean().default(false).describe('Replace all occurrences'),
});

/**
 * Apply exact text replacement in file.
 * Requires exact match. Uses atomic write via temp file + rename.
 */
export const applyTextEditTool = createTool<
  z.infer<typeof ApplyTextEditInputSchema>,
  ApplyTextEditResult
>({
  name: 'apply_text_edit',
  description: 'Replace exact text snippet. For structured edits, prefer apply_file_patch instead.',
  schema: ApplyTextEditInputSchema,
  execute: async (input): Promise<ToolResponse<ApplyTextEditResult>> => {
    // Check if writes are enabled
    const writeCheck = checkWritePermission();
    if (writeCheck !== null) {
      return writeCheck;
    }

    // Require file exists for editing
    const resolved = await resolveWorkspacePathSafe(input.path, undefined, true);
    if (typeof resolved !== 'string') {
      return resolved;
    }

    // Validate expectedText
    if (input.expectedText === '') {
      return errorResponse(
        'VALIDATION_ERROR',
        'expectedText cannot be empty. Provide exact text to match.'
      );
    }

    try {
      const fd = await fs.open(resolved, 'r');
      let originalContent: string;
      try {
        // Check file exists and is a file
        const stats = await fd.stat();
        if (!stats.isFile()) {
          return errorResponse('VALIDATION_ERROR', `Path is not a file: ${input.path}`);
        }

        // Read original content via the same file descriptor used for checks.
        originalContent = (await fd.readFile()).toString('utf8');
      } finally {
        await fd.close();
      }
      const originalSize = Buffer.byteLength(originalContent, 'utf-8');

      // Count occurrences
      const occurrences = originalContent.split(input.expectedText).length - 1;

      if (occurrences === 0) {
        return errorResponse(
          'NOT_FOUND',
          `expectedText not found in file: ${input.path}. No changes made.`
        );
      }

      if (occurrences > 1 && !input.replaceAll) {
        return errorResponse(
          'VALIDATION_ERROR',
          `expectedText found ${String(occurrences)} times in ${input.path}. Use replaceAll=true to replace all.`
        );
      }

      // Perform replacement
      let newContent: string;
      let replacements: number;
      if (input.replaceAll) {
        newContent = originalContent.split(input.expectedText).join(input.replacementText);
        replacements = occurrences;
      } else {
        newContent = originalContent.replace(input.expectedText, input.replacementText);
        replacements = 1;
      }

      // Check new size
      const newSize = Buffer.byteLength(newContent, 'utf-8');
      if (newSize > DEFAULT_MAX_WRITE_BYTES) {
        return errorResponse(
          'VALIDATION_ERROR',
          `Resulting file size (${String(newSize)} bytes) exceeds max write limit (${String(DEFAULT_MAX_WRITE_BYTES)} bytes)`
        );
      }

      // Calculate lines changed (approximate)
      const originalLines = originalContent.split('\n').length;
      const newLines = newContent.split('\n').length;
      const linesChanged = Math.abs(newLines - originalLines) + replacements;

      // Atomic write via temp file + rename
      const tempPath = path.join(
        path.dirname(resolved),
        `.${path.basename(resolved)}.tmp.${String(Date.now())}`
      );
      await fs.writeFile(tempPath, newContent, { encoding: 'utf-8' });
      try {
        await fs.rename(tempPath, resolved);
      } catch {
        // Cleanup temp file on rename failure
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw new Error(`Failed to rename temp file to ${input.path}`);
      }

      return successResponse(
        {
          path: input.path,
          bytesWritten: newSize,
          replacements,
          originalSize,
          newSize,
          linesChanged,
        },
        `Applied ${String(replacements)} replacement(s) to ${input.path}`
      );
    } catch (error) {
      const mapped = mapSystemErrorToToolError(error);
      return errorResponse(mapped.code, `Error editing ${input.path}: ${mapped.message}`);
    }
  },
});

// --- create_directory ---

const CreateDirectoryInputSchema = z.object({
  path: z.string().describe('Directory path relative to workspace'),
  parents: z.boolean().default(true).describe('Create parent directories if needed'),
});

/**
 * Create directory with optional parent creation.
 * Idempotent: success if already exists as directory.
 */
export const createDirectoryTool = createTool<
  z.infer<typeof CreateDirectoryInputSchema>,
  CreateDirectoryResult
>({
  name: 'create_directory',
  description: 'Create directory. Idempotent (success if exists). Default creates parents.',
  schema: CreateDirectoryInputSchema,
  execute: async (input): Promise<ToolResponse<CreateDirectoryResult>> => {
    // Check if writes are enabled
    const writeCheck = checkWritePermission();
    if (writeCheck !== null) {
      return writeCheck;
    }

    // Path may not exist yet for directory creation - don't require exists
    const resolved = await resolveWorkspacePathSafe(input.path);
    if (typeof resolved !== 'string') {
      return resolved;
    }

    try {
      // Check if path exists
      let exists = false;
      let isDir = false;
      try {
        const stats = await fs.stat(resolved);
        exists = true;
        isDir = stats.isDirectory();
      } catch {
        // Path doesn't exist
      }

      if (exists) {
        if (isDir) {
          // Already exists - idempotent success
          return successResponse(
            { path: input.path, created: false, parentsCreated: 0 },
            `Directory already exists: ${input.path}`
          );
        } else {
          // Exists but not a directory
          return errorResponse(
            'VALIDATION_ERROR',
            `Path exists but is not a directory: ${input.path}`
          );
        }
      }

      // Count parents that will be created
      let parentsCreated = 0;
      if (input.parents) {
        const workspaceRoot = getWorkspaceRoot();
        let checkPath = path.dirname(resolved);
        while (checkPath !== workspaceRoot && checkPath !== path.dirname(checkPath)) {
          try {
            await fs.stat(checkPath);
            break; // Exists, stop counting
          } catch {
            parentsCreated++;
            checkPath = path.dirname(checkPath);
          }
        }
      }

      // Create directory
      await fs.mkdir(resolved, { recursive: input.parents });

      return successResponse(
        { path: input.path, created: true, parentsCreated },
        `Created directory: ${input.path}`
      );
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return errorResponse(
          'NOT_FOUND',
          `Parent directory does not exist: ${input.path}. Use parents=true to create.`
        );
      }
      const mapped = mapSystemErrorToToolError(error);
      return errorResponse(mapped.code, `Error creating ${input.path}: ${mapped.message}`);
    }
  },
});

// --- apply_file_patch ---

/** Max file size for patching (same as read limit) */
const MAX_PATCH_FILE_SIZE = DEFAULT_MAX_READ_BYTES;

/**
 * Compute SHA256 hash of content.
 */
function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Extract file paths from unified diff headers.
 * Returns paths from --- and +++ lines, stripping a/ and b/ prefixes.
 */
function extractPatchFilePaths(patch: string): { oldPath: string | null; newPath: string | null } {
  const lines = patch.split('\n');
  let oldPath: string | null = null;
  let newPath: string | null = null;

  for (const line of lines) {
    // Match --- a/path or --- path
    if (line.startsWith('--- ')) {
      const pathPart = line.slice(4).trim();
      // If /dev/null, treat as empty; else strip a/ prefix if present
      oldPath = pathPart === '/dev/null' ? '' : pathPart.replace(/^a\//, '');
    }
    // Match +++ b/path or +++ path
    if (line.startsWith('+++ ')) {
      const pathPart = line.slice(4).trim();
      // If /dev/null, treat as empty; else strip b/ prefix if present
      newPath = pathPart === '/dev/null' ? '' : pathPart.replace(/^b\//, '');
    }
    // Stop after finding both or hitting a hunk
    if (line.startsWith('@@')) break;
  }

  return { oldPath, newPath };
}

/**
 * Parse unified diff hunks from patch text.
 * Supports standard unified diff format with @@ -old,count +new,count @@ headers.
 */
function parseUnifiedDiff(patch: string): ParsedHunk[] | PatchParseError {
  const lines = patch.split('\n');
  const hunks: ParsedHunk[] = [];

  // Skip file headers (--- and +++ lines)
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) break;

    // Skip empty lines and file headers
    if (
      line === '' ||
      line.startsWith('---') ||
      line.startsWith('+++') ||
      line.startsWith('diff ')
    ) {
      i++;
      continue;
    }

    // Look for hunk header: @@ -old,count +new,count @@
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (hunkMatch === null) {
      // Not a hunk header - might be context or invalid
      if (line.startsWith(' ') || line.startsWith('-') || line.startsWith('+')) {
        return {
          type: 'parse_error',
          message: 'Diff content found outside of hunk. Missing @@ hunk header.',
          excerpt: line.slice(0, 60),
        };
      }
      i++;
      continue;
    }

    const oldStart = parseInt(hunkMatch[1] as string, 10);
    const oldCount = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
    const newStart = parseInt(hunkMatch[3] as string, 10);
    const newCount = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;

    // Parse hunk content
    const contextBefore: string[] = [];
    const removals: string[] = [];
    const additions: string[] = [];
    const contextAfter: string[] = [];
    let phase: 'context_before' | 'changes' | 'context_after' = 'context_before';

    i++;
    let oldLinesRead = 0;
    let newLinesRead = 0;

    // Read hunk content until we've read all expected lines
    // Continue while we haven't read enough of either old or new content
    while (i < lines.length && (oldLinesRead < oldCount || newLinesRead < newCount)) {
      const contentLine = lines[i];
      if (contentLine === undefined) break;

      // Next hunk or end
      if (contentLine.startsWith('@@') || contentLine.startsWith('diff ')) {
        break;
      }

      if (contentLine.startsWith(' ')) {
        // Context line
        const text = contentLine.slice(1);
        if (phase === 'context_before') {
          contextBefore.push(text);
        } else if (phase === 'changes') {
          phase = 'context_after';
          contextAfter.push(text);
        } else {
          contextAfter.push(text);
        }
        oldLinesRead++;
        newLinesRead++;
      } else if (contentLine.startsWith('-')) {
        // Removal
        if (phase === 'context_after') {
          return {
            type: 'parse_error',
            message: 'Removal line after context_after. Malformed hunk.',
            hunkIndex: hunks.length,
            excerpt: contentLine.slice(0, 60),
          };
        }
        phase = 'changes';
        removals.push(contentLine.slice(1));
        oldLinesRead++;
      } else if (contentLine.startsWith('+')) {
        // Addition
        if (phase === 'context_after') {
          return {
            type: 'parse_error',
            message: 'Addition line after context_after. Malformed hunk.',
            hunkIndex: hunks.length,
            excerpt: contentLine.slice(0, 60),
          };
        }
        phase = 'changes';
        additions.push(contentLine.slice(1));
        newLinesRead++;
      } else if (contentLine === '' || contentLine === '\\ No newline at end of file') {
        // Empty line (might be a context line with no trailing space) or no-newline marker
        // For safety, treat as potential context
        if (phase === 'context_before') {
          contextBefore.push('');
        } else if (phase === 'context_after' || (removals.length === 0 && additions.length === 0)) {
          if (phase !== 'context_after') phase = 'context_after';
          contextAfter.push('');
        }
        // Don't count "\ No newline" markers
        if (contentLine !== '\\ No newline at end of file') {
          oldLinesRead++;
          newLinesRead++;
        }
      } else {
        // Unknown line type - stop parsing this hunk
        break;
      }

      i++;
    }

    hunks.push({
      oldStart,
      oldCount,
      newStart,
      newCount,
      contextBefore,
      removals,
      additions,
      contextAfter,
    });
  }

  if (hunks.length === 0) {
    return {
      type: 'parse_error',
      message: 'No valid hunks found in patch. Expected @@ -N,M +N,M @@ format.',
    };
  }

  return hunks;
}

/**
 * Apply parsed hunks to file content.
 * Returns new content or error with context.
 */
function applyHunks(content: string, hunks: ParsedHunk[]): string | PatchParseError {
  const lines = content.split('\n');
  const result = [...lines];
  let offset = 0; // Track line offset as we apply changes

  for (let hunkIdx = 0; hunkIdx < hunks.length; hunkIdx++) {
    const hunk = hunks[hunkIdx] as ParsedHunk;

    // Find where to apply this hunk (1-based to 0-based, adjust for offset)
    const targetStart = hunk.oldStart - 1 + offset;

    // Build expected lines (context_before + removals + context_after)
    const expectedLines = [...hunk.contextBefore, ...hunk.removals, ...hunk.contextAfter];

    // Check context match
    let contextMatches = true;
    let mismatchLine = -1;
    let expectedLine = '';
    let actualLine = '';

    for (let j = 0; j < expectedLines.length; j++) {
      const lineIdx = targetStart + j;
      if (lineIdx >= result.length) {
        contextMatches = false;
        mismatchLine = lineIdx;
        expectedLine = expectedLines[j] ?? '';
        actualLine = '<end of file>';
        break;
      }
      if (result[lineIdx] !== expectedLines[j]) {
        contextMatches = false;
        mismatchLine = lineIdx;
        expectedLine = expectedLines[j] ?? '';
        actualLine = result[lineIdx] ?? '';
        break;
      }
    }

    if (!contextMatches) {
      return {
        type: 'context_mismatch',
        message: `Hunk ${String(hunkIdx + 1)} context mismatch at line ${String(mismatchLine + 1)}. Expected: "${expectedLine.slice(0, 40)}", got: "${actualLine.slice(0, 40)}"`,
        hunkIndex: hunkIdx,
        excerpt: `Expected: ${expectedLine.slice(0, 60)}\nActual: ${actualLine.slice(0, 60)}`,
      };
    }

    // Apply the hunk: remove old lines, insert new lines
    const removeCount = hunk.contextBefore.length + hunk.removals.length + hunk.contextAfter.length;
    const newLines = [...hunk.contextBefore, ...hunk.additions, ...hunk.contextAfter];

    result.splice(targetStart, removeCount, ...newLines);

    // Update offset for subsequent hunks
    offset += newLines.length - removeCount;
  }

  return result.join('\n');
}

const ApplyFilePatchInputSchema = z.object({
  path: z.string().describe('File path relative to workspace'),
  patch: z.string().describe('Unified diff patch content'),
  dryRun: z.boolean().default(false).describe('Validate patch without writing'),
  requireExactFileMatch: z
    .boolean()
    .default(false)
    .describe('Require patch to match specific file path'),
  expectedSha256: z.string().optional().describe('Expected SHA256 hash of file before patching'),
});

/**
 * Apply unified diff patch to file.
 * Parses hunks, validates context, applies atomically.
 */
export const applyFilePatchTool = createTool<
  z.infer<typeof ApplyFilePatchInputSchema>,
  ApplyFilePatchResult
>({
  name: 'apply_file_patch',
  description:
    'Primary edit tool. Apply unified diff patch with context validation. Use dryRun to test first.',
  schema: ApplyFilePatchInputSchema,
  execute: async (input): Promise<ToolResponse<ApplyFilePatchResult>> => {
    // Check if writes are enabled (even for dry-run, as we're a write tool)
    if (!input.dryRun) {
      const writeCheck = checkWritePermission();
      if (writeCheck !== null) {
        return writeCheck;
      }
    }

    // Require file exists for patching
    const resolved = await resolveWorkspacePathSafe(input.path, undefined, true);
    if (typeof resolved !== 'string') {
      return resolved;
    }

    try {
      const fd = await fs.open(resolved, 'r');
      let originalContent: string;
      try {
        // Check file exists and is a file
        const stats = await fd.stat();
        if (!stats.isFile()) {
          return errorResponse('VALIDATION_ERROR', `Path is not a file: ${input.path}`);
        }

        // Check file size
        if (stats.size > MAX_PATCH_FILE_SIZE) {
          return errorResponse(
            'VALIDATION_ERROR',
            `File size (${String(stats.size)} bytes) exceeds max patch limit (${String(MAX_PATCH_FILE_SIZE)} bytes): ${input.path}`
          );
        }

        // Check for binary
        if (await isBinaryFileHandle(fd)) {
          return errorResponse(
            'VALIDATION_ERROR',
            `File appears to be binary (contains null bytes): ${input.path}`
          );
        }

        // Read original content via the same file descriptor used for checks.
        originalContent = (await fd.readFile()).toString('utf8');
      } finally {
        await fd.close();
      }
      const originalSize = Buffer.byteLength(originalContent, 'utf-8');
      const sha256Before = computeSha256(originalContent);

      // Check expected SHA256 if provided
      if (input.expectedSha256 !== undefined && input.expectedSha256 !== sha256Before) {
        return errorResponse(
          'VALIDATION_ERROR',
          `SHA256 mismatch. Expected: ${input.expectedSha256}, actual: ${sha256Before}. File may have changed.`
        );
      }

      // Parse the patch
      const hunksOrError = parseUnifiedDiff(input.patch);
      if (!Array.isArray(hunksOrError)) {
        // Parse error
        const err = hunksOrError;
        return errorResponse(
          'VALIDATION_ERROR',
          `Patch parse error: ${err.message}${err.excerpt !== undefined ? ` near: "${err.excerpt}"` : ''}`
        );
      }

      const hunks = hunksOrError;

      // Validate file path match if required
      if (input.requireExactFileMatch) {
        const patchPaths = extractPatchFilePaths(input.patch);
        // Normalize input path for comparison (remove leading ./)
        const normalizedInput = input.path.replace(/^\.\//, '');

        // Check if patch specifies file paths and if they match
        const pathsToCheck = [patchPaths.oldPath, patchPaths.newPath].filter(
          (p): p is string => p !== null && p !== ''
        );

        if (pathsToCheck.length > 0) {
          const pathMatches = pathsToCheck.some((patchPath) => {
            // Normalize patch path for comparison
            const normalizedPatch = patchPath.replace(/^\.\//, '');
            // Check if paths match (exact or if patch path ends with input path)
            return (
              normalizedPatch === normalizedInput ||
              normalizedPatch.endsWith('/' + normalizedInput) ||
              normalizedInput.endsWith('/' + normalizedPatch)
            );
          });

          if (!pathMatches) {
            return errorResponse(
              'VALIDATION_ERROR',
              `Patch file path mismatch. Patch specifies "${pathsToCheck.join('" or "')}" but target is "${input.path}". Set requireExactFileMatch=false to ignore.`
            );
          }
        }
      }

      // Apply hunks
      const resultOrError = applyHunks(originalContent, hunks);
      if (typeof resultOrError !== 'string') {
        // Apply error
        const err = resultOrError;
        return errorResponse(
          'VALIDATION_ERROR',
          `Patch apply error: ${err.message}${err.excerpt !== undefined ? `\n${err.excerpt}` : ''}`
        );
      }

      const newContent = resultOrError;
      const newSize = Buffer.byteLength(newContent, 'utf-8');
      const sha256After = computeSha256(newContent);

      // Count lines added/removed
      let linesAdded = 0;
      let linesRemoved = 0;
      for (const hunk of hunks) {
        linesAdded += hunk.additions.length;
        linesRemoved += hunk.removals.length;
      }

      // If not dry-run, write the file atomically
      if (!input.dryRun) {
        // Atomic write via temp file + rename
        const tempPath = path.join(
          path.dirname(resolved),
          `.${path.basename(resolved)}.patch.${String(Date.now())}`
        );
        await fs.writeFile(tempPath, newContent, { encoding: 'utf-8' });
        try {
          await fs.rename(tempPath, resolved);
        } catch {
          // Cleanup temp file on rename failure
          try {
            await fs.unlink(tempPath);
          } catch {
            // Ignore cleanup errors
          }
          throw new Error(`Failed to rename temp file to ${input.path}`);
        }
      }

      return successResponse(
        {
          path: input.path,
          dryRun: input.dryRun,
          hunksApplied: hunks.length,
          linesAdded,
          linesRemoved,
          originalSize,
          newSize,
          sha256Before,
          sha256After,
        },
        input.dryRun
          ? `Dry run: patch validated (${String(hunks.length)} hunks, +${String(linesAdded)}/-${String(linesRemoved)} lines)`
          : `Applied patch to ${input.path} (${String(hunks.length)} hunks, +${String(linesAdded)}/-${String(linesRemoved)} lines)`
      );
    } catch (error) {
      const mapped = mapSystemErrorToToolError(error);
      return errorResponse(mapped.code, `Error patching ${input.path}: ${mapped.message}`);
    }
  },
});
