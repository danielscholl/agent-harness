/**
 * FocusZone component for progressive disclosure UI.
 *
 * Displays streaming LLM output in a bounded viewport (max N lines).
 * Automatically scrolls to bottom as new content arrives.
 * Shows current output chunk for real-time feedback without flooding the terminal.
 * Supports bordered box display for active tool execution.
 */

import React from 'react';
import { Box, Text } from 'ink';

/** Default maximum visible lines */
const DEFAULT_MAX_LINES = 8;

/** Default box width for bordered display */
const DEFAULT_BOX_WIDTH = 60;

/** Box drawing characters */
const BOX_TOP_LEFT = '\u250C'; // ┌
const BOX_TOP_RIGHT = '\u2510'; // ┐
const BOX_BOTTOM_LEFT = '\u2514'; // └
const BOX_BOTTOM_RIGHT = '\u2518'; // ┘
const BOX_HORIZONTAL = '\u2500'; // ─
const BOX_VERTICAL = '\u2502'; // │

/** Streaming cursor */
const STREAMING_CURSOR = '\u258C'; // ▌

/**
 * Props for FocusZone component.
 */
export interface FocusZoneProps {
  /** Streaming content to display */
  content: string;
  /** Maximum number of lines to show (default: 8) */
  maxLines?: number;
  /** Whether content is still streaming */
  isStreaming?: boolean;
  /** Optional title/header (shown inside bordered box) */
  title?: string;
  /** Whether to show bordered box (default: false) */
  bordered?: boolean;
  /** Width of bordered box (default: 60) */
  boxWidth?: number;
  /** Indentation level (spaces before box) */
  indent?: number;
}

/**
 * Truncate a line to fit within box width.
 */
function truncateLine(line: string, maxWidth: number): string {
  if (line.length <= maxWidth) return line;
  return line.slice(0, maxWidth - 3) + '...';
}

/**
 * Pad a line to fill box width.
 */
function padLine(line: string, width: number): string {
  if (line.length >= width) return line;
  return line + ' '.repeat(width - line.length);
}

/**
 * FocusZone component.
 *
 * Provides a bounded viewport for streaming LLM output.
 * Only shows the most recent N lines of content.
 * Can render in bordered box style for active tool execution.
 *
 * @example
 * ```tsx
 * // Simple streaming display
 * <FocusZone content={streamingOutput} maxLines={6} isStreaming={true} />
 *
 * // Bordered box for active tool
 * <FocusZone
 *   content={bashOutput}
 *   title="$ npm run build"
 *   bordered={true}
 *   isStreaming={true}
 * />
 * ```
 */
export function FocusZone({
  content,
  maxLines = DEFAULT_MAX_LINES,
  isStreaming = false,
  title,
  bordered = false,
  boxWidth = DEFAULT_BOX_WIDTH,
  indent = 0,
}: FocusZoneProps): React.ReactElement {
  // Don't render if no content and no title
  if (!content.trim() && title === undefined) {
    return <></>;
  }

  // Split content into lines and take the last N lines
  const allLines = content.split('\n');
  const totalLines = allLines.length;

  // Take the last maxLines lines (auto-scroll to bottom behavior)
  const startIndex = Math.max(0, totalLines - maxLines);
  const visibleLines = allLines.slice(startIndex);

  // Show scroll indicator if content is truncated
  const hasMoreAbove = startIndex > 0;

  // Indentation prefix
  const indentStr = ' '.repeat(indent);

  // Bordered box rendering
  if (bordered) {
    const innerWidth = boxWidth - 4; // Account for │ and spaces
    const horizontalLine = BOX_HORIZONTAL.repeat(boxWidth - 2);

    return (
      <Box flexDirection="column">
        {/* Top border */}
        <Text dimColor>
          {indentStr}
          {BOX_TOP_LEFT}
          {horizontalLine}
          {BOX_TOP_RIGHT}
        </Text>

        {/* Title line if provided */}
        {title !== undefined && (
          <Text>
            <Text dimColor>
              {indentStr}
              {BOX_VERTICAL}{' '}
            </Text>
            <Text color="cyan">{truncateLine(title, innerWidth)}</Text>
            <Text dimColor>
              {padLine('', innerWidth - Math.min(title.length, innerWidth))} {BOX_VERTICAL}
            </Text>
          </Text>
        )}

        {/* Scroll indicator */}
        {hasMoreAbove && (
          <Text dimColor>
            {indentStr}
            {BOX_VERTICAL} ... ({startIndex} more above)
            {padLine('', innerWidth - 15 - String(startIndex).length)} {BOX_VERTICAL}
          </Text>
        )}

        {/* Content lines */}
        {visibleLines.map((line, index) => {
          const isLastLine = index === visibleLines.length - 1;
          const displayLine = truncateLine(line, innerWidth);
          const paddedLine = padLine(displayLine, innerWidth);

          return (
            <Text key={index}>
              <Text dimColor>
                {indentStr}
                {BOX_VERTICAL}{' '}
              </Text>
              <Text>{paddedLine}</Text>
              {/* Streaming cursor on last line */}
              {isStreaming && isLastLine && <Text color="yellow">{STREAMING_CURSOR}</Text>}
              {!isStreaming || !isLastLine ? (
                <Text dimColor> {BOX_VERTICAL}</Text>
              ) : (
                <Text dimColor>{BOX_VERTICAL}</Text>
              )}
            </Text>
          );
        })}

        {/* Empty line if no content but streaming */}
        {visibleLines.length === 0 && isStreaming && (
          <Text>
            <Text dimColor>
              {indentStr}
              {BOX_VERTICAL}{' '}
            </Text>
            <Text color="yellow">{STREAMING_CURSOR}</Text>
            <Text dimColor>
              {padLine('', innerWidth)} {BOX_VERTICAL}
            </Text>
          </Text>
        )}

        {/* Bottom border */}
        <Text dimColor>
          {indentStr}
          {BOX_BOTTOM_LEFT}
          {horizontalLine}
          {BOX_BOTTOM_RIGHT}
        </Text>
      </Box>
    );
  }

  // Non-bordered rendering (original behavior)
  return (
    <Box flexDirection="column">
      {/* Title if provided */}
      {title !== undefined && (
        <Text dimColor>
          {indentStr}
          {title}
        </Text>
      )}

      {/* Scroll indicator */}
      {hasMoreAbove && (
        <Text dimColor>
          {indentStr}... ({startIndex} more line{startIndex === 1 ? '' : 's'} above)
        </Text>
      )}

      {/* Visible content */}
      <Box flexDirection="column">
        {visibleLines.map((line, index) => {
          const isLastLine = index === visibleLines.length - 1;
          return (
            <Text key={index}>
              {indentStr}
              {line}
              {isStreaming && isLastLine && <Text color="yellow">{STREAMING_CURSOR}</Text>}
            </Text>
          );
        })}
      </Box>

      {/* Streaming indicator for empty content */}
      {visibleLines.length === 0 && isStreaming && (
        <Text color="yellow">
          {indentStr}
          {STREAMING_CURSOR}
        </Text>
      )}
    </Box>
  );
}
