# Feature: Session Save/Restore and History Management

## Feature Description

Implement a session persistence system for the TypeScript agent framework that enables saving, listing, resuming, and managing conversation sessions. This feature ports the session management functionality from `../agent-base/src/agent/cli/session.py` and `../agent-base/src/agent/persistence.py`, providing:

1. **Session persistence** - Save conversation sessions to disk as JSON files
2. **Session listing** - List all saved sessions with metadata (timestamp, message count, preview)
3. **Session resume** - Resume a previous session (`--continue` flag or `/resume` command)
4. **Last session tracking** - Track the most recent session for quick continue
5. **Session purge** - Delete old sessions to manage disk space
6. **Session metadata** - Track timestamps, message counts, provider/model info

Sessions are stored in `~/.agent/sessions/` with an index file for fast listing. The on-disk format is stable JSON aligned with the existing config/migration tooling patterns.

## User Story

As an agent user,
I want to save and resume conversation sessions,
So that I can continue previous conversations without losing context.

## Problem Statement

Currently, the TypeScript agent framework has no mechanism to:
- Persist conversation state beyond a single session
- Resume a previous conversation where it left off
- List and manage saved conversations
- Track which session was most recently used
- Clean up old sessions to manage disk space

Without session persistence, users lose all conversation context when they exit the agent, forcing them to re-explain context in every new session.

## Solution Statement

Implement `SessionManager` class in `src/utils/session.ts` that:

1. **Saves sessions with metadata** - Each session includes messages, timestamps, provider/model info
2. **Generates unique session IDs** - Timestamp-based IDs for easy sorting
3. **Maintains session index** - Fast listing without reading all session files
4. **Tracks last session** - Enables quick `--continue` resume
5. **Provides CLI integration** - `/save`, `/sessions`, `/resume`, `/purge` commands
6. **Integrates with MessageHistory** - Export/import conversation state
7. **Follows established patterns** - Uses IFileSystem, dependency injection, structured responses

Storage layout:
```
~/.agent/sessions/
├── index.json              # Session metadata index
├── last_session            # Pointer to most recent session
├── 2025-12-15-10-30-45.json
├── 2025-12-15-14-22-18.json
└── my-custom-name.json     # Named sessions
```

## Related Documentation

### Requirements
- `docs/plans/typescript-rewrite-features.md` - Feature 20 specification
- `docs/plans/typescript-rewrite.md` - Phase 3: Memory + Session
- `docs/architecture.md` - Session Architecture section (lines 391-424)

### Architecture Decisions
- `docs/decisions/0007-callbacks-over-eventbus.md` - Callback patterns (no global state)
- `docs/decisions/0004-validation-zod.md` - Zod validation for schemas

### Python Reference
- `agent-base/src/agent/cli/session.py` - Session management helpers
- `agent-base/src/agent/persistence.py` - ThreadPersistence class

## Codebase Analysis Findings

### Architecture Patterns
- **Dependency Injection**: All components receive dependencies via constructor options
- **No Global State**: Following callbacks-over-eventbus decision
- **Structured Responses**: Return structured objects with success/error fields
- **File System Abstraction**: Use `IFileSystem` interface for testability
- **Callback-Driven**: Optional debug callbacks `onDebug?: (msg: string, data?: unknown) => void`

### Naming Conventions
- Files: `kebab-case.ts` (e.g., `session.ts`)
- Classes: `PascalCase` (e.g., `SessionManager`)
- Types/Interfaces: `PascalCase` (e.g., `StoredSession`, `SessionMetadata`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `DEFAULT_SESSION_DIR`, `DEFAULT_MAX_SESSIONS`)

### Similar Implementations
- `src/utils/message-history.ts` - Memory management, storage pattern
- `src/utils/context.ts` - Filesystem persistence with pointers, cleanup methods
- `src/config/manager.ts` - Dependency injection via options, IFileSystem interface

### Integration Patterns
- InteractiveShell initializes utils in useEffect with refs
- Commands receive context with access to config and utilities
- Session management triggers cleanup at session end

### Key Python Patterns to Port
From `agent-base/src/agent/persistence.py`:
- `_sanitize_conversation_name()` - Input validation
- `save_thread()` - Session serialization with metadata
- `load_thread()` - Session deserialization with context summary generation
- `list_sessions()` - Fast metadata retrieval from index
- `delete_session()` - Safe session removal

From `agent-base/src/agent/cli/session.py`:
- `auto_save_session()` - Automatic save on exit
- `pick_session()` - Interactive session picker
- `restore_session_context()` - Resume with history display
- `get_last_session()` / `_save_last_session()` - Last session tracking

## Archon Project

**Project ID:** `9536e359-c5c7-4dc6-9fd1-46df69e3183e`
**Title:** Feature 20: Session Save/Restore

## Relevant Files

### Existing Files
- `src/utils/message-history.ts`: MessageHistory class for conversation tracking
- `src/utils/context.ts`: ContextManager class (reference pattern)
- `src/utils/index.ts`: Utils module exports (needs update)
- `src/config/types.ts`: `IFileSystem` interface definition
- `src/config/manager.ts`: `NodeFileSystem` implementation
- `src/config/constants.ts`: Default configuration values pattern
- `src/config/schema.ts`: Zod schema patterns
- `src/components/InteractiveShell.tsx`: CLI integration point (has `resumeSession` prop placeholder)
- `src/cli/commands/index.ts`: Command registration
- `src/cli/types.ts`: Command types and shell interfaces

### New Files
- `src/utils/session.ts`: SessionManager class implementation
- `src/utils/__tests__/session.test.ts`: Unit tests
- `src/cli/commands/session.ts`: Session commands implementation

## Implementation Plan

### Phase 1: Foundation
Create the `SessionManager` class with core types, constructor, and dependency injection.

### Phase 2: Core Implementation
Implement save, load, list, and metadata management methods.

### Phase 3: Last Session Tracking
Implement last session pointer and continue functionality.

### Phase 4: CLI Integration
Wire SessionManager into commands and InteractiveShell.

## Step by Step Tasks

### Task 1: Add session constants to config/constants.ts
- Description: Define default values for session configuration
- Files to modify: `src/config/constants.ts`
- Implementation details:
  ```typescript
  // Session defaults
  export const DEFAULT_SESSION_DIR = '~/.agent/sessions';
  export const DEFAULT_MAX_SESSIONS = 50;
  export const DEFAULT_AUTO_SAVE = true;
  export const DEFAULT_SESSION_NAME_MAX_LENGTH = 64;
  ```

### Task 2: Add session config schema to config/schema.ts
- Description: Define Zod schema for session configuration
- Files to modify: `src/config/schema.ts`
- Implementation details:
  ```typescript
  /**
   * Session configuration schema.
   */
  export const SessionConfigSchema = z.object({
    autoSave: z.boolean().default(DEFAULT_AUTO_SAVE).describe('Auto-save session on exit'),
    maxSessions: z
      .number()
      .int()
      .positive()
      .default(DEFAULT_MAX_SESSIONS)
      .describe('Maximum sessions to keep'),
  });

  export type SessionConfig = z.infer<typeof SessionConfigSchema>;
  ```
  - Add `session` field to `AppConfigSchema`

### Task 3: Define types and interfaces for session storage
- Description: Create the core type definitions for stored sessions
- Files to modify: `src/utils/session.ts` (new)
- Implementation details:
  ```typescript
  /**
   * Session metadata stored in index file.
   */
  export interface SessionMetadata {
    /** Session ID (filename without extension) */
    id: string;
    /** Session display name (may differ from ID) */
    name: string;
    /** Optional description */
    description?: string;
    /** ISO 8601 timestamp when session was created */
    createdAt: string;
    /** ISO 8601 timestamp of last activity */
    lastActivityAt: string;
    /** Number of messages in session */
    messageCount: number;
    /** First user message preview (truncated) */
    firstMessage: string;
    /** Provider used in session */
    provider: string;
    /** Model used in session */
    model: string;
  }

  /**
   * Full session data stored on disk.
   */
  export interface StoredSession {
    /** Session metadata */
    metadata: SessionMetadata;
    /** Conversation messages (from MessageHistory) */
    messages: StoredMessage[];
    /** Optional context summary for AI resume */
    contextSummary?: string;
  }

  /**
   * Session index for fast listing.
   */
  export interface SessionIndex {
    /** Schema version */
    version: string;
    /** Map of session ID to metadata */
    sessions: Record<string, SessionMetadata>;
    /** Last updated timestamp */
    updatedAt: string;
  }

  /**
   * Options for SessionManager constructor.
   */
  export interface SessionManagerOptions {
    /** Directory for session storage (default: ~/.agent/sessions) */
    sessionDir?: string;
    /** Maximum sessions to keep (default: 50) */
    maxSessions?: number;
    /** File system implementation for testing */
    fileSystem?: IFileSystem;
    /** Debug callback for logging */
    onDebug?: (msg: string, data?: unknown) => void;
  }
  ```

### Task 4: Implement SessionManager class constructor and helpers
- Description: Create the class skeleton with constructor and private helpers
- Files to modify: `src/utils/session.ts`
- Implementation details:
  - Constructor accepts `SessionManagerOptions` with defaults
  - Store `sessionDir`, `maxSessions`, `fileSystem`, `onDebug` as private fields
  - Private `sanitizeSessionName()` method for input validation
  - Private `generateSessionId()` method using timestamp
  - Private `generateContextSummary()` method for AI resume context
  - Private `getIndexPath()`, `getSessionPath()`, `getLastSessionPath()` helpers
  - Private `debug()` helper for optional debug logging
  - Use `NodeFileSystem` as default file system implementation

### Task 5: Implement session index management
- Description: Methods to load, save, and manage the session index
- Files to modify: `src/utils/session.ts`
- Implementation details:
  ```typescript
  /** Load session index from disk */
  private async loadIndex(): Promise<SessionIndex>

  /** Save session index to disk */
  private async saveIndex(index: SessionIndex): Promise<void>

  /** Ensure session directory exists */
  private async ensureSessionDir(): Promise<void>
  ```
  - Create index file if it doesn't exist
  - Handle corrupted index gracefully (rebuild from files)
  - Use atomic writes (write to temp, then rename)

### Task 6: Implement saveSession method
- Description: Save a session to disk with metadata
- Files to modify: `src/utils/session.ts`
- Implementation details:
  ```typescript
  async saveSession(
    messages: StoredMessage[],
    options?: {
      name?: string;
      description?: string;
      provider?: string;
      model?: string;
    }
  ): Promise<SessionMetadata>
  ```
  - Generate session ID from timestamp or use provided name
  - Validate session name using `sanitizeSessionName()`
  - Create `StoredSession` object with all metadata
  - Write to disk as JSON
  - Update session index
  - Update last session pointer
  - Enforce max sessions limit (delete oldest)
  - Return session metadata

### Task 7: Implement loadSession method
- Description: Load a session from disk
- Files to modify: `src/utils/session.ts`
- Implementation details:
  ```typescript
  async loadSession(sessionId: string): Promise<StoredSession | null>
  ```
  - Validate session ID
  - Read session file from disk
  - Parse and validate JSON structure
  - Return null for missing sessions (don't throw)
  - Handle corrupted files gracefully

### Task 8: Implement listSessions method
- Description: List all sessions with metadata
- Files to modify: `src/utils/session.ts`
- Implementation details:
  ```typescript
  async listSessions(): Promise<SessionMetadata[]>
  ```
  - Load session index
  - Return sorted by lastActivityAt (newest first)
  - Return empty array if no sessions

### Task 9: Implement deleteSession method
- Description: Delete a session and update index
- Files to modify: `src/utils/session.ts`
- Implementation details:
  ```typescript
  async deleteSession(sessionId: string): Promise<boolean>
  ```
  - Validate session ID
  - Delete session file
  - Remove from index
  - Update last session pointer if deleted session was last
  - Return false if session doesn't exist

### Task 10: Implement last session tracking
- Description: Methods to get and set the last session
- Files to modify: `src/utils/session.ts`
- Implementation details:
  ```typescript
  /** Get the last session ID for --continue */
  async getLastSession(): Promise<string | null>

  /** Save the last session ID */
  private async saveLastSession(sessionId: string): Promise<void>
  ```
  - Read/write simple text file with session ID
  - Return null if no last session
  - Handle missing file gracefully

### Task 11: Implement purgeSessions method
- Description: Delete old sessions beyond the limit
- Files to modify: `src/utils/session.ts`
- Implementation details:
  ```typescript
  async purgeSessions(keepCount?: number): Promise<number>
  ```
  - Sort sessions by lastActivityAt
  - Keep most recent N sessions
  - Delete rest
  - Return count of deleted sessions

### Task 12: Implement restoreSession helper
- Description: Restore session messages and generate context summary
- Files to modify: `src/utils/session.ts`
- Implementation details:
  ```typescript
  async restoreSession(sessionId: string): Promise<{
    messages: StoredMessage[];
    contextSummary: string | null;
  } | null>
  ```
  - Load session
  - Generate context summary for AI
  - Return messages and summary
  - Return null if session not found

### Task 13: Export SessionManager from utils index
- Description: Update module exports
- Files to modify: `src/utils/index.ts`
- Implementation details:
  - Export `SessionManager` class
  - Export `SessionMetadata`, `StoredSession`, `SessionIndex`, `SessionManagerOptions` types

### Task 14: Write unit tests for SessionManager
- Description: Comprehensive test suite with mocked file system
- Files to modify: `src/utils/__tests__/session.test.ts` (new)
- Test cases:
  - **Constructor**: Default options, custom options, debug callback
  - **saveSession**: Creates file, updates index, tracks last session
  - **loadSession**: Loads valid session, returns null for missing
  - **listSessions**: Returns sorted list, empty for no sessions
  - **deleteSession**: Removes file and index entry
  - **getLastSession**: Returns ID or null
  - **purgeSessions**: Keeps correct count, deletes oldest
  - **sanitizeSessionName**: Validates names, prevents path traversal
  - **Edge cases**: Corrupted index, missing files, special characters
- Target 90%+ coverage

### Task 15: Implement session CLI commands
- Description: Add /save, /sessions, /resume, /purge commands
- Files to modify: `src/cli/commands/session.ts` (new), `src/cli/commands/index.ts`
- Implementation details:
  - `/save [name]` - Save current session
  - `/sessions` - List all sessions
  - `/resume [id]` - Resume a session (interactive picker if no ID)
  - `/purge [count]` - Delete old sessions
  - Update command registry in `src/cli/commands/index.ts`

### Task 16: Update InteractiveShell for session support
- Description: Wire SessionManager into the interactive shell
- Files to modify: `src/components/InteractiveShell.tsx`
- Implementation details:
  - Create `SessionManager` instance with config
  - Initialize from `resumeSession` prop if provided
  - Auto-save session on exit (if enabled)
  - Wire `/save`, `/sessions`, `/resume` commands to SessionManager
  - Display session restore indicator when resuming

### Task 17: Update CommandResult for session operations
- Description: Add session-related flags to CommandResult
- Files to modify: `src/cli/commands/types.ts`
- Implementation details:
  - Add `shouldSaveSession?: boolean` flag
  - Add `sessionToResume?: string` flag
  - Add `sessionMessages?: StoredMessage[]` for resume data

### Task 18: Integration testing and validation
- Description: Verify end-to-end functionality
- Implementation details:
  - Test save → list → resume flow
  - Test auto-save on exit
  - Test --continue flag
  - Test purge with various counts
  - Verify file format matches expected JSON structure
  - Run full validation suite (typecheck, lint, test)

## Testing Strategy

### Unit Tests

**Constructor & Configuration:**
- Creates with default options (uses ~/.agent/sessions)
- Accepts custom sessionDir path
- Accepts custom maxSessions limit
- Accepts mock fileSystem for testing
- Accepts debug callback

**saveSession() method:**
- Creates session directory if missing
- Generates unique session ID from timestamp
- Accepts custom session name
- Validates session name (sanitization)
- Writes valid JSON with all metadata fields
- Updates session index
- Updates last session pointer
- Enforces max sessions limit
- Returns session metadata

**loadSession() method:**
- Loads valid session file
- Returns null for missing session
- Handles corrupted JSON gracefully

**listSessions() method:**
- Returns sorted list (newest first)
- Returns empty array for no sessions
- Loads from index file (fast)

**deleteSession() method:**
- Deletes session file
- Removes from index
- Updates last session if needed
- Returns false for non-existent session

**getLastSession() method:**
- Returns session ID when set
- Returns null when not set
- Handles missing file gracefully

**purgeSessions() method:**
- Keeps specified count
- Deletes oldest first
- Returns count deleted

**sanitizeSessionName() method:**
- Accepts valid names (alphanumeric, underscore, dash, dot)
- Rejects path traversal attempts (.., /)
- Rejects reserved names
- Enforces length limits

### Integration Tests
- Save session → list sessions → verify in list
- Save session → load session → verify data integrity
- Save multiple → purge → verify count
- Delete session → verify removed from list and disk

### Edge Cases
- Empty session (no messages)
- Very long session (many messages)
- Special characters in first message
- Unicode content
- Corrupted session file
- Corrupted index file (rebuild)
- Concurrent saves (single-threaded, should be fine)
- Non-existent session directory (auto-create)

## Acceptance Criteria

- [ ] `SessionManager` class implemented in `src/utils/session.ts`
- [ ] Supports `saveSession()`, `loadSession()`, `listSessions()`, `deleteSession()`
- [ ] Session index for fast listing without reading all files
- [ ] Last session tracking for `--continue` flag
- [ ] `purgeSessions()` method to clean up old sessions
- [ ] Session name validation (path traversal prevention)
- [ ] Context summary generation for AI resume
- [ ] Uses `IFileSystem` interface for testability
- [ ] Session config schema added to `AppConfigSchema`
- [ ] CLI commands: `/save`, `/sessions`, `/resume`, `/purge`
- [ ] InteractiveShell integration with auto-save
- [ ] `--continue` flag support (via `resumeSession` prop)
- [ ] Exported from `src/utils/index.ts`
- [ ] Unit tests with 90%+ coverage
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

# Run session tests specifically
bun run test -- src/utils/__tests__/session.test.ts

# Run with coverage
bun run test:coverage

# Build
bun run build
```

## Notes

### Session Data Structure

Each session file contains:
```json
{
  "metadata": {
    "id": "2025-12-15-10-30-45",
    "name": "2025-12-15-10-30-45",
    "description": "Auto-saved session",
    "createdAt": "2025-12-15T10:30:45.000Z",
    "lastActivityAt": "2025-12-15T10:45:22.000Z",
    "messageCount": 12,
    "firstMessage": "Help me understand the codebase...",
    "provider": "openai",
    "model": "gpt-4o"
  },
  "messages": [
    { "role": "user", "content": "...", "id": "...", "timestamp": "...", "turnIndex": 1 },
    { "role": "assistant", "content": "...", "id": "...", "timestamp": "...", "turnIndex": 1 }
  ],
  "contextSummary": "You are resuming a previous session..."
}
```

### Context is NOT Restored

Per architecture.md, **context data is NOT restored** on session resume:
> When a session is resumed (`--continue`):
> - **Conversation history** is restored (messages, timestamps)
> - **Event logs** are available (LLM calls, tool calls)
> - **Context data is NOT restored** (large tool outputs are lost)

This is intentional - tool outputs can be very large. The context summary helps the AI understand what happened, but detailed tool results need to be regenerated if needed.

### Relationship to Message History

Feature 18 (MessageHistory) handles in-session conversation tracking. Feature 20 (SessionManager) handles:
- **Persistence**: Saving MessageHistory state to disk
- **Resume**: Loading MessageHistory state back
- **Management**: List, delete, purge sessions

SessionManager uses `StoredMessage[]` from MessageHistory for session data.

### Relationship to Tool Context

Feature 19 (ContextManager) handles tool output persistence. Per architecture:
- Context is cleared at session end
- Context is NOT restored on session resume
- This is a deliberate trade-off for simplicity

### Session Name Validation

From Python `_sanitize_conversation_name()`:
- Max 64 characters
- Only alphanumeric, underscore, dash, dot
- No path traversal (.., /)
- No reserved names (index, metadata, con, prn, aux, nul)

### Auto-Save Behavior

When `session.autoSave` is enabled (default: true):
1. On normal exit (Ctrl+D, /exit) - save current session
2. On Ctrl+C - do NOT save (user may not want to)
3. Skip save if no messages exchanged

### Integration with --continue Flag

The `--continue` flag should:
1. Read last session ID from `~/.agent/sessions/last_session`
2. Load session messages
3. Initialize MessageHistory with restored messages
4. Display session restore indicator
5. Continue conversation with full context

## Execution

This spec can be implemented using: `/sdlc:implement docs/specs/feature-020-session-save-restore.md`
