/**
 * Config command handlers.
 * Provides config (show), config init, config edit subcommands.
 */

import { spawn } from 'node:child_process';
import type { CommandHandler, CommandResult } from './types.js';
import { loadConfig, ConfigManager } from '../../config/manager.js';
import { getDefaultConfig, type AppConfig } from '../../config/schema.js';
import { getProviderWizards } from '../../config/providers/index.js';
import { PROVIDER_NAMES, type ProviderName } from '../../config/constants.js';

/**
 * Type guard to check if a string is a valid provider name.
 */
function isValidProviderName(name: string): name is ProviderName {
  return (PROVIDER_NAMES as readonly string[]).includes(name);
}

/**
 * Main config command handler.
 * Routes to subcommands based on first argument.
 */
export const configHandler: CommandHandler = async (args, context): Promise<CommandResult> => {
  const [subcommand, ...rest] = args.trim().split(/\s+/);
  const subArgs = rest.join(' ');

  switch (subcommand?.toLowerCase()) {
    case 'init':
      return configInitHandler(subArgs, context);
    case 'edit':
      return configEditHandler(subArgs, context);
    case undefined:
    case '':
      return configShowHandler('', context); // Default to show
    default:
      context.onOutput(`Unknown subcommand: ${subcommand ?? ''}`, 'warning');
      context.onOutput('Usage: agent config [init|edit]', 'info');
      return { success: false, message: 'Unknown subcommand' };
  }
};

/**
 * Get list of configured providers (have apiKey, token, or endpoint set).
 */
function getConfiguredProviders(config: AppConfig): ProviderName[] {
  const configured: ProviderName[] = [];
  for (const name of PROVIDER_NAMES) {
    const providerConfig = config.providers[name] as Record<string, unknown> | undefined;
    if (providerConfig === undefined) continue;

    // Local is always "configured"
    if (name === 'local') {
      configured.push(name);
      continue;
    }

    // Check for explicit configuration
    const hasApiKey = providerConfig.apiKey !== undefined;
    const hasToken = providerConfig.token !== undefined;
    const hasEndpoint =
      providerConfig.endpoint !== undefined || providerConfig.projectEndpoint !== undefined;

    if (hasApiKey || hasToken || hasEndpoint) {
      configured.push(name);
    }
  }
  return configured;
}

/**
 * Create a table row with proper padding.
 */
function tableRow(
  setting: string,
  value: string,
  settingWidth: number,
  valueWidth: number
): string {
  const paddedSetting = setting.padEnd(settingWidth);
  const paddedValue = value.padEnd(valueWidth);
  return `│ ${paddedSetting} │ ${paddedValue} │`;
}

/**
 * Handler for /config show command.
 * Displays current configuration in a formatted table like osdu-agent.
 */
export const configShowHandler: CommandHandler = async (_args, context): Promise<CommandResult> => {
  const configResult = await loadConfig();

  if (!configResult.success) {
    context.onOutput(`Failed to load config: ${configResult.message}`, 'error');
    return { success: false, message: configResult.message };
  }

  const config = configResult.result as AppConfig;

  // Build table rows
  const rows: Array<{ setting: string; value: string }> = [];

  // Get configured providers
  const configuredProviders = getConfiguredProviders(config);

  // Enabled Providers row
  rows.push({
    setting: 'Enabled Providers',
    value: configuredProviders.length > 0 ? configuredProviders.join(', ') : 'none',
  });

  // Default Provider row
  rows.push({
    setting: 'Default Provider',
    value: config.providers.default,
  });

  // Provider-specific settings (indented)
  const defaultProvider = config.providers.default;
  const defaultConfig = config.providers[defaultProvider] as Record<string, unknown> | undefined;

  if (defaultConfig !== undefined) {
    // Show endpoint for azure/foundry
    if (defaultProvider === 'azure') {
      const endpoint = defaultConfig.endpoint as string | undefined;
      if (endpoint !== undefined) {
        rows.push({
          setting: `  ${defaultProvider} Endpoint`,
          value: endpoint,
        });
      }
    }
    if (defaultProvider === 'foundry') {
      const endpoint = defaultConfig.projectEndpoint as string | undefined;
      if (endpoint !== undefined) {
        rows.push({
          setting: `  ${defaultProvider} Endpoint`,
          value: endpoint,
        });
      }
    }

    // Show model/deployment
    const deployment = defaultConfig.deployment as string | undefined;
    const modelDeployment = defaultConfig.modelDeployment as string | undefined;
    const model = defaultConfig.model as string | undefined;
    const modelAlias = defaultConfig.modelAlias as string | undefined;

    if (deployment !== undefined) {
      rows.push({
        setting: `  ${defaultProvider} Deployment`,
        value: deployment,
      });
    } else if (modelDeployment !== undefined) {
      rows.push({
        setting: `  ${defaultProvider} Deployment`,
        value: modelDeployment,
      });
    } else if (model !== undefined) {
      rows.push({
        setting: `  ${defaultProvider} Model`,
        value: model,
      });
    } else if (modelAlias !== undefined) {
      rows.push({
        setting: `  ${defaultProvider} Model`,
        value: modelAlias,
      });
    }
  }

  // Telemetry row
  rows.push({
    setting: 'Telemetry',
    value: config.telemetry.enabled ? 'Enabled' : 'Disabled',
  });

  // Memory row
  const memoryValue = config.memory.enabled
    ? `${config.memory.type} (limit: ${String(config.memory.historyLimit)})`
    : 'Disabled';
  rows.push({
    setting: 'Memory',
    value: memoryValue,
  });

  // Data Directory row
  rows.push({
    setting: 'Data Directory',
    value: config.agent.dataDir,
  });

  // Calculate column widths
  const settingWidth = Math.max(...rows.map((r) => r.setting.length), 'Setting'.length);
  const valueWidth = Math.max(...rows.map((r) => r.value.length), 'Value'.length);

  // Build table
  const topBorder = `┏${'━'.repeat(settingWidth + 2)}┳${'━'.repeat(valueWidth + 2)}┓`;
  const headerSep = `┡${'━'.repeat(settingWidth + 2)}╇${'━'.repeat(valueWidth + 2)}┩`;
  const bottomBorder = `└${'─'.repeat(settingWidth + 2)}┴${'─'.repeat(valueWidth + 2)}┘`;

  // Output title
  context.onOutput('', 'info');
  context.onOutput('                            Agent Configuration', 'success');

  // Output table
  context.onOutput(topBorder, 'info');
  context.onOutput(tableRow('Setting', 'Value', settingWidth, valueWidth), 'info');
  context.onOutput(headerSep, 'info');

  for (const row of rows) {
    context.onOutput(tableRow(row.setting, row.value, settingWidth, valueWidth), 'info');
  }

  context.onOutput(bottomBorder, 'info');

  // Output config file location
  context.onOutput('', 'info');
  context.onOutput(`Configuration file: ~/.agent/settings.json`, 'info');

  return { success: true, data: config };
};

/**
 * Handler for /config init command.
 * Interactive setup wizard for initial configuration.
 */
export const configInitHandler: CommandHandler = async (_args, context): Promise<CommandResult> => {
  // Check for interactive mode
  if (!context.onPrompt) {
    context.onOutput('Interactive mode required for /config init', 'error');
    context.onOutput('Run the agent in interactive mode (without -p flag)', 'info');
    return { success: false, message: 'No prompt handler available' };
  }

  context.onOutput('\nAgent Configuration Setup', 'success');
  context.onOutput('═══════════════════════════\n', 'info');
  context.onOutput('This wizard will help you configure an LLM provider.', 'info');
  context.onOutput('Run /config init again to add more providers.\n', 'info');

  // Get provider wizards
  const providerWizards = getProviderWizards();

  // List available providers
  context.onOutput('Available providers:', 'info');
  for (let i = 0; i < providerWizards.length; i++) {
    const provider = providerWizards[i];
    if (provider) {
      context.onOutput(
        `  ${String(i + 1)}. ${provider.displayName.padEnd(12)} - ${provider.description}`,
        'info'
      );
    }
  }
  context.onOutput('', 'info');

  const choice = await context.onPrompt('Select provider (1-7):');
  const providerIndex = parseInt(choice, 10) - 1;

  if (isNaN(providerIndex) || providerIndex < 0 || providerIndex >= providerWizards.length) {
    context.onOutput('Invalid selection. Run /config init to try again.', 'error');
    return { success: false, message: 'Invalid provider selection' };
  }

  const selectedProvider = providerWizards[providerIndex];
  if (!selectedProvider) {
    context.onOutput('Invalid selection. Run /config init to try again.', 'error');
    return { success: false, message: 'Invalid provider selection' };
  }

  // Run provider wizard
  context.onOutput(`\nStep 2: Configure ${selectedProvider.displayName}\n`, 'info');
  const wizardResult = await selectedProvider.wizard(context);

  if (!wizardResult.success) {
    context.onOutput(`\nSetup failed: ${wizardResult.message}`, 'error');
    return { success: false, message: wizardResult.message };
  }

  // Save configuration
  context.onOutput('\nStep 3: Saving configuration...\n', 'info');

  const configResult = await loadConfig();
  const existingConfig: AppConfig = configResult.success
    ? (configResult.result as AppConfig)
    : getDefaultConfig();

  // Validate provider name before using it
  if (!isValidProviderName(selectedProvider.name)) {
    context.onOutput(
      `Invalid provider name: ${selectedProvider.name}. Expected one of: ${PROVIDER_NAMES.join(', ')}`,
      'error'
    );
    return { success: false, message: 'Invalid provider name' };
  }

  // Merge provider config
  const newConfig: AppConfig = {
    ...existingConfig,
    providers: {
      ...existingConfig.providers,
      default: selectedProvider.name,
      [selectedProvider.name]: wizardResult.config,
    },
  };

  const manager = new ConfigManager();
  const saveResult = await manager.save(newConfig);

  if (!saveResult.success) {
    context.onOutput(`Failed to save: ${saveResult.message}`, 'error');
    return { success: false, message: saveResult.message };
  }

  context.onOutput('Configuration saved successfully!', 'success');
  context.onOutput(`  Provider: ${selectedProvider.displayName}`, 'info');
  context.onOutput('  Location: ~/.agent/settings.json\n', 'info');
  context.onOutput('Note: Restart the agent for changes to take effect.', 'warning');
  context.onOutput('Run /config show to view your configuration', 'info');

  return { success: true, message: 'Configuration initialized' };
};

/**
 * Open a file in the system's default editor.
 * Tries $EDITOR, $VISUAL, then falls back to platform-specific defaults.
 */
async function openInEditor(filePath: string): Promise<{ success: boolean; message?: string }> {
  return new Promise((resolve) => {
    // Try environment variables first
    const editor = process.env.EDITOR ?? process.env.VISUAL;

    if (editor !== undefined && editor !== '') {
      // Use the specified editor
      const proc = spawn(editor, [filePath], {
        stdio: 'inherit',
        shell: true,
      });

      proc.on('error', (err) => {
        resolve({ success: false, message: `Failed to open editor: ${err.message}` });
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, message: `Editor exited with code ${String(code)}` });
        }
      });
      return;
    }

    // Fall back to platform-specific defaults
    const platform = process.platform;
    let command: string;
    let args: string[];

    if (platform === 'darwin') {
      // macOS: use 'open' which opens with default app
      command = 'open';
      args = ['-t', filePath]; // -t opens in default text editor
    } else if (platform === 'win32') {
      // Windows: use 'notepad' or 'start'
      command = 'notepad';
      args = [filePath];
    } else {
      // Linux/Unix: try xdg-open, then common editors
      command = 'xdg-open';
      args = [filePath];
    }

    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: platform === 'win32',
    });

    proc.on('error', () => {
      // If xdg-open fails on Linux, try nano
      if (platform === 'linux') {
        const fallback = spawn('nano', [filePath], { stdio: 'inherit' });
        fallback.on('error', (err) => {
          resolve({ success: false, message: `No editor found: ${err.message}` });
        });
        fallback.on('close', (code) => {
          resolve(code === 0 ? { success: true } : { success: false, message: 'Editor failed' });
        });
      } else {
        resolve({ success: false, message: 'Failed to open editor' });
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, message: `Editor exited with code ${String(code)}` });
      }
    });
  });
}

/**
 * Handler for config edit command.
 * Opens the configuration file in the system's default text editor.
 */
export const configEditHandler: CommandHandler = async (_args, context): Promise<CommandResult> => {
  const manager = new ConfigManager();
  const configPath = manager.getUserConfigPath();

  context.onOutput(`Opening configuration file: ${configPath}`, 'info');

  const result = await openInEditor(configPath);

  if (!result.success) {
    context.onOutput(`Failed to open editor: ${result.message ?? 'Unknown error'}`, 'error');
    context.onOutput('You can manually edit the file at: ' + configPath, 'info');
    return { success: false, message: result.message };
  }

  context.onOutput('Configuration file opened in editor.', 'success');
  context.onOutput('Note: Restart the agent for changes to take effect.', 'warning');
  return { success: true, message: 'Opened config in editor' };
};
