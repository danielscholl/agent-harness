/**
 * Skill plugin installer.
 * Handles git clone, update, and removal of plugin skills.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, rm, access, readdir } from 'node:fs/promises';
import { parseSkillMd } from './parser.js';
import { readFile } from 'node:fs/promises';

const execAsync = promisify(exec);

/**
 * Options for installing a skill from git.
 */
export interface InstallOptions {
  /** Git repository URL */
  url: string;
  /** Branch/tag/commit to checkout */
  ref?: string;
  /** Override skill name (defaults to repo name) */
  name?: string;
  /** Base directory for plugins (defaults to ~/.agent/skills) */
  baseDir?: string;
}

/**
 * Result of a skill installation operation.
 */
export interface InstallResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Skill name (from manifest or derived) */
  skillName: string;
  /** Path to installed skill directory */
  path: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Result of a skill update operation.
 */
export interface UpdateResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Skill name */
  skillName: string;
  /** Whether any changes were pulled */
  updated: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Get the default plugins directory.
 */
export function getPluginsDir(baseDir?: string): string {
  return baseDir ?? join(homedir(), '.agent', 'skills');
}

/**
 * Extract repository name from git URL.
 */
export function extractRepoName(url: string): string {
  // Handle various git URL formats:
  // https://github.com/user/repo.git
  // git@github.com:user/repo.git
  // https://github.com/user/repo
  const match = url.match(/\/([^/]+?)(\.git)?$/);
  return match?.[1] ?? 'unknown-skill';
}

/**
 * Check if a directory exists.
 */
async function dirExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Install a skill plugin from a git repository.
 *
 * @param options - Installation options
 * @returns Installation result
 */
export async function installSkill(options: InstallOptions): Promise<InstallResult> {
  const { url, ref, name } = options;
  const baseDir = getPluginsDir(options.baseDir);
  const repoName = name ?? extractRepoName(url);
  const targetDir = join(baseDir, repoName);

  try {
    // Check if already installed
    if (await dirExists(targetDir)) {
      return {
        success: false,
        skillName: repoName,
        path: targetDir,
        error: `Skill "${repoName}" already exists at ${targetDir}. Use update to refresh or remove first.`,
      };
    }

    // Ensure base directory exists
    await mkdir(baseDir, { recursive: true });

    // Clone repository
    const cloneCmd =
      ref !== undefined && ref !== ''
        ? `git clone --depth 1 --branch "${ref}" "${url}" "${targetDir}"`
        : `git clone --depth 1 "${url}" "${targetDir}"`;

    await execAsync(cloneCmd, { timeout: 60000 });

    // Validate SKILL.md exists
    const skillMdPath = join(targetDir, 'SKILL.md');
    if (!(await dirExists(skillMdPath))) {
      // Rollback: remove cloned directory
      await rm(targetDir, { recursive: true, force: true });
      return {
        success: false,
        skillName: repoName,
        path: targetDir,
        error: `Repository does not contain a SKILL.md file. Not a valid skill package.`,
      };
    }

    // Validate SKILL.md content
    const content = await readFile(skillMdPath, 'utf-8');
    const parseResult = parseSkillMd(content, repoName);

    if (!parseResult.success) {
      // Rollback: remove cloned directory
      await rm(targetDir, { recursive: true, force: true });
      return {
        success: false,
        skillName: repoName,
        path: targetDir,
        error: `Invalid SKILL.md: ${parseResult.error}`,
      };
    }

    // Use the name from the manifest
    const actualName = parseResult.content.manifest.name;

    // If manifest name differs from directory, rename
    if (actualName !== repoName) {
      const newTargetDir = join(baseDir, actualName);
      if (await dirExists(newTargetDir)) {
        // Rollback: remove cloned directory
        await rm(targetDir, { recursive: true, force: true });
        return {
          success: false,
          skillName: actualName,
          path: newTargetDir,
          error: `Skill "${actualName}" already exists. Choose a different name with --name option.`,
        };
      }
      // Rename directory to match skill name
      await execAsync(`mv "${targetDir}" "${newTargetDir}"`);
      return {
        success: true,
        skillName: actualName,
        path: newTargetDir,
      };
    }

    return {
      success: true,
      skillName: actualName,
      path: targetDir,
    };
  } catch (error) {
    // Cleanup on error
    try {
      await rm(targetDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      skillName: repoName,
      path: targetDir,
      error: `Failed to install: ${message}`,
    };
  }
}

/**
 * Update an installed skill plugin by pulling latest changes.
 *
 * @param skillName - Name of the skill to update
 * @param baseDir - Base directory for plugins
 * @returns Update result
 */
export async function updateSkill(skillName: string, baseDir?: string): Promise<UpdateResult> {
  const pluginsDir = getPluginsDir(baseDir);
  const targetDir = join(pluginsDir, skillName);

  try {
    // Check if skill exists
    if (!(await dirExists(targetDir))) {
      return {
        success: false,
        skillName,
        updated: false,
        error: `Skill "${skillName}" not found at ${targetDir}`,
      };
    }

    // Check if it's a git repository
    const gitDir = join(targetDir, '.git');
    if (!(await dirExists(gitDir))) {
      return {
        success: false,
        skillName,
        updated: false,
        error: `Skill "${skillName}" is not a git repository`,
      };
    }

    // Get current HEAD before pull
    const { stdout: beforeHash } = await execAsync('git rev-parse HEAD', { cwd: targetDir });

    // Pull latest changes
    await execAsync('git pull --ff-only', { cwd: targetDir, timeout: 60000 });

    // Get HEAD after pull
    const { stdout: afterHash } = await execAsync('git rev-parse HEAD', { cwd: targetDir });

    const updated = beforeHash.trim() !== afterHash.trim();

    return {
      success: true,
      skillName,
      updated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      skillName,
      updated: false,
      error: `Failed to update: ${message}`,
    };
  }
}

/**
 * Remove an installed skill plugin.
 *
 * @param skillName - Name of the skill to remove
 * @param baseDir - Base directory for plugins
 * @returns Whether removal succeeded
 */
export async function removeSkill(skillName: string, baseDir?: string): Promise<boolean> {
  const pluginsDir = getPluginsDir(baseDir);
  const targetDir = join(pluginsDir, skillName);

  try {
    // Check if skill exists
    if (!(await dirExists(targetDir))) {
      return false;
    }

    // Remove directory
    await rm(targetDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * List installed plugin skills.
 *
 * @param baseDir - Base directory for plugins
 * @returns Array of installed skill names
 */
export async function listInstalledPlugins(baseDir?: string): Promise<string[]> {
  const pluginsDir = getPluginsDir(baseDir);

  try {
    if (!(await dirExists(pluginsDir))) {
      return [];
    }

    const entries = await readdir(pluginsDir, { withFileTypes: true });
    const plugins: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check if it has a SKILL.md
        const skillMdPath = join(pluginsDir, entry.name, 'SKILL.md');
        if (await dirExists(skillMdPath)) {
          plugins.push(entry.name);
        }
      }
    }

    return plugins.sort();
  } catch {
    return [];
  }
}
