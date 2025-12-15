/**
 * Utility module exports.
 * Provides shared utilities for the agent framework.
 */

export {
  MessageHistory,
  type StoredMessage,
  type MessageHistoryOptions,
} from './message-history.js';

export {
  ContextManager,
  type ContextPointer,
  type StoredContext,
  type ContextManagerOptions,
} from './context.js';

export {
  SessionManager,
  type SessionMetadata,
  type StoredSession,
  type SessionIndex,
  type SessionManagerOptions,
  type SaveSessionOptions,
} from './session.js';
