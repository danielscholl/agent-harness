/**
 * System prompt loading utilities.
 * Implements three-tier fallback and placeholder replacement.
 *
 * ## Overview
 *
 * The system prompt loader provides a flexible way to customize the agent's behavior
 * through prompt files. It supports a three-tier fallback system:
 *
 * 1. **Explicit override**: Set via `config.agent.systemPromptFile`
 * 2. **User default**: Located at `~/.agent/system.md`
 * 3. **Package default**: Bundled with the package at `src/prompts/system.md`
 *
 * ## Placeholder Substitution
 *
 * Prompts can include placeholders using `{{NAME}}` syntax that are replaced at load time:
 *
 * | Placeholder | Description | Example Value |
 * |-------------|-------------|---------------|
 * | `{{MODEL}}` | Current model name | `gpt-4o` |
 * | `{{PROVIDER}}` | Current provider | `openai` |
 * | `{{DATA_DIR}}` | Data directory path | `~/.agent-data` |
 * | `{{MEMORY_ENABLED}}` | Memory status | `enabled` or `disabled` |
 *
 * ## YAML Front Matter
 *
 * Prompt files may include YAML front matter (delimited by `---`) which is automatically
 * stripped before processing. This allows prompts to include metadata:
 *
 * ```markdown
 * ---
 * title: My Custom Prompt
 * version: 1.0
 * ---
 * You are a helpful assistant using {{MODEL}}.
 * ```
 *
 * ## Skills Integration
 *
 * When `includeSkills` is enabled, the loader discovers available skills and appends
 * their context as XML to the system prompt. This enables progressive skill disclosure.
 *
 * @module agent/prompts
 *
 * @example Basic Usage
 * ```typescript
 * import { loadSystemPrompt } from './prompts.js';
 * import { getDefaultConfig } from '../config/schema.js';
 *
 * const config = getDefaultConfig();
 * const prompt = await loadSystemPrompt({
 *   config,
 *   model: 'gpt-4o',
 *   provider: 'openai',
 * });
 * ```
 *
 * @example With Skills
 * ```typescript
 * import { loadSystemPromptWithSkills } from './prompts.js';
 *
 * const { prompt, skills } = await loadSystemPromptWithSkills({
 *   config,
 *   model: 'gpt-4o',
 *   provider: 'openai',
 *   includeSkills: true,
 * });
 *
 * console.log(`Loaded ${skills.length} skills`);
 * ```
 *
 * @example Custom Placeholder Replacement
 * ```typescript
 * import { replacePlaceholders } from './prompts.js';
 *
 * const result = replacePlaceholders(
 *   'Hello, {{USER}}! Using {{MODEL}}.',
 *   { USER: 'Alice', MODEL: 'gpt-4o' }
 * );
 * // Result: 'Hello, Alice! Using gpt-4o.'
 * ```
 */

import { readFile, access, constants } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import type { AppConfig } from '../config/schema.js';
import {
  createSkillLoader,
  createSkillContextProvider,
  type DiscoveredSkill,
  type SkillLoaderOptions,
} from '../skills/index.js';

/**
 * Options for loading system prompt.
 */
export interface PromptOptions {
  /** Application configuration */
  config: AppConfig;
  /** Current model name (for {{MODEL}} placeholder) */
  model: string;
  /** Current provider name (for {{PROVIDER}} placeholder) */
  provider: string;
}

/**
 * Placeholder values for prompt replacement.
 */
export interface PlaceholderValues {
  /** Model name */
  MODEL: string;
  /** Provider name */
  PROVIDER: string;
  /** Data directory path */
  DATA_DIR: string;
  /** Session directory path */
  SESSION_DIR?: string;
  /** Whether memory is enabled */
  MEMORY_ENABLED: string;
  /** Additional custom placeholders */
  [key: string]: string | undefined;
}

/**
 * Check if a file exists and is readable.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the path to the package default system prompt.
 * Resolves relative to this module's location.
 * Uses fileURLToPath for cross-platform compatibility (Windows safe).
 *
 * Handles both:
 * - Bundled: dist/index.js -> dist/prompts/system.md (same dir)
 * - Source: src/agent/prompts.ts -> src/prompts/system.md (parent dir)
 */
function getPackagePromptPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const moduleDir = dirname(currentFile);

  // In bundled dist, prompts are at dist/prompts/system.md (same dir as index.js)
  // In source, prompts are at src/prompts/system.md (sibling to agent/)
  // Check if the module directory itself is named 'dist' to detect bundled execution
  // This avoids false positives when 'dist' appears elsewhere in the path
  const isBundled = basename(moduleDir) === 'dist';
  const promptsDir = isBundled ? moduleDir : join(moduleDir, '..');

  return join(promptsDir, 'prompts', 'system.md');
}

/**
 * Get the user's default system prompt path.
 * Located at ~/.agent/system.md
 */
function getUserPromptPath(): string {
  return join(homedir(), '.agent', 'system.md');
}

/**
 * Strip YAML front matter from markdown content.
 * Front matter is delimited by --- on its own line at start of file.
 * The closing --- must also be on its own line (not inside YAML values).
 *
 * @param content - Markdown content with optional YAML front matter
 * @returns Content with front matter removed
 */
export function stripYamlFrontMatter(content: string): string {
  const trimmed = content.trimStart();

  // Check for YAML front matter opening delimiter (--- followed by newline)
  if (!trimmed.startsWith('---')) {
    return content;
  }

  // Ensure opening delimiter is on its own line
  const afterOpening = trimmed.substring(3);
  if (afterOpening.length > 0 && afterOpening[0] !== '\n' && afterOpening[0] !== '\r') {
    // Not a valid front matter opening (e.g., "---something")
    return content;
  }

  // Find the closing delimiter on its own line
  // Look for newline followed by --- followed by newline or end of string
  const closingMatch = afterOpening.match(/\r?\n---(?:\r?\n|$)/);
  if (!closingMatch || closingMatch.index === undefined) {
    // No closing delimiter on its own line, return original
    return content;
  }

  // Skip past the closing delimiter and any following whitespace
  const endIndex = closingMatch.index + closingMatch[0].length;
  const afterFrontMatter = afterOpening.substring(endIndex).trimStart();
  return afterFrontMatter;
}

/**
 * Replace placeholders in prompt content.
 * Placeholders use {{NAME}} format.
 *
 * @param content - Prompt content with placeholders
 * @param values - Values to substitute
 * @returns Content with placeholders replaced
 */
export function replacePlaceholders(content: string, values: PlaceholderValues): string {
  let result = content;

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      // Replace all instances of {{KEY}}
      const placeholder = `{{${key}}}`;
      result = result.split(placeholder).join(value);
    }
  }

  return result;
}

/**
 * Load system prompt with three-tier fallback.
 *
 * Priority order:
 * 1. config.agent.systemPromptFile (explicit env override)
 * 2. ~/.agent/system.md (user's default)
 * 3. Package default (src/prompts/system.md)
 *
 * Strips YAML front matter and replaces placeholders.
 *
 * @param options - Prompt options including config, model, and provider
 * @returns Processed system prompt string
 */
export async function loadSystemPrompt(options: PromptOptions): Promise<string> {
  const { config, model, provider } = options;

  let promptContent: string | null = null;

  // Tier 1: Explicit config override
  if (config.agent.systemPromptFile !== undefined && config.agent.systemPromptFile !== '') {
    const configPath = config.agent.systemPromptFile;
    if (await fileExists(configPath)) {
      promptContent = await readFile(configPath, 'utf-8');
    }
  }

  // Tier 2: User's default (~/.agent/system.md)
  if (promptContent === null) {
    const userPath = getUserPromptPath();
    if (await fileExists(userPath)) {
      promptContent = await readFile(userPath, 'utf-8');
    }
  }

  // Tier 3: Package default
  if (promptContent === null) {
    const packagePath = getPackagePromptPath();
    if (await fileExists(packagePath)) {
      promptContent = await readFile(packagePath, 'utf-8');
    } else {
      // Fallback to inline default if file not found
      promptContent = getDefaultPrompt();
    }
  }

  // Strip YAML front matter
  const stripped = stripYamlFrontMatter(promptContent);

  // Build placeholder values
  const values: PlaceholderValues = {
    MODEL: model,
    PROVIDER: provider,
    DATA_DIR: config.agent.dataDir,
    MEMORY_ENABLED: config.memory.enabled ? 'enabled' : 'disabled',
  };

  // Replace placeholders
  const processed = replacePlaceholders(stripped, values);

  return processed;
}

/**
 * Get the inline default prompt.
 * Used as ultimate fallback if no file is found.
 */
function getDefaultPrompt(): string {
  return `You are a helpful AI assistant.

Model: {{MODEL}}
Provider: {{PROVIDER}}

You have access to various tools to help accomplish tasks. Use them when appropriate.

Guidelines:
- Be concise and direct in responses
- Use tools when they can help answer questions
- Explain your reasoning when helpful
- Ask for clarification if a request is ambiguous`;
}

// -----------------------------------------------------------------------------
// Skills Integration
// -----------------------------------------------------------------------------

/**
 * Extended options for loading system prompt with skills.
 */
export interface PromptOptionsWithSkills extends PromptOptions {
  /** Include discovered skills in system prompt */
  includeSkills?: boolean;
  /** Skills loader options */
  skillLoaderOptions?: SkillLoaderOptions;
}

/**
 * Load skills and generate context for system prompt.
 *
 * Design note: Skill loading errors are non-fatal - we continue with whatever
 * skills loaded successfully. Errors are logged via onDebug callback to allow
 * callers to observe issues without breaking the flow. The errors are also
 * collected in SkillDiscoveryResult.errors and returned to callers who need
 * structured error information.
 *
 * @param options - Skill loader options
 * @returns Skills context with XML and discovered skills
 */
export async function loadSkillsContext(
  options?: SkillLoaderOptions
): Promise<{ xml: string; skills: DiscoveredSkill[] }> {
  const loader = createSkillLoader(options);
  const result = await loader.discover();

  if (result.errors.length > 0) {
    // Log errors but continue with valid skills
    for (const error of result.errors) {
      options?.onDebug?.(`Skill load error: ${error.path}: ${error.message}`, { error });
    }
  }

  const provider = createSkillContextProvider(result.skills, {
    onDebug: options?.onDebug,
  });
  const xml = provider.getTier1Context();

  return { xml, skills: result.skills };
}

/**
 * Load system prompt with skills integration.
 * Combines base prompt loading with skill discovery.
 *
 * @param options - Prompt options including skills configuration
 * @returns System prompt with skills and list of discovered skills
 */
export async function loadSystemPromptWithSkills(
  options: PromptOptionsWithSkills
): Promise<{ prompt: string; skills: DiscoveredSkill[] }> {
  const basePrompt = await loadSystemPrompt(options);

  if (options.includeSkills !== true) {
    return { prompt: basePrompt, skills: [] };
  }

  const { xml, skills } = await loadSkillsContext(options.skillLoaderOptions);

  // Append skills XML after base prompt
  const prompt = xml ? `${basePrompt}\n\n${xml}` : basePrompt;

  return { prompt, skills };
}
