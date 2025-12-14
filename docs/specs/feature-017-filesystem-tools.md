# Feature: Port FileSystem Tools

## Feature Description

Port the Python FileSystem tools (`../agent-base/src/agent/tools/filesystem.py`) to TypeScript, following the established tool patterns in `src/tools/`. This implements Feature 17 from the TypeScript rewrite plan, providing fundamental file operations that enable real-world agent testing and demonstrations.

The filesystem tools provide structured file operations with workspace sandboxing, enabling agents to safely inspect and modify files without arbitrary shell execution. These tools follow Anthropic's best practices for agent tool design.

## User Story

As an agent developer,
I want to have filesystem tools available in the agent framework,
So that agents can safely read, write, search, and navigate files within a controlled workspace.

## Problem Statement

The TypeScript agent framework currently lacks filesystem tools, limiting agents to simple greeting demonstrations. Real-world agent use cases require file operations for code analysis, editing, search, and directory navigation. Without these tools, agents cannot perform practical development assistance tasks.

## Solution Statement

Implement a comprehensive set of filesystem tools in TypeScript that:
1. Follow the established `createTool` pattern from `src/tools/base.ts`
2. Return structured `ToolResponse<T>` objects with specific error codes
3. Provide workspace sandboxing for security
4. Support all operations from the Python implementation: path info, list directory, read file, search text, write file, apply text edit, and create directory
5. Wire into the CLI components (`InteractiveShell`, `SinglePrompt`) for immediate usability

**Note on write safety:** The Python implementation has a `filesystemWritesEnabled` config flag (disabled by default). Per feature requirements, we will NOT implement this config parity - write operations will be enabled by default, with an approval system planned for a future feature.

## Related Documentation

### Requirements
- `docs/plans/typescript-rewrite-features.md` - Feature 17 specification
- `docs/plans/typescript-rewrite.md` - Phase 2 deliverables

### Architecture Decisions
- `docs/decisions/0002-llm-integration-langchain.md` - LangChain tool integration
- `docs/decisions/0004-validation-zod.md` - Zod schema validation
- `docs/decisions/0007-callbacks-over-eventbus.md` - Callback patterns for tool events

### Best Practices Reference
- [Anthropic: Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents)

## Codebase Analysis Findings

### Architecture Patterns
- **Tool Factory Pattern**: All tools use `createTool<TInput, TResult>()` from `src/tools/base.ts`
- **Response Contract**: Tools return `ToolResponse<T>` (discriminated union of `SuccessResponse<T> | ErrorResponse`)
- **Schema Definition**: Zod schemas with `.describe()` on all parameters
- **Error Codes**: Typed `ToolErrorCode` enum (`'IO_ERROR'`, `'NOT_FOUND'`, `'PERMISSION_DENIED'`, etc.)

### Naming Conventions
- Tool names: `snake_case` (e.g., `hello_world`, `greet_user`)
- File names: `camelCase.ts` (e.g., `hello.ts`, `filesystem.ts`)
- Types: `PascalCase` with `Schema` suffix for Zod (e.g., `ReadFileInputSchema`)
- Result interfaces: `PascalCase` with `Result` suffix (e.g., `ReadFileResult`)

### Similar Implementations
- `src/tools/hello.ts` - Reference tool implementation pattern
- `src/tools/base.ts` - `createTool()` factory, `successResponse()`, `errorResponse()`
- `src/tools/types.ts` - `ToolResponse`, `ToolErrorCode` definitions

### Integration Patterns
- Tools injected via `Agent` constructor: `new Agent({ config, tools: [...], callbacks })`
- Tools bound to LLM via LangChain's `model.bindTools(tools)`
- Tool execution emits `onToolStart`/`onToolEnd` callbacks with `SpanContext`

### Testing Approaches
- Co-located tests in `__tests__/` directories
- Use `isSuccessResponse()`/`isErrorResponse()` type guards
- Test success cases, error cases, edge cases (empty strings, unicode, special chars)
- 85% coverage minimum enforced

## Archon Project

**Project ID:** `4b2ceb1a-2c5f-41b2-b669-d607ae5d05ab`
**Title:** Feature 17: FileSystem Tools Port

Tasks created (13 total):
1. Create filesystem tool file with path utilities (task_order: 100)
2. Implement get_path_info tool (task_order: 90)
3. Implement list_directory tool (task_order: 85)
4. Implement read_file tool (task_order: 80)
5. Implement search_text tool (task_order: 75)
6. Implement write_file tool (task_order: 70)
7. Implement apply_text_edit tool (task_order: 65)
8. Implement create_directory tool (task_order: 60)
9. Export filesystem tools from index (task_order: 55)
10. Wire tools into InteractiveShell (task_order: 50)
11. Wire tools into SinglePrompt (task_order: 45)
12. Write unit tests for filesystem tools (task_order: 40)
13. Integration testing and verification (task_order: 35)

## Relevant Files

### Existing Files
- `src/tools/base.ts`: Tool factory and response helpers
- `src/tools/types.ts`: ToolResponse and error code types
- `src/tools/hello.ts`: Reference implementation
- `src/tools/index.ts`: Tool exports (needs filesystem exports)
- `src/config/schema.ts`: Config schema with `filesystemWritesEnabled` (line 165-168)
- `src/agent/agent.ts`: Agent class that executes tools (lines 203-246)
- `src/components/InteractiveShell.tsx`: Interactive CLI (needs tool wiring)
- `src/components/SinglePrompt.tsx`: Single-prompt CLI (needs tool wiring)
- `../agent-base/src/agent/tools/filesystem.py`: Python source to port

### New Files
- `src/tools/filesystem.ts`: FileSystem tool implementations
- `src/tools/__tests__/filesystem.test.ts`: Unit tests for filesystem tools

## Implementation Plan

### Phase 1: Foundation
Establish the filesystem tool structure with workspace path resolution and validation utilities.

### Phase 2: Core Implementation
Implement all seven filesystem tools following the Python behavior:
1. `get_path_info` - File/directory metadata
2. `list_directory` - Directory listing with recursion support
3. `read_file` - Text file reading with line range support
4. `search_text` - Pattern search across files
5. `write_file` - File creation/modification
6. `apply_text_edit` - Surgical text replacement
7. `create_directory` - Directory creation

### Phase 3: Integration
Wire filesystem tools into CLI components and export from tools module.

## Step by Step Tasks

### Task 1: Create filesystem tool file with path utilities
- Description: Create `src/tools/filesystem.ts` with workspace resolution helpers and error mapping
- Files to modify: `src/tools/filesystem.ts` (new)
- Implementation details:
  - Create `resolveWorkspacePath()` helper for path validation
  - Create `mapSystemErrorToToolError()` for Node.js error code mapping
  - Define shared constants (MAX_READ_BYTES, MAX_ENTRIES, etc.)
  - Export internal types for result interfaces

### Task 2: Implement get_path_info tool
- Description: Port `get_path_info` - returns file/directory metadata
- Files to modify: `src/tools/filesystem.ts`
- Implementation details:
  - Zod schema: `path` (string, default ".")
  - Returns: exists, type (file/directory/symlink/other), size, modified timestamp, permissions
  - Handle non-existent paths gracefully
  - Use `fs/promises` for async operations

### Task 3: Implement list_directory tool
- Description: Port `list_directory` - lists directory contents with metadata
- Files to modify: `src/tools/filesystem.ts`
- Implementation details:
  - Zod schema: `path`, `recursive`, `maxEntries` (default 200, cap 500), `includeHidden`
  - Returns: entries array with name, relativePath, type, size; truncated flag
  - Use `fs.readdir` with `withFileTypes: true`
  - For recursive, use custom walk or `fs.readdir` recursive option

### Task 4: Implement read_file tool
- Description: Port `read_file` - reads text files with line range support
- Files to modify: `src/tools/filesystem.ts`
- Implementation details:
  - Zod schema: `path` (required), `startLine` (default 1), `maxLines` (default 200, cap 1000)
  - Returns: content, startLine, endLine, totalLines, truncated, nextStartLine, encodingErrors
  - Check for binary files (null bytes in first 8KB)
  - Enforce size limit (default 1MB from config)
  - Handle encoding errors with replacement character detection

### Task 5: Implement search_text tool
- Description: Port `search_text` - searches patterns across files
- Files to modify: `src/tools/filesystem.ts`
- Implementation details:
  - Zod schema: `query` (required), `path`, `glob` pattern, `maxMatches` (default 50), `useRegex`, `caseSensitive`
  - Returns: matches array with file, line, snippet, matchStart, matchEnd; filesSearched, truncated
  - Support literal and regex modes
  - Skip binary files
  - Truncate snippets to 200 chars

### Task 6: Implement write_file tool
- Description: Port `write_file` - creates or modifies files
- Files to modify: `src/tools/filesystem.ts`
- Implementation details:
  - Zod schema: `path` (required), `content` (required), `mode` (create/overwrite/append, default create)
  - Returns: path, bytesWritten, mode, existedBefore
  - Mode validation: create fails if exists, overwrite creates if not exists, append adds to end
  - Enforce write size limit

### Task 7: Implement apply_text_edit tool
- Description: Port `apply_text_edit` - surgical text replacement
- Files to modify: `src/tools/filesystem.ts`
- Implementation details:
  - Zod schema: `path` (required), `expectedText` (required), `replacementText` (required), `replaceAll`
  - Returns: path, bytesWritten, replacements, originalSize, newSize, linesChanged
  - Require exact match (fail if not found or ambiguous without replaceAll)
  - Atomic write via temp file + rename

### Task 8: Implement create_directory tool
- Description: Port `create_directory` - creates directories
- Files to modify: `src/tools/filesystem.ts`
- Implementation details:
  - Zod schema: `path` (required), `parents` (default true)
  - Returns: path, created, parentsCreated
  - Idempotent: success if already exists as directory
  - Fail if exists as file

### Task 9: Export filesystem tools from index
- Description: Add filesystem tool exports to the tools module
- Files to modify: `src/tools/index.ts`
- Implementation details:
  - Export all 7 tools: `getPathInfoTool`, `listDirectoryTool`, `readFileTool`, `searchTextTool`, `writeFileTool`, `applyTextEditTool`, `createDirectoryTool`
  - Export result types for testing

### Task 10: Wire tools into InteractiveShell
- Description: Add filesystem tools to Agent construction in interactive mode
- Files to modify: `src/components/InteractiveShell.tsx`
- Implementation details:
  - Import filesystem tools from `src/tools/index.ts`
  - Pass tools array to Agent constructor
  - Use `run()` instead of `runStream()` to support tool calling
  - Add mode detection for chat-only vs tool-enabled

### Task 11: Wire tools into SinglePrompt
- Description: Add filesystem tools to Agent construction in single-prompt mode
- Files to modify: `src/components/SinglePrompt.tsx`
- Implementation details:
  - Import filesystem tools from `src/tools/index.ts`
  - Pass tools array to Agent constructor
  - Non-verbose mode uses `run()` (already does), supports tools
  - Verbose mode note: `runStream()` ignores tools (documented limitation)

### Task 12: Write unit tests for filesystem tools
- Description: Create comprehensive test suite for all filesystem tools
- Files to modify: `src/tools/__tests__/filesystem.test.ts` (new)
- Implementation details:
  - Test each tool's success cases, error cases, edge cases
  - Use temp directories for filesystem tests
  - Mock filesystem errors where needed
  - Test workspace boundary enforcement
  - Target 85%+ coverage

### Task 13: Integration testing and verification
- Description: Verify tools work end-to-end in CLI
- Files to modify: None (manual testing)
- Implementation details:
  - Test interactive shell with tool calls
  - Test single-prompt mode with tool calls
  - Verify error messages are actionable
  - Check tool result display in TaskProgress component

## Testing Strategy

### Unit Tests
All tests in `src/tools/__tests__/filesystem.test.ts`:

**get_path_info:**
- Returns correct metadata for files, directories, symlinks
- Handles non-existent paths
- Returns correct permission flags

**list_directory:**
- Lists directory contents correctly
- Respects maxEntries limit
- Filters hidden files when includeHidden=false
- Handles recursive traversal
- Sets truncated flag appropriately

**read_file:**
- Reads file content correctly
- Respects startLine and maxLines
- Detects and rejects binary files
- Handles encoding errors
- Enforces size limit
- Reports nextStartLine for pagination

**search_text:**
- Finds literal matches
- Supports regex mode
- Case-sensitive and case-insensitive modes
- Respects glob filtering
- Skips binary files
- Truncates long snippets

**write_file:**
- Creates new files (mode=create)
- Fails if file exists (mode=create)
- Overwrites existing files (mode=overwrite)
- Appends to files (mode=append)
- Enforces size limit

**apply_text_edit:**
- Replaces exact matches
- Fails if match not found
- Fails if multiple matches without replaceAll
- Replaces all with replaceAll=true
- Uses atomic writes

**create_directory:**
- Creates single directory
- Creates parent directories (parents=true)
- Idempotent for existing directories
- Fails for existing files

### Integration Tests
- Full agent loop with filesystem tool calls
- Multiple tool calls in sequence
- Error recovery scenarios

### Edge Cases
- Empty paths, paths with spaces, unicode paths
- Very long file content (pagination)
- Permission denied scenarios
- Concurrent file access
- Symlink handling

## Acceptance Criteria
- [ ] All 7 filesystem tools implemented matching Python behavior
- [ ] Tools use `createTool` factory and return `ToolResponse<T>`
- [ ] Workspace path validation prevents traversal attacks
- [ ] Error codes map correctly: NOT_FOUND, PERMISSION_DENIED, IO_ERROR, VALIDATION_ERROR
- [ ] Tool descriptions under 40 tokens each
- [ ] Tools wired into InteractiveShell and SinglePrompt
- [ ] Using `run()` method when tools enabled (not `runStream()`)
- [ ] All unit tests pass with 85%+ coverage
- [ ] Manual testing confirms tools work in CLI
- [ ] TypeScript strict mode passes
- [ ] ESLint passes with no errors

## Validation Commands

```bash
# TypeScript type checking
bun run typecheck

# Linting
bun run lint

# Run all tests
bun run test

# Run filesystem tests specifically
bun run test -- src/tools/__tests__/filesystem.test.ts

# Run with coverage
bun run test:coverage

# Build
bun run build
```

## Notes

### Streaming vs Tool-Calling
Per the feature requirements and codebase analysis:
- `Agent.runStream()` does not support tool calling (tools are ignored in streaming mode)
- When tools are enabled, use `run()` for full tool support
- This is a documented MVP limitation - true streaming-with-tools is deferred

### Tool Description Guidelines (from Anthropic best practices)
- Keep descriptions concise (10-40 tokens)
- Use explicit parameter names (e.g., `startLine` not `start`)
- Provide actionable error messages
- Include constraints in description where relevant

### Error Code Mapping
| System Error | Tool Error Code |
|--------------|-----------------|
| ENOENT | NOT_FOUND |
| EACCES, EPERM | PERMISSION_DENIED |
| EISDIR, ENOTDIR | VALIDATION_ERROR |
| EMFILE, ENFILE | IO_ERROR |
| Other | IO_ERROR |

### Config Integration
The `filesystemWritesEnabled` config field is now enforced via `AGENT_FILESYSTEM_WRITES_ENABLED` environment variable. Write tools check this before allowing writes.

## Execution

This spec can be implemented using: `/sdlc:implement docs/specs/feature-017-filesystem-tools.md`

## Implementation Notes (2025-12-14)

### Completed
All 8 filesystem tools implemented and tested:
- `get_path_info` - File/directory metadata
- `list_directory` - Directory listing with recursive mode
- `read_file` - Text file reading with line range support
- `search_text` - Text pattern search with regex/literal modes
- `write_file` - File creation with create/overwrite/append modes (atomic writes)
- `apply_text_edit` - Exact text replacement with atomic writes
- `create_directory` - Directory creation with parent support
- `apply_file_patch` - **Primary edit tool**: Unified diff patch application

### Security Enhancements (from codex review)
1. **Symlink Escape Protection**: Added `resolveWorkspacePathSafe()` that uses `fs.realpath()` to verify symlinks don't escape workspace boundaries
2. **Write Permission Enforcement**: Added `isFilesystemWritesEnabled()` check that reads `AGENT_FILESYSTEM_WRITES_ENABLED` env var
3. **search_text Multi-Match**: Updated to find all matches per line (not just first match)
4. **list_directory Hidden Dir Handling**: Verified correct behavior - hidden directories are skipped in recursive mode when `includeHidden=false`

### Follow-up Enhancements (2025-12-14)
1. **apply_file_patch tool**: New primary edit tool for unified diff patches with:
   - Strict context validation
   - Multi-hunk support
   - SHA256 hash verification (before/after)
   - dryRun mode for validation without writes
   - Atomic writes via temp file + rename
2. **InteractiveShell bug fix**: Removed double-append of assistant messages
3. **search_text hardening**: Added per-file size check to skip files > 1MB
4. **write_file atomic writes**: Made create/overwrite modes use temp file + rename
5. **Updated tool descriptions**: Guide users toward read_file → apply_file_patch → read_file workflow

### Review Fixes (P1/P2/P3)
1. **P1 - Config propagation**: Added `AGENT_FILESYSTEM_WRITES_ENABLED` env var propagation in InteractiveShell and SinglePrompt
2. **P2 - Verbose mode tool support**: Changed SinglePrompt verbose mode to use `run()` instead of `runStream()` for tool calling support
3. **P3 - requireExactFileMatch validation**: Implemented `extractPatchFilePaths()` to parse `---/+++` headers and validate paths match when `requireExactFileMatch=true`

### Test Coverage
- 106 filesystem-specific tests
- TypeScript strict mode compliant
- ESLint clean
