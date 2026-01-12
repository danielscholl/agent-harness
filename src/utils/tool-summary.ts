/**
 * Tool summary generation for progressive disclosure UI.
 *
 * Generates human-readable summaries for tool executions, including:
 * - Primary argument (what the tool operated on)
 * - Result summary (outcome in minimal text)
 * - Preview data (first N lines for verbose mode expansion)
 */

/**
 * Tool summary result.
 */
export interface ToolSummary {
  /** Primary argument to display inline (e.g., file path, command, pattern) */
  primary: string;
  /** One-line result summary (e.g., "42 files", "270 lines", "done") */
  summary: string;
  /** First N lines for verbose mode expansion (optional) */
  preview?: string[];
  /** Whether the tool has detailed output worth expanding */
  hasDetail?: boolean;
}

/** Maximum length for primary argument display */
const MAX_PRIMARY_LENGTH = 50;

/** Maximum length for summary display */
const MAX_SUMMARY_LENGTH = 40;

/** Number of preview lines to include */
const PREVIEW_LINE_COUNT = 5;

/**
 * Truncate a string with ellipsis if too long.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Safely get a string from metadata.
 */
function getString(obj: Record<string, unknown>, key: string): string {
  const val = obj[key];
  return typeof val === 'string' ? val : '';
}

/**
 * Safely get a number from metadata.
 */
function getNumber(obj: Record<string, unknown>, key: string): number {
  const val = obj[key];
  return typeof val === 'number' ? val : 0;
}

/**
 * Safely get a boolean from metadata.
 */
function getBoolean(obj: Record<string, unknown>, key: string): boolean {
  const val = obj[key];
  return val === true;
}

/**
 * Check if metadata has an error.
 */
function hasError(obj: Record<string, unknown>): boolean {
  const err = obj['error'];
  return err === true || (typeof err === 'string' && err.length > 0);
}

/**
 * Extract the last line of output (for bash streaming display).
 */
export function extractLastLine(output: string): string {
  const lines = output.trim().split('\n');
  const lastLine = lines[lines.length - 1] ?? '';
  return truncate(lastLine.trim(), MAX_SUMMARY_LENGTH);
}

/**
 * Extract first N lines of output for preview.
 */
export function extractPreview(output: string, lineCount: number = PREVIEW_LINE_COUNT): string[] {
  const lines = output.trim().split('\n');
  return lines.slice(0, lineCount);
}

/**
 * Generate a human-readable summary for a bash tool execution.
 */
function summarizeBash(
  args: Record<string, unknown>,
  result: { output?: string; message?: string },
  metadata: Record<string, unknown>
): ToolSummary {
  // Primary: the command (or description if provided)
  const description = getString(args, 'description');
  const command = getString(metadata, 'command') || getString(args, 'command');
  const primary = truncate(description.length > 0 ? description : command, MAX_PRIMARY_LENGTH);

  // Summary: based on exit code
  const exitCode = metadata['exitCode'];
  const hasErr = hasError(metadata);
  const isNull = exitCode === null;
  const isNonZero = typeof exitCode === 'number' && exitCode !== 0;

  let summary: string;
  if (hasErr || isNonZero) {
    const exitStr = typeof exitCode === 'number' ? String(exitCode) : '?';
    summary = `exit ${exitStr}`;
  } else if (isNull) {
    summary = 'killed';
  } else {
    const output = result.output ?? result.message ?? '';
    const lastLine = extractLastLine(output);
    summary = lastLine.length > 0 ? lastLine : 'done';
  }

  // Preview for verbose mode
  const output = result.output ?? result.message ?? '';
  const preview = extractPreview(output);

  return {
    primary,
    summary: truncate(summary, MAX_SUMMARY_LENGTH),
    preview: preview.length > 0 ? preview : undefined,
    hasDetail: output.length > 100,
  };
}

/**
 * Generate a human-readable summary for a glob tool execution.
 */
function summarizeGlob(
  args: Record<string, unknown>,
  _result: { output?: string; message?: string },
  metadata: Record<string, unknown>
): ToolSummary {
  const pattern = getString(metadata, 'pattern') || getString(args, 'pattern');
  const primary = truncate(pattern, MAX_PRIMARY_LENGTH);
  const fileCount = getNumber(metadata, 'fileCount');
  const truncated = getBoolean(metadata, 'truncated');

  let summary: string;
  if (hasError(metadata)) {
    summary = 'error';
  } else if (fileCount === 0) {
    summary = 'no matches';
  } else {
    const suffix = truncated ? '+' : '';
    summary = `${String(fileCount)}${suffix} file${fileCount === 1 ? '' : 's'}`;
  }

  return {
    primary,
    summary,
    hasDetail: fileCount > 0,
  };
}

/**
 * Generate a human-readable summary for a read tool execution.
 */
function summarizeRead(
  args: Record<string, unknown>,
  _result: { output?: string; message?: string },
  metadata: Record<string, unknown>
): ToolSummary {
  const filePath = getString(metadata, 'path') || getString(args, 'file_path');
  const primary = truncate(filePath, MAX_PRIMARY_LENGTH);
  const totalLines = getNumber(metadata, 'totalLines');
  const startLine = getNumber(metadata, 'startLine');
  const endLine = getNumber(metadata, 'endLine');
  const truncated = getBoolean(metadata, 'truncated');

  let summary: string;
  if (hasError(metadata)) {
    summary = 'error';
  } else if (truncated) {
    const shown = endLine - startLine + 1;
    summary = `${String(shown)}/${String(totalLines)} lines`;
  } else {
    summary = `${String(totalLines)} line${totalLines === 1 ? '' : 's'}`;
  }

  return {
    primary,
    summary,
    hasDetail: totalLines > 0,
  };
}

/**
 * Generate a human-readable summary for an edit tool execution.
 */
function summarizeEdit(
  args: Record<string, unknown>,
  _result: { output?: string; message?: string },
  metadata: Record<string, unknown>
): ToolSummary {
  const filePath = getString(metadata, 'path') || getString(args, 'file_path');
  const primary = truncate(filePath, MAX_PRIMARY_LENGTH);
  const replacements = getNumber(metadata, 'replacements');
  const originalSize = getNumber(metadata, 'originalSize');
  const newSize = getNumber(metadata, 'newSize');

  let summary: string;
  if (hasError(metadata)) {
    summary = 'error';
  } else {
    const sizeDiff = newSize - originalSize;
    const sizeStr = sizeDiff > 0 ? `+${String(sizeDiff)}` : sizeDiff < 0 ? String(sizeDiff) : '0';
    summary = `${String(replacements)} change${replacements === 1 ? '' : 's'} (${sizeStr})`;
  }

  return {
    primary,
    summary,
    hasDetail: true,
  };
}

/**
 * Generate a human-readable summary for a grep tool execution.
 */
function summarizeGrep(
  args: Record<string, unknown>,
  _result: { output?: string; message?: string },
  metadata: Record<string, unknown>
): ToolSummary {
  const pattern = getString(metadata, 'pattern') || getString(args, 'pattern');
  const primary = truncate(`"${pattern}"`, MAX_PRIMARY_LENGTH);
  const matchCount = getNumber(metadata, 'matchCount');
  const truncated = getBoolean(metadata, 'truncated');

  let summary: string;
  if (hasError(metadata)) {
    summary = 'error';
  } else if (matchCount === 0) {
    summary = 'no matches';
  } else {
    const suffix = truncated ? '+' : '';
    summary = `${String(matchCount)}${suffix} match${matchCount === 1 ? '' : 'es'}`;
  }

  return {
    primary,
    summary,
    hasDetail: matchCount > 0,
  };
}

/**
 * Generate a human-readable summary for a list tool execution.
 */
function summarizeList(
  args: Record<string, unknown>,
  _result: { output?: string; message?: string },
  metadata: Record<string, unknown>
): ToolSummary {
  const dirPath = getString(metadata, 'path') || getString(args, 'path') || '.';
  const primary = truncate(dirPath, MAX_PRIMARY_LENGTH);
  const entryCount = getNumber(metadata, 'entryCount');
  const truncated = getBoolean(metadata, 'truncated');

  let summary: string;
  if (hasError(metadata)) {
    summary = 'error';
  } else {
    const suffix = truncated ? '+' : '';
    summary = `${String(entryCount)}${suffix} entr${entryCount === 1 ? 'y' : 'ies'}`;
  }

  return {
    primary,
    summary,
    hasDetail: entryCount > 0,
  };
}

/**
 * Generate a human-readable summary for a write tool execution.
 */
function summarizeWrite(
  args: Record<string, unknown>,
  _result: { output?: string; message?: string },
  metadata: Record<string, unknown>
): ToolSummary {
  const filePath = getString(metadata, 'path') || getString(args, 'file_path');
  const primary = truncate(filePath, MAX_PRIMARY_LENGTH);
  const bytesWritten = getNumber(metadata, 'bytesWritten');
  const existedBefore = getBoolean(metadata, 'existedBefore');

  let summary: string;
  if (hasError(metadata)) {
    summary = 'error';
  } else {
    const action = existedBefore ? 'updated' : 'created';
    summary = `${action} (${formatBytes(bytesWritten)})`;
  }

  return {
    primary,
    summary,
    hasDetail: false,
  };
}

/**
 * Generate a human-readable summary for a webfetch tool execution.
 */
function summarizeWebFetch(
  args: Record<string, unknown>,
  _result: { output?: string; message?: string },
  metadata: Record<string, unknown>
): ToolSummary {
  const url = getString(metadata, 'url') || getString(args, 'url');
  // Extract domain from URL for display
  let primary: string;
  try {
    const urlObj = new URL(url);
    primary = truncate(urlObj.hostname, MAX_PRIMARY_LENGTH);
  } catch {
    primary = truncate(url, MAX_PRIMARY_LENGTH);
  }

  const statusCode = metadata['statusCode'];
  const contentType = getString(metadata, 'contentType');

  let summary: string;
  if (hasError(metadata)) {
    summary = 'error';
  } else if (typeof statusCode === 'number') {
    const ct = contentType.length > 0 ? contentType : 'OK';
    summary = `${String(statusCode)} ${ct}`;
  } else {
    summary = 'fetched';
  }

  return {
    primary,
    summary: truncate(summary, MAX_SUMMARY_LENGTH),
    hasDetail: true,
  };
}

/**
 * Generate a human-readable summary for a task tool execution.
 */
function summarizeTask(
  args: Record<string, unknown>,
  _result: { output?: string; message?: string },
  metadata: Record<string, unknown>
): ToolSummary {
  const description =
    getString(metadata, 'description') ||
    getString(args, 'description') ||
    getString(metadata, 'taskId') ||
    'task';
  const primary = truncate(description, MAX_PRIMARY_LENGTH);

  const summary = hasError(metadata) ? 'error' : 'done';

  return {
    primary,
    summary,
    hasDetail: false,
  };
}

/**
 * Generate a human-readable summary for a todo tool execution.
 */
function summarizeTodo(
  args: Record<string, unknown>,
  _result: { output?: string; message?: string },
  _metadata: Record<string, unknown>
): ToolSummary {
  const todos = args['todos'];
  const todoCount = Array.isArray(todos) ? todos.length : 0;

  return {
    primary: 'todos',
    summary: `${String(todoCount)} item${todoCount === 1 ? '' : 's'}`,
    hasDetail: false,
  };
}

/**
 * Format bytes in human-readable format.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/**
 * Default summary for unknown tools.
 */
function summarizeDefault(
  args: Record<string, unknown>,
  result: { success?: boolean; message?: string; output?: string },
  _metadata: Record<string, unknown>
): ToolSummary {
  // Try to find a primary argument
  const primaryKeys = ['path', 'file_path', 'pattern', 'command', 'url', 'query'];
  let primary = '';
  for (const key of primaryKeys) {
    const val = args[key];
    if (typeof val === 'string' && val.length > 0) {
      primary = truncate(val, MAX_PRIMARY_LENGTH);
      break;
    }
  }

  // Default summary based on success
  const success = result.success !== false;
  const summary = success ? 'done' : 'error';

  return {
    primary,
    summary,
    hasDetail: false,
  };
}

/**
 * Generate a tool summary based on tool name, arguments, result, and metadata.
 *
 * @param toolName - The name of the tool (e.g., 'bash', 'glob', 'read')
 * @param args - The arguments passed to the tool
 * @param result - The tool execution result
 * @param metadata - Tool-specific metadata from execution
 * @returns A ToolSummary object with primary arg and result summary
 */
export function generateToolSummary(
  toolName: string,
  args: Record<string, unknown>,
  result: { success?: boolean; result?: unknown; message?: string; output?: string },
  metadata: Record<string, unknown> = {}
): ToolSummary {
  // Extract output from result (handles both direct output and result.result.output)
  const resultObj = result.result;
  const extractedOutput =
    result.output ??
    result.message ??
    (typeof resultObj === 'object' && resultObj !== null
      ? (resultObj as Record<string, unknown>)['output']
      : undefined);
  const resultWithOutput = {
    ...result,
    output: typeof extractedOutput === 'string' ? extractedOutput : undefined,
  };

  switch (toolName.toLowerCase()) {
    case 'bash':
      return summarizeBash(args, resultWithOutput, metadata);
    case 'glob':
      return summarizeGlob(args, resultWithOutput, metadata);
    case 'read':
      return summarizeRead(args, resultWithOutput, metadata);
    case 'edit':
      return summarizeEdit(args, resultWithOutput, metadata);
    case 'grep':
      return summarizeGrep(args, resultWithOutput, metadata);
    case 'list':
      return summarizeList(args, resultWithOutput, metadata);
    case 'write':
      return summarizeWrite(args, resultWithOutput, metadata);
    case 'webfetch':
    case 'web_fetch':
      return summarizeWebFetch(args, resultWithOutput, metadata);
    case 'task':
      return summarizeTask(args, resultWithOutput, metadata);
    case 'todo':
    case 'todo_write':
      return summarizeTodo(args, resultWithOutput, metadata);
    default:
      return summarizeDefault(args, resultWithOutput, metadata);
  }
}
