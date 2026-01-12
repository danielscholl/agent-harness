/**
 * ToolSummary component for progressive disclosure UI.
 *
 * Renders a single tool execution in a compact one-line format.
 * Format: tool primaryArg -> resultSummary (Xs)
 */

import React from 'react';
import { Box, Text } from 'ink';

// Status symbols
const SYMBOL_COMPLETE = '\u2022'; // •
const SYMBOL_RUNNING = '\u2192'; // →
const SYMBOL_ERROR = '\u2717'; // ✗
const SYMBOL_ARROW = '\u2192'; // →

/**
 * Props for ToolSummary component.
 */
export interface ToolSummaryProps {
  /** Tool name (e.g., 'bash', 'glob', 'read') */
  name: string;
  /** Primary argument to show (e.g., file path, command, pattern) */
  primaryArg?: string;
  /** Result summary (e.g., '42 files', '270 lines') */
  resultSummary?: string;
  /** Execution status */
  status: 'running' | 'complete' | 'error';
  /** Duration in seconds (only shown if >= 1s) */
  duration?: number;
  /** Error message (for error status) */
  error?: string;
  /** Optional prefix text (e.g., tree characters) */
  prefix?: string;
}

/**
 * Format duration in seconds.
 */
function formatDuration(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

/**
 * ToolSummary component.
 *
 * Renders a tool execution in compact one-line format suitable for
 * both verbose and non-verbose display modes.
 */
export function ToolSummary({
  name,
  primaryArg,
  resultSummary,
  status,
  duration,
  error,
  prefix,
}: ToolSummaryProps): React.ReactElement {
  // Determine symbol and color based on status
  let symbol: string;
  let color: string;

  switch (status) {
    case 'running':
      symbol = SYMBOL_RUNNING;
      color = 'yellow';
      break;
    case 'error':
      symbol = SYMBOL_ERROR;
      color = 'red';
      break;
    default:
      symbol = SYMBOL_COMPLETE;
      color = 'gray';
  }

  const hasPrimaryArg = primaryArg !== undefined && primaryArg !== '';
  const hasResultSummary = resultSummary !== undefined && resultSummary !== '';
  const showDuration = duration !== undefined && duration >= 1.0;

  return (
    <Box>
      {/* Optional prefix (e.g., tree characters) */}
      {prefix !== undefined && <Text dimColor>{prefix} </Text>}

      {/* Status symbol */}
      <Text color={color}>{symbol} </Text>

      {/* Tool name */}
      <Text color={color}>{name}</Text>

      {/* Primary argument */}
      {hasPrimaryArg && (
        <Text color={status === 'running' ? 'yellow' : 'gray'}>
          {name === 'bash' ? ': ' : ' '}
          {primaryArg}
        </Text>
      )}

      {/* Result summary with arrow separator */}
      {status !== 'running' && hasResultSummary && (
        <Text dimColor>
          {' '}
          {SYMBOL_ARROW} {resultSummary}
        </Text>
      )}

      {/* Duration (only if significant) */}
      {showDuration && <Text dimColor> ({formatDuration(duration)})</Text>}

      {/* Error message */}
      {status === 'error' && error !== undefined && <Text color="red"> - {error}</Text>}
    </Box>
  );
}

/**
 * Render a list of tool summaries.
 *
 * @example
 * ```tsx
 * <ToolSummaryList tools={toolNodes} />
 * ```
 */
export function ToolSummaryList({
  tools,
  maxDisplay,
}: {
  tools: Array<{
    name: string;
    primaryArg?: string;
    resultSummary?: string;
    status: 'running' | 'complete' | 'error';
    duration?: number;
    error?: string;
  }>;
  maxDisplay?: number;
}): React.ReactElement {
  const displayTools = maxDisplay !== undefined ? tools.slice(0, maxDisplay) : tools;
  const remaining = maxDisplay !== undefined ? tools.length - maxDisplay : 0;

  return (
    <Box flexDirection="column">
      {displayTools.map((tool, index) => (
        <ToolSummary key={index} {...tool} />
      ))}
      {remaining > 0 && (
        <Text dimColor>
          ... and {remaining} more tool{remaining === 1 ? '' : 's'}
        </Text>
      )}
    </Box>
  );
}
