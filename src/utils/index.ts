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

export {
  TokenUsageTracker,
  TokenEstimator,
  type SessionTokenUsage,
  type TokenUsageTrackerOptions,
  type TokenEstimatorOptions,
} from './tokens.js';

export { resolveModelName, isProviderConfigured } from './model.js';

export { getAgentHome, getPromptsDir, getBundledSkillsDir } from './paths.js';

export { readClipboard } from './clipboard.js';

export {
  generateToolSummary,
  extractLastLine,
  extractPreview,
  type ToolSummary,
} from './tool-summary.js';

export {
  truncateReasoning,
  truncatePreview,
  REASONING_CONFIG,
  type TruncatedReasoning,
} from './reasoning.js';
