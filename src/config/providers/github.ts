/**
 * GitHub Models provider setup wizard.
 */

import { spawnSync } from 'node:child_process';
import type { CommandContext } from '../../cli/commands/types.js';
import type { ProviderSetupResult } from './index.js';
import { checkEnvVar, maskSecret } from './index.js';
import { DEFAULT_GITHUB_MODEL, DEFAULT_GITHUB_ENDPOINT } from '../constants.js';

/**
 * Get token from GitHub CLI if logged in.
 */
export function getGitHubCLIToken(): string | undefined {
  try {
    const result = spawnSync('gh', ['auth', 'token'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    if (result.status === 0 && result.stdout) {
      return result.stdout.trim();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get user's primary GitHub organization from gh CLI.
 * Returns the first organization the user belongs to, if any.
 */
export function getGitHubCLIOrg(): string | undefined {
  try {
    const result = spawnSync('gh', ['api', 'user/orgs', '--jq', '.[0].login'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    if (result.status === 0 && result.stdout) {
      const org = result.stdout.trim();
      return org !== '' ? org : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Interactive setup wizard for GitHub Models provider.
 * Detects existing env vars and gh CLI auth, prompts for token and model.
 */
export async function setupGitHub(context: CommandContext): Promise<ProviderSetupResult> {
  context.onOutput('\nGitHub Models Setup', 'success');
  context.onOutput('─────────────────────', 'info');

  if (!context.onPrompt) {
    return { success: false, message: 'Interactive prompts not available' };
  }

  // Check for existing token in environment
  let envToken = checkEnvVar(context, 'GITHUB_TOKEN', 'Token');

  // Also check gh CLI if no env var (but warn about scope)
  if (envToken === undefined) {
    const cliToken = getGitHubCLIToken();
    if (cliToken !== undefined) {
      // gh CLI tokens (gho_) may not have models:read scope
      context.onOutput(
        `  ⚠ Detected: Token from gh CLI (${maskSecret(cliToken)}) - may lack models:read scope`,
        'warning'
      );
      context.onOutput(
        '  Tip: Create a fine-grained PAT with models:read for reliable access',
        'info'
      );
      envToken = cliToken;
    }
  }

  if (envToken === undefined) {
    context.onOutput(
      'Generate a fine-grained token at: https://github.com/settings/tokens',
      'info'
    );
    context.onOutput('Required scope: models:read', 'info');
    context.onOutput('', 'info');
  } else {
    context.onOutput('', 'info'); // Blank line after detection message
  }

  // Prompt for token - optional if detected
  const promptText =
    envToken !== undefined
      ? 'Token (press Enter to use detected token, or enter new):'
      : 'GitHub Token (ghp_..., github_pat_..., or gho_...):';
  const tokenInput = await context.onPrompt(promptText);

  // Use input if provided, otherwise use detected token
  const token = tokenInput.trim() || envToken;

  // Validate - must have a token from somewhere
  if (token === undefined || token === '') {
    context.onOutput(
      'Token is required. Set GITHUB_TOKEN, run gh auth login, or enter a token.',
      'error'
    );
    return { success: false, message: 'Token required' };
  }

  // Validate format only for manually entered tokens.
  // Note: We intentionally skip format validation for tokens from environment variables or gh CLI.
  // This allows enterprise setups to use non-standard token formats (proxied auth, custom tokens).
  if (
    tokenInput.trim() !== '' &&
    !tokenInput.startsWith('ghp_') &&
    !tokenInput.startsWith('github_pat_') &&
    !tokenInput.startsWith('gho_')
  ) {
    context.onOutput(
      'Invalid token format. Expected "ghp_", "github_pat_", or "gho_" prefix.',
      'error'
    );
    return { success: false, message: 'Invalid token format' };
  }

  // Prompt for model with default
  const modelInput = await context.onPrompt(`Model (default: ${DEFAULT_GITHUB_MODEL}):`);
  const model = modelInput.trim() || DEFAULT_GITHUB_MODEL;

  // Prompt for optional org
  const org = await context.onPrompt('GitHub Organization (optional, press Enter to skip):');

  context.onOutput('\nConfiguration ready', 'success');

  // Only include token in config if manually entered (env var/cli will be used at runtime)
  const config: Record<string, unknown> = {
    model,
    endpoint: DEFAULT_GITHUB_ENDPOINT,
    org: org.trim() || undefined,
  };
  if (tokenInput.trim() !== '') {
    config.token = token;
  }

  return {
    success: true,
    config,
    message: 'GitHub Models configured successfully',
  };
}
