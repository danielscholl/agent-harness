/**
 * HealthCheck component.
 * Displays configuration and connectivity status in grouped sections.
 * Follows osdu-agent CLI style with System, Agent, Memory, Docker, and LLM Providers sections.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { loadConfig, loadConfigFromFiles } from '../config/manager.js';
import { VERSION } from '../cli/version.js';
import { Spinner } from './Spinner.js';
import type { AppConfig } from '../config/schema.js';
import { PROVIDER_NAMES, type ProviderName } from '../config/constants.js';

/**
 * Status types for color coding.
 * - ok: green - success, enabled, working
 * - warning: yellow - disabled, attention needed
 * - error: red - failed, critical issues
 * - info: cyan - informational, system data
 */
type ItemStatus = 'ok' | 'warning' | 'error' | 'info';

/**
 * Item within a health check section.
 */
interface SectionItem {
  label: string;
  value: string;
  status: ItemStatus;
  isDefault?: boolean;
  isSubItem?: boolean;
}

/**
 * A section of related health check items.
 */
interface HealthSection {
  name: string;
  items: SectionItem[];
}

/**
 * Docker model information.
 */
interface DockerModel {
  name: string;
}

/**
 * Docker status information.
 */
interface DockerStatus {
  running: boolean;
  version?: string;
  cpus?: number;
  memoryBytes?: number;
  models?: DockerModel[];
}

/**
 * Mask a secret value, showing only the last 6 characters.
 * Returns special display for providers using Azure CLI auth.
 */
function maskSecret(secret: string | undefined): string {
  if (secret === undefined || secret === '') return 'Not configured';
  if (secret === 'N/A') return 'Azure CLI';
  if (secret.length <= 8) return '****';
  return '****' + secret.slice(-6);
}

/**
 * Format bytes as GiB.
 */
function formatMemory(bytes: number): string {
  const gib = bytes / 1024 ** 3;
  return `${gib.toFixed(1)} GiB`;
}

/**
 * Get the provider display name (capitalized).
 */
function getProviderDisplayName(name: ProviderName): string {
  const displayNames: Record<ProviderName, string> = {
    local: 'Local',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    azure: 'Azure OpenAI',
    foundry: 'Azure AI Foundry',
    gemini: 'Google Gemini',
    github: 'GitHub Models',
  };
  return displayNames[name];
}

/**
 * Get model name for a provider config.
 */
function getModelName(providerName: ProviderName, providerConfig: Record<string, unknown>): string {
  if (providerName === 'azure') {
    return (providerConfig.deployment as string) || 'default';
  }
  if (providerName === 'foundry') {
    const mode = providerConfig.mode as string;
    if (mode === 'local') {
      return (providerConfig.modelAlias as string) || 'default';
    }
    return (providerConfig.modelDeployment as string) || 'default';
  }
  return (providerConfig.model as string) || 'default';
}

/**
 * Get secret/key for a provider config.
 * Returns 'N/A' for providers that don't need API keys (local, Azure CLI auth).
 */
function getProviderSecret(
  providerName: ProviderName,
  providerConfig: Record<string, unknown>
): string | undefined {
  if (providerName === 'local') {
    return 'N/A';
  }
  if (providerName === 'github') {
    return providerConfig.token as string | undefined;
  }
  // Azure and Foundry can use Azure CLI authentication (no API key needed)
  if (providerName === 'azure') {
    const apiKey = providerConfig.apiKey as string | undefined;
    if (apiKey === undefined || apiKey === '') {
      // Azure CLI auth - no API key needed if endpoint is configured
      const endpoint = providerConfig.endpoint as string | undefined;
      if (endpoint !== undefined && endpoint !== '') {
        return 'N/A'; // Azure CLI auth
      }
    }
    return apiKey;
  }
  if (providerName === 'foundry') {
    const apiKey = providerConfig.apiKey as string | undefined;
    if (apiKey === undefined || apiKey === '') {
      // Foundry cloud uses Azure CLI auth, local mode needs no auth
      const mode = providerConfig.mode as string | undefined;
      if (mode === 'local') {
        return 'N/A';
      }
      const projectEndpoint = providerConfig.projectEndpoint as string | undefined;
      if (projectEndpoint !== undefined && projectEndpoint !== '') {
        return 'N/A'; // Azure CLI auth
      }
    }
    return apiKey;
  }
  return providerConfig.apiKey as string | undefined;
}

/**
 * Get Docker Model Runner models via HTTP API.
 * Queries http://localhost:12434/engines/llama.cpp/v1/models
 * Returns empty array if Model Runner isn't running or no models available.
 */
async function getDockerModels(): Promise<DockerModel[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 2000);

    const response = await fetch('http://localhost:12434/engines/llama.cpp/v1/models', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = (await response.json()) as { data?: Array<{ id?: string }> };
      const models: DockerModel[] = [];
      for (const model of data.data ?? []) {
        if (model.id !== undefined && model.id !== '') {
          models.push({ name: model.id });
        }
      }
      return models;
    }
    return [];
  } catch {
    // Model Runner not running or not responding
    return [];
  }
}

/**
 * Get Docker info (version, CPUs, memory).
 * Times out after 3 seconds if Docker is unresponsive.
 */
async function getDockerInfo(spawn: typeof import('node:child_process').spawn): Promise<{
  running: boolean;
  version?: string;
  cpus?: number;
  memoryBytes?: number;
}> {
  return new Promise((resolve) => {
    try {
      const proc = spawn('docker', [
        'info',
        '--format',
        '{{.ServerVersion}}|{{.NCPU}}|{{.MemTotal}}',
      ]);
      let output = '';
      let resolved = false;

      // Timeout after 3 seconds
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill();
          resolve({ running: false });
        }
      }, 3000);

      proc.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.on('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ running: false });
        }
      });

      proc.on('close', (code: number | null) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          if (code === 0 && output.trim()) {
            const parts = output.trim().split('|');
            const version = parts[0];
            const cpus = parts[1] !== undefined ? parseInt(parts[1], 10) : undefined;
            const memoryBytes = parts[2] !== undefined ? parseInt(parts[2], 10) : undefined;

            resolve({
              running: true,
              version,
              cpus: cpus !== undefined && !isNaN(cpus) ? cpus : undefined,
              memoryBytes:
                memoryBytes !== undefined && !isNaN(memoryBytes) ? memoryBytes : undefined,
            });
          } else {
            resolve({ running: false });
          }
        }
      });
    } catch {
      resolve({ running: false });
    }
  });
}

/**
 * Check Docker status asynchronously using child_process.
 * Queries Docker for version, allocated CPUs, memory, and available models.
 */
async function getDockerStatus(): Promise<DockerStatus> {
  const { spawn } = await import('node:child_process');

  const info = await getDockerInfo(spawn);

  if (!info.running) {
    return { running: false };
  }

  // Fetch Docker Model Runner models via HTTP API
  const models = await getDockerModels();

  return {
    running: true,
    version: info.version,
    cpus: info.cpus,
    memoryBytes: info.memoryBytes,
    models,
  };
}

/**
 * Build the System section.
 * System info uses 'info' status (cyan) for neutral informational items.
 */
function buildSystemSection(config: AppConfig): HealthSection {
  return {
    name: 'System',
    items: [
      { label: `Node.js ${process.version}`, value: '', status: 'info' },
      { label: `Platform: ${process.platform} (${process.arch})`, value: '', status: 'info' },
      { label: `Data: ${config.agent.dataDir}`, value: '', status: 'info' },
    ],
  };
}

/**
 * Build the Agent section.
 * Agent config uses 'ok' status (green) for configured items.
 */
function buildAgentSection(config: AppConfig): HealthSection {
  const systemPromptFile = config.agent.systemPromptFile;
  let promptDisplay = 'Default';
  if (systemPromptFile !== undefined && systemPromptFile !== '') {
    const filename = systemPromptFile.split('/').pop();
    promptDisplay = '~/' + (filename ?? 'system.md');
  }
  return {
    name: 'Agent',
    items: [
      { label: `Version: ${VERSION}`, value: '', status: 'ok' },
      { label: `Log Level: ${config.agent.logLevel.toUpperCase()}`, value: '', status: 'ok' },
      { label: `System Prompt: ${promptDisplay}`, value: '', status: 'ok' },
    ],
  };
}

/**
 * Build the Memory section.
 * Shows 'warning' (yellow) if disabled, 'ok' (green) if enabled.
 */
function buildMemorySection(config: AppConfig): HealthSection {
  const isEnabled = config.memory.enabled;
  const backend = isEnabled ? config.memory.type : 'disabled';
  return {
    name: 'Memory',
    items: [{ label: `Backend: ${backend}`, value: '', status: isEnabled ? 'ok' : 'warning' }],
  };
}

/**
 * Build the Docker section.
 * Shows 'ok' (green) if running, 'warning' (yellow) if not running.
 * Displays Docker's allocated resources (CPUs and memory), not system totals.
 * Also shows available Docker models if any.
 */
function buildDockerSection(dockerStatus: DockerStatus): HealthSection {
  if (dockerStatus.running) {
    const version = dockerStatus.version ?? 'unknown';
    const cpuCount = dockerStatus.cpus !== undefined ? String(dockerStatus.cpus) : 'unknown';
    const totalMemory =
      dockerStatus.memoryBytes !== undefined ? formatMemory(dockerStatus.memoryBytes) : 'unknown';

    const items: SectionItem[] = [
      {
        label: `Running (${version}) · ${cpuCount} allocated cores, ${totalMemory} allocated`,
        value: '',
        status: 'ok',
      },
    ];

    // Add Docker Model Runner models if available
    if (dockerStatus.models !== undefined && dockerStatus.models.length > 0) {
      for (const model of dockerStatus.models) {
        items.push({
          label: model.name,
          value: '',
          status: 'ok',
          isSubItem: true,
        });
      }
    }

    return {
      name: 'Docker',
      items,
    };
  }

  return {
    name: 'Docker',
    items: [{ label: 'Not Running', value: '', status: 'warning' }],
  };
}

/**
 * Check if a provider has meaningful configuration beyond schema defaults.
 * A provider is "configured" if it has credentials or explicitly set values.
 */
function isProviderConfigured(
  providerName: ProviderName,
  providerConfig: Record<string, unknown> | undefined
): boolean {
  if (providerConfig === undefined) return false;

  switch (providerName) {
    case 'openai':
      // OpenAI needs an API key or custom baseUrl
      return (
        (typeof providerConfig.apiKey === 'string' && providerConfig.apiKey !== '') ||
        (typeof providerConfig.baseUrl === 'string' && providerConfig.baseUrl !== '')
      );

    case 'anthropic':
      // Anthropic needs an API key
      return typeof providerConfig.apiKey === 'string' && providerConfig.apiKey !== '';

    case 'azure':
      // Azure needs endpoint and deployment
      return (
        typeof providerConfig.endpoint === 'string' &&
        providerConfig.endpoint !== '' &&
        typeof providerConfig.deployment === 'string' &&
        providerConfig.deployment !== ''
      );

    case 'foundry':
      // Foundry cloud needs projectEndpoint, local mode is always available
      if (providerConfig.mode === 'local') {
        return true; // Local mode doesn't need credentials
      }
      return (
        typeof providerConfig.projectEndpoint === 'string' && providerConfig.projectEndpoint !== ''
      );

    case 'gemini':
      // Gemini needs an API key
      return typeof providerConfig.apiKey === 'string' && providerConfig.apiKey !== '';

    case 'github':
      // GitHub needs a token
      return typeof providerConfig.token === 'string' && providerConfig.token !== '';

    case 'local':
      // Local provider is configured if baseUrl is set
      return typeof providerConfig.baseUrl === 'string' && providerConfig.baseUrl !== '';

    default:
      return false;
  }
}

/**
 * Build the LLM Providers section.
 * Shows 'ok' (green) if API key configured, 'warning' (yellow) if not configured.
 *
 * @param config - Full config with env vars merged (for display values like API keys)
 * @param fileConfig - Config from files only (to determine which providers are explicitly configured)
 */
function buildProvidersSection(config: AppConfig, fileConfig: AppConfig): HealthSection {
  const defaultProvider = config.providers.default;
  const items: SectionItem[] = [];

  for (const providerName of PROVIDER_NAMES) {
    // Check if provider is explicitly configured in file-based config (not env vars)
    const fileProviderConfig = fileConfig.providers[providerName] as
      | Record<string, unknown>
      | undefined;
    if (!isProviderConfigured(providerName, fileProviderConfig)) continue;

    // Use full config (with env vars) for display values
    const providerConfig = config.providers[providerName] as Record<string, unknown> | undefined;

    const displayName = getProviderDisplayName(providerName);
    const modelName = getModelName(providerName, providerConfig ?? {});
    const secret = getProviderSecret(providerName, providerConfig ?? {});
    const hasSecret = secret !== undefined && secret !== '' && secret !== 'N/A';
    const isFoundryLocal = providerName === 'foundry' && providerConfig?.mode === 'local';

    // Build masked secret display - special handling for local providers
    let maskedSecret = '';
    if (providerName === 'local') {
      maskedSecret = ''; // Local provider shows no secret info
    } else if (isFoundryLocal) {
      maskedSecret = ' · Local SDK'; // Foundry local mode uses foundry-local-sdk
    } else {
      maskedSecret = ` · ${maskSecret(secret)}`;
    }

    // Determine status: ok if has credentials or doesn't need them (local, foundry local mode)
    const status: ItemStatus =
      hasSecret || providerName === 'local' || isFoundryLocal ? 'ok' : 'warning';

    items.push({
      label: `${displayName} (${modelName})`,
      value: maskedSecret,
      status,
      isDefault: providerName === defaultProvider,
    });
  }

  // If no providers configured, show an error
  if (items.length === 0) {
    items.push({
      label: 'No providers configured',
      value: '',
      status: 'error',
    });
  }

  return {
    name: 'LLM Providers',
    items,
  };
}

/**
 * HealthCheck component.
 * Shows configuration status, environment, and provider availability in grouped sections.
 */
export function HealthCheck(): React.ReactElement {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<HealthSection[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    async function runChecks(): Promise<void> {
      // Load full config (with env vars) for display values
      const configResult = await loadConfig();

      if (!configResult.success) {
        setConfigError(configResult.message);
        setLoading(false);
        setTimeout(() => {
          exit();
        }, 100);
        return;
      }

      const config = configResult.result as NonNullable<typeof configResult.result>;

      // Load file-only config to determine which providers are explicitly configured
      const fileConfigResult = await loadConfigFromFiles();
      const fileConfig = fileConfigResult.success
        ? (fileConfigResult.result as NonNullable<typeof fileConfigResult.result>)
        : config;

      // Get Docker status
      const dockerStatus = await getDockerStatus();

      // Build all sections
      const allSections: HealthSection[] = [
        buildSystemSection(config),
        buildAgentSection(config),
        buildMemorySection(config),
        buildDockerSection(dockerStatus),
        buildProvidersSection(config, fileConfig),
      ];

      setSections(allSections);
      setLoading(false);

      // Exit after a brief delay to show results
      setTimeout(() => {
        exit();
      }, 100);
    }

    void runChecks();
  }, [exit]);

  if (loading) {
    return <Spinner message="Running health checks..." />;
  }

  if (configError !== null) {
    return (
      <Box flexDirection="column" paddingTop={1}>
        <Text color="red">Configuration Error:</Text>
        <Box paddingLeft={2}>
          <Text color="red">◉</Text>
          <Text> {configError}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      {sections.map((section, sectionIndex) => (
        <Box
          key={section.name}
          flexDirection="column"
          marginBottom={sectionIndex < sections.length - 1 ? 1 : 0}
        >
          {/* Section header */}
          <Text>{section.name}:</Text>

          {/* Section items */}
          {section.items.map((item, itemIndex) => {
            // Determine bullet color based on status
            const bulletColor =
              item.status === 'ok'
                ? 'green'
                : item.status === 'warning'
                  ? 'yellow'
                  : item.status === 'error'
                    ? 'red'
                    : 'cyan'; // info

            // Use smaller dot for sub-items
            const bullet = item.isSubItem === true ? '•' : '◉';

            return (
              <Box key={itemIndex} paddingLeft={2}>
                {/* Show checkmark for default provider */}
                {section.name === 'LLM Providers' && item.isDefault === true ? (
                  <Text color="green">✓ </Text>
                ) : (
                  <Text> </Text>
                )}
                <Text color={bulletColor}>{bullet}</Text>
                <Text> {item.label}</Text>
                {item.value !== '' && <Text dimColor>{item.value}</Text>}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
